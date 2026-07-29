// Webhook da Cakto: confirma o pagamento e LIBERA o presente.
//
// Imports relativos COM extensão .js: este arquivo vira ESM em runtime na
// Vercel e o resolver do Node não aceita specifier sem extensão.
//
// Config no painel Cakto → Apps → Webhooks:
//   URL   = https://www.serenatagift.com/api/webhook/cakto
//   Tipo  = Agrupado
//   Evento= purchase_approved (+ reembolso e chargeback)
//
// A regra de ouro do CLAUDE.md: NUNCA liberar sem confirmação. Toda a
// mecânica abaixo existe pra isso — e para o inverso, que é igualmente
// grave: pagamento confirmado que não libera.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailPresentePronto } from "../../emails/presente-pronto.js";

type Req = IncomingMessage & { method?: string; body?: unknown; headers: Record<string, string | string[] | undefined> };
type Res = ServerResponse & { status: (c: number) => Res; json: (b: unknown) => void };

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente no webhook");
  return createClient(url, key, { auth: { persistSession: false } });
}

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";

type Item = {
  offer_type?: string;
  status?: string;
  paidAt?: string;
  refId?: string;
  id?: string;
  sck?: string;
  amount?: number;
  refundedAt?: string;
  chargedbackAt?: string;
  customer?: { email?: string; name?: string };
  product?: { id?: string; name?: string };
  offer?: { id?: string; name?: string };
};

