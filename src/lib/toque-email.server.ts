import { getCookie } from "@tanstack/react-start/server";
import type { supabaseAdmin } from "@/lib/supabase-admin";
import { COOKIE_TOQUE_EMAIL } from "@/lib/toque-email";

/**
 * Marca o pedido como vindo de e-mail quando o navegador tem o cookie de
 * `toque-email.ts`. Update à parte, DEPOIS do pedido gravado, e engolindo
 * erro: a contagem do painel nunca pode derrubar uma cobrança.
 */
export async function marcarSeVeioDeEmail(
  db: ReturnType<typeof supabaseAdmin>,
  paymentId: string,
): Promise<void> {
  try {
    if (getCookie(COOKIE_TOQUE_EMAIL) !== "1") return;
    const { error } = await db.from("pedidos").update({ veio_de: "email" }).eq("payment_id", paymentId);
    if (error) console.error("[toque-email] marcar pedido falhou:", error.message);
  } catch (err) {
    console.error("[toque-email] marcar pedido falhou:", err);
  }
}
