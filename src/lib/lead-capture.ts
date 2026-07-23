import { supabase } from "@/lib/supabase-client";
import { getOrCreateSessionId, getStoredAttribution } from "@/lib/session-context";

// Grava o progresso do lead a cada avanço do quiz, via RPC SECURITY DEFINER.
// É a vantagem competitiva direta: quem abandona no meio ainda vira lead.
// Não usa .upsert direto porque sob RLS o INSERT ... ON CONFLICT DO UPDATE
// exige SELECT, que o anon não tem (ver migration de fundação).
//
// GREATEST no furthest_step é feito no servidor: back-nav nunca regride o lead.
export async function captureLeadProgress(args: {
  currentStep: number;
  furthestStep: number;
  respostas: Record<string, unknown>;
  email?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const sessionId = getOrCreateSessionId();
  try {
    const { error } = await supabase.rpc("upsert_quiz_response", {
      p_session_id: sessionId,
      p_current_step: args.currentStep,
      p_furthest_step: args.furthestStep,
      p_respostas: args.respostas,
      p_email: args.email ?? null,
      p_whatsapp: null, // decisão: só e-mail no lançamento
      p_attribution: getStoredAttribution(),
    });
    // Falha NÃO é silenciosa (erro herdado a não repetir: catch {} vazio):
    if (error) console.error("[lead] upsert_quiz_response falhou:", error);
  } catch (err) {
    console.error("[lead] captura de progresso falhou:", err);
  }
}
