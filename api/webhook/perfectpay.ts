// Webhook da Perfect Pay: confirma o pagamento e LIBERA o presente.
//
// Gêmeo do api/webhook/cakto.ts — mesma lógica de baixo (casar música,
// idempotência, e-mail com o link), só muda o MAPEAMENTO dos campos, que na
// Perfect Pay é diferente:
//   - Autenticação: um `token` no corpo (ou ?token=), não assinatura HMAC.
//   - Status: string ("approved"/"paid"/"a"), não enum numérico.
//   - Id da transação: `code`.
//   - Valor: `sale_amount` em REAIS (não centavos).
//   - Ponte de sessão: `metadata.src` (o `?src=<session_id>` do checkout).
//
// Config no painel Perfect Pay:
//   Webhook  = https://www.serenatagift.com/api/webhook/perfectpay?token=<segredo>
//   Redirect = https://www.serenatagift.com/obrigado
//
// Regra de ouro do CLAUDE.md: NUNCA liberar sem confirmação, e o inverso
// (confirmado que não libera) é igualmente grave.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailPresentePronto } from "../../emails/presente-pronto.js";
import { enviarVendaUtmify } from "../lib/utmify.js";

type Req = IncomingMessage & {
  method?: string;
  url?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
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

// Os UTMs da venda saem do NOSSO banco (captura first-touch), não do que o
// gateway ecoa: é o dado mais confiável que temos da origem do clique.
async function buscarAttribution(
  src: string | null,
  email: string | null,
): Promise<Record<string, string | undefined> | null> {
  try {
    const sb = db();
    if (src) {
      const { data } = await sb
        .from("quiz_responses")
        .select("attribution")
        .eq("session_id", src)
        .maybeSingle();
      if (data?.attribution) return data.attribution as Record<string, string | undefined>;
    }
    if (email) {
      const { data } = await sb
        .from("quiz_responses")
        .select("attribution")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.attribution) return data.attribution as Record<string, string | undefined>;
    }
  } catch (err) {
    console.error("[perfectpay] attribution falhou:", err);
  }
  return null;
}

async function auditar(nome: string, dados: unknown) {
  try {
    await db().from("funnel_events").insert({ event_name: nome, event_data: dados });
  } catch (err) {
    console.error("[perfectpay] auditoria falhou:", err);
  }
}

