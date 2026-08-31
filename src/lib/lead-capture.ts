import { getOrCreateSessionId, getStoredAttribution } from "@/lib/session-context";

// Grava o progresso do lead a cada avanço do quiz, via RPC SECURITY DEFINER.
// É a vantagem competitiva direta: quem abandona no meio ainda vira lead.
// Não usa .upsert direto porque sob RLS o INSERT ... ON CONFLICT DO UPDATE
// exige SELECT, que o anon não tem (ver migration de fundação).
//
// GREATEST no furthest_step é feito no servidor: back-nav nunca regride o lead.
export async function captureLeadProgress(args: {
  /** O funil em que a pessoa entrou. Grava desde o passo 1: quem abandona
   *  no meio ainda precisa ser alcançável no idioma certo. */
  locale?: string;
  /**
   * Opcionais porque nem toda gravação é avanço de passo. Quem só está
   * deixando o WhatsApp na tela de espera manda `undefined` aqui: inventar um
   * número alto envenenaria o `furthest_step` (que sobe por GREATEST) e o
   * relatório de abandono passaria a mentir.
   */
  currentStep?: number;
  furthestStep?: number;
  respostas: Record<string, unknown>;
  email?: string | null;
  /**
   * Só quando a pessoa DIGITA o número por vontade própria. O quiz nunca
   * manda isto no upsert de progresso: telefone aqui é sempre consentimento
   * explícito, e `whatsapp_origem` diz de qual tela veio.
   */
  whatsapp?: string | null;
  whatsappOrigem?: string | null;
  /**
   * O nome de QUEM COMPRA. Diferente de `respostas.nome`, que e a pessoa
   * homenageada — 80% dos pedidos tinham a homenageada no campo do comprador
   * ate 31/08, e foi isso que deixou uma contestacao no Banco Central sem
   * pedido correspondente achavel.
   */
  nomeComprador?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const sessionId = getOrCreateSessionId();
  try {
    // ── IMPORT DINÂMICO, e não estático no topo ──────────────────
    //
    // O SDK do Supabase são 207 KB brutos (54 KB comprimidos). Importado no
    // topo, ele entra no bundle INICIAL do quiz e precisa ser baixado e
    // interpretado ANTES de o React hidratar — ou seja, antes de o botão
    // "continuar" passar a funcionar.
    //
    // O sintoma disso é o botão que parece pronto e não responde: ele vem
    // renderizado no HTML do servidor, mas fica morto até o JS terminar. O
    // dono bateu nisso no celular em 30/08 (dois, três toques até passar).
    //
    // `track.ts` já fazia certo. Aqui estava estático — e como a captura de
    // lead roda a CADA passo, era ele que segurava o SDK no caminho crítico.
    const { supabase } = await import("@/lib/supabase-client");
    const { error } = await supabase.rpc("upsert_quiz_response", {
      p_session_id: sessionId,
      p_current_step: args.currentStep ?? null,
      p_furthest_step: args.furthestStep ?? null,
      p_respostas: args.respostas,
      p_email: args.email ?? null,
      p_whatsapp: args.whatsapp ?? null,
      p_attribution: getStoredAttribution(),
      p_locale: args.locale ?? "pt",
      p_whatsapp_origem: args.whatsappOrigem ?? null,
      p_nome_comprador: args.nomeComprador ?? null,
    });
    // Falha NÃO é silenciosa (erro herdado a não repetir: catch {} vazio):
    if (error) console.error("[lead] upsert_quiz_response falhou:", error);
  } catch (err) {
    console.error("[lead] captura de progresso falhou:", err);
  }
}
