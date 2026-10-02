import {
  getOrCreateSessionId,
  getStoredAttribution,
  getDevice,
  getFbIdentifiers,
} from "@/lib/session-context";
import { encaminharGa4 } from "@/lib/ga4";

export async function trackEvent(
  eventName: string,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  const sessionId = getOrCreateSessionId();

  const enriched = {
    ...eventData,
    device: getDevice(),
    attribution: getStoredAttribution(),
    ...getFbIdentifiers(),
    path: window.location.pathname,
  };

  // ── GA4 ANTES DO BANCO ─────────────────────────────────────────
  //
  // O gtag é síncrono e o insert não: encaminhar depois do `await` perderia o
  // hit quando a página navega no meio, que é o clique que leva ao checkout.
  // Import estático (e não `import()` como o do Supabase) pelo mesmo motivo:
  // `ga4.ts` é pequeno, e esperar o módulo seria a mesma espera.
  //
  // E o GA4 nunca derruba o rastreio próprio: o banco é a verdade.
  try {
    encaminharGa4(eventName, enriched);
  } catch {
    // bloqueador, gtag quebrado: o insert abaixo segue
  }

  try {
    const { supabase } = await import("@/lib/supabase-client");
    await supabase.from("funnel_events").insert({
      session_id: sessionId,
      event_name: eventName,
      event_data: enriched,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[tracking] '${eventName}'`, enriched);
    }
  } catch (err) {
    console.error(`[tracking] Failed '${eventName}':`, err);
  }
}

// Dispara no máximo UMA vez por chave. Eventos de marco (quiz_started) rodavam
// em useEffect de mount e refaziam a cada reload / volta, inflando os agregados
// que contam eventos crus (device, top UTM) em ~3x.
const DEDUPE_PREFIX = "mp_once:";

/**
 * Marca `nome:chave` como visto NESTA SESSÃO e diz se era a primeira vez.
 * Síncrono, pra quem precisa decidir NA HORA se dispara outra coisa junto — a
 * promoção ao GA4 (`leadGa4`), que tem que seguir a mesma dedupe do evento
 * que substitui. Storage indisponível conta como primeira vez: perder a
 * dedupe é melhor que perder o evento.
 *
 * Uma vez por SESSÃO, não por navegador (auditoria 30/09): a chave sem a
 * sessão valia pra sempre naquele aparelho, e o segundo quiz no mesmo celular
 * (o que mais converte) sumia de quiz_started, oferta_vista etc.
 */
export function primeiraVez(eventName: string, dedupeKey: string): boolean {
  const chave = `${DEDUPE_PREFIX}${getOrCreateSessionId()}:${eventName}:${dedupeKey}`;
  try {
    if (localStorage.getItem(chave)) return false;
    localStorage.setItem(chave, "1");
  } catch {
    // storage indisponível (aba anônima com quota zerada): dispara mesmo assim
  }
  return true;
}

export function trackEventOnce(
  eventName: string,
  dedupeKey: string,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!primeiraVez(eventName, dedupeKey)) return Promise.resolve();
  return trackEvent(eventName, eventData);
}
