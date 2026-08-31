// O WEBHOOK DO ASAAS.
//
// ── DUAS COISAS AQUI SÃO DIFERENTES DA WOOVI, E AS DUAS SÃO PIORES ──
//
// 1. NÃO EXISTE ASSINATURA. A Woovi assina cada postback com RSA-SHA256, então
//    lá a assinatura prova ORIGEM e a reconsulta prova PAGAMENTO — duas
//    perguntas diferentes, duas travas. O Asaas manda apenas um token estático
//    num header (`asaas-access-token`), escolhido por nós. Token estático prova
//    muito menos: quem o obtiver forja um postback inteiro.
//
//    Consequência: a RECONSULTA deixa de ser a segunda trava e passa a ser a
//    ÚNICA prova de que o dinheiro entrou. Ela é obrigatória em todo caminho
//    que libera produto. É o mesmo desenho que o CLAUDE.md registra pra
//    MillionsPay, e pelo mesmo motivo.
//
// 2. A FILA DELES PARA. Documentação do Asaas: após 15 falhas consecutivas a
//    fila do webhook pode ser interrompida, e evento parado há mais de 14 dias
//    é APAGADO em definitivo. A Woovi não tem isso.
//
//    Consequência: este arquivo NUNCA devolve 5xx. O webhook da Woovi devolve
//    500 quando a gravação falha, o que lá é aceitável (ela reenvia). Copiar
//    esse padrão pra cá seria pôr o faturamento do cartão a 15 instabilidades
//    do Supabase de parar em silêncio. Aqui, falha nossa vira 200 com o erro
//    registrado e um alerta — o pagamento fica no gateway pra reconciliar, mas
//    a fila continua andando.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { asaas } from "../../src/lib/asaas.js";
import { segredoConfere } from "../lib/segredo.js";
import { musicaDoQuiz, refazerSeFaltou, mandarEmailDeEntrega } from "../lib/entrega.js";
import { Resend } from "resend";

type Req = IncomingMessage & {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & {
  status: (c: number) => Res;
  json: (b: unknown) => void;
};

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function alertarDono(assunto: string, html: string) {
  try {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) return;
    await new Resend(chave).emails.send({
      from: "Serenata <contato@serenatagift.com>",
      to: ["guilhermerojasiqueira@gmail.com"],
      subject: assunto,
      html,
    });
  } catch (err) {
    console.error("[asaas] alerta ao dono falhou:", err);
  }
}

async function auditar(sb: ReturnType<typeof db>, nome: string, dados: unknown) {
  try {
    await sb.from("funnel_events").insert({ event_name: nome, event_data: dados });
  } catch {
    // Auditoria nunca derruba o webhook.
  }
}

