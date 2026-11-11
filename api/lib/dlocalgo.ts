// DLOCAL GO, o OXXO e a transferência (SPEI) do México na Ballad (23/10).
//
// O cartão continua no Stripe. A dLocal Go entra só pra quem está no México e
// não quer (ou não pode) pagar com cartão: o mexicano compra no OXXO, em
// dinheiro, e a conta do Stripe é brasileira, sem OXXO. Primeira prova disso no
// suporte de 23/10: "no me gusta pagar con tarjetas, ¿tendrás opción de OXXO?".
//
// Sem SDK, como o Stripe: são três chamadas (criar, ler, conferir assinatura).
// A conta liquida em REAL e cobra 2,99% + US$ 0,20 (dono, 23/10).
//
// ── AS MESMAS TRAVAS DO STRIPE E DO PIX ──────────────────────────
//
//   1. O PREÇO NUNCA VEM DO CLIENTE (`dlocalgo-checkout.ts`).
//   2. ASSINATURA PROVA ORIGEM, SÓ A RECONSULTA PROVA PAGAMENTO. O aviso deles
//      traz só o id (`{"payment_id": ...}`); quem diz se pagou é o GET.
//   3. IDEMPOTÊNCIA É NOSSA: `pedidos.payment_id = dlocalgo:<id>` é único, e a
//      entrega só roda na chamada que VIROU o pedido de pendente pra pago.
//   4. UM QUIZ, UMA ENTREGA. Segundo pagamento do mesmo quiz é avisado.
//   5. A ENTREGA É A DE `entrega.ts`, não uma cópia.
//
// OXXO é ASSÍNCRONO: a pessoa gera a ficha e paga na loja horas depois. A
// música já existe (regra de ouro), então ela recebe no instante em que o
// aviso chega. O aviso tenta de novo a cada 10 min por 30 dias se a gente
// não responder 200.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { musicaDoQuiz, refazerSeFaltou, mandarEmailDeEntrega } from "./entrega.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { avisarDonos } from "../../src/lib/avisar-donos.js";
import { venderNoTiktok } from "./tiktok-eventos.js";
import { ttclidDaVenda } from "../../src/lib/clique-recente.js";
import { mercadoDaMoeda, unidadeMenorDe, valorPagoConfere } from "../../src/lib/mercados.js";
import { creditarUpsell } from "./creditar-upsell.js";
import { OFERTAS } from "../../src/lib/creditos.js";
import { lerOrderIdUpsell } from "../../src/lib/upsell-dlocal.js";
import { Resend } from "resend";
import { comUtm } from "../../src/lib/utm-email.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { assuntoCreditoParado, emailCreditoParado, textoCreditoParado } from "../../emails/credito-parado.js";

const API = "https://api.dlocalgo.com/v1";

export class ErroDlocal extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// ── DUAS CONTAS (11/11) ───────────────────────────────────────────
//
// A conta nova (CNPJ novo) está em DLOCALGO_API_KEY/SECRET_KEY: é nela que nasce
// toda cobrança. A antiga fica em DLOCALGO_API_KEY_ANTIGA/SECRET_KEY_ANTIGA
// enquanto houver ficha dela viva (OXXO, transferência, PagoEfectivo, Efecty,
// PSE... valem 3 dias, e no México ~30 por semana pagam 6h+ depois de gerar).
// O aviso de pagamento vem assinado pela conta que criou a cobrança, e só ela
// sabe responder o GET do pagamento: sem a antiga aqui, quem pagou uma ficha
// velha depois da troca ficaria sem a música. Tirar a antiga só depois que não
// houver mais pedido `dlocalgo` pendente e válido criado antes da troca.

export type ContaDlocal = { nome: "nova" | "antiga"; chave: string; segredo: string };

export function contasDlocal(env: Record<string, string | undefined> = process.env): ContaDlocal[] {
  const contas: ContaDlocal[] = [];
  if (env.DLOCALGO_API_KEY && env.DLOCALGO_SECRET_KEY) contas.push({ nome: "nova", chave: env.DLOCALGO_API_KEY, segredo: env.DLOCALGO_SECRET_KEY });
  if (env.DLOCALGO_API_KEY_ANTIGA && env.DLOCALGO_SECRET_KEY_ANTIGA) contas.push({ nome: "antiga", chave: env.DLOCALGO_API_KEY_ANTIGA, segredo: env.DLOCALGO_SECRET_KEY_ANTIGA });
  return contas;
}

