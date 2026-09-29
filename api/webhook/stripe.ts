// Webhook do Stripe (Ballad Gift, EUA).
//
// Config: endpoint registrado pela API em 29/09, na conta do Stripe da Ballad,
//   URL     = https://www.balladgift.com/api/webhook/stripe
//   Eventos = checkout.session.completed, checkout.session.async_payment_succeeded
//   Segredo (whsec_...) em STRIPE_WEBHOOK_SECRET, SÓ no projeto balladgift.
//
// FAIL-CLOSED: sem segredo configurado, recusa (o erro herdado que o CLAUDE.md
// manda não repetir é `!secretEsperado || ...` aceitando qualquer POST).
//
// Assinatura prova ORIGEM; `confirmarSessaoStripe` reconsulta a API e só ela
// prova PAGAMENTO. Erro nosso devolve 500 pro Stripe tentar de novo: a
// idempotência está no banco, então o reenvio nunca entrega duas vezes.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { assinaturaStripeConfere, confirmarSessaoStripe } from "../lib/stripe.js";

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

const EVENTOS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET ausente, recusando");
    return res.status(500).json({ error: "webhook nao configurado" });
  }

  let corpo: string;
  try {
    corpo = await corpoCru(req);
  } catch {
    return res.status(400).json({ error: "corpo ilegivel" });
  }

  const sig = req.headers["stripe-signature"];
  if (!assinaturaStripeConfere(Array.isArray(sig) ? sig[0] : sig, corpo, segredo)) {
    console.warn("[stripe] assinatura invalida");
    return res.status(401).json({ error: "assinatura invalida" });
  }

  let ev: { type?: string; data?: { object?: { id?: string; object?: string } } };
  try {
    ev = JSON.parse(corpo);
  } catch {
    return res.status(400).json({ error: "json invalido" });
  }

  const sessaoId = ev.data?.object?.id;
  if (!ev.type || !EVENTOS.has(ev.type) || ev.data?.object?.object !== "checkout.session" || !sessaoId) {
    return res.status(200).json({ ok: true, ignorado: ev.type ?? "sem tipo" });
  }

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return res.status(500).json({ error: "supabase env ausente" });
  const sb = createClient(url, chave, { auth: { persistSession: false } });

  try {
    const r = await confirmarSessaoStripe(sb, sessaoId);
    await sb.from("funnel_events").insert({
      event_name: "stripe_webhook",
      event_data: { tipo: ev.type, sessao: sessaoId, resultado: r },
    });
    // "não pago" num evento de sessão completa é pagamento assíncrono ainda
    // pendente: 200, e o `async_payment_succeeded` chega depois.
    return res.status(200).json(r);
  } catch (err) {
    console.error("[stripe] confirmação falhou:", err);
    return res.status(500).json({ error: "falhou, tente de novo" });
  }
}