/** Eventos que significam dinheiro dentro. O resto é ruído pra nós. */
const PAGOU = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "método" });

  // ── A ÚNICA AUTENTICAÇÃO QUE ELES OFERECEM ───────────────────
  //
  // Em tempo constante, como todo segredo do projeto: `===` de string sai no
  // primeiro byte diferente e o tempo dessa saída é medível.
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado) {
    // FALHA FECHADA. Sem token configurado, aceitar qualquer POST seria o bug
    // "fail-open" que o CLAUDE.md lista como erro a não repetir.
    console.error("[asaas] ASAAS_WEBHOOK_TOKEN não configurado");
    return res.status(503).json({ error: "webhook não configurado" });
  }
  if (!segredoConfere(req.headers["asaas-access-token"], esperado)) {
    return res.status(401).json({ error: "token inválido" });
  }

  const corpo = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as {
    id?: string;
    event?: string;
    payment?: { id?: string; externalReference?: string };
  } | null;

  const evento = String(corpo?.event ?? "");
  const idCobranca = corpo?.payment?.id;
  if (!idCobranca) return res.status(200).json({ ok: true, nota: "sem cobrança" });

  const sb = db();
  const paymentId = `asaas:${idCobranca}`;

  if (!PAGOU.has(evento)) {
    // Recusa por antifraude é o único não-pagamento que interessa registrar:
    // é dinheiro que a tela já mostrou como aprovado e que não vai entrar.
    if (evento === "PAYMENT_REPROVED_BY_RISK_ANALYSIS") {
      await auditar(sb, "asaas_reprovado_antifraude", { paymentId });
      await sb.from("pedidos").update({ status: "recusado", status_gateway: evento }).eq("payment_id", paymentId);
    }
    return res.status(200).json({ ok: true, evento });
  }

  // ── IDEMPOTÊNCIA ─────────────────────────────────────────────
  const { data: existente } = await sb
    .from("pedidos")
    .select("id, status, valor_centavos, bump_quadro, email, quiz_response_id")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (existente?.status === "pago") {
    return res.status(200).json({ ok: true, duplicado: true });
  }

  // ── A RECONSULTA, QUE AQUI É A ÚNICA PROVA ───────────────────
  let status;
  try {
    status = await asaas.consultar(idCobranca);
  } catch (err) {
    // NÃO devolve 5xx: ver o cabeçalho. Falha de rede vira 200 e o evento se
    // perde — mas a fila continua viva, e o pedido fica pendente pra
    // reconciliar. É o mal menor entre "perdi um evento" e "parei a fila".
    console.error("[asaas] reconsulta falhou:", (err as Error).message);
    await auditar(sb, "asaas_reconsulta_falhou", { paymentId, evento });
    return res.status(200).json({ ok: true, nota: "reconsulta falhou" });
  }
  if (!status.confirmado) {
    await auditar(sb, "asaas_evento_sem_pagamento", { paymentId, evento, status: status.statusCru });
    return res.status(200).json({ ok: true, nota: "gateway não confirma" });
  }

  // ── O VALOR TEM QUE BATER ────────────────────────────────────
  //
  // Contra o pedido que NÓS criamos ao cobrar. Sem isto, um postback forjado
  // (e sem assinatura, forjar é mais fácil aqui) com um id de cobrança de R$ 1
  // liberaria um produto de R$ 38.
  if (existente?.valor_centavos && status.valorCentavos && existente.valor_centavos !== status.valorCentavos) {
    await auditar(sb, "asaas_valor_divergente", {
      paymentId,
      esperado: existente.valor_centavos,
      recebido: status.valorCentavos,
    });
    return res.status(200).json({ ok: true, nota: "valor divergente" });
  }

  const quizId = existente?.quiz_response_id ?? null;
  const musica = quizId ? await musicaDoQuiz(sb, quizId) : null;

  const { data: pedido, error: erroPedido } = await sb
    .from("pedidos")
    .upsert(
      {
        payment_id: paymentId,
        gateway: "asaas",
        status: "pago",
        status_gateway: status.statusCru,
        valor_centavos: status.valorCentavos,
        taxa_centavos: status.taxaCentavos,
        quiz_response_id: quizId,
        musica_id: musica?.id ?? null,
        // `paid_at` só na primeira vez: o CSV de conversões do Google usa este
        // horário como chave de deduplicação. Reescrever faria a mesma venda
        // entrar duas vezes lá.
        ...(existente?.status === "pago" ? {} : { paid_at: new Date().toISOString() }),
      },
      { onConflict: "payment_id" },
    )
    .select("id")
    .maybeSingle();

  if (erroPedido) {
    // 200, NUNCA 500. Ver o cabeçalho: 5xx repetido para a fila deles.
    console.error("[asaas] gravar pedido falhou:", erroPedido.message);
    await alertarDono(
      "Cartão pago e pedido NÃO gravado",
      `<p>O Asaas confirmou o pagamento e a gravação falhou: ${erroPedido.message}` +
        `<br>cobrança: ${paymentId}</p><p>Conferir e liberar à mão.</p>`,
    );
    return res.status(200).json({ ok: true, nota: "pago, gravação falhou" });
  }

  // ── O QUADRO COMPRADO JUNTO ──────────────────────────────────
  if (existente?.bump_quadro === true && existente.email) {
    const { error } = await sb.from("quadros").insert({
      email: existente.email,
      pedido_id: pedido?.id ?? null,
    });
    if (error && error.code !== "23505") {
      await alertarDono(
        "Quadro pago no cartão e NÃO liberado",
        `<p>${error.message}<br>${existente.email} · ${paymentId}</p>`,
      );
    }
  }

  await auditar(sb, "asaas_pago", {
    paymentId,
    valor: status.valorCentavos,
    taxa: status.taxaCentavos,
    quiz_response_id: quizId,
  });

  // ── A ENTREGA ────────────────────────────────────────────────
  //
  // Pelo MÓDULO compartilhado (`api/lib/entrega.ts`), nunca copiada. É a regra
  // do CLAUDE.md: conserto num tem que ir no outro.
  if (!quizId || !musica) {
    return res.status(200).json({ ok: true, pedido: paymentId, entrega: "sem-musica" });
  }
  const { data: dono } = await sb
    .from("pedidos")
    .select("email, nome_pagador")
    .eq("payment_id", paymentId)
    .maybeSingle();
  const email = (dono?.email as string | null) ?? null;
  if (!email) {
    await auditar(sb, "asaas_pago_sem_email", { paymentId, quiz_response_id: quizId });
    return res.status(200).json({ ok: true, pedido: paymentId, entrega: "sem-email" });
  }

  try {
    await refazerSeFaltou(sb, quizId);
    await mandarEmailDeEntrega(sb, {
      email,
      musica,
      nomePagador: (dono?.nome_pagador as string | null) ?? null,
    });
  } catch (err) {
    // Entrega falhou depois do dinheiro entrar: grita, mas devolve 200. O
    // pedido está gravado e dá pra reenviar pelo painel.
    console.error("[asaas] entrega falhou:", (err as Error).message);
    await alertarDono(
      "Cartão pago e entrega falhou",
      `<p>${(err as Error).message}<br>${email} · ${paymentId}</p>`,
    );
  }

  return res.status(200).json({ ok: true, pedido: paymentId });
}
