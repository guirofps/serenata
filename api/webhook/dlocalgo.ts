// Aviso da dLocal Go (OXXO e transferência do México, Ballad).
//
// Não se registra no painel: o endereço vai em CADA pagamento
// (`notification_url`, ver `dlocalgo-checkout.ts`).
//
// FAIL-CLOSED: sem chave configurada, recusa. A assinatura prova ORIGEM;
// `confirmarPagamentoDlocal` reconsulta a API e só ela prova PAGAMENTO. Erro
// nosso devolve 500 pra eles tentarem de novo (a cada 10 min, por 30 dias): a
// idempotência está no banco, então o reenvio nunca entrega duas vezes.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { assinaturaDlocalConfere, confirmarPagamentoDlocal, idDlocalValido } from "../lib/dlocalgo.js";

type Req = IncomingMessage & { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = ServerResponse & { status: (c: number) => Res; json: (b: unknown) => void };

// A assinatura é sobre o corpo CRU: o parser da Vercel re-serializa o JSON.
export const config = { api: { bodyParser: false } };

function corpoCru(req: Req): Promise<string> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    req.on("data", (p: Buffer) => partes.push(p));
    req.on("end", () => ok(Buffer.concat(partes).toString("utf8")));
    req.on("error", falha);
  });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const apiKey = process.env.DLOCALGO_API_KEY;
  const secretKey = process.env.DLOCALGO_SECRET_KEY;
  if (!apiKey || !secretKey) {
    console.error("[dlocal] chaves ausentes, recusando");
    return res.status(500).json({ error: "webhook nao configurado" });
  }

  let corpo: string;
  try {
    corpo = await corpoCru(req);
  } catch {
    return res.status(400).json({ error: "corpo ilegivel" });
  }

  const auth = req.headers.authorization;
  if (!assinaturaDlocalConfere(Array.isArray(auth) ? auth[0] : auth, corpo, apiKey, secretKey)) {
    console.warn("[dlocal] assinatura invalida");
    return res.status(401).json({ error: "assinatura invalida" });
  }

  let id: unknown;
  try {
    id = (JSON.parse(corpo) as { payment_id?: unknown }).payment_id;
  } catch {
    return res.status(400).json({ error: "json invalido" });
  }
  if (!idDlocalValido(id)) return res.status(200).json({ ok: true, ignorado: "sem payment_id" });

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return res.status(500).json({ error: "supabase env ausente" });
  const sb = createClient(url, chave, { auth: { persistSession: false } });

  try {
    const r = await confirmarPagamentoDlocal(sb, id);
    await sb.from("funnel_events").insert({ event_name: "dlocal_webhook", event_data: { pagamento: id, resultado: r } });
    // "não pago" é ficha do OXXO gerada e ainda não paga, ou vencida: 200.
    return res.status(200).json(r);
  } catch (err) {
    console.error("[dlocal] confirmação falhou:", err);
    return res.status(500).json({ error: "falhou, tente de novo" });
  }
}
