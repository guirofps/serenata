// O WEBHOOK DO ASAAS.
//
// â”€â”€ DUAS COISAS AQUI SÃƒO DIFERENTES DA WOOVI, E AS DUAS SÃƒO PIORES â”€â”€
//
// 1. NÃƒO EXISTE ASSINATURA. A Woovi assina cada postback com RSA-SHA256, entÃ£o
//    lÃ¡ a assinatura prova ORIGEM e a reconsulta prova PAGAMENTO â€” duas
//    perguntas diferentes, duas travas. O Asaas manda apenas um token estÃ¡tico
//    num header (`asaas-access-token`), escolhido por nÃ³s. Token estÃ¡tico prova
//    muito menos: quem o obtiver forja um postback inteiro.
//
//    ConsequÃªncia: a RECONSULTA deixa de ser a segunda trava e passa a ser a
//    ÃšNICA prova de que o dinheiro entrou. Ela Ã© obrigatÃ³ria em todo caminho
//    que libera produto. Ã‰ o mesmo desenho que o CLAUDE.md registra pra
//    MillionsPay, e pelo mesmo motivo.
//
// 2. A FILA DELES PARA. DocumentaÃ§Ã£o do Asaas: apÃ³s 15 falhas consecutivas a
//    fila do webhook pode ser interrompida, e evento parado hÃ¡ mais de 14 dias
//    Ã© APAGADO em definitivo. A Woovi nÃ£o tem isso.
//
//    ConsequÃªncia: este arquivo NUNCA devolve 5xx. O webhook da Woovi devolve
//    500 quando a gravaÃ§Ã£o falha, o que lÃ¡ Ã© aceitÃ¡vel (ela reenvia). Copiar
//    esse padrÃ£o pra cÃ¡ seria pÃ´r o faturamento do cartÃ£o a 15 instabilidades
//    do Supabase de parar em silÃªncio. Aqui, falha nossa vira 200 com o erro
//    registrado e um alerta â€” o pagamento fica no gateway pra reconciliar, mas
//    a fila continua andando.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { asaas } from "../../src/lib/asaas.js";
import { segredoConfere } from "../lib/segredo.js";
import { musicaDoQuiz, refazerSeFaltou, mandarEmailDeEntrega } from "../lib/entrega.js";
import { venderNoTiktok } from "../lib/tiktok-eventos.js";
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

