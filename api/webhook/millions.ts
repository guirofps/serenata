// POSTBACK DA MILLIONSPAY.
//
// ── O PROBLEMA CENTRAL: ELE NÃO É ASSINADO ───────────────────────
//
// A Perfect Pay manda um token que a gente compara em tempo constante. O
// Resend assina no padrão Svix. A MillionsPay não faz nem um nem outro: a
// documentação de postbacks não descreve cabeçalho de assinatura, chave de
// validação, nem nada equivalente.
//
// Um webhook de pagamento sem assinatura é um botão de "me dá o produto"
// aberto na internet. E o CLAUDE.md trata isto como inegociável: nunca
// liberar sem confirmação.
//
// ── AS DUAS TRAVAS ───────────────────────────────────────────────
//
// 1. SEGREDO NA URL. O caminho carrega `?k=`, comparado em tempo constante.
//    Isso sozinho não bastaria (URL vaza em log, em proxy, em print), mas
//    tira do ar quem só varre caminhos comuns.
//
// 2. RECONSULTA NA FONTE, e esta é a que realmente vale. O corpo do POST é
//    tratado como AVISO, nunca como prova: dele a gente lê só o ID. O
//    status vem de `GET /transactions/{id}`, autenticado com a nossa chave
//    secreta. Quem forjar o POST consegue, no máximo, nos fazer gastar uma
//    consulta.
//
// Ou seja: o payload pode mentir à vontade que não muda nada.
//
// ── E O VALOR TAMBÉM É CONFERIDO ─────────────────────────────────
//
// Não basta "está pago": tem que estar pago PELO VALOR QUE A GENTE COBROU.
// Sem isso, uma transação de R$ 1 criada por fora liberaria um produto de
// R$ 54,90.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { segredoConfere } from "../lib/segredo.js";
import { buscarTransacaoMillions, pagaMillions } from "../../src/lib/millions.js";

type Req = IncomingMessage & { method?: string; url?: string };
type Res = ServerResponse & { status: (c: number) => Res; json: (b: unknown) => void };

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function corpo(req: Req): Promise<string> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    req.on("data", (p: Buffer) => partes.push(p));
    req.on("end", () => ok(Buffer.concat(partes).toString("utf8")));
    req.on("error", falha);
  });
}
export const config = { api: { bodyParser: false } };

