import type { SupabaseClient } from "@supabase/supabase-js";
import { venderNoTiktok } from "./tiktok-eventos.js";

// O QUE VEM DEPOIS DA ENTREGA, E TEM QUE VIR POR QUALQUER PORTA.
//
// Um PIX do Asaas vira `pago` por dois caminhos: o webhook deles, ou o vigia
// de pagamento (a sonda da folha chama o vigia aos 25s, e ele ganha a corrida
// em ~13% das vendas). Quem chega depois sai como duplicado. Até 16/10 a
// venda do TikTok pelo servidor só existia dentro do webhook: quando o vigia
// ganhava, ela nunca subia (18 de 141 vendas com `ttclid` em 7 dias). Daqui
// pra frente as duas portas chamam este módulo.

async function auditar(sb: SupabaseClient, nome: string, dados: unknown) {
  try {
    await sb.from("funnel_events").insert({ event_name: nome, event_data: dados });
  } catch {
    // Auditoria nunca derruba a entrega.
  }
}

/**
 * A venda vai pro TikTok pelo servidor, SÓ se veio dele (tem `ttclid`).
 *
 * `eventId` é o id da cobrança CRU (sem `asaas:`): é o que o pixel da
 * `/obrigado` manda, e o TikTok só deduplica se os dois baterem. Nunca joga:
 * o pior caso é uma venda não contada.
 */
export async function subirVendaTiktok(
  sb: SupabaseClient,
  v: {
    quizId: string;
    eventId: string;
    paymentId: string;
    valorCentavos: number | null;
    email: string;
    telefone: string | null;
    via: string;
  },
): Promise<void> {
  try {
    const { data: q } = await sb.from("quiz_responses").select("attribution").eq("id", v.quizId).maybeSingle();
    const attr = (q?.attribution ?? null) as Record<string, string | undefined> | null;
    // Venda sem ttclid não é do TikTok: mandá-la deixava ele reivindicar por
    // view-through venda do Google e inflava o painel.
    if (!attr?.ttclid) return;
    const valor = (v.valorCentavos ?? 0) / 100;
    const tiktok = await venderNoTiktok({
      eventId: v.eventId,
      valor,
      moeda: "BRL",
      email: v.email,
      telefone: v.telefone,
      ttclid: attr.ttclid,
      quando: new Date(),
    });
    await auditar(sb, tiktok.ok ? "tiktok_conversao_enviada" : "tiktok_conversao_falhou", {
      payment_id: v.paymentId,
      valor,
      motivo: tiktok.motivo ?? null,
      via: v.via,
    });
  } catch (err) {
    console.error(`[pos-pagamento] tiktok falhou (${v.via}):`, (err as Error).message);
  }
}
