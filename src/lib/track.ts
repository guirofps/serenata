import {
  getOrCreateSessionId,
  getStoredAttribution,
  getDevice,
  getFbIdentifiers,
} from "@/lib/session-context";

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

export function trackEventOnce(
  eventName: string,
  dedupeKey: string,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const chave = `${DEDUPE_PREFIX}${eventName}:${dedupeKey}`;
  try {
    if (localStorage.getItem(chave)) return Promise.resolve();
    localStorage.setItem(chave, "1");
  } catch {
    // storage indisponível (aba anônima com quota zerada): dispara mesmo assim
  }
  return trackEvent(eventName, eventData);
}
