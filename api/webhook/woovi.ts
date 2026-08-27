// WEBHOOK DA WOOVI.
//
// ── DUAS PERGUNTAS DIFERENTES, DUAS TRAVAS ───────────────────────
//
// 1. "Esta mensagem veio mesmo da Woovi?"  → ASSINATURA (RSA-SHA256).
// 2. "O dinheiro entrou mesmo?"            → CONSULTA na API.
//
// Não é redundância. A assinatura prova ORIGEM; só a consulta prova
// PAGAMENTO. Um postback legítimo pode chegar por um evento que não é
// pagamento, e um corpo pode ser replicado depois de um estorno.
//
// Este é o ponto em que a Woovi é melhor que a MillionsPay, cujo postback
// não é assinado de forma nenhuma: lá eu tive que suprir a falta com segredo
// na URL. Aqui a origem é provada com criptografia.
//
// ── A ASSINATURA É SOBRE O CORPO CRU ─────────────────────────────
//
// Com o parser do Vercel ligado, o JSON re-serializado quase nunca bate byte
// a byte com o original, e a verificação falharia em tudo. Por isso
// `bodyParser: false` e leitura manual do stream. Mesmo motivo do webhook do
// Resend.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { woovi, assinaturaWooviConfere } from "../../src/lib/woovi.js";
import { musicaDoQuiz, refazerSeFaltou, mandarEmailDeEntrega } from "../lib/entrega.js";
import { creditarUpsell } from "../lib/creditar-upsell.js";
import { OFERTAS } from "../../src/lib/creditos.js";

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
 * O UPSELL PAGO: grava o pedido e DÁ o que foi comprado.
 *
 * Sai cedo do fluxo principal porque quase nada dele se aplica: não há quiz,
 * não há música, não há e-mail de entrega. O que há é um direito a criar.
 *
 * O e-mail vem do PEDIDO PENDENTE, que nasceu de uma sessão autenticada em
 * `criar-pix-upsell.ts`. Não vem do que a Woovi ecoa: creditar pelo e-mail
 * que o gateway devolve seria confiar num campo que não é a nossa prova de
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
    // Referência com oferta que não existe no catálogo. Não inventa nada:
    // grita e deixa o dinheiro registrado pra alguém olhar.
    await auditar(sb, "woovi_upsell_desconhecido", { correlationID, ofertaId });
    console.error("[woovi] upsell desconhecido:", ofertaId);
    return res.status(200).json({ ok: true, nota: "oferta desconhecida" });
  }

  // O VALOR TEM QUE BATER com o catálogo, e não só com o pedido pendente:
  // é a segunda trava contra alguém pagar R$ 1 num crédito de R$ 28.
  const esperado = Math.round(oferta.precoBrl * 100);
  if (status.valorCentavos && status.valorCentavos !== esperado) {
    await auditar(sb, "woovi_upsell_valor_divergente", {
      correlationID,
      esperado,
      recebido: status.valorCentavos,
    });
    return res.status(200).json({ ok: true, nota: "valor divergente, não creditado" });
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
    // O ID É O QUE SEGURA O REENVIO: os índices únicos que impedem crédito
    // duplicado são por `pedido_id`. Sem ele, cada reenvio creditaria de novo.
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
    // Pagou e não recebeu: o pior desfecho. Sai no log e no evento, e o
    // pedido fica pago pra o dono liberar à mão pelo painel.
    console.error("[woovi] upsell pago e NÃO creditado:", r.erro);
  }

  return res.status(200).json({ ok: true, upsell: oferta.id, creditou: r.creditou, quadro: r.quadro });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "use POST" });

  const cru = await corpoCru(req);

  // ── TRAVA 1: a assinatura ────────────────────────────────────
  //
  // FECHADO por natureza: sem assinatura válida, não passa. Não existe
  // caminho "sem assinatura configurada" que aceite, que é o erro herdado
  // que o CLAUDE.md proíbe.
  const assinatura = cabecalho(req, "x-webhook-signature");
  if (!(await assinaturaWooviConfere(cru, assinatura))) {
    // 401 e não 404: aqui o endereço não é segredo, a assinatura é que manda.
    console.error("[woovi] assinatura inválida");
    return res.status(401).json({ error: "assinatura inválida" });
  }

  let evento: { event?: string; charge?: { correlationID?: string; status?: string } };
  try {
    evento = JSON.parse(cru);
  } catch {
    return res.status(400).json({ error: "corpo inválido" });
  }

  const sb = db();
  const correlationID = evento?.charge?.correlationID;
  if (!correlationID) {
    // Teste de webhook do painel deles chega sem cobrança. 200 pra não ficar
    // vermelho no painel por uma coisa que está certa.
    await auditar(sb, "woovi_evento_sem_cobranca", { evento: evento?.event ?? null });
    return res.status(200).json({ ok: true, nota: "sem correlationID" });
  }

  // ── TRAVA 2: pergunta pra fonte ──────────────────────────────
  let status;
  try {
    status = await woovi.consultar(correlationID);
  } catch (err) {
    // 500 de propósito: gateway reenvia postback com erro. Devolver 200 aqui
    // seria descartar uma venda porque a consulta piscou.
    console.error("[woovi] consulta falhou:", err);
    await auditar(sb, "woovi_consulta_falhou", { correlationID });
    return res.status(500).json({ error: "não consegui confirmar na fonte" });
  }

  await auditar(sb, `woovi_${status.statusCru.toLowerCase()}`, {
    correlationID,
    valor: status.valorCentavos,
    taxa: status.taxaCentavos,
  });

  if (!status.pago) {
    return res.status(200).json({ ok: true, nota: `status ${status.statusCru}` });
  }

  // ── IDEMPOTÊNCIA ─────────────────────────────────────────────
  const paymentId = `woovi:${correlationID}`;
  const { data: existente } = await sb
    .from("pedidos")
    .select("id, status, valor_centavos")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (existente?.status === "pago") {
    return res.status(200).json({ ok: true, duplicado: true });
  }

  // ── O VALOR TEM QUE BATER ────────────────────────────────────
  //
  // Contra o pedido pendente que nós mesmos criamos ao gerar o PIX. Sem
  // isto, uma cobrança de R$ 1 criada por fora com a referência de alguém
  // liberaria um produto de R$ 54,90.
  if (existente?.valor_centavos && status.valorCentavos &&
      existente.valor_centavos !== status.valorCentavos) {
    await auditar(sb, "woovi_valor_divergente", {
      correlationID,
      esperado: existente.valor_centavos,
      recebido: status.valorCentavos,
    });
    return res.status(200).json({ ok: true, nota: "valor divergente, não liberado" });
  }

  // ── UPSELL? ──────────────────────────────────────────────────
  //
  // `up:<oferta>:<uuid>` é compra de crédito ou de quadro, feita por alguém
  // logado no painel. Caminho inteiro diferente do funil: não tem música pra
  // entregar, tem direito pra dar.
  //
  // A oferta é conferida contra o CATÁLOGO, nunca aceita como veio: o texto
  // chega dentro de uma referência que nós criamos, mas quem valida no fim é
  // o servidor, e é barato manter assim.
  if (correlationID.startsWith("up:")) {
    return await pagarUpsell(sb, res, { correlationID, paymentId, status });
  }

  // ── DE QUEM É ────────────────────────────────────────────────
  //
  // A referência que a gente mandou é `serenata:<quiz_response_id>`. Sai
  // dela, sem adivinhação: SEM fallback por "quiz mais recente", que sob
  // concorrência entrega a música da pessoa errada.
  //
  // O `.split(":")[0]` NÃO é paranoia: quando a cobrança anterior daquele
  // quiz venceu, a Woovi recusa reaproveitar o id e a nova nasce como
  // `serenata:<quizId>:r2`. Sem cortar no primeiro dois-pontos, o id do quiz
  // sairia com o sufixo colado e a busca não acharia música nenhuma — a
  // pessoa pagaria e o webhook registraria "pago sem música".
  const quizId = correlationID.startsWith("serenata:")
    ? (correlationID.slice("serenata:".length).split(":")[0] ?? null)
    : null;

  const musica = quizId ? await musicaDoQuiz(sb, quizId) : null;

  const { error: erroPedido } = await sb.from("pedidos").upsert(
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
    },
    { onConflict: "payment_id" },
  );
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

  // ── A ENTREGA ────────────────────────────────────────────────
  //
  // DEPOIS de gravar o pedido, de propósito. Se o e-mail estourasse antes, a
  // pessoa teria pagado e o pagamento não existiria em lugar nenhum; nesta
  // ordem, o pior caso é uma venda registrada sem e-mail, que dá pra reenviar
  // olhando o painel.
  //
  // NÃO devolve erro se a entrega falhar: 500 faria a Woovi reenviar o
  // evento, e o comprador receberia o mesmo e-mail de novo.
  if (!musica) {
    // Pagou e não achamos a música. Grita no log e no banco: não existe
    // caminho automático daqui, alguém tem que olhar.
    await auditar(sb, "woovi_pago_sem_musica", { correlationID, quiz_response_id: quizId });
    console.error("[woovi] PAGO SEM MÚSICA:", correlationID);
    return res.status(200).json({ ok: true, pedido: paymentId, entrega: "sem-musica" });
  }

  if (await refazerSeFaltou(sb, musica)) {
    await auditar(sb, "compra_sem_musica_refeita", {
      musica: musica.id,
      gateway: "woovi",
      statusAnterior: musica.status,
    });
  }

  // O e-mail do PEDIDO, que é o do quiz: a Woovi não pede e-mail pra pagar
  // um PIX, então o que ela ecoa é o que nós mandamos na criação da cobrança.
  const { data: pedido } = await sb
    .from("pedidos")
    .select("email, nome_pagador")
    .eq("payment_id", paymentId)
    .maybeSingle();

  const email = (pedido?.email as string | null) ?? null;
  if (!email) {
    await auditar(sb, "woovi_pago_sem_email", { correlationID, quiz_response_id: quizId });
    return res.status(200).json({ ok: true, pedido: paymentId, entrega: "sem-email" });
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

  console.log("[woovi] liberado:", { paymentId, musica: musica.id });
  return res.status(200).json({ ok: true, pedido: paymentId, quiz: quizId, entrega: entrega.ok });
}
