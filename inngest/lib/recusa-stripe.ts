import type { SupabaseClient } from "@supabase/supabase-js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { sessaoTeveRecusa } from "../../src/lib/aviso-recusa.js";

// O CARTÃO DESTE QUIZ FOI RECUSADO NO STRIPE? (Ballad, 18/10)
//
// O pedido do Stripe nasce pendente com `payment_id = stripe:<sessão>` quando
// a folha abre. A sessão, com o PaymentIntent expandido, guarda o último erro
// de pagamento: tem erro e não foi pago = a pessoa tentou e o banco barrou.
//
// Erro aqui vira "não sei" (false): o pior caso é ela receber o e-mail de
// sempre, que é o que recebia antes deste teste.
export async function teveRecusaStripe(sb: SupabaseClient, quizId: string): Promise<boolean> {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (MARCA_ATIVA.chave !== "ballad" || !chave) return false;
  const { data, error } = await sb
    .from("pedidos")
    .select("payment_id, status")
    .eq("quiz_response_id", quizId)
    .like("payment_id", "stripe:%");
  if (error) return false;
  for (const p of (data ?? []).slice(0, 5)) {
    const id = String(p.payment_id ?? "").slice("stripe:".length);
    if (!id.startsWith("cs_")) continue;
    try {
      const r = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}?expand[]=payment_intent`,
        { headers: { Authorization: `Bearer ${chave}` } },
      );
      if (!r.ok) continue;
      if (sessaoTeveRecusa(await r.json())) return true;
    } catch {
      // Rede piscou: segue pra próxima sessão; nada achado = e-mail de sempre.
    }
  }
  return false;
}
