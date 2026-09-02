// WEBHOOK DA WOOVI.
//
// â”€â”€ DUAS PERGUNTAS DIFERENTES, DUAS TRAVAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// 1. "Esta mensagem veio mesmo da Woovi?"  â†’ ASSINATURA (RSA-SHA256).
// 2. "O dinheiro entrou mesmo?"            â†’ CONSULTA na API.
//
// NÃ£o Ã© redundÃ¢ncia. A assinatura prova ORIGEM; sÃ³ a consulta prova
// PAGAMENTO. Um postback legÃ­timo pode chegar por um evento que nÃ£o Ã©
// pagamento, e um corpo pode ser replicado depois de um estorno.
//
// Este Ã© o ponto em que a Woovi Ã© melhor que a MillionsPay, cujo postback
// nÃ£o Ã© assinado de forma nenhuma: lÃ¡ eu tive que suprir a falta com segredo
// na URL. Aqui a origem Ã© provada com criptografia.
//
// â”€â”€ A ASSINATURA Ã‰ SOBRE O CORPO CRU â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Com o parser do Vercel ligado, o JSON re-serializado quase nunca bate byte
// a byte com o original, e a verificaÃ§Ã£o falharia em tudo. Por isso
// `bodyParser: false` e leitura manual do stream. Mesmo motivo do webhook do
// Resend.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { woovi, assinaturaWooviConfere } from "../../src/lib/woovi.js";
import { musicaDoQuiz, refazerSeFaltou, mandarEmailDeEntrega } from "../lib/entrega.js";
import { creditarUpsell } from "../lib/creditar-upsell.js";
import { enviarVendaUtmify } from "../lib/utmify.js";
import { venderNoTiktok } from "../lib/tiktok-eventos.js";
import { OFERTAS } from "../../src/lib/creditos.js";
import { Resend } from "resend";

// Mesmo molde do `perfectpay.ts`. Duplicado de proposito e nao extraido: sao
// dois webhooks que precisam sobreviver um ao outro, e a unica coisa que
// compartilham aqui e o endereco do dono.
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
    // Aviso nunca derruba o webhook: a Woovi reenviaria o evento e o
    // comprador receberia tudo duplicado.
    console.error("[woovi] alerta ao dono falhou:", err);
  }
}

type Req = IncomingMessage & {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & { status: (c: number) => Res; json: (b: unknown) => void };

export const config = { api: { bodyParser: false } };

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function corpoCru(req: Req): Promise<string> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    req.on("data", (p: Buffer) => partes.push(p));
    req.on("end", () => ok(Buffer.concat(partes).toString("utf8")));
    req.on("error", falha);
  });
}

function cabecalho(req: Req, nome: string): string | null {
  const v = req.headers[nome];
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;
}

async function auditar(sb: ReturnType<typeof db>, evento: string, dados: unknown) {
  try {
    await sb.from("funnel_events").insert({ event_name: evento, event_data: dados });
  } catch (err) {
    console.error("[woovi] auditoria falhou:", err);
  }
}

/**
 * O UPSELL PAGO: grava o pedido e DÃ o que foi comprado.
 *
 * Sai cedo do fluxo principal porque quase nada dele se aplica: nÃ£o hÃ¡ quiz,
 * nÃ£o hÃ¡ mÃºsica, nÃ£o hÃ¡ e-mail de entrega. O que hÃ¡ Ã© um direito a criar.
 *
 * O e-mail vem do PEDIDO PENDENTE, que nasceu de uma sessÃ£o autenticada em
 * `criar-pix-upsell.ts`. NÃ£o vem do que a Woovi ecoa: creditar pelo e-mail
 * que o gateway devolve seria confiar num campo que nÃ£o Ã© a nossa prova de
 * identidade.
 */