/** Eventos que significam dinheiro dentro. O resto Ã© ruÃ­do pra nÃ³s. */
const PAGOU = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "mÃ©todo" });

  // â”€â”€ A ÃšNICA AUTENTICAÃ‡ÃƒO QUE ELES OFERECEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // Em tempo constante, como todo segredo do projeto: `===` de string sai no
  // primeiro byte diferente e o tempo dessa saÃ­da Ã© medÃ­vel.
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado) {
    // FALHA FECHADA. Sem token configurado, aceitar qualquer POST seria o bug
    // "fail-open" que o CLAUDE.md lista como erro a nÃ£o repetir.
    console.error("[asaas] ASAAS_WEBHOOK_TOKEN nÃ£o configurado");
    return res.status(503).json({ error: "webhook nÃ£o configurado" });
  }
  if (!segredoConfere(req.headers["asaas-access-token"], esperado)) {
    return res.status(401).json({ error: "token invÃ¡lido" });
  }

  const corpo = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as {
    id?: string;
    event?: string;
    payment?: { id?: string; externalReference?: string };
  } | null;

  const evento = String(corpo?.event ?? "");
  const idCobranca = corpo?.payment?.id;
  if (!idCobranca) return res.status(200).json({ ok: true, nota: "sem cobranÃ§a" });

  const sb = db();
  const paymentId = `asaas:${idCobranca}`;

  if (!PAGOU.has(evento)) {
    // Recusa por antifraude Ã© o Ãºnico nÃ£o-pagamento que interessa registrar:
    // Ã© dinheiro que a tela jÃ¡ mostrou como aprovado e que nÃ£o vai entrar.
    if (evento === "PAYMENT_REPROVED_BY_RISK_ANALYSIS") {
      await auditar(sb, "asaas_reprovado_antifraude", { paymentId });
      await sb.from("pedidos").update({ status: "recusado", status_gateway: evento }).eq("payment_id", paymentId);
    }
    return res.status(200).json({ ok: true, evento });
  }

  // â”€â”€ IDEMPOTÃŠNCIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: existente } = await sb
    .from("pedidos")
    .select("id, status, valor_centavos, bump_quadro, email, quiz_response_id")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (existente?.status === "pago") {
    return res.status(200).json({ ok: true, duplicado: true });
  }

  // â”€â”€ A RECONSULTA, QUE AQUI Ã‰ A ÃšNICA PROVA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let status;
  try {
    status = await asaas.consultar(idCobranca);
  } catch (err) {
    // NÃƒO devolve 5xx: ver o cabeÃ§alho. Falha de rede vira 200 e o evento se
    // perde â€” mas a fila continua viva, e o pedido fica pendente pra
    // reconciliar. Ã‰ o mal menor entre "perdi um evento" e "parei a fila".
    console.error("[asaas] reconsulta falhou:", (err as Error).message);
    await auditar(sb, "asaas_reconsulta_falhou", { paymentId, evento });
    return res.status(200).json({ ok: true, nota: "reconsulta falhou" });
  }
  if (!status.confirmado) {
    await auditar(sb, "asaas_evento_sem_pagamento", { paymentId, evento, status: status.statusCru });
    return res.status(200).json({ ok: true, nota: "gateway nÃ£o confirma" });
  }

  // â”€â”€ O VALOR TEM QUE BATER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // Contra o pedido que NÃ“S criamos ao cobrar. Sem isto, um postback forjado
  // (e sem assinatura, forjar Ã© mais fÃ¡cil aqui) com um id de cobranÃ§a de R$ 1
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
        // `paid_at` sÃ³ na primeira vez: o CSV de conversÃµes do Google usa este
        // horÃ¡rio como chave de deduplicaÃ§Ã£o. Reescrever faria a mesma venda
        // entrar duas vezes lÃ¡.
        ...(existente?.status === "pago" ? {} : { paid_at: new Date().toISOString() }),
      },
      { onConflict: "payment_id" },
    )
    .select("id")
    .maybeSingle();

  if (erroPedido) {
    // 200, NUNCA 500. Ver o cabeÃ§alho: 5xx repetido para a fila deles.
    console.error("[asaas] gravar pedido falhou:", erroPedido.message);
    await alertarDono(
      "CartÃ£o pago e pedido NÃƒO gravado",
      `<p>O Asaas confirmou o pagamento e a gravaÃ§Ã£o falhou: ${erroPedido.message}` +
        `<br>cobranÃ§a: ${paymentId}</p><p>Conferir e liberar Ã  mÃ£o.</p>`,
    );
    return res.status(200).json({ ok: true, nota: "pago, gravaÃ§Ã£o falhou" });
  }

  // â”€â”€ O QUADRO COMPRADO JUNTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (existente?.bump_quadro === true && existente.email) {
    const { error } = await sb.from("quadros").insert({
      email: existente.email,
      pedido_id: pedido?.id ?? null,
    });
    if (error && error.code !== "23505") {
      await alertarDono(
        "Quadro pago no cartÃ£o e NÃƒO liberado",
        `<p>${error.message}<br>${existente.email} Â· ${paymentId}</p>`,
      );
    }
  }

  await auditar(sb, "asaas_pago", {
    paymentId,
    valor: status.valorCentavos,
    taxa: status.taxaCentavos,
    quiz_response_id: quizId,
  });

  // â”€â”€ A ENTREGA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // Pelo MÃ“DULO compartilhado (`api/lib/entrega.ts`), nunca copiada. Ã‰ a regra
  // do CLAUDE.md: conserto num tem que ir no outro.
  if (!quizId || !musica) {
    return res.status(200).json({ ok: true, pedido: paymentId, entrega: "sem-musica" });
  }
  const { data: dono } = await sb
    .from("pedidos")
    // `telefone` e `valor_centavos` entram pro TikTok logo abaixo: o telefone
    // Ã© o segundo identificador quando o `ttclid` nÃ£o veio, e o valor tem que
    // ser o que ELA pagou, nÃ£o um nÃºmero do catÃ¡logo.
    .select("email, nome_pagador, telefone, valor_centavos")
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
    // pedido estÃ¡ gravado e dÃ¡ pra reenviar pelo painel.
    console.error("[asaas] entrega falhou:", (err as Error).message);
    await alertarDono(
      "CartÃ£o pago e entrega falhou",
      `<p>${(err as Error).message}<br>${email} Â· ${paymentId}</p>`,
    );
  }

  // â”€â”€ A VENDA VAI PRO TIKTOK, DAQUI E NÃƒO DA /obrigado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // Mesmo desenho do webhook da Woovi, e pelo mesmo motivo: a pÃ¡gina de
  // pÃ³s-compra Ã© vista por uma fraÃ§Ã£o dos compradores, e contar venda sÃ³ por
  // ela jÃ¡ custou dois terÃ§os da mediÃ§Ã£o do Google em 28/08.
  //
  // DEPOIS da entrega, de propÃ³sito: relatÃ³rio nunca atrasa nem arrisca o que
  // a pessoa pagou pra receber. E `venderNoTiktok` nÃ£o joga, entÃ£o nem precisa
  // de try: o pior caso dele Ã© uma venda nÃ£o contada.
  try {
    const { data: q } = await sb
      .from("quiz_responses")
      .select("attribution")
      .eq("id", quizId)
      .maybeSingle();
    const attr = (q?.attribution ?? null) as Record<string, string | undefined> | null;
    await venderNoTiktok({
      eventId: paymentId,
      valor: (dono?.valor_centavos as number | null ?? 0) / 100,
      moeda: "BRL",
      email,
      telefone: (dono?.telefone as string | null) ?? null,
      ttclid: attr?.ttclid ?? null,
      quando: new Date(),
    });
  } catch (err) {
    console.error("[asaas] tiktok falhou:", (err as Error).message);
  }

  return res.status(200).json({ ok: true, pedido: paymentId });
}

