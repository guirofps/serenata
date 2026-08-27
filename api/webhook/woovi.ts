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

  // ── DE QUEM É ────────────────────────────────────────────────
  //
  // A referência que a gente mandou é `serenata:<quiz_response_id>`. Sai
  // dela, sem adivinhação: SEM fallback por "quiz mais recente", que sob
  // concorrência entrega a música da pessoa errada.
  const quizId = correlationID.startsWith("serenata:")
    ? correlationID.slice("serenata:".length)
    : null;

  const { error: erroPedido } = await sb.from("pedidos").upsert(
    {
      payment_id: paymentId,
      gateway: "woovi",
      status: "pago",
      status_gateway: status.statusCru,
      valor_centavos: status.valorCentavos,
      taxa_centavos: status.taxaCentavos,
      quiz_response_id: quizId,
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

  // A ENTREGA ainda não sai daqui. Enquanto isto for preview, gravar o
  // pedido basta pra provar o caminho, e mandar e-mail de produto a partir
  // de um ambiente de teste seria pior que não testar.
  return res.status(200).json({ ok: true, pedido: paymentId, quiz: quizId });
}
