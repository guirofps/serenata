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
import { creditarUpsell, liberarItensDoBump } from "../lib/creditar-upsell.js";
import { ofertaDaReferencia } from "../../src/lib/creditos.js";
import { valorEsperadoDoUpsell, type Alvo } from "../../src/lib/cupom.js";
import { avisarDonos } from "../../src/lib/avisar-donos.js";
import {
  eventoDeEstorno,
  outroPagamentoDoQuiz,
  quizDaReferencia,
  statusConfirmaEstorno,
  type TipoEstorno,
} from "../../src/lib/asaas-regras.js";

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
    await avisarDonos({
      assunto: assunto,
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

/**
 * UPSELL PAGO NO ASAAS: crédito de música ou quadro, nunca entrega de música.
 *
 * Até 15/09/2026 este caminho não existia. O upsell passou a sair pelo Asaas na
 * noite de 11/09, e todo pagamento dele caía no fluxo da música: pedido novo
 * `asaas:pay_...` sem e-mail, sem crédito, sem quadro. Foram 11 compras entre 12
 * e 14/09; três clientes pagaram duas vezes e um pagou a música cheia depois.
 *
 * O e-mail vem do PEDIDO PENDENTE, criado numa sessão com prova de posse em
 * `criar-pix-upsell.ts`, e não do que o gateway ecoa. Mesmo desenho da Woovi.
 */
async function pagarUpsell(
  sb: ReturnType<typeof db>,
  res: Res,
  args: {
    referencia: string;
    idCobranca: string;
    pendente: { id: string; email: string | null; cupom?: string | null; created_at?: string | null } | null;
    status: { statusCru: string; valorCentavos: number | null; taxaCentavos: number | null };
  },
) {
  const { referencia, idCobranca, pendente, status } = args;
  const oferta = ofertaDaReferencia(referencia);
  if (!oferta) {
    await auditar(sb, "asaas_upsell_desconhecido", { referencia, idCobranca });
    await alertarDono("Upsell pago no Asaas com oferta desconhecida", `<p>${referencia} · ${idCobranca}</p>`);
    return res.status(200).json({ ok: true, nota: "oferta desconhecida" });
  }

  // O valor tem que bater com o que NÓS cobramos: o catálogo, ou o catálogo
  // com o cupom que o PRÓPRIO pedido gravou ao nascer (07/10). Continua sendo
  // a trava contra pagar R$ 1 num crédito de R$ 28: o cupom vem da nossa
  // linha, nunca do gateway.
  const esperado = valorEsperadoDoUpsell(Math.round(oferta.precoBrl * 100), oferta.id as Alvo, pendente);
  if (status.valorCentavos && status.valorCentavos !== esperado) {
    await auditar(sb, "asaas_upsell_valor_divergente", { referencia, esperado, recebido: status.valorCentavos });
    await alertarDono(
      "Upsell pago no Asaas com valor divergente",
      `<p>${referencia}: esperado ${esperado}, recebido ${status.valorCentavos}</p>`,
    );
    return res.status(200).json({ ok: true, nota: "valor divergente, não liberado" });
  }

  const email = pendente?.email ?? null;
  if (!pendente?.id || !email) {
    await auditar(sb, "asaas_upsell_sem_pedido", { referencia, idCobranca });
    await alertarDono("Upsell pago no Asaas sem pedido", `<p>${referencia} · ${idCobranca}</p><p>Liberar à mão.</p>`);
    return res.status(200).json({ ok: true, nota: "sem pedido do comprador" });
  }

  const { error: erroPedido } = await sb
    .from("pedidos")
    .update({
      status: "pago",
      status_gateway: status.statusCru,
      valor_centavos: status.valorCentavos ?? esperado,
      taxa_centavos: status.taxaCentavos,
      paid_at: new Date().toISOString(),
    })
    .eq("id", pendente.id)
    .eq("status", "pendente");
  if (erroPedido) {
    await alertarDono(
      "Upsell pago no Asaas e pedido NÃO gravado",
      `<p>${erroPedido.message}<br>${email} · ${referencia}</p>`,
    );
    return res.status(200).json({ ok: true, nota: "pago, gravação falhou" });
  }

  // O índice único por `pedido_id` segura o reenvio: o segundo evento não credita de novo.
  const r = await creditarUpsell(sb, {
    oferta,
    email,
    pedidoId: pendente.id,
    nota: { gateway: "asaas", referencia, cobranca: idCobranca },
  });
  await auditar(sb, r.erro ? "asaas_upsell_falhou" : "asaas_upsell", {
    referencia,
    email,
    oferta: oferta.id,
    ...(r.erro ? { erro: r.erro } : {}),
  });
  if (r.erro) {
    await alertarDono("Upsell pago no Asaas e NÃO liberado", `<p>${r.erro}<br>${email} · ${referencia}</p>`);
  }
  return res.status(200).json({ ok: true, upsell: oferta.id, creditou: r.creditou, quadro: r.quadro });
}

/**
 * ESTORNO E CHARGEBACK NO ASAAS (08/10).
 *
 * Até aqui o webhook só olhava pagamento e recusa do antifraude: o dinheiro
 * que voltava (estorno feito no painel, chargeback do cartão, MED do PIX)
 * continuava `pago` no banco e contado como venda no painel. A Perfect Pay já
 * marcava `reembolsado` (`perfectpay.ts`); a coluna e o valor são os mesmos
 * (o CHECK de `pedidos.status` aceita pendente|pago|reembolsado|cancelado).
 *
 * RECONSULTA ANTES DE MEXER, como no pagamento: sem assinatura, um postback
 * forjado de estorno derrubaria uma venda boa. O corpo diz qual cobrança, a
 * API diz se o dinheiro saiu.
 *
 * Só vira `reembolsado` linha que estava `pago`. Estorno PARCIAL não muda o
 * status (parte do dinheiro ficou): só avisa.
 *
 * Estes eventos só chegam se estiverem MARCADOS no webhook do painel do Asaas.
 */
async function registrarEstorno(
  sb: ReturnType<typeof db>,
  res: Res,
  args: { evento: string; tipo: TipoEstorno; idCobranca: string; ids: string[] },
) {
  const { evento, tipo, idCobranca, ids } = args;

  let st;
  try {
    st = await asaas.consultar(idCobranca);
  } catch (err) {
    // 200 mesmo assim (ver o cabeçalho: 5xx repetido para a fila deles). O
    // estorno não se perde do lado do Asaas; quem resolve é alguém olhando.
    await auditar(sb, "asaas_estorno_reconsulta_falhou", { idCobranca, evento });
    await alertarDono(
      "Estorno no Asaas sem confirmação",
      `<p>Chegou ${evento} pra cobrança ${idCobranca} e a reconsulta falhou: ${(err as Error).message}</p>` +
        `<p>Conferir no painel do Asaas e marcar o pedido à mão se o dinheiro saiu.</p>`,
    );
    return res.status(200).json({ ok: true, nota: "estorno: reconsulta falhou" });
  }

  const { data: linhas } = await sb
    .from("pedidos")
    .select("id, payment_id, status, email, quiz_response_id, valor_centavos")
    .in("payment_id", ids);
  const lista = linhas ?? [];
  const resumo = lista.map((p) => `${p.payment_id} (${p.status}, ${p.valor_centavos}, ${p.email ?? "sem e-mail"})`);

  if (tipo === "parcial") {
    await auditar(sb, "asaas_estorno_parcial", { idCobranca, evento, status: st.statusCru, pedidos: ids });
    await alertarDono(
      "Estorno PARCIAL no Asaas",
      `<p>Cobrança ${idCobranca}: ${evento} (status ${st.statusCru}, valor ${st.valorCentavos}).</p>` +
        `<p>${resumo.join("<br>") || "Nenhum pedido nosso com esta cobrança."}</p>` +
        `<p>O pedido NÃO foi marcado como reembolsado: parte do dinheiro ficou.</p>`,
    );
    return res.status(200).json({ ok: true, nota: "estorno parcial, só avisado" });
  }

  if (!statusConfirmaEstorno(st.statusCru)) {
    await auditar(sb, "asaas_estorno_nao_confirmado", { idCobranca, evento, status: st.statusCru });
    return res.status(200).json({ ok: true, nota: "gateway não confirma estorno" });
  }

  const pagas = lista.filter((p) => p.status === "pago");
  if (!pagas.length) {
    // Reenvio do mesmo evento, ou a sequência natural (REFUND_IN_PROGRESS e
    // depois REFUNDED; CHARGEBACK_REQUESTED e depois DISPUTE): já marcado.
    if (lista.some((p) => p.status === "reembolsado")) {
      return res.status(200).json({ ok: true, duplicado: true });
    }
    await auditar(sb, "asaas_estorno_sem_pedido", { idCobranca, evento, status: st.statusCru });
    await alertarDono(
      "Estorno no Asaas sem pedido pago nosso",
      `<p>Cobrança ${idCobranca}: ${evento} (status ${st.statusCru}, valor ${st.valorCentavos}).</p>` +
        `<p>${resumo.join("<br>") || "Nenhum pedido com esta cobrança."}</p>`,
    );
    return res.status(200).json({ ok: true, nota: "estorno sem pedido pago" });
  }

  const { error } = await sb
    .from("pedidos")
    .update({ status: "reembolsado", status_gateway: st.statusCru })
    .in(
      "id",
      pagas.map((p) => p.id),
    )
    .eq("status", "pago");
  if (error) {
    await alertarDono(
      "Estorno no Asaas e pedido NÃO marcado",
      `<p>${error.message}<br>${resumo.join("<br>")}</p><p>Marcar como reembolsado à mão.</p>`,
    );
    return res.status(200).json({ ok: true, nota: "estorno: gravação falhou" });
  }

  await auditar(sb, tipo === "chargeback" ? "asaas_chargeback" : "asaas_estorno", {
    idCobranca,
    evento,
    status: st.statusCru,
    pedidos: pagas.map((p) => p.payment_id),
    quiz_response_id: pagas[0]?.quiz_response_id ?? null,
  });
  await alertarDono(
    tipo === "chargeback" ? "CHARGEBACK no Asaas: montar o dossiê" : "Estorno registrado no Asaas",
    `<p>Cobrança ${idCobranca}: ${evento} (status ${st.statusCru}).</p>` +
      `<p>Marcado como reembolsado:<br>${pagas
        .map((p) => `${p.payment_id} · ${p.valor_centavos} · ${p.email ?? "sem e-mail"} · quiz ${p.quiz_response_id ?? "?"}`)
        .join("<br>")}</p>` +
      (tipo === "chargeback"
        ? `<p>Contestação aberta: o prazo de defesa corre no painel do Asaas.</p>`
        : ""),
  );
  return res.status(200).json({ ok: true, reembolsado: true, tipo });
}

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
  // O upsell grava o pedido pela NOSSA referência (`asaas:up:<oferta>:<uuid>`),
  // e o Asaas manda o id deles. Sem olhar a referência, o pagamento virava uma
  // linha nova sem e-mail e o pedido de verdade ficava pendente pra sempre.
  const referencia = String(corpo?.payment?.externalReference ?? "");
  const idPorReferencia = referencia.startsWith("up:") ? `asaas:${referencia}` : null;
  const idsDoPedido = idPorReferencia ? [paymentId, idPorReferencia] : [paymentId];

  if (!PAGOU.has(evento)) {
    // Recusa por antifraude Ã© o Ãºnico nÃ£o-pagamento que interessa registrar:
    // Ã© dinheiro que a tela jÃ¡ mostrou como aprovado e que nÃ£o vai entrar.
    if (evento === "PAYMENT_REPROVED_BY_RISK_ANALYSIS") {
      await auditar(sb, "asaas_reprovado_antifraude", { paymentId });
      // "cancelado", nao "recusado": o CHECK de `pedidos.status` so aceita
      // pendente|pago|reembolsado|cancelado, e o update com "recusado" falhava
      // calado. O motivo fica no `status_gateway`.
      //
      // SÓ O QUE AINDA ESTÁ PENDENTE (08/10). Sem o filtro, um evento atrasado
      // ou forjado (aqui só há token estático) cancelava um pedido já pago:
      // a venda sumia do painel e a música sumia da conta de quem pagou. E
      // pela referência também, pra o cartão do upsell (`asaas:up:...`),
      // que nasce pendente antes de cobrar e ficava pendente pra sempre.
      await sb
        .from("pedidos")
        .update({ status: "cancelado", status_gateway: evento })
        .in("payment_id", idsDoPedido)
        .eq("status", "pendente");
    }
    const tipoEstorno = eventoDeEstorno(evento);
    if (tipoEstorno) {
      return registrarEstorno(sb, res, { evento, tipo: tipoEstorno, idCobranca, ids: idsDoPedido });
    }
    return res.status(200).json({ ok: true, evento });
  }

  // â”€â”€ IDEMPOTÃŠNCIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: existentes } = await sb
    .from("pedidos")
    .select("id, payment_id, status, valor_centavos, bump_quadro, bump_video, email, quiz_response_id, cupom, created_at")
    .in("payment_id", idsDoPedido);
  if ((existentes ?? []).some((p) => p.status === "pago")) {
    return res.status(200).json({ ok: true, duplicado: true });
  }
  const existente = (existentes ?? []).find((p) => p.payment_id === paymentId) ?? null;

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

  if (idPorReferencia) {
    const pendente = (existentes ?? []).find((p) => p.payment_id === idPorReferencia) ?? null;
    return pagarUpsell(sb, res, { referencia, idCobranca, pendente, status });
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

  // ── DE QUEM É (08/10) ─────────────────────────────────────────
  //
  // Primeiro do pedido pendente que NÓS gravamos. Sem ele (gravação que
  // falhou no `criar-pix`, cobrança antiga), da referência `serenata:<quiz>`
  // que nós mesmos criamos, como a Woovi faz. Antes daqui o quiz saía SÓ do
  // pendente, e sem ele o pagamento virava "sem-musica" sem aviso nenhum.
  //
  // A referência vem da RECONSULTA, não do corpo: com token estático, um
  // postback forjado escolheria pra qual quiz a música vai.
  const quizDaRef = quizDaReferencia(status.referencia ?? null);
  const quizId = (existente?.quiz_response_id as string | null) ?? quizDaRef;

  // ── ESTE QUIZ JÁ FOI PAGO? (08/10) ────────────────────────────
  //
  // A idempotência acima é por COBRANÇA. Ela não vê o segundo pagamento do
  // mesmo quiz por OUTRA cobrança, e foi assim que o quiz bb9effb8… pagou
  // R$ 38 em 03/10 e de novo em 06/10 (o QR de 01/10, vencido, continuava
  // pagável), recebeu dois e-mails de entrega e ninguém soube. A Woovi e o
  // Stripe já tinham esta trava. Mesmo desenho: o dinheiro fica REGISTRADO
  // como pago (ninguém some com pagamento), a entrega NÃO se repete, e os
  // donos são avisados pra devolver.
  if (quizId) {
    const { data: pagosDoQuiz } = await sb
      .from("pedidos")
      .select("payment_id, status, dinheiro_entrou, valor_centavos")
      .eq("quiz_response_id", quizId)
      .eq("status", "pago")
      .limit(20);
    const anterior = outroPagamentoDoQuiz(pagosDoQuiz, paymentId);
    if (anterior) {
      const { error: erroDuplo } = await sb.from("pedidos").upsert(
        {
          payment_id: paymentId,
          gateway: "asaas",
          status: "pago",
          status_gateway: status.statusCru,
          valor_centavos: status.valorCentavos,
          taxa_centavos: status.taxaCentavos,
          quiz_response_id: quizId,
          paid_at: new Date().toISOString(),
        },
        { onConflict: "payment_id" },
      );
      await auditar(sb, "asaas_pagou_duas_vezes", {
        paymentId,
        quiz_response_id: quizId,
        anterior: anterior.payment_id,
        valor: status.valorCentavos,
      });
      await alertarDono(
        "PAGOU DUAS VEZES: devolver (Asaas)",
        `<p>O mesmo quiz recebeu dois pagamentos.</p>` +
          `<p>quiz: ${quizId}<br>agora: ${paymentId} (${status.valorCentavos})` +
          `<br>antes: ${anterior.payment_id} (${anterior.valor_centavos})</p>` +
          `<p>A entrega NÃO foi repetida. Devolver um dos dois no painel do Asaas.</p>` +
          (erroDuplo ? `<p>E o pedido deste pagamento NÃO gravou: ${erroDuplo.message}</p>` : ""),
      );
      return res.status(200).json({ ok: true, nota: "quiz ja pago, nao entregue de novo" });
    }
  }

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
  // O video do bump (bracos V e C): nasce esperando as fotos. Ver
  // `liberarVideoDoBump`. Pela coluna do pedido que NOS gravamos.
  // Pelo módulo comum: o cartão libera o mesmo bump na hora, em `criar-cartao.ts`.
  if ((existente?.bump_video === true || existente?.bump_quadro === true) && existente.email) {
    const erros = await liberarItensDoBump(sb, {
      email: existente.email,
      pedidoId: pedido?.id ?? null,
      musicaId: musica?.id ?? null,
      video: existente.bump_video === true,
      quadro: existente.bump_quadro === true,
    });
    if (erros.length) {
      await alertarDono("Bump pago e NAO liberado", `<p>${erros.join("<br>")}<br>${existente.email} · ${paymentId}</p>`);
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
    // PAGOU E NÃO ACHAMOS O QUE ENTREGAR (08/10: antes saía calado). Não
    // existe caminho automático daqui: alguém tem que olhar.
    await auditar(sb, "asaas_pago_sem_musica", { paymentId, quiz_response_id: quizId, referencia: status.referencia });
    await alertarDono(
      "Pago no Asaas e NADA entregue",
      `<p>O Asaas confirmou ${paymentId} (${status.valorCentavos}) e ` +
        (quizId ? `o quiz ${quizId} não tem música.` : `não achei o quiz (referência: ${status.referencia ?? "?"}).`) +
        `</p><p>Conferir e liberar à mão.</p>`,
    );
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
  let email = (dono?.email as string | null) ?? null;
  // Sem o pedido pendente não há e-mail no pedido (08/10). O do QUIZ é o
  // mesmo que o `criar-pix` grava (ele atualiza o quiz quando a pessoa
  // corrige na folha), e o quiz aqui saiu de uma referência nossa: não é
  // adivinhação.
  if (!email) {
    const { data: q } = await sb.from("quiz_responses").select("email").eq("id", quizId).maybeSingle();
    email = (q?.email as string | null) ?? null;
    if (email) await sb.from("pedidos").update({ email }).eq("payment_id", paymentId);
  }
  if (!email) {
    await auditar(sb, "asaas_pago_sem_email", { paymentId, quiz_response_id: quizId });
    await alertarDono(
      "Pago no Asaas sem e-mail pra entregar",
      `<p>${paymentId} (${status.valorCentavos}), quiz ${quizId}: nem o pedido nem o quiz têm e-mail.</p>` +
        `<p>Liberar à mão.</p>`,
    );
    return res.status(200).json({ ok: true, pedido: paymentId, entrega: "sem-email" });
  }

  try {
    await refazerSeFaltou(sb, musica);
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
    // SÓ manda pro TikTok venda que REALMENTE veio dele (tem `ttclid`). Antes a
    // gente disparava CompletePayment em TODA venda, inclusive Google/direto/
    // orgânico, e o TikTok reivindicava essas por view-through, inflando o
    // painel. Não é o TikTok reportando errado, era a gente entregando venda de
    // outro canal. Venda sem ttclid não é do TikTok e não sobe.
    if (attr?.ttclid) {
      // O event_id É o `idCobranca` CRU, NÃO o `paymentId`. O pixel na /obrigado
      // guarda e manda o id da cobrança sem prefixo; o `paymentId` carrega o
      // `asaas:` na frente. Mandar ele aqui fazia o TikTok NÃO deduplicar e
      // contar duas vezes o comprador que voltava pra /obrigado. Agora batem.
      const tiktok = await venderNoTiktok({
        eventId: idCobranca,
        valor: (dono?.valor_centavos as number | null ?? 0) / 100,
        moeda: "BRL",
        email,
        telefone: (dono?.telefone as string | null) ?? null,
        ttclid: attr.ttclid,
        quando: new Date(),
      });
      // Grava sucesso E fracasso, igual ao Woovi: sem isso o silêncio é ambíguo
      // entre "não vendeu" e "o server-side parou de mandar".
      await auditar(sb, tiktok.ok ? "tiktok_conversao_enviada" : "tiktok_conversao_falhou", {
        payment_id: paymentId,
        valor: (dono?.valor_centavos as number | null ?? 0) / 100,
        motivo: tiktok.motivo ?? null,
      });
    }
  } catch (err) {
    console.error("[asaas] tiktok falhou:", (err as Error).message);
  }

  return res.status(200).json({ ok: true, pedido: paymentId });
}