// A Perfect Pay pode mandar aninhado (JSON) ou achatado (form). Os acessos
// abaixo tentam os dois: `customer.email` OU `customer_email`.
type Corpo = {
  token?: string;
  code?: string;
  sale_status_enum_key?: string;
  sale_status_detail?: string;
  sale_status?: string;
  order_status?: string;
  sale_amount?: number | string;
  currency_enum_key?: string;
  customer?: { email?: string; full_name?: string; name?: string };
  customer_email?: string;
  customer_name?: string;
  metadata?: { src?: string; ref?: string };
  src?: string;
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    const body = (req.body ?? {}) as Corpo;

    // ── 1. SEGREDO, FAIL-CLOSED ──────────────────────────────
    // Sem o segredo configurado, RECUSA (não libera) — o erro "webhook
    // fail-open" do CLAUDE.md. O token vem no corpo ou em ?token=.
    const esperado = process.env.PERFECTPAY_WEBHOOK_SECRET;
    if (!esperado) {
      await auditar("perfectpay_sem_segredo_configurado", {});
      console.error("[perfectpay] PERFECTPAY_WEBHOOK_SECRET não configurado — recusando");
      return res.status(503).json({ error: "webhook não configurado" });
    }
    let tokenUrl: string | null = null;
    try {
      tokenUrl = new URL(req.url ?? "", "http://x").searchParams.get("token");
    } catch {
      tokenUrl = null;
    }
    const recebido = body.token ?? tokenUrl;
    if (recebido !== esperado) {
      await auditar("perfectpay_recusado", { motivo: "token inválido" });
      return res.status(401).json({ error: "token inválido" });
    }

    // ── 2. EXTRAI OS CAMPOS ──────────────────────────────────
    const paymentId = body.code ?? null;
    const email = (body.customer?.email ?? body.customer_email ?? "").trim().toLowerCase() || null;
    const nomeCliente = body.customer?.full_name ?? body.customer?.name ?? body.customer_name ?? null;
    // `src` = session_id do nosso funil, mandado no checkout como ?src=.
    const src = body.metadata?.src ?? body.metadata?.ref ?? body.src ?? null;
    const rawStatus = String(
      body.sale_status_enum_key ?? body.sale_status_detail ?? body.sale_status ?? body.order_status ?? "",
    ).toLowerCase();
    const reais = typeof body.sale_amount === "number" ? body.sale_amount : Number(body.sale_amount);

    // Auditoria SEM o token (é o nosso segredo; não guarda em claro).
    await auditar(`perfectpay_${rawStatus || "sem_status"}`, {
      code: paymentId,
      email,
      src,
      sale_amount: body.sale_amount ?? null,
    });

    // ── 3. REEMBOLSO / CHARGEBACK ────────────────────────────
    if (/refund|reembols|estorn|charge\s*back|chargeback|dispute/.test(rawStatus)) {
      if (paymentId) {
        await db().from("pedidos").update({ status: "reembolsado" }).eq("payment_id", paymentId);
        // A Utmify precisa saber do estorno, senão o relatório conta uma venda
        // que não existe mais.
        await enviarVendaUtmify({
          orderId: paymentId,
          status: /charge\s*back|chargeback|dispute/.test(rawStatus) ? "chargedback" : "refunded",
          valorCentavos: Number.isFinite(reais) ? Math.round(reais * 100) : 0,
          email,
          nome: nomeCliente,
          src,
          attribution: await buscarAttribution(src, email),
          reembolsadoEm: new Date(),
        });
      }
      return res.status(200).json({ ok: true, reembolsado: true });
    }

    // ── 4. É PAGAMENTO APROVADO? ─────────────────────────────
    const pago = ["approved", "paid", "a", "aprovado"].includes(rawStatus);
    if (!pago) return res.status(200).json({ ok: true, nota: `status não aprovado (${rawStatus})` });
    if (!paymentId) {
      await auditar("perfectpay_sem_code", { body });
      return res.status(400).json({ error: "evento sem code" });
    }

    const sb = db();

    // ── 5. IDEMPOTÊNCIA ──────────────────────────────────────
    // A Perfect Pay reenvia. Só encerra cedo se o pedido JÁ estiver pago;
    // pedido gravado mas sem entrega precisa seguir e completar.
    const { data: existente } = await sb
      .from("pedidos")
      .select("id, status, musica_id")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (existente?.status === "pago") {
      return res.status(200).json({ ok: true, duplicado: true });
    }

    // ── 6. CASA O PAGAMENTO COM A SESSÃO ─────────────────────
    // Só pelo src (session_id) ou pelo e-mail. SEM fallback "quiz anônimo mais
    // recente": sob concorrência entrega a música da pessoa errada (erro
    // herdado listado no CLAUDE.md — o próprio perfectpay.js antigo fazia isso).
    let quiz: { id: string } | null = null;
    if (src) {
      const { data } = await sb.from("quiz_responses").select("id").eq("session_id", src).maybeSingle();
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

    // ── 7. GRAVA O PEDIDO ────────────────────────────────────
    // sale_amount vem em REAIS; guardamos em centavos.
    const { error: erroPedido } = await sb.from("pedidos").upsert(
      {
        payment_id: paymentId,
        gateway: "perfectpay",
        status: "pago",
        email,
        valor_centavos: Number.isFinite(reais) ? Math.round(reais * 100) : null,
        quiz_response_id: quiz?.id ?? null,
        musica_id: musica?.id ?? null,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" },
    );
    if (erroPedido) {
      await auditar("perfectpay_pedido_falhou", { paymentId, erro: erroPedido.message });
      console.error("[perfectpay] gravar pedido falhou:", erroPedido.message);
      return res.status(500).json({ error: "falha ao gravar pedido" });
    }

    // Pago sem música casada: dinheiro entrou e pedido registrado, mas não há o
    // que entregar automático. Falha alto na auditoria pra tratativa humana.
    if (!musica) {
      await auditar("perfectpay_pago_sem_musica", { paymentId, src, email });
      console.error("[perfectpay] pago mas sem música casada:", { paymentId, src, email });
      return res.status(200).json({ ok: true, alerta: "pago sem música casada" });
    }

    // ── 8. E-MAIL COM O LINK DO EDITOR ───────────────────────
    // Falha de e-mail NÃO derruba o webhook (senão a Perfect Pay reenvia o
    // evento e o comprador recebe duplicado). Vira evento de auditoria.
    if (email) {
      try {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) throw new Error("RESEND_API_KEY ausente");
        const { data: q } = await sb
          .from("quiz_responses")
          .select("respostas")
          .eq("id", musica.quiz_response_id)
          .maybeSingle();
        const nome =
          ((q?.respostas ?? {}) as Record<string, string>).nome ??
          nomeCliente ??
          "quem você ama";

        const linkEditor = `${SITE}/editar/${musica.token_edicao}`;
        const linkPresente = `${SITE}/p/${musica.token}`;
        const { error } = await new Resend(chave).emails.send({
          from: "Serenata <contato@serenatagift.com>",
          to: [email],
          subject: `A música de ${nome} está pronta`,
          html: emailPresentePronto({
            nome,
            titulo: musica.titulo ?? "Sua música",
            linkEditor,
            linkPresente,
          }),
          text: `A música de ${nome} está pronta.\n\nMonte o presente (coloque uma foto e uma frase):\n${linkEditor}\n\nO presente já funciona do jeito que está:\n${linkPresente}\n\nGuarde este e-mail: o link do editor é seu e só ele deixa editar a página.`,
        });
        if (error) throw new Error(error.message);
        await auditar("perfectpay_email_enviado", { paymentId, email });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await auditar("perfectpay_email_falhou", { paymentId, email, erro: msg });
        console.error("[perfectpay] e-mail falhou:", msg);
      }
    }

    // ── 9. REPORTA A VENDA PRA UTMIFY ────────────────────────
    // Depois da entrega, de propósito: relatório nunca pode atrasar (nem
    // arriscar) o que a pessoa pagou pra receber.
    await enviarVendaUtmify({
      orderId: paymentId,
      status: "paid",
      valorCentavos: Number.isFinite(reais) ? Math.round(reais * 100) : 0,
      email,
      nome: nomeCliente,
      src,
      attribution: await buscarAttribution(src, email),
      aprovadoEm: new Date(),
    });

    console.log("[perfectpay] liberado:", { paymentId, musica: musica.id });
    return res.status(200).json({ ok: true, liberado: true });
  } catch (err) {
    console.error("[perfectpay] erro:", err);
    return res.status(500).json({ error: "interno" });
  }
}
