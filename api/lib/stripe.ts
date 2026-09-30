// STRIPE, o gateway da Ballad Gift (EUA). Cartão, Apple Pay e Google Pay pelo
// Embedded Checkout: a tela de pagamento do próprio Stripe, dentro da nossa.
//
// Sem SDK de propósito: são três chamadas (criar sessão, ler sessão, conferir
// assinatura), e o SDK traria 1 MB pra dentro de funções que precisam subir
// rápido. A API fala form-urlencoded e isso é uma função de dez linhas.
//
// ── AS MESMAS TRAVAS DO PIX, NA MESMA ORDEM ──────────────────────
//
// O que o checkout transparente da Serenata aprendeu com dinheiro de verdade
// vale igual aqui (ver "Checkout transparente" no CLAUDE.md):
//
//   1. O PREÇO NUNCA VEM DO CLIENTE. Sai do braço de `preco` que a sessão
//      sorteou, lido no servidor, na tabela `experimentos` do banco DESTE
//      deploy (o da Ballad tem a linha em dólar).
//   2. ASSINATURA PROVA ORIGEM, SÓ A RECONSULTA PROVA PAGAMENTO. O webhook
//      confere a assinatura e depois pergunta à API se a sessão está paga.
//   3. IDEMPOTÊNCIA É NOSSA. `pedidos.payment_id = stripe:<sessão>` é único, e
//      a entrega só roda na PRIMEIRA vez que o pedido vira pago.
//   4. UM QUIZ, UMA ENTREGA. Segundo pagamento do mesmo quiz é gravado e
//      avisado ao dono, nunca entregue de novo em silêncio.
//   5. A ENTREGA É A DE `entrega.ts`, não uma cópia.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { musicaDoQuiz, refazerSeFaltou, mandarEmailDeEntrega } from "./entrega.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { avisarDonos } from "../../src/lib/avisar-donos.js";
import { venderNoTiktok } from "./tiktok-eventos.js";
import { creditarUpsell } from "./creditar-upsell.js";

const API = "https://api.stripe.com/v1";

/** Achata um objeto no formato `a[b][0][c]=x` que a API do Stripe exige. */
export function formStripe(obj: Record<string, unknown>, prefixo = ""): URLSearchParams {
  const out = new URLSearchParams();
  const andar = (v: unknown, chave: string) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => andar(item, `${chave}[${i}]`));
    else if (typeof v === "object") {
      for (const [k, sub] of Object.entries(v as Record<string, unknown>)) andar(sub, `${chave}[${k}]`);
    } else out.append(chave, String(v));
  };
  for (const [k, v] of Object.entries(obj)) andar(v, prefixo ? `${prefixo}[${k}]` : k);
  return out;
}

export class ErroStripe extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function stripeApi<T>(
  metodo: "GET" | "POST",
  caminho: string,
  corpo?: Record<string, unknown>,
  opcoes?: { idempotencia?: string },
): Promise<T> {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new ErroStripe("STRIPE_SECRET_KEY ausente", 500);
  const headers: Record<string, string> = { Authorization: `Bearer ${chave}` };
  if (corpo) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (opcoes?.idempotencia) headers["Idempotency-Key"] = opcoes.idempotencia;
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers,
    body: corpo ? formStripe(corpo).toString() : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!r.ok) throw new ErroStripe(j.error?.message ?? `Stripe ${r.status}`, r.status);
  return j;
}

