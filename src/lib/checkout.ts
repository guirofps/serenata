import { getOrCreateSessionId } from "@/lib/session-context";

// Ida pro CHECKOUT (Perfect Pay).
//
// Duas coisas viajam com o comprador e não podem faltar:
//
// 1. `src` = o session_id do nosso funil. A Perfect Pay ecoa isso de volta no
//    webhook como `metadata.src`, e é ASSIM que o pagamento é casado com a
//    música certa. Sem ele, sobra casar por e-mail (que a pessoa pode digitar
//    diferente no checkout) — e o webhook não tem fallback de adivinhação, de
//    propósito.
//
// 2. Os UTMs. O script da Utmify captura na visita e guarda em
//    `localStorage.utmify_data`; como a ida ao checkout é por JavaScript (e
//    não um <a> que o script reescreve), o repasse é feito aqui na mão. Três
//    fontes, em ordem de confiança: store da Utmify, a URL atual, e a nossa
//    captura first-touch.

export const CHECKOUT_URL = "https://go.perfectpay.com.br/PPU38CQER4D";

const PARAMS_RASTREIO = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "gclid",
  "fbclid",
  "src",
  "sck",
] as const;

function leJson(chave: string): Record<string, unknown> | null {
  try {
    const cru = localStorage.getItem(chave);
    return cru ? (JSON.parse(cru) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Monta a URL do checkout com sessão, nome e UTMs. */
export function urlCheckout(extra?: { nome?: string; email?: string }): string {
  const p = new URLSearchParams();

  // A ponte com o webhook.
  p.set("src", getOrCreateSessionId());

  // Preenche o checkout pra pessoa não digitar de novo (menos atrito).
  if (extra?.nome) p.set("name", extra.nome);
  if (extra?.email) p.set("email", extra.email);

  if (typeof window !== "undefined") {
    const daUrl: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => (daUrl[k] = v));
    const fontes = [leJson("utmify_data"), daUrl, leJson("mp_attribution")].filter(
      Boolean,
    ) as Array<Record<string, unknown>>;

    for (const chave of PARAMS_RASTREIO) {
      if (p.has(chave)) continue; // `src` já foi
      for (const f of fontes) {
        const v = f[chave];
        if (v) {
          p.set(chave, String(v));
          break;
        }
      }
    }
  }

  return `${CHECKOUT_URL}?${p.toString()}`;
}

/** Leva pro checkout. */
export function irParaCheckout(extra?: { nome?: string; email?: string }) {
  window.location.href = urlCheckout(extra);
}
