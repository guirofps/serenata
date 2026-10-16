import type { SupabaseClient } from "@supabase/supabase-js";
import { stripeApi } from "./stripe.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { avisarDonos } from "../../src/lib/avisar-donos.js";

// ESTORNO E CONTESTAÇÃO NO STRIPE (16/10).
//
// O webhook da Ballad só conhecia a venda (`checkout.session.completed`):
// reembolso e chargeback nunca viravam `reembolsado`, o painel contava venda
// estornada como venda, e ninguém era avisado do prazo de defesa de uma
// contestação. Espelha a regra do Asaas (`registrarEstorno` em
// `api/webhook/asaas.ts`): a reconsulta na API prova o estorno, estorno
// parcial só avisa, e o pedido só sai de `pago`.
//
// PRECISA dos eventos `charge.refunded` e `charge.dispute.created` marcados
// no endpoint do webhook, no painel do Stripe (hoje só os de checkout).

export const EVENTOS_ESTORNO = new Set(["charge.refunded", "charge.dispute.created"]);

type Charge = { id: string; payment_intent?: string | null; amount: number; amount_refunded: number; refunded: boolean };
type Disputa = { id: string; charge?: string; payment_intent?: string | null; amount: number; reason?: string; status?: string; evidence_details?: { due_by?: number } };

async function auditar(sb: SupabaseClient, nome: string, dados: unknown) {
  try {
    await sb.from("funnel_events").insert({ event_name: nome, event_data: dados });
  } catch {
    // auditoria nunca derruba o webhook
  }
}

async function alertar(assunto: string, html: string) {
  try {
    await avisarDonos({ assunto: `[${MARCA_ATIVA.nome}] ${assunto}`, html });
  } catch (err) {
    console.error("[stripe] alerta ao dono falhou:", err);
  }
}

/** Os pedidos nossos daquele pagamento: a sessão do checkout é a nossa chave (`stripe:<sessão>`). */
async function pedidosDoPagamento(sb: SupabaseClient, paymentIntent: string) {
  const r = await stripeApi<{ data: Array<{ id: string }> }>(
    "GET",
    `/checkout/sessions?payment_intent=${encodeURIComponent(paymentIntent)}&limit=5`,
  );
  const ids = (r.data ?? []).map((s) => `stripe:${s.id}`);
  if (!ids.length) return [];
  const { data } = await sb
    .from("pedidos")
    .select("id, payment_id, status, email, quiz_response_id, valor_centavos")
    .in("payment_id", ids);
  return data ?? [];
}

/** Trata o evento e devolve o resumo pro log. Lança em erro nosso (o Stripe tenta de novo). */
export async function registrarEstornoStripe(
  sb: SupabaseClient,
  ev: { type: string; data?: { object?: { id?: string } } },
): Promise<Record<string, unknown>> {
  const id = ev.data?.object?.id;
  if (!id) return { ignorado: "sem id" };

  const chargeback = ev.type === "charge.dispute.created";
  // A RECONSULTA prova: o corpo do evento só diz que algo chegou assinado.
  let paymentIntent: string | null = null;
  let parcial = false;
  let detalhe = "";
  if (chargeback) {
    const d = await stripeApi<Disputa>("GET", `/disputes/${encodeURIComponent(id)}`);
    paymentIntent = d.payment_intent ?? null;
    const prazo = d.evidence_details?.due_by
      ? new Date(d.evidence_details.due_by * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "?";
    detalhe = `Contestação ${d.id}: motivo ${d.reason ?? "?"}, US$ ${(d.amount / 100).toFixed(2)}, prazo de defesa ${prazo}.`;
  } else {
    const c = await stripeApi<Charge>("GET", `/charges/${encodeURIComponent(id)}`);
    paymentIntent = c.payment_intent ?? null;
    parcial = !c.refunded && c.amount_refunded > 0 && c.amount_refunded < c.amount;
    if (!c.refunded && !parcial) return { ignorado: "cobrança sem estorno na reconsulta" };
    detalhe = `Cobrança ${c.id}: estornado US$ ${(c.amount_refunded / 100).toFixed(2)} de US$ ${(c.amount / 100).toFixed(2)}.`;
  }
  if (!paymentIntent) {
    await alertar("Estorno no Stripe sem pagamento ligado", `<p>${detalhe}</p><p>Conferir no painel do Stripe.</p>`);
    return { nota: "sem payment_intent" };
  }

  const lista = await pedidosDoPagamento(sb, paymentIntent);
  const resumo = lista.map((p) => `${p.payment_id} (${p.status}, ${p.valor_centavos}, ${p.email ?? "sem e-mail"})`);

  if (parcial) {
    await auditar(sb, "stripe_estorno_parcial", { id, paymentIntent, pedidos: lista.map((p) => p.payment_id) });
    await alertar(
      "Estorno PARCIAL no Stripe",
      `<p>${detalhe}</p><p>${resumo.join("<br>") || "Nenhum pedido nosso."}</p><p>O pedido NÃO foi marcado como reembolsado.</p>`,
    );
    return { nota: "parcial, só avisado" };
  }

  const pagas = lista.filter((p) => p.status === "pago");
  if (pagas.length) {
    const { error } = await sb
      .from("pedidos")
      .update({ status: "reembolsado", status_gateway: chargeback ? "dispute" : "refunded" })
      .in(
        "id",
        pagas.map((p) => p.id),
      )
      .eq("status", "pago");
    if (error) throw new Error(`marcar reembolsado falhou: ${error.message}`);
  }

  await auditar(sb, chargeback ? "stripe_chargeback" : "stripe_estorno", {
    id,
    paymentIntent,
    pedidos: pagas.map((p) => p.payment_id),
    quiz_response_id: pagas[0]?.quiz_response_id ?? null,
  });
  await alertar(
    chargeback ? "CHARGEBACK no Stripe: montar a defesa" : "Estorno registrado no Stripe",
    `<p>${detalhe}</p>` +
      (pagas.length
        ? `<p>Marcado como reembolsado:<br>${pagas
            .map((p) => `${p.payment_id} · ${p.valor_centavos} · ${p.email ?? "sem e-mail"} · quiz ${p.quiz_response_id ?? "?"}`)
            .join("<br>")}</p>`
        : `<p>${resumo.join("<br>") || "Nenhum pedido pago nosso com este pagamento."}</p>`) +
      (chargeback ? `<p>O prazo de defesa corre no painel do Stripe (Disputes).</p>` : ""),
  );
  return { marcados: pagas.length };
}