// ── ASSINATURA DO WEBHOOK ─────────────────────────────────────────
//
// Cabeçalho `Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>]`. A assinatura é
// HMAC-SHA256 de `<t>.<corpo cru>` com o segredo do endpoint (whsec_...).
// Tolerância de 5 minutos, igual ao Resend: sem ela, um POST capturado uma
// vez valeria pra sempre. Comparação em tempo constante (CLAUDE.md, 20/08).
export function assinaturaStripeConfere(
  cabecalho: string | null | undefined,
  corpo: string,
  segredo: string,
  agoraSeg = Math.floor(Date.now() / 1000),
): boolean {
  if (!cabecalho || !segredo) return false;
  const partes = cabecalho.split(",").map((p) => p.trim().split("="));
  const t = partes.find(([k]) => k === "t")?.[1];
  const assinaturas = partes.filter(([k]) => k === "v1").map(([, v]) => v).filter(Boolean);
  if (!t || !assinaturas.length) return false;
  const idade = Math.abs(agoraSeg - Number(t));
  if (!Number.isFinite(idade) || idade > 300) return false;
  const esperada = createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex");
  const b = Buffer.from(esperada);
  return assinaturas.some((v) => {
    const a = Buffer.from(v as string);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

// ── A SESSÃO, LIDA NA FONTE ───────────────────────────────────────

export type SessaoStripe = {
  id: string;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  metadata?: Record<string, string> | null;
  payment_intent?:
    | string
    | {
        id: string;
        latest_charge?:
          | string
          | {
              id: string;
              balance_transaction?: { fee?: number; exchange_rate?: number | null; currency?: string } | string | null;
            }
          | null;
      }
    | null;
};

export async function lerSessao(id: string): Promise<SessaoStripe> {
  return stripeApi<SessaoStripe>(
    "GET",
    `/checkout/sessions/${encodeURIComponent(id)}?expand[]=payment_intent.latest_charge.balance_transaction`,
  );
}

/**
 * A taxa do Stripe em CENTAVOS DE DÓLAR, na moeda da venda.
 *
 * O Stripe da conta liquida em real, então a `balance_transaction` vem em BRL
 * com o câmbio do dia. `valor_centavos` do pedido é em dólar; guardar a taxa
 * em real na coluna do lado faria o painel subtrair real de dólar.
 */
function taxaEmCentavosDaVenda(s: SessaoStripe): number | null {
  const pi = typeof s.payment_intent === "object" ? s.payment_intent : null;
  const ch = pi && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const bt = ch && typeof ch.balance_transaction === "object" ? ch.balance_transaction : null;
  if (!bt || typeof bt.fee !== "number") return null;
  if (bt.currency && s.currency && bt.currency === s.currency) return bt.fee;
  const cambio = Number(bt.exchange_rate);
  return cambio > 0 ? Math.round(bt.fee / cambio) : null;
}

async function alertarDono(assunto: string, html: string) {
  // Passa pelo `avisarDonos`, que manda por e-mail E WhatsApp. Este helper
  // nasceu mandando só e-mail, e o guard de `avisar-donos.test.ts` o pegou no
  // rebase — que é exatamente o caso que o teste existe pra pegar: alerta novo
  // que chega na caixa e não no celular, sem nada acender.
  //
  // O prefixo da MARCA fica: com Serenata e Ballad no mesmo código, "PAROU:
  // sem crédito" sem dizer de quem é manda o dono procurar no lugar errado.
  await avisarDonos({ assunto: `[${MARCA_ATIVA.nome}] ${assunto}`, html });
}

export type ResultadoConfirmacao =
  | { ok: true; entregue: boolean; duplicado?: boolean; quizId: string }
  | { ok: false; motivo: "nao-pago" | "sem-pedido" | "valor-diferente" | "erro"; detalhe?: string };

/**
 * CONFIRMA UMA SESSÃO E ENTREGA, uma vez só.
 *
 * Chamada pelo webhook E pela `/obrigado` (quem volta do pagamento antes do
 * webhook chegar). As duas portas convergem aqui, e a idempotência está no
 * banco, não em quem chama: a entrega só roda na chamada que VIROU o pedido
 * de pendente pra pago.
 */
export async function confirmarSessaoStripe(
  sb: SupabaseClient,
  sessaoId: string,
): Promise<ResultadoConfirmacao> {
  const s = await lerSessao(sessaoId);
  if (s.payment_status !== "paid") return { ok: false, motivo: "nao-pago" };

  const paymentId = `stripe:${s.id}`;
  const { data: pedido } = await sb
    .from("pedidos")
    .select("id, status, valor_centavos, quiz_response_id, musica_id, email")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (!pedido) {
    // Pedido nasce na criação da sessão. Sem ele, não se adivinha de quem é
    // (CLAUDE.md: "falhe alto, não adivinhe").
    await alertarDono(
      "Pagamento Stripe sem pedido",
      `<p>Sessão <code>${s.id}</code> paga (${s.amount_total} ${s.currency}) e sem linha em <code>pedidos</code>. Nada foi entregue.</p>`,
    );
    return { ok: false, motivo: "sem-pedido" };
  }
  // UPSELL (o vídeo, vendido no editor): outro caminho de liberação, o mesmo
  // `creditarUpsell` do PIX da Serenata. Sai antes do resto porque o pedido de
  // upsell não tem quiz, e tudo abaixo é a entrega da música.
  if (s.metadata?.tipo === "upsell") return confirmarUpsellStripe(sb, s, pedido);

  const quizId = String(pedido.quiz_response_id);
  if (pedido.status === "pago") return { ok: true, entregue: false, duplicado: true, quizId };

  if (s.amount_total !== pedido.valor_centavos) {
    await alertarDono(
      "Valor pago diferente do pedido (Stripe)",
      `<p>Sessão <code>${s.id}</code>: pago ${s.amount_total}, pedido ${pedido.valor_centavos}. Entrega retida.</p>`,
    );
    return { ok: false, motivo: "valor-diferente" };
  }

  // Um quiz já pago por OUTRA sessão: registra e avisa, não entrega de novo.
  const { data: outroPago } = await sb
    .from("pedidos")
    .select("id, payment_id")
    .eq("quiz_response_id", quizId)
    .eq("status", "pago")
    .neq("payment_id", paymentId)
    .limit(1);

  const email =
    String(pedido.email ?? "").trim() || String(s.customer_details?.email ?? "").trim() || null;

  // A TRAVA: só uma chamada vira o pedido de pendente pra pago. Quem perder a
  // corrida (webhook e /obrigado ao mesmo tempo) vê 0 linhas e não entrega.
  const { data: virou } = await sb
    .from("pedidos")
    .update({
      status: "pago",
      status_gateway: "paid",
      paid_at: new Date().toISOString(),
      taxa_centavos: taxaEmCentavosDaVenda(s),
      email,
      nome_pagador: s.customer_details?.name ?? null,
    })
    .eq("payment_id", paymentId)
    .eq("status", "pendente")
    .select("id");
  if (!virou?.length) return { ok: true, entregue: false, duplicado: true, quizId };

  if (outroPago?.length) {
    await alertarDono(
      "Segundo pagamento do mesmo quiz (Stripe)",
      `<p>Quiz <code>${quizId}</code> já estava pago por <code>${outroPago[0].payment_id}</code> e foi pago de novo pela sessão <code>${s.id}</code>. NÃO reentregue; avalie reembolso no painel do Stripe.</p>`,
    );
    return { ok: true, entregue: false, quizId };
  }

  const musica = await musicaDoQuiz(sb, quizId);
  if (!musica) {
    await alertarDono(
      "Pago sem música (Stripe)",
      `<p>Quiz <code>${quizId}</code> pago pela sessão <code>${s.id}</code> e sem música no banco.</p>`,
    );
    return { ok: true, entregue: false, quizId };
  }
  await sb.from("pedidos").update({ musica_id: musica.id }).eq("payment_id", paymentId);
  await refazerSeFaltou(sb, musica);
  if (email) {
    const r = await mandarEmailDeEntrega(sb, { email, musica, nomePagador: s.customer_details?.name });
    if (!r.ok) console.error("[stripe] e-mail de entrega falhou:", r.erro);
  }

  // A VENDA PRO TIKTOK, pelo servidor. Mesma régua da Serenata: SÓ com
  // `ttclid` (venda de outro canal mandada pro TikTok inflava o painel dele,
  // ver a memória do gate por ttclid). `eventId` = id da sessão do Stripe, o
  // MESMO que o pixel usa na /obrigado: os dois se deduplicam. Nunca joga.
  const { data: q } = await sb.from("quiz_responses").select("attribution").eq("id", quizId).maybeSingle();
  const ttclid = (q?.attribution as { ttclid?: string } | null)?.ttclid;
  if (ttclid) {
    const t = await venderNoTiktok({
      eventId: s.id,
      valor: (s.amount_total ?? 0) / 100,
      moeda: "USD",
      email,
      ttclid,
    });
    await sb.from("funnel_events").insert({ event_name: "tiktok_venda_servidor", event_data: { sessao: s.id, ...t } });
  }
  return { ok: true, entregue: true, quizId };
}

/**
 * UPSELL PAGO PELO STRIPE (o vídeo, vendido no editor da Ballad).
 *
 * Mesma forma da entrega da música: confere valor, vira o pedido de pendente
 * pra pago numa escrita condicional (quem não virou não libera), e só então
 * libera pelo `creditarUpsell`, o mesmo módulo do PIX da Serenata. O índice
 * único de `videos` segura o reenvio do webhook.
 */
async function confirmarUpsellStripe(
  sb: SupabaseClient,
  s: SessaoStripe,
  pedido: { id: string; status: string | null; valor_centavos: number | null; email: string | null },
): Promise<ResultadoConfirmacao> {
  if (pedido.status === "pago") return { ok: true, entregue: false, duplicado: true, quizId: "" };
  if (s.amount_total !== pedido.valor_centavos) {
    await alertarDono(
      "Valor pago diferente do pedido (Stripe, upsell)",
      `<p>Sessão <code>${s.id}</code>: pago ${s.amount_total}, pedido ${pedido.valor_centavos}. Vídeo NÃO liberado.</p>`,
    );
    return { ok: false, motivo: "valor-diferente" };
  }
  const email =
    String(pedido.email ?? "").trim() || String(s.customer_details?.email ?? "").trim() || null;
  const { data: virou } = await sb
    .from("pedidos")
    .update({
      status: "pago",
      status_gateway: "paid",
      paid_at: new Date().toISOString(),
      taxa_centavos: taxaEmCentavosDaVenda(s),
      email,
      nome_pagador: s.customer_details?.name ?? null,
    })
    .eq("id", pedido.id)
    .eq("status", "pendente")
    .select("id");
  if (!virou?.length) return { ok: true, entregue: false, duplicado: true, quizId: "" };

  const oferta = s.metadata?.oferta;
  if (oferta !== "video" || !email) {
    await alertarDono(
      "Upsell pago sem o que liberar (Stripe)",
      `<p>Sessão <code>${s.id}</code> paga, oferta <code>${oferta ?? "?"}</code>, e-mail ${email ? "ok" : "ausente"}. Liberar à mão.</p>`,
    );
    return { ok: true, entregue: false, quizId: "" };
  }
  const r = await creditarUpsell(sb, {
    oferta: { id: "video", creditos: 0 },
    email,
    pedidoId: pedido.id,
    nota: { gateway: "stripe", sessao: s.id },
  });
  if (r.erro || !r.video) {
    await alertarDono(
      "Vídeo pago e NÃO liberado (Stripe)",
      `<p>Sessão <code>${s.id}</code>, pedido <code>${pedido.id}</code>: ${r.erro ?? "linha do vídeo não criada"}.</p>`,
    );
  }
  await sb.from("funnel_events").insert({
    event_name: "stripe_video_pago",
    session_id: "sistema",
    event_data: { sessao: s.id, pedido: pedido.id, video: r.video, erro: r.erro },
  });
  return { ok: true, entregue: r.video, quizId: "" };
}