async function pagarUpsell(
  sb: ReturnType<typeof db>,
  res: Res,
  args: {
    correlationID: string;
    paymentId: string;
    status: { statusCru: string; valorCentavos: number | null; taxaCentavos: number | null };
  },
) {
  const { correlationID, paymentId, status } = args;
  const ofertaId = correlationID.split(":")[1] ?? "";
  const oferta = OFERTAS.find((o) => o.id === ofertaId);
  if (!oferta) {
    // ReferÃªncia com oferta que nÃ£o existe no catÃ¡logo. NÃ£o inventa nada:
    // grita e deixa o dinheiro registrado pra alguÃ©m olhar.
    await auditar(sb, "woovi_upsell_desconhecido", { correlationID, ofertaId });
    console.error("[woovi] upsell desconhecido:", ofertaId);
    return res.status(200).json({ ok: true, nota: "oferta desconhecida" });
  }

  // O VALOR TEM QUE BATER com o catÃ¡logo, e nÃ£o sÃ³ com o pedido pendente:
  // Ã© a segunda trava contra alguÃ©m pagar R$ 1 num crÃ©dito de R$ 28.
  const esperado = Math.round(oferta.precoBrl * 100);
  if (status.valorCentavos && status.valorCentavos !== esperado) {
    await auditar(sb, "woovi_upsell_valor_divergente", {
      correlationID,
      esperado,
      recebido: status.valorCentavos,
    });
    return res.status(200).json({ ok: true, nota: "valor divergente, nÃ£o creditado" });
  }

  const { data: pendente } = await sb
    .from("pedidos")
    .select("id, email, status")
    .eq("payment_id", paymentId)
    .maybeSingle();
  const email = (pendente?.email as string | null) ?? null;
  if (!email) {
    await auditar(sb, "woovi_upsell_sem_email", { correlationID });
    console.error("[woovi] upsell pago sem e-mail:", correlationID);
    return res.status(200).json({ ok: true, nota: "sem e-mail do comprador" });
  }

  const { data: pedido, error: erroPedido } = await sb
    .from("pedidos")
    .upsert(
      {
        payment_id: paymentId,
        gateway: "woovi",
        status: "pago",
        status_gateway: status.statusCru,
        valor_centavos: status.valorCentavos,
        taxa_centavos: status.taxaCentavos,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" },
    )
    // O ID Ã‰ O QUE SEGURA O REENVIO: os Ã­ndices Ãºnicos que impedem crÃ©dito
    // duplicado sÃ£o por `pedido_id`. Sem ele, cada reenvio creditaria de novo.
    .select("id")
    .maybeSingle();
  if (erroPedido) {
    console.error("[woovi] gravar pedido de upsell falhou:", erroPedido.message);
    return res.status(500).json({ error: "falha ao gravar pedido" });
  }

  const r = await creditarUpsell(sb, {
    oferta,
    email,
    pedidoId: pedido?.id ?? null,
    nota: { gateway: "woovi", correlationID },
  });

  await auditar(sb, r.erro ? "woovi_upsell_falhou" : "woovi_upsell", {
    correlationID,
    email,
    oferta: oferta.id,
    creditos: oferta.creditos,
    ...(r.erro ? { erro: r.erro } : {}),
  });
  if (r.erro) {
    // Pagou e nÃ£o recebeu: o pior desfecho. Sai no log e no evento, e o
    // pedido fica pago pra o dono liberar Ã  mÃ£o pelo painel.
    console.error("[woovi] upsell pago e NÃƒO creditado:", r.erro);
  }

  return res.status(200).json({ ok: true, upsell: oferta.id, creditou: r.creditou, quadro: r.quadro });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });

  const cru = await corpoCru(req);

  // â”€â”€ TRAVA 1: a assinatura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // FECHADO por natureza: sem assinatura vÃ¡lida, nÃ£o passa. NÃ£o existe
  // caminho "sem assinatura configurada" que aceite, que Ã© o erro herdado
  // que o CLAUDE.md proÃ­be.
  const assinatura = cabecalho(req, "x-webhook-signature");
  if (!(await assinaturaWooviConfere(cru, assinatura))) {
    // 401 e nÃ£o 404: aqui o endereÃ§o nÃ£o Ã© segredo, a assinatura Ã© que manda.
    console.error("[woovi] assinatura invÃ¡lida");
    return res.status(401).json({ error: "assinatura invÃ¡lida" });
  }

  let evento: { event?: string; charge?: { correlationID?: string; status?: string } };
  try {
    evento = JSON.parse(cru);
  } catch {
    return res.status(400).json({ error: "corpo invÃ¡lido" });
  }

  const sb = db();
  const correlationID = evento?.charge?.correlationID;
  if (!correlationID) {
    // Teste de webhook do painel deles chega sem cobranÃ§a. 200 pra nÃ£o ficar
    // vermelho no painel por uma coisa que estÃ¡ certa.
    await auditar(sb, "woovi_evento_sem_cobranca", { evento: evento?.event ?? null });
    return res.status(200).json({ ok: true, nota: "sem correlationID" });
  }

  // â”€â”€ TRAVA 2: pergunta pra fonte â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let status;
  try {
    status = await woovi.consultar(correlationID);
  } catch (err) {
    // 500 de propÃ³sito: gateway reenvia postback com erro. Devolver 200 aqui
    // seria descartar uma venda porque a consulta piscou.
    console.error("[woovi] consulta falhou:", err);
    await auditar(sb, "woovi_consulta_falhou", { correlationID });
    return res.status(500).json({ error: "nÃ£o consegui confirmar na fonte" });
  }

  await auditar(sb, `woovi_${status.statusCru.toLowerCase()}`, {
    correlationID,
    valor: status.valorCentavos,
    taxa: status.taxaCentavos,
  });

  if (!status.pago) {
    return res.status(200).json({ ok: true, nota: `status ${status.statusCru}` });
  }

  // â”€â”€ IDEMPOTÃŠNCIA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const paymentId = `woovi:${correlationID}`;
  const { data: existente } = await sb
    .from("pedidos")
    .select("id, status, valor_centavos, bump_quadro, email")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (existente?.status === "pago") {
    return res.status(200).json({ ok: true, duplicado: true });
  }

  // â”€â”€ O VALOR TEM QUE BATER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // Contra o pedido pendente que nÃ³s mesmos criamos ao gerar o PIX. Sem
  // isto, uma cobranÃ§a de R$ 1 criada por fora com a referÃªncia de alguÃ©m
  // liberaria um produto de R$ 54,90.
  if (existente?.valor_centavos && status.valorCentavos &&
      existente.valor_centavos !== status.valorCentavos) {
    await auditar(sb, "woovi_valor_divergente", {
      correlationID,
      esperado: existente.valor_centavos,
      recebido: status.valorCentavos,
    });
    return res.status(200).json({ ok: true, nota: "valor divergente, nÃ£o liberado" });
  }

  // â”€â”€ UPSELL? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // `up:<oferta>:<uuid>` Ã© compra de crÃ©dito ou de quadro, feita por alguÃ©m
  // logado no painel. Caminho inteiro diferente do funil: nÃ£o tem mÃºsica pra
  // entregar, tem direito pra dar.
  //
  // A oferta Ã© conferida contra o CATÃLOGO, nunca aceita como veio: o texto
  // chega dentro de uma referÃªncia que nÃ³s criamos, mas quem valida no fim Ã©
  // o servidor, e Ã© barato manter assim.
  if (correlationID.startsWith("up:")) {
    return await pagarUpsell(sb, res, { correlationID, paymentId, status });
  }

  // â”€â”€ DE QUEM Ã‰ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // A referÃªncia que a gente mandou Ã© `serenata:<quiz_response_id>`. Sai
  // dela, sem adivinhaÃ§Ã£o: SEM fallback por "quiz mais recente", que sob
  // concorrÃªncia entrega a mÃºsica da pessoa errada.
  //
  // O `.split(":")[0]` NÃƒO Ã© paranoia: quando a cobranÃ§a anterior daquele
  // quiz venceu, a Woovi recusa reaproveitar o id e a nova nasce como
  // `serenata:<quizId>:r2`. Sem cortar no primeiro dois-pontos, o id do quiz
  // sairia com o sufixo colado e a busca nÃ£o acharia mÃºsica nenhuma â€” a
  // pessoa pagaria e o webhook registraria "pago sem mÃºsica".
  const quizId = correlationID.startsWith("serenata:")
    ? (correlationID.slice("serenata:".length).split(":")[0] ?? null)
    : null;

  // â”€â”€ ESTE QUIZ JA FOI PAGO? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // A idempotencia acima e por `payment_id`, ou seja, por COBRANCA. Ela nao
  // ve um segundo pagamento do mesmo quiz com outra referencia.
  //
  // Ate agora isso nao podia acontecer: as referencias extras (`:r2`) so
  // nascem quando a cobranca anterior VENCE, e cobranca vencida ninguem paga.
  // O order bump do quadro muda isso â€” `serenata:<id>` (R$ 38) e
  // `serenata:<id>:q` (R$ 62,90) podem estar vivas ao mesmo tempo, porque a
  // Woovi recusa reaproveitar um correlationID com outro valor.
  //
  // Sem esta trava, pagar as duas mandaria dois presentes e dobraria a
  // cobranca em silencio, e quem descobriria seria o comprador, no extrato.
  // Aqui o dinheiro fica REGISTRADO (ninguem some com pagamento), a entrega
  // nao se repete, e o dono e avisado pra devolver.
  if (quizId) {
    const { data: jaPago } = await sb
      .from("pedidos")
      .select("id, payment_id, valor_centavos")
      .eq("quiz_response_id", quizId)
      .eq("status", "pago")
      .neq("payment_id", paymentId)
      .limit(1)
      .maybeSingle();
    if (jaPago) {
      await sb.from("pedidos").upsert(
        {
          payment_id: paymentId,
          gateway: "woovi",
          status: "pago",
          status_gateway: status.statusCru,
          valor_centavos: status.valorCentavos,
          taxa_centavos: status.taxaCentavos,
          quiz_response_id: quizId,
          paid_at: new Date().toISOString(),
          // QUEM PAGOU. Ver o comentario da coluna: `nome_pagador` guarda a
          // pessoa HOMENAGEADA, nao o pagador, e foi isso que deixou um
          // pedido de reembolso sem pedido correspondente achavel.
          titular_pix: status.titularPix ?? null,
        },
        { onConflict: "payment_id" },
      );
      await auditar(sb, "woovi_pagou_duas_vezes", {
        correlationID,
        quiz_response_id: quizId,
        anterior: jaPago.payment_id,
        valor: status.valorCentavos,
      });
      await alertarDono(
        "PAGOU DUAS VEZES â€” devolver",
        `<p>O mesmo quiz recebeu dois pagamentos.</p>` +
          `<p>quiz: ${quizId}<br>agora: ${correlationID} (${status.valorCentavos})` +
          `<br>antes: ${jaPago.payment_id} (${jaPago.valor_centavos})</p>` +
          `<p>A entrega NAO foi repetida. Devolver o menor dos dois.</p>`,
      );
      return res.status(200).json({ ok: true, nota: "quiz ja pago, nao entregue de novo" });
    }
  }

  const musica = quizId ? await musicaDoQuiz(sb, quizId) : null;

  // `.select()` no upsert porque o id da venda e o que amarra o direito ao
  // quadro (`quadros.pedido_id`), e e o indice unico por pedido que impede um
  // reenvio do postback de criar dois direitos. Com `pedido_id` nulo o indice
  // nao protege nada: no Postgres, nulo nao colide com nulo.
  const { data: pedidoDaVenda, error: erroPedido } = await sb
    .from("pedidos")
    .upsert(
      {
        payment_id: paymentId,
        gateway: "woovi",
        status: "pago",
        status_gateway: status.statusCru,
        valor_centavos: status.valorCentavos,
        taxa_centavos: status.taxaCentavos,
        quiz_response_id: quizId,
        musica_id: musica?.id ?? null,
        paid_at: new Date().toISOString(),
        // QUEM PAGOU. Ver o comentario da coluna: `nome_pagador` guarda a
        // pessoa HOMENAGEADA, nao o pagador, e foi isso que deixou um
        // pedido de reembolso sem pedido correspondente achavel.
        titular_pix: status.titularPix ?? null,
      },
      { onConflict: "payment_id" },
    )
    .select("id")
    .maybeSingle();
  if (erroPedido) {
    console.error("[woovi] gravar pedido falhou:", erroPedido.message);
    return res.status(500).json({ error: "falha ao gravar pedido" });
  }

  await auditar(sb, "woovi_pago", {
    correlationID,
    valor: status.valorCentavos,
    taxa: status.taxaCentavos,
    quiz_response_id: quizId,
  });

  // â”€â”€ A ENTREGA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // DEPOIS de gravar o pedido, de propÃ³sito. Se o e-mail estourasse antes, a
  // pessoa teria pagado e o pagamento nÃ£o existiria em lugar nenhum; nesta
  // ordem, o pior caso Ã© uma venda registrada sem e-mail, que dÃ¡ pra reenviar
  // olhando o painel.
  //
  // NÃƒO devolve erro se a entrega falhar: 500 faria a Woovi reenviar o
  // evento, e o comprador receberia o mesmo e-mail de novo.
  if (!musica) {
    // Pagou e nÃ£o achamos a mÃºsica. Grita no log e no banco: nÃ£o existe
    // caminho automÃ¡tico daqui, alguÃ©m tem que olhar.
    await auditar(sb, "woovi_pago_sem_musica", { correlationID, quiz_response_id: quizId });
    console.error("[woovi] PAGO SEM MÃšSICA:", correlationID);
    return res.status(200).json({ ok: true, pedido: paymentId, entrega: "sem-musica" });
  }

  if (await refazerSeFaltou(sb, musica)) {
    await auditar(sb, "compra_sem_musica_refeita", {
      musica: musica.id,
      gateway: "woovi",
      statusAnterior: musica.status,
    });
  }

  // O e-mail do PEDIDO, que Ã© o do quiz: a Woovi nÃ£o pede e-mail pra pagar
  // um PIX, entÃ£o o que ela ecoa Ã© o que nÃ³s mandamos na criaÃ§Ã£o da cobranÃ§a.
  const { data: pedido } = await sb
    .from("pedidos")
    // `telefone` entra pro TikTok: é o segundo identificador que a Events API
    // usa pra casar a venda quando o `ttclid` não veio (visita direta, ou
    // clique que perdeu o parâmetro no caminho).
    .select("email, nome_pagador, telefone")
    .eq("payment_id", paymentId)
    .maybeSingle();

  const email = (pedido?.email as string | null) ?? null;
  if (!email) {
    await auditar(sb, "woovi_pago_sem_email", { correlationID, quiz_response_id: quizId });
    return res.status(200).json({ ok: true, pedido: paymentId, entrega: "sem-email" });
  }

  // â”€â”€ O QUADRO COMPRADO JUNTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // Vira DIREITO e nao produto: uma linha em `quadros` com `musica_id` nulo,
  // exatamente como o webhook da Perfect Pay ja faz pro bump dele. O nulo e o
  // direito â€” ela ainda vai escolher de qual musica o quadro e.
  //
  // A fonte da verdade e a coluna do pedido pendente que NOS criamos, nao o
  // valor que chegou: valor nao diz o que foi comprado quando o preco tem
  // cinco bracos de teste. O sufixo `:q` da referencia entra so como rede,
  // pro caso raro de o postback chegar antes da nossa linha existir.
  //
  // ANTES do e-mail de entrega, de proposito: o e-mail conta que o quadro
  // esta liberado, e contar antes de liberar seria mentir na ordem errada.
  const comprouQuadro =
    existente?.bump_quadro === true || correlationID.endsWith(":q");
  if (comprouQuadro) {
    const { error: erroQuadro } = await sb.from("quadros").insert({
      email,
      pedido_id: pedidoDaVenda?.id ?? null,
    });
    // 23505 e o indice unico por pedido: reenvio do postback nao cria dois.
    if (erroQuadro && erroQuadro.code !== "23505") {
      await auditar(sb, "woovi_quadro_nao_liberado", {
        correlationID,
        erro: erroQuadro.message,
      });
      await alertarDono(
        "Quadro pago no bump e NAO liberado",
        `<p>O quadro veio junto no PIX e o direito nao foi criado:` +
          ` ${erroQuadro.message}<br>${email} Â· ${correlationID}</p>` +
          `<p>Ela pagou e o painel nao vai mostrar o quadro pra montar.</p>`,
      );
    }
  }

  const entrega = await mandarEmailDeEntrega(sb, {
    email,
    musica,
    nomePagador: (pedido?.nome_pagador as string | null) ?? null,
  });
  await auditar(sb, entrega.ok ? "woovi_email_enviado" : "woovi_email_falhou", {
    correlationID,
    email,
    ...(entrega.ok ? {} : { erro: entrega.erro }),
  });
  if (!entrega.ok) console.error("[woovi] e-mail falhou:", entrega.erro);

  // â”€â”€ A VENDA VAI PRA UTMIFY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // DEPOIS da entrega, de propÃ³sito: relatÃ³rio nunca pode atrasar (nem
  // arriscar) o que a pessoa pagou pra receber.
  //
  // Faltava, e o buraco era grande: com o PIX inteiro na Woovi, a UTMify
  // passou a ver 1 venda a cada 9. Um painel que mostra 11% do faturamento Ã©
  // pior que painel nenhum â€” ele parece uma queda.
  //
  // Os UTMs saem do NOSSO banco (captura first-touch), nÃ£o do que o gateway
  // ecoa: Ã© o dado mais confiÃ¡vel que temos da origem do clique.
  try {
    const { data: q } = await sb
      .from("quiz_responses")
      .select("session_id, attribution")
      .eq("id", quizId)
      .maybeSingle();
    await enviarVendaUtmify({
      orderId: paymentId,
      status: "paid",
      valorCentavos: status.valorCentavos ?? 0,
      email,
      nome: (pedido?.nome_pagador as string | null) ?? null,
      src: (q?.session_id as string | null) ?? null,
      attribution: (q?.attribution as Record<string, string | undefined> | null) ?? null,
      moeda: "BRL",
      taxaCentavos: status.taxaCentavos ?? 0,
      aprovadoEm: new Date(),
    });

    // â”€â”€ E A VENDA VAI PRO TIKTOK, DAQUI E NÃƒO DA /obrigado â”€â”€â”€â”€â”€â”€
    //
    // O pixel tambÃ©m dispara `CompletePayment` lÃ¡, mas `/obrigado` Ã© pÃ¡gina
    // que muita gente nunca vÃª: quem paga PIX no aplicativo do banco nÃ£o
    // volta. JÃ¡ foi medido com o Google, em 28/08: 23 vendas num dia, 8
    // contadas pela tag. Contar venda sÃ³ pelo navegador Ã© aceitar perder dois
    // terÃ§os, e foi por isso que `api/conversoes.ts` precisou existir.
    //
    // Os dois mandam o MESMO `event_id` (a referÃªncia do pagamento), entÃ£o o
    // TikTok deduplica e a cobertura vira a UNIÃƒO dos dois caminhos em vez da
    // interseÃ§Ã£o. O `ttclid` sai da atribuiÃ§Ã£o first-touch, que Ã© o que dÃ¡ ao
    // evento alguÃ©m em quem casar.
    const attr = (q?.attribution ?? null) as Record<string, string | undefined> | null;
    const tiktok = await venderNoTiktok({
      eventId: paymentId,
      valor: (status.valorCentavos ?? 0) / 100,
      moeda: "BRL",
      email,
      telefone: (pedido?.telefone as string | null) ?? null,
      ttclid: attr?.ttclid ?? null,
      quando: new Date(),
    });

    // ── O RESULTADO FICA GRAVADO, e não é zelo ──────────────
    //
    // O retorno era descartado e a lib só escrevia no `console.error`, então
    // do nosso lado esta integração era invisível: em 02/09 a primeira venda
    // vinda do TikTok chegou, o painel deles contabilizou, e aqui não havia
    // uma linha provando isso. Eu procurei e concluí que tinha falhado.
    //
    // O modo de falhar que isso esconde é o caro: token expirado ou pixel
    // trocado não derrubam nada, só param de mandar conversão — e a campanha
    // vai perdendo otimização em silêncio até alguém estranhar o CPA semanas
    // depois. Mesmo padrão do `catch {}` vazio que o CLAUDE.md lista como erro
    // a não repetir.
    //
    // Grava sucesso E fracasso: sem o sucesso não dá pra saber se o silêncio
    // é "não vendeu" ou "parou de mandar".
    await auditar(sb, tiktok.ok ? "tiktok_conversao_enviada" : "tiktok_conversao_falhou", {
      payment_id: paymentId,
      valor: (status.valorCentavos ?? 0) / 100,
      com_ttclid: Boolean(attr?.ttclid),
      motivo: tiktok.motivo ?? null,
    });
  } catch (err) {
    // RelatÃ³rio que falha nÃ£o derruba entrega jÃ¡ feita.
    console.error("[woovi] utmify falhou:", err);
  }

  console.log("[woovi] liberado:", { paymentId, musica: musica.id });
  return res.status(200).json({ ok: true, pedido: paymentId, quiz: quizId, entrega: entrega.ok });
}