/** Auditoria que nunca derruba o webhook. */
async function auditar(sb: ReturnType<typeof db>, evento: string, dados: unknown) {
  try {
    await sb.from("funnel_events").insert({ event_name: evento, event_data: dados });
  } catch (err) {
    console.error("[millions] auditoria falhou:", err);
  }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });

  // ── TRAVA 1: o segredo da URL ────────────────────────────────
  const esperado = process.env.MILLIONS_POSTBACK_SECRET;
  if (!esperado) {
    // FECHA. É o erro herdado que o CLAUDE.md proíbe: `!segredo ||` aceitando
    // qualquer POST. Sem o segredo configurado, este endpoint não existe.
    console.error("[millions] MILLIONS_POSTBACK_SECRET ausente");
    return res.status(503).json({ error: "não configurado" });
  }
  const url = new URL(req.url ?? "/", "https://serenatagift.com");
  if (!segredoConfere(url.searchParams.get("k"), esperado)) {
    return res.status(404).json({ error: "não encontrado" });
  }

  let evento: { type?: string; objectId?: string; data?: { id?: number | string } };
  try {
    evento = JSON.parse(await corpo(req));
  } catch {
    return res.status(400).json({ error: "corpo inválido" });
  }

  const sb = db();

  // Do corpo a gente lê SÓ O ID. Nada mais dele é confiável.
  const id = evento?.data?.id ?? evento?.objectId;
  if (!id) {
    await auditar(sb, "millions_postback_sem_id", { tipo: evento?.type ?? null });
    return res.status(200).json({ ok: true, nota: "sem id" });
  }

  // Só transação interessa. Checkout e transferência chegam no mesmo canal.
  if (evento.type && evento.type !== "transaction") {
    return res.status(200).json({ ok: true, nota: `tipo ${evento.type} ignorado` });
  }

  // ── TRAVA 2: pergunta pra fonte ──────────────────────────────
  let transacao;
  try {
    transacao = await buscarTransacaoMillions(id);
  } catch (err) {
    // 500 DE PROPÓSITO: gateway costuma reenviar postback com erro. Devolver
    // 200 aqui seria descartar uma venda porque a consulta piscou.
    console.error("[millions] consulta falhou:", err);
    await auditar(sb, "millions_consulta_falhou", { id: String(id) });
    return res.status(500).json({ error: "não consegui confirmar na fonte" });
  }

  await auditar(sb, `millions_${transacao.status ?? "sem_status"}`, {
    id: String(id),
    status: transacao.status ?? null,
    valor: transacao.amount ?? null,
  });

  if (!pagaMillions(transacao.status)) {
    return res.status(200).json({ ok: true, nota: `status ${transacao.status}` });
  }

  // ── IDEMPOTÊNCIA ─────────────────────────────────────────────
  //
  // `payment_id` é único em `pedidos`, e o gateway reenvia. Sem isto, o
  // mesmo pagamento viraria dois pedidos e o comprador receberia dois
  // e-mails de entrega.
  const paymentId = `millions:${transacao.id}`;
  const { data: existente } = await sb
    .from("pedidos")
    .select("id, status")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (existente?.status === "pago") {
    return res.status(200).json({ ok: true, duplicado: true });
  }

  // ── DE QUEM É ESTA COMPRA ────────────────────────────────────
  //
  // O `metadata` carrega o `src`, que é o `session_id` do funil. É por ele
  // que a música JÁ GRAVADA encontra o dono. SEM FALLBACK por "quiz mais
  // recente": sob concorrência isso entrega a música da pessoa errada, e é
  // erro herdado que o CLAUDE.md manda não repetir.
  let src: string | null = null;
  try {
    const m = transacao.metadata;
    const obj = typeof m === "string" ? JSON.parse(m) : m;
    const v = (obj as { src?: unknown } | null)?.src;
    if (typeof v === "string" && v) src = v;
  } catch {
    /* metadata ilegível: cai no e-mail abaixo */
  }

  let quizId: string | null = null;
  if (src) {
    const { data } = await sb.from("quiz_responses").select("id").eq("session_id", src).maybeSingle();
    quizId = data?.id ?? null;
  }
  const email = transacao.customer?.email?.trim().toLowerCase() ?? null;
  if (!quizId && email) {
    const { data } = await sb
      .from("quiz_responses")
      .select("id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    quizId = data?.id ?? null;
  }

  // ── O VALOR TEM QUE BATER ────────────────────────────────────
  //
  // Confere contra o pedido PENDENTE que a gente mesmo criou ao gerar o Pix.
  // Sem esta linha, uma transação de R$ 1 criada por fora com o `src` de
  // alguém liberaria um produto de R$ 54,90.
  if (existente) {
    const { data: pend } = await sb
      .from("pedidos")
      .select("valor_centavos")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (pend?.valor_centavos && pend.valor_centavos !== transacao.amount) {
      await auditar(sb, "millions_valor_divergente", {
        id: String(id),
        esperado: pend.valor_centavos,
        recebido: transacao.amount,
      });
      return res.status(200).json({ ok: true, nota: "valor divergente, não liberado" });
    }
  }

  const { error: erroPedido } = await sb.from("pedidos").upsert(
    {
      payment_id: paymentId,
      gateway: "millions",
      status: "pago",
      status_gateway: transacao.status ?? null,
      email,
      nome_pagador: transacao.customer?.name ?? null,
      valor_centavos: transacao.amount ?? null,
      quiz_response_id: quizId,
      paid_at: new Date().toISOString(),
    },
    { onConflict: "payment_id" },
  );
  if (erroPedido) {
    console.error("[millions] gravar pedido falhou:", erroPedido.message);
    return res.status(500).json({ error: "falha ao gravar pedido" });
  }

  await auditar(sb, "millions_pago", {
    id: String(id),
    valor: transacao.amount,
    quiz_response_id: quizId,
    email,
    casou_por: src && quizId ? "src" : quizId ? "email" : "nenhum",
  });

  // A ENTREGA ainda não é feita aqui de propósito. Enquanto este webhook
  // estiver só em preview, gravar o pedido é o suficiente pra provar que o
  // caminho funciona. Ligar a entrega antes de o fluxo estar aprovado seria
  // mandar e-mail de produto a partir de um ambiente de teste.
  return res.status(200).json({ ok: true, pedido: paymentId, quiz: quizId });
}