export function dlocalConfigurado(): boolean {
  return contasDlocal().some((c) => c.nome === "nova");
}

/** Chama a API na conta indicada; sem conta, na NOVA (onde a cobrança nasce). */
export async function dlocalApi<T>(metodo: "GET" | "POST", caminho: string, corpo?: unknown, conta?: ContaDlocal): Promise<T> {
  const c = conta ?? contasDlocal().find((x) => x.nome === "nova");
  if (!c) throw new ErroDlocal("DLOCALGO_API_KEY/SECRET ausente", 500);
  const { chave, segredo } = c;
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${chave}:${segredo}`,
      Accept: "application/json",
      ...(corpo ? { "Content-Type": "application/json" } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as { message?: string } & T;
  if (!r.ok) throw new ErroDlocal(j.message ?? `dLocal Go ${r.status}`, r.status);
  return j;
}

// ── ASSINATURA DO AVISO ───────────────────────────────────────────
//
// Cabeçalho `Authorization: V2-HMAC-SHA256, Signature: <hex>`, com
// HMAC-SHA256(secretKey, apiKey + corpo cru). Comparação em tempo constante
// (CLAUDE.md, 20/08). Sem chave configurada, recusa: nunca fail-open.
export function assinaturaDlocalConfere(
  cabecalho: string | null | undefined,
  corpo: string,
  apiKey: string | undefined,
  secretKey: string | undefined,
): boolean {
  if (!cabecalho || !apiKey || !secretKey) return false;
  const m = /Signature:\s*([0-9a-fA-F]+)/.exec(cabecalho);
  if (!m) return false;
  const esperada = Buffer.from(createHmac("sha256", secretKey).update(apiKey + corpo).digest("hex"));
  const veio = Buffer.from(m[1].toLowerCase());
  return veio.length === esperada.length && timingSafeEqual(veio, esperada);
}

/** A conta que assinou o aviso (nova ou antiga), ou null se nenhuma confere. */
export function contaDaAssinatura(cabecalho: string | null | undefined, corpo: string, contas: ContaDlocal[] = contasDlocal()): ContaDlocal | null {
  return contas.find((c) => assinaturaDlocalConfere(cabecalho, corpo, c.chave, c.segredo)) ?? null;
}

// ── O PAGAMENTO, LIDO NA FONTE ────────────────────────────────────

export type PagamentoDlocal = {
  id: string;
  amount: number;
  currency: string;
  country?: string;
  status: "PENDING" | "PAID" | "REJECTED" | "CANCELLED" | "EXPIRED" | string;
  status_detail?: string | null;
  order_id?: string;
  payment_method_type?: string | null;
  payer?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
};

/**
 * Lê o pagamento na conta que o criou: tenta a nova e, se ela disser que não
 * existe (404), a antiga. Qualquer outro erro sobe na hora (nada de adivinhar).
 */
export async function lerPagamentoDlocal(id: string, contas: ContaDlocal[] = contasDlocal()): Promise<PagamentoDlocal> {
  if (!contas.length) throw new ErroDlocal("DLOCALGO_API_KEY/SECRET ausente", 500);
  let ultimo: unknown;
  for (const conta of contas) {
    try {
      return await dlocalApi<PagamentoDlocal>("GET", `/payments/${encodeURIComponent(id)}`, undefined, conta);
    } catch (err) {
      if (!(err instanceof ErroDlocal) || err.status !== 404) throw err;
      ultimo = err;
    }
  }
  throw ultimo;
}

/**
 * O `order_id` que vai na cobrança. A dLocal só aceita `[A-Za-z0-9-_]` (o
 * primeiro formato, `<quiz>:<hora>`, deu 400 em todas as 40 tentativas de
 * 23/10): o quiz, um hífen e a hora em base 36, que muda a cada ficha nova.
 */
export function orderIdDlocal(quizId: string, agora = Date.now()): string {
  return `${quizId}-${agora.toString(36)}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
}