async function auditar(nome: string, dados: unknown) {
  try {
    await db().from("funnel_events").insert({ event_name: nome, event_data: dados });
  } catch (err) {
    // Auditoria nunca derruba o webhook.
    console.error("[cakto] auditoria falhou:", err);
  }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    const evento = (req.body ?? {}) as { event?: string; type?: string; data?: Item[] | Item; secret?: string };

    // ── 1. SEGREDO, FAIL-CLOSED ──────────────────────────────
    // O numaya faz `!secretEsperado || recebido === esperado`: sem a env
    // configurada, QUALQUER POST da internet libera venda. É o "webhook
    // fail-open" listado no CLAUDE.md como erro a não repetir. Aqui a
    // ausência de segredo RECUSA em vez de liberar.
    const esperado = process.env.CAKTO_WEBHOOK_SECRET;
    if (!esperado) {
      await auditar("cakto_sem_segredo_configurado", {});
      console.error("[cakto] CAKTO_WEBHOOK_SECRET não configurado — recusando");
      return res.status(503).json({ error: "webhook não configurado" });
    }
    const cab = req.headers["x-cakto-secret"] ?? req.headers["x-webhook-secret"];
    const recebido = evento.secret ?? (Array.isArray(cab) ? cab[0] : cab);
    const tipo = evento.event ?? evento.type ?? "desconhecido";

    if (recebido !== esperado) {
      await auditar(`cakto_${tipo}_recusado`, { motivo: "segredo inválido" });
      return res.status(401).json({ error: "segredo inválido" });
    }

    // Trilha de auditoria de todo evento aceito.
    await auditar(`cakto_${tipo}`, { payload: evento.data ?? evento });

    const itens: Item[] = Array.isArray(evento.data) ? evento.data : evento.data ? [evento.data] : [];
    if (itens.length === 0) return res.status(200).json({ ok: true, nota: "sem itens" });

    const principal = itens.find((i) => i.offer_type === "main") ?? itens[0];
    const paymentId = principal.refId ?? principal.id ?? null;
    const email = principal.customer?.email?.trim().toLowerCase() ?? null;
    // `sck` carrega o session_id do nosso funil (mandado no link do checkout).
    const sck = principal.sck ?? null;

    // ── 2. REEMBOLSO / CHARGEBACK ────────────────────────────
    if (
      /refund|chargeback/i.test(tipo) ||
      principal.refundedAt ||
      principal.chargedbackAt
    ) {
      if (paymentId) {
        await db().from("pedidos").update({ status: "reembolsado" }).eq("payment_id", paymentId);
      }
      return res.status(200).json({ ok: true, reembolsado: true });
    }

    const pago = tipo === "purchase_approved" && (principal.status === "paid" || Boolean(principal.paidAt));
    if (!pago) return res.status(200).json({ ok: true, nota: "evento não é de pagamento aprovado" });
    if (!paymentId) {
      // Sem id não há idempotência possível: libera duplicado no primeiro
      // reenvio. Falha alto pra Cakto reenviar com payload completo.
      await auditar("cakto_sem_payment_id", { itens });
      return res.status(400).json({ error: "evento sem refId" });
    }

    const sb = db();

    // ── 3. IDEMPOTÊNCIA ──────────────────────────────────────
    // A Cakto reenvia o mesmo evento. Só encerra cedo se o pedido JÁ estiver
    // pago: pedido gravado mas sem entrega é entrega quebrada (retry depois
    // de falha parcial), e aí precisa seguir e completar.
    const { data: existente } = await sb
      .from("pedidos")
      .select("id, status, musica_id")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (existente?.status === "pago") {
      return res.status(200).json({ ok: true, duplicado: true });
    }

    // ── 4. CASA O PAGAMENTO COM A SESSÃO ─────────────────────
    // Só pelo sck (session_id) ou pelo e-mail informado no checkout. NÃO
    // existe fallback "quiz anônimo mais recente": sob concorrência isso
    // entrega a música da pessoa errada (erro herdado, CLAUDE.md).
    let quiz: { id: string } | null = null;
    if (sck) {
      const { data } = await sb.from("quiz_responses").select("id").eq("session_id", sck).maybeSingle();
      quiz = data;
    }
    if (!quiz && email) {
      const { data } = await sb
        .from("quiz_responses")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      quiz = data;
    }

    const { data: musica } = quiz
      ? await sb
          .from("musicas")
          .select("id, token, token_edicao, titulo, quiz_response_id")
          .eq("quiz_response_id", quiz.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    // ── 5. GRAVA O PEDIDO ────────────────────────────────────
    // O supabase-js NÃO lança: devolve { error }. Um upsert negado passaria
    // batido e responderia 200 — venda paga, sem registro e sem retry. Aqui
    // o erro vira 500 pra Cakto reenviar.
    const { error: erroPedido } = await sb.from("pedidos").upsert(
      {
        payment_id: paymentId,
        gateway: "cakto",
        status: "pago",
        email,
        valor_centavos: typeof principal.amount === "number" ? Math.round(principal.amount * 100) : null,
        quiz_response_id: quiz?.id ?? null,
        musica_id: musica?.id ?? null,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" },
    );
    if (erroPedido) {
      await auditar("cakto_pedido_falhou", { paymentId, erro: erroPedido.message });
      console.error("[cakto] gravar pedido falhou:", erroPedido.message);
      return res.status(500).json({ error: "falha ao gravar pedido" });
    }

    // Pagamento sem música casada: o dinheiro entrou e o pedido está
    // registrado (não se perde), mas não há o que entregar automaticamente.
    // Falha alto na auditoria pra virar tratativa humana.
    if (!musica) {
      await auditar("cakto_pago_sem_musica", { paymentId, sck, email });
      console.error("[cakto] pago mas sem música casada:", { paymentId, sck, email });
      return res.status(200).json({ ok: true, alerta: "pago sem música casada" });
    }

    // ── 6. E-MAIL COM O LINK DO EDITOR ───────────────────────
    // É o único caminho até o token_edicao. Falha de e-mail NÃO derruba o
    // webhook: se estourasse, a Cakto reenviaria o evento inteiro e o
    // comprador receberia e-mail duplicado. Vira evento de auditoria.
    if (email) {
      try {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) throw new Error("RESEND_API_KEY ausente");
        const { data: q } = await sb
          .from("quiz_responses")
          .select("respostas")
          .eq("id", musica.quiz_response_id)
          .maybeSingle();
        const nome = ((q?.respostas ?? {}) as Record<string, string>).nome ?? "quem você ama";

        const linkEditor = `${SITE}/editar/${musica.token_edicao}`;
        const linkPresente = `${SITE}/p/${musica.token}`;
        const { error } = await new Resend(chave).emails.send({
          from: "Serenata <contato@serenatagift.com>",
          to: [email],
          // Sem emoji no assunto: emoji tende a mandar pra aba Promoções,
          // ainda mais em remetente novo.
          subject: `A música de ${nome} está pronta`,
          html: emailPresentePronto({
            nome,
            titulo: musica.titulo ?? "Sua música",
            linkEditor,
            linkPresente,
          }),
          // Versão texto: melhora a entrega (multipart/alternative).
          text: `A música de ${nome} está pronta.\n\nMonte o presente (coloque uma foto e uma frase):\n${linkEditor}\n\nO presente já funciona do jeito que está:\n${linkPresente}\n\nGuarde este e-mail: o link do editor é seu e só ele deixa editar a página.`,
        });
        if (error) throw new Error(error.message);
        await auditar("cakto_email_enviado", { paymentId, email });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await auditar("cakto_email_falhou", { paymentId, email, erro: msg });
        console.error("[cakto] e-mail falhou:", msg);
      }
    }

    console.log("[cakto] liberado:", { paymentId, musica: musica.id });
    return res.status(200).json({ ok: true, liberado: true });
  } catch (err) {
    console.error("[cakto] erro:", err);
    return res.status(500).json({ error: "interno" });
  }
}
