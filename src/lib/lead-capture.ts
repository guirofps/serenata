import { getOrCreateSessionId, getStoredAttribution } from "@/lib/session-context";
import { semPontoNoFim } from "@/lib/email-limpo";
import { comRetentativas } from "@/lib/retentar";
import { trackEvent } from "@/lib/track";

/**
 * AS ESPERAS ENTRE AS TENTATIVAS (29/10). Antes, a falha do upsert só ia pro
 * console: no 4G ruim, quem deixava o e-mail e caía na rede no mesmo segundo
 * sumia da base (sem lead, sem recuperação, sem letra por e-mail).
 */
const ESPERAS_LEAD_MS = [500, 2000, 5000] as const;

/**
 * A gravação mais nova desta aba. Uma retentativa VELHA que acerta depois de
 * uma gravação nova mandaria respostas antigas por cima das novas (o
 * `furthest_step` sobe por GREATEST, as respostas não): a velha desiste quando
 * já existe uma mais nova.
 */
let ultimaGravacao = 0;

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
  const minha = ++ultimaGravacao;
  // O telefone só vem da tela do WhatsApp: a gravação seguinte do quiz não o
  // carrega, então essa nunca desiste por ter sido "superada".
  const superada = args.whatsapp ? undefined : () => minha !== ultimaGravacao;
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
    const gravar = async () => {
      const { error } = await supabase.rpc("upsert_quiz_response", {
        p_session_id: sessionId,
        p_current_step: args.currentStep ?? null,
        p_furthest_step: args.furthestStep ?? null,
        p_respostas: args.respostas,
        // Ponto no fim ("...@hotmail.com.") mata a entrega e o PIX (26/09).
        p_email: args.email ? semPontoNoFim(args.email) : null,
        p_whatsapp: args.whatsapp ?? null,
        p_attribution: getStoredAttribution(),
        p_locale: args.locale ?? "pt",
        p_whatsapp_origem: args.whatsappOrigem ?? null,
        p_nome_comprador: args.nomeComprador ?? null,
      });
      if (error) throw error;
    };
    const r = await comRetentativas(gravar, ESPERAS_LEAD_MS, { desistir: superada });
    // Falha NÃO é silenciosa (erro herdado a não repetir: catch {} vazio). E
    // esgotada vira evento, pra o painel ver quanto lead a rede está comendo;
    // o servidor ainda cria a linha com o e-mail no fim da letra
    // (`finalizarLetra`/`gerarRefroes`, 29/10).
    if (!r.ok && !r.desistiu) {
      console.error("[lead] upsert_quiz_response falhou:", r.erro);
      void trackEvent("lead_upsert_falhou", {
        tentativas: r.tentativas,
        passo: args.furthestStep ?? null,
        com_email: Boolean(args.email),
        erro: String((r.erro as { message?: string } | null)?.message ?? r.erro).slice(0, 200),
      });
    }
  } catch (err) {
    console.error("[lead] captura de progresso falhou:", err);
  }
}