/** Id que a dLocal Go devolve (`DP-123`). Só isso entra numa URL de consulta. */
export function idDlocalValido(id: unknown): id is string {
  return typeof id === "string" && /^[A-Z]{1,4}-[A-Za-z0-9-]{1,40}$/.test(id);
}

/**
 * A taxa em CENTAVOS DE DÓLAR, pela tabela da conta (2,99% + US$ 0,20). A API
 * não devolve a taxa por pagamento; o painel precisa de uma pra o lucro não sair
 * inflado. Se a tabela mudar, muda aqui.
 */
export function taxaDlocalCentavos(valorUsdCentavos: number): number {
  return Math.round(valorUsdCentavos * 0.0299 + 20);
}

export type ResultadoDlocal =
  | { ok: true; entregue: boolean; duplicado?: boolean; quizId: string }
  | { ok: false; motivo: "nao-pago" | "sem-pedido" | "valor-diferente"; status?: string };

/**
 * CONFIRMA UM PAGAMENTO E ENTREGA, uma vez só. Chamada pelo aviso da dLocal e
 * pela folha aberta (que pergunta de tempos em tempos); a trava é o banco.
 */
export async function confirmarPagamentoDlocal(sb: SupabaseClient, id: string): Promise<ResultadoDlocal> {
  const p = await lerPagamentoDlocal(id);
  if (p.status !== "PAID") return { ok: false, motivo: "nao-pago", status: p.status };

  const paymentId = `dlocalgo:${p.id}`;
  const { data: pedido } = await sb
    .from("pedidos")
    .select("id, status, valor_centavos, quiz_response_id, email")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (!pedido) {
    await alertar(
      "Pagamento dLocal sem pedido",
      `<p>Pagamento <code>${p.id}</code> pago (${p.amount} ${p.currency}) e sem linha em <code>pedidos</code>. Nada foi entregue.</p>`,
    );
    return { ok: false, motivo: "sem-pedido" };
  }
  // UPSELL (vídeo e música extra, teste `upsell_dlocal`): o pedido não tem quiz,
  // e tudo abaixo é a entrega da música. O mesmo desvio do Stripe.
  if (!pedido.quiz_response_id) return confirmarUpsellDlocal(sb, p, pedido);

  const quizId = String(pedido.quiz_response_id);
  if (pedido.status === "pago") return { ok: true, entregue: false, duplicado: true, quizId };

  if (!valorDlocalConfere(p, Number(pedido.valor_centavos))) {
    await alertar(
      "Valor pago diferente do pedido (dLocal)",
      `<p>Pagamento <code>${p.id}</code>: pago ${p.amount} ${p.currency}, pedido ${pedido.valor_centavos} usd. Entrega retida.</p>`,
    );
    return { ok: false, motivo: "valor-diferente" };
  }

  const { data: outroPago } = await sb
    .from("pedidos")
    .select("id, payment_id")
    .eq("quiz_response_id", quizId)
    .eq("status", "pago")
    .neq("payment_id", paymentId)
    .limit(1);

  const email = String(pedido.email ?? "").trim() || String(p.payer?.email ?? "").trim() || null;
  const nomePagador = [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ").trim() || null;

  const { data: virou } = await sb
    .from("pedidos")
    .update({
      status: "pago",
      status_gateway: `${p.status}${p.payment_method_type ? `:${p.payment_method_type}` : ""}`,
      paid_at: new Date().toISOString(),
      taxa_centavos: taxaDlocalCentavos(Number(pedido.valor_centavos)),
      email,
      nome_pagador: nomePagador,
    })
    .eq("payment_id", paymentId)
    // `cancelado` é a ficha trocada por outra (`dlocalgo-checkout.ts`): na dLocal
    // ela segue viva, e se foi paga o dinheiro entrou. Só `pendente` aqui devolvia
    // "duplicado": pago, sem entrega e sem aviso.
    .in("status", ["pendente", "cancelado"])
    .select("id");
  if (!virou?.length) return { ok: true, entregue: false, duplicado: true, quizId };

  if (outroPago?.length) {
    await alertar(
      "Segundo pagamento do mesmo quiz (dLocal)",
      `<p>Quiz <code>${quizId}</code> já estava pago por <code>${outroPago[0].payment_id}</code> e foi pago de novo por <code>${p.id}</code>. NÃO reentregue; avalie devolver pelo painel da dLocal Go.</p>`,
    );
    return { ok: true, entregue: false, quizId };
  }

  const musica = await musicaDoQuiz(sb, quizId);
  if (!musica) {
    await alertar("Pago sem música (dLocal)", `<p>Quiz <code>${quizId}</code> pago por <code>${p.id}</code> e sem música no banco.</p>`);
    return { ok: true, entregue: false, quizId };
  }
  await sb.from("pedidos").update({ musica_id: musica.id }).eq("payment_id", paymentId);
  await refazerSeFaltou(sb, musica);
  if (email) {
    const r = await mandarEmailDeEntrega(sb, { email, musica, nomePagador });
    if (!r.ok) console.error("[dlocal] e-mail de entrega falhou:", r.erro);
  }

  // A venda pro TikTok, mesma régua do Stripe: só com `ttclid`, em dólar.
  const { data: q } = await sb.from("quiz_responses").select("attribution").eq("id", quizId).maybeSingle();
  const ttclid = ttclidDaVenda(q?.attribution as Record<string, unknown> | null);
  if (ttclid) {
    const t = await venderNoTiktok({ eventId: p.id, valor: Number(pedido.valor_centavos ?? 0) / 100, moeda: "USD", email, ttclid });
    await sb.from("funnel_events").insert({ event_name: "tiktok_venda_servidor", event_data: { dlocal: p.id, ...t } });
  }
  return { ok: true, entregue: true, quizId };
}

/**
 * O pedido é em dólar; a dLocal cobrou na moeda local, pela MESMA tabela do
 * caixa. A dLocal devolve unidade MAIOR ("199.00"): leva pra unidade menor pelas
 * casas da moeda (29/10), senão um peso chileno, que não tem centavo, chegaria
 * 100 vezes maior e toda venda ficaria retida.
 */
function valorDlocalConfere(p: PagamentoDlocal, valorUsdCentavos: number): boolean {
  const mercado = mercadoDaMoeda(p.currency);
  const pago = mercado ? unidadeMenorDe(mercado, Number(p.amount)) : Math.round(Number(p.amount) * 100);
  return valorPagoConfere(p.currency, pago, valorUsdCentavos);
}

/**
 * UPSELL PAGO PELA dLOCAL (teste `upsell_dlocal`, 01/11).
 *
 * A mesma forma do `confirmarUpsellStripe`: confere valor, vira o pedido de
 * pendente pra pago numa escrita condicional (quem não virou não libera), e só
 * então libera pelo `creditarUpsell`. A oferta sai do CATÁLOGO pelo `order_id`
 * que o nosso servidor gerou e a API deles devolve.
 */
async function confirmarUpsellDlocal(
  sb: SupabaseClient,
  p: PagamentoDlocal,
  pedido: { id: string; status: string | null; valor_centavos: number | null; email: string | null },
): Promise<ResultadoDlocal> {
  if (pedido.status === "pago") return { ok: true, entregue: false, duplicado: true, quizId: "" };
  if (!valorDlocalConfere(p, Number(pedido.valor_centavos))) {
    await alertar(
      "Valor pago diferente do pedido (upsell dLocal)",
      `<p>Pagamento <code>${p.id}</code>: pago ${p.amount} ${p.currency}, pedido ${pedido.valor_centavos} usd. Nada liberado.</p>`,
    );
    return { ok: false, motivo: "valor-diferente" };
  }

  const email = String(pedido.email ?? "").trim() || String(p.payer?.email ?? "").trim() || null;
  const nomePagador = [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ").trim() || null;
  const { data: virou } = await sb
    .from("pedidos")
    .update({
      status: "pago",
      status_gateway: `${p.status}${p.payment_method_type ? `:${p.payment_method_type}` : ""}`,
      paid_at: new Date().toISOString(),
      taxa_centavos: taxaDlocalCentavos(Number(pedido.valor_centavos)),
      email,
      nome_pagador: nomePagador,
    })
    .eq("id", pedido.id)
    // Ficha trocada e paga mesmo assim: igual à música, em `confirmarPagamentoDlocal`.
    .in("status", ["pendente", "cancelado"])
    .select("id");
  if (!virou?.length) return { ok: true, entregue: false, duplicado: true, quizId: "" };

  const lido = lerOrderIdUpsell(p.order_id);
  const oferta = OFERTAS.find((o) => o.id === lido?.oferta);
  if (!oferta || !email) {
    await alertar(
      "Upsell pago sem o que liberar (dLocal)",
      `<p>Pagamento <code>${p.id}</code> pago, order_id <code>${p.order_id ?? "?"}</code>, e-mail ${email ? "ok" : "ausente"}. Liberar à mão.</p>`,
    );
    return { ok: true, entregue: false, quizId: "" };
  }

  // A ficha pode ser paga dias depois: nesse meio-tempo ela pode ter comprado o
  // vídeo no cartão. O dinheiro entrou duas vezes, então avisa em vez de renderizar outro.
  if (oferta.id === "video" && lido) {
    const { data: jaTem } = await sb.from("videos").select("id").eq("musica_id", lido.musicaId).limit(1);
    if (jaTem?.length) {
      await alertar(
        "Vídeo pago duas vezes (dLocal)",
        `<p>Pagamento <code>${p.id}</code> (${p.amount} ${p.currency}) de um vídeo que já existe, música <code>${lido.musicaId}</code>. Nada novo foi gerado; avalie devolver pelo painel da dLocal Go.</p>`,
      );
      return { ok: true, entregue: false, quizId: "" };
    }
  }

  const r = await creditarUpsell(sb, {
    oferta: { id: oferta.id, creditos: oferta.creditos },
    email,
    pedidoId: pedido.id,
    nota: { gateway: "dlocalgo", pagamento: p.id },
  });
  const liberou = oferta.id === "video" ? r.video : r.creditou;
  if (r.erro || !liberou) {
    await alertar(
      oferta.id === "video" ? "Vídeo pago e NÃO liberado (dLocal)" : "Música extra paga e crédito NÃO lançado (dLocal)",
      `<p>Pagamento <code>${p.id}</code>, pedido <code>${pedido.id}</code>: ${r.erro ?? "linha não criada"}.</p>`,
    );
  }
  // A ficha pode ser paga dias depois, com a folha fechada: o vídeo avisa quando
  // fica pronto, e a extra precisa deste aviso. Falha aqui não desfaz nada: o
  // `creditoParado` lembra depois de 48h.
  if (oferta.id === "extra" && r.creditou && lido) {
    await avisarExtraPaga(sb, email, lido.musicaId).catch((err) => console.error("[dlocal] aviso da extra falhou:", err));
  }
  await sb.from("funnel_events").insert({
    event_name: oferta.id === "video" ? "dlocal_video_pago" : "dlocal_extra_pago",
    session_id: "sistema",
    event_data: { pagamento: p.id, pedido: pedido.id, video: r.video, creditou: r.creditou, erro: r.erro },
  });
  return { ok: true, entregue: liberou, quizId: "" };
}

/** "Sua música extra está paga", com o link que já entra com o crédito. */
async function avisarExtraPaga(sb: SupabaseClient, email: string, musicaId: string): Promise<void> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return;
  const { data: m } = await sb.from("musicas").select("token_edicao").eq("id", musicaId).maybeSingle();
  if (!m?.token_edicao) return;
  const site = process.env.VITE_APP_URL?.startsWith("http") ? process.env.VITE_APP_URL : MARCA_ATIVA.url;
  const link = `${site}/credito/${m.token_edicao}`;
  const { data: enviado, error } = await comUtm(new Resend(chave)).emails.send({
    tags: [{ name: "template", value: "credito_pago" }],
    from: MARCA_ATIVA.remetenteTransacional,
    to: [email],
    subject: assuntoCreditoParado("es"),
    html: emailCreditoParado({ link, locale: "es" }),
    text: textoCreditoParado(link, "es"),
  });
  if (error) throw new Error(error.message);
  await registrarEnvio(sb, { emailId: enviado?.id, template: "credito_pago", para: email });
  // Conta como recado de "coisa parada": o `creditoParado` não repete na mesma semana.
  await sb.from("funnel_events").insert({ event_name: "credito_parado_avisado", session_id: "sistema", event_data: { email } });
}

async function alertar(assunto: string, html: string) {
  await avisarDonos({ assunto: `[${MARCA_ATIVA.nome}] ${assunto}`, html });
}
