import { getOrCreateSessionId } from "@/lib/session-context";
import { type Locale, LOCALE_PADRAO } from "@/lib/i18n";

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

// Um produto por idioma na Perfect Pay: o brasileiro cobra R$ 37 no PIX ou
// cartão, o internacional cobra em dólar. Mesmo gateway, mesmo webhook, IDs
// diferentes — e é o `src` (nosso session_id) que casa o pagamento com a
// música, não o produto.
const CHECKOUT: Record<Locale, string> = {
  pt: "https://go.perfectpay.com.br/PPU38CQER4D",
  es: "https://go.centerpag.com/PPU38CQF4HJ",
};

/** Compat: código que não conhece idioma continua indo pro produto BR. */
export const CHECKOUT_URL = CHECKOUT.pt;

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

/** Monta a URL do checkout com sessão e UTMs. */
export function urlCheckout(extra?: { email?: string; locale?: Locale }): string {
  const p = new URLSearchParams();

  // A ponte com o webhook.
  p.set("src", getOrCreateSessionId());

  // Só o e-mail é pré-preenchido. O NOME não: o único nome que temos é o do
  // HOMENAGEADO (quem vai receber a música), e mandá-lo aqui fazia o gateway
  // registrar "Cliente: Zé" quando quem comprava era a esposa dele. Nome
  // errado no pedido atrapalha suporte, nota e conciliação — melhor a pessoa
  // digitar o dela.
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

  return `${CHECKOUT[extra?.locale ?? LOCALE_PADRAO] ?? CHECKOUT.pt}?${p.toString()}`;
}

/** Leva pro checkout. */
export function irParaCheckout(extra?: { email?: string; locale?: Locale }) {
  window.location.href = urlCheckout(extra);
}
