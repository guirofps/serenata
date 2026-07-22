import { useEffect, useState } from "react";

const SESSION_KEY = "mp_session_id";
const SESSION_TS_KEY = "mp_session_ts";
// Janela de inatividade da sessão (padrão de mercado: 30 min, deslizante).
// Sem isso o id vivia pra sempre no localStorage e "sessão" virava "navegador":
// quem voltava dias depois era contado como a mesma sessão do primeiro toque.
const SESSION_TTL_MS = 30 * 60 * 1000;
const ATTRIBUTION_KEY = "mp_attribution";
const DEVICE_KEY = "mp_device";
const VARIANT_KEY = "mp_variant";

export type DeviceBucket = "mobile" | "tablet" | "desktop";

// Variante de A/B: "A" = controle. Só existe uma por enquanto; a máquina fica
// pronta para quando houver um teste real (?f=b na URL de campanha).
export type QuizVariant = "A" | "B";

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  // Carimbada por stampVariantIntoAttribution no mount da raiz; flui como está
  // para funnel_events.event_data.attribution e quiz_responses.attribution.
  variant?: QuizVariant;
  captured_at: string;
};

export type SessionContext = {
  sessionId: string;
  device: DeviceBucket;
  attribution: Attribution | null;
  fbp: string | null;
  fbc: string | null;
};

function detectDevice(): DeviceBucket {
  if (typeof window === "undefined") return "desktop";
  if (window.matchMedia("(max-width: 640px)").matches) return "mobile";
  if (window.matchMedia("(max-width: 1024px)").matches) return "tablet";
  return "desktop";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  const agora = Date.now();
  let id = localStorage.getItem(SESSION_KEY);
  const ultimoToque = Number(localStorage.getItem(SESSION_TS_KEY) ?? 0);
  // Sem carimbo (id gravado antes deste TTL existir) conta como expirado.
  if (!id || !ultimoToque || agora - ultimoToque > SESSION_TTL_MS) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  // Desliza a cada evento: trackEvent chama isto em toda chamada.
  localStorage.setItem(SESSION_TS_KEY, String(agora));
  return id;
}

export function getStoredAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ATTRIBUTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Attribution;
  } catch {
    return null;
  }
}

// True quando o objeto guardado carrega um toque de fato capturado (UTM /
// click id / referrer), em oposição ao stub só-de-variante escrito por
// stampVariantIntoAttribution para tráfego direto.
function hasCapturedTouch(attr: Attribution): boolean {
  return Boolean(
    attr.utm_source ||
      attr.utm_medium ||
      attr.utm_campaign ||
      attr.utm_content ||
      attr.utm_term ||
      attr.gclid ||
      attr.fbclid ||
      attr.referrer,
  );
}

export function captureFirstTouchAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  // First-touch: só grava se ainda não houver toque capturado. Um stub
  // só-de-variante NÃO conta; ao capturar por cima de um stub, faz merge
  // para `variant` sobreviver.
  const existing = getStoredAttribution();
  if (existing && hasCapturedTouch(existing)) return existing;

  const sp = new URLSearchParams(window.location.search);
  const utm_source = sp.get("utm_source") ?? undefined;
  const utm_medium = sp.get("utm_medium") ?? undefined;
  const utm_campaign = sp.get("utm_campaign") ?? undefined;
  const utm_content = sp.get("utm_content") ?? undefined;
  const utm_term = sp.get("utm_term") ?? undefined;
  const gclid = sp.get("gclid") ?? undefined;
  const fbclid = sp.get("fbclid") ?? undefined;
  const referrer = document.referrer || undefined;

  const hasAnyUtm =
    utm_source || utm_medium || utm_campaign || utm_content || utm_term || gclid || fbclid;
  if (!hasAnyUtm && !referrer) return null;

  const attribution: Attribution = {
    // Merge por cima de um stub só-de-variante (se houver).
    ...existing,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    gclid,
    fbclid,
    referrer,
    captured_at: new Date().toISOString(),
  };

  localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  return attribution;
}

// ────────────────────────────────────────────────────────────────
// Resolução da variante A/B, controle por campanha (sem sorteio).
// Prioridade da fonte de verdade:
//   1. Parâmetro de campanha na URL: ?f=b -> B, ?f=a -> A (e fica sticky).
//   2. localStorage "mp_variant" já gravado (sticky entre visitas).
//   3. Default: A (controle — hoje só existe um funil).
// Roda client-side: a "/" é HTML estático pré-renderizado.
// ────────────────────────────────────────────────────────────────
export function getOrAssignVariant(): QuizVariant {
  if (typeof window === "undefined") return "A";
  const f = new URLSearchParams(window.location.search).get("f");
  if (f === "b" || f === "B") {
    localStorage.setItem(VARIANT_KEY, "B");
    return "B";
  }
  if (f === "a" || f === "A") {
    localStorage.setItem(VARIANT_KEY, "A");
    return "A";
  }
  const stored = localStorage.getItem(VARIANT_KEY);
  if (stored === "A" || stored === "B") return stored;
  return "A";
}

// Carimba a variante em "mp_attribution" para fluir tanto em
// funnel_events.event_data.attribution (trackEvent relê a cada evento) quanto
// em quiz_responses.attribution, sem editar as rotas do quiz. Cria o objeto
// quando ausente (tráfego direto não grava nada), faz merge quando presente.
// Idempotente.
export function stampVariantIntoAttribution(variant: QuizVariant): void {
  if (typeof window === "undefined") return;
  const existing = getStoredAttribution();
  if (existing) {
    if (existing.variant === variant) return;
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ ...existing, variant }));
  } else {
    const stub: Attribution = { variant, captured_at: new Date().toISOString() };
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(stub));
  }
}

export function getDevice(): DeviceBucket {
  if (typeof window === "undefined") return "desktop";
  let device = localStorage.getItem(DEVICE_KEY) as DeviceBucket | null;
  if (!device) {
    device = detectDevice();
    localStorage.setItem(DEVICE_KEY, device);
  }
  return device;
}

export function getFbIdentifiers(): { fbp: string | null; fbc: string | null } {
  return {
    fbp: readCookie("_fbp"),
    fbc: readCookie("_fbc"),
  };
}

export function useSessionContext(): SessionContext | null {
  const [ctx, setCtx] = useState<SessionContext | null>(null);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    captureFirstTouchAttribution();
    const attribution = getStoredAttribution();
    const device = getDevice();
    const { fbp, fbc } = getFbIdentifiers();
    setCtx({ sessionId, device, attribution, fbp, fbc });
  }, []);

  return ctx;
}
