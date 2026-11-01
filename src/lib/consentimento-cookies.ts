// O AVISO DE COOKIES DA ESPANHA (Ballad, 01/11/2026).
//
// Na Espanha, cookie de medição e de anúncio só pode entrar DEPOIS de a pessoa
// aceitar, e recusar tem que ser tão fácil quanto aceitar. Nos outros países da
// Ballad e na Serenata nada muda: o `data-pais` decide, e a Serenata nem tem o
// carimbo. Vale só pra Espanha porque é o único país europeu com campanha; país
// novo da Europa entra em `PAISES`.
//
// O PAÍS É O DO ACESSO, o mesmo `data-pais` que decide o preço em euro
// (`pais-acesso.ts`), lido na hora por um script no `<head>`. A escolha vale pra
// este navegador e pode ser refeita em `/es/cookies`.
//
// ── COMO O GOOGLE E O TIKTOK FICAM ESPERANDO ─────────────────────
//
// O Google recebe `consent default denied` ANTES do `gtag('js')`: a tag carrega,
// mas não grava cookie nem usa dado de anúncio. O TikTok recebe `holdConsent`
// antes do primeiro evento (`scriptTiktok`). Aceitou, os dois são liberados na
// mesma página. Quem recusa continua comprando normal, só não é contado pelos
// cookies deles: as nossas vendas continuam no banco.

export const CHAVE_COOKIES = "mp_cookies";
const PAISES = ["ES"];
const NEGADO = "{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'}";
const LIBERADO = { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" };

export type RespostaCookies = "sim" | "nao";

declare global {
  interface Window {
    __cookiesPendentes?: boolean;
  }
}

export function paisPedeCookies(pais: string | null | undefined): boolean {
  return !!pais && PAISES.includes(pais);
}

/**
 * Inline no `<head>`, depois do carimbo do país e antes de qualquer pixel.
 * Sem a pergunta respondida com "sim", nega tudo e marca `__cookiesPendentes`,
 * que é o que o snippet do TikTok lê. Fora da Espanha não faz nada.
 */
export function scriptConsentimento(): string {
  return `(function(){try{var p=document.documentElement.getAttribute("data-pais");if(${JSON.stringify(PAISES)}.indexOf(p)<0)return;var r=null;try{r=localStorage.getItem(${JSON.stringify(CHAVE_COOKIES)})}catch(e){}window.dataLayer=window.dataLayer||[];function g(){dataLayer.push(arguments)}g('set','ads_data_redaction',true);g('consent','default',${NEGADO});if(r==="sim")g('consent','update',${JSON.stringify(LIBERADO)});else window.__cookiesPendentes=true}catch(e){}})();`;
}

export function respostaCookies(): RespostaCookies | null {
  try {
    const r = localStorage.getItem(CHAVE_COOKIES);
    return r === "sim" || r === "nao" ? r : null;
  } catch {
    return null;
  }
}

/** Se o aviso tem que aparecer: país que pede e ninguém respondeu ainda. */
export function deveMostrarAviso(): boolean {
  return paisPedeCookies(document.documentElement.getAttribute("data-pais")) && respostaCookies() === null;
}

export function responderCookies(resposta: RespostaCookies): void {
  try {
    localStorage.setItem(CHAVE_COOKIES, resposta);
  } catch {
    // Aba privada: vale só pra esta página, e o aviso volta na próxima visita.
  }
  window.__cookiesPendentes = false;
  if (resposta === "sim") {
    window.gtag?.("consent", "update", LIBERADO);
    (window.ttq as unknown as { grantConsent?: () => void } | undefined)?.grantConsent?.();
  } else {
    (window.ttq as unknown as { revokeConsent?: () => void } | undefined)?.revokeConsent?.();
  }
}

/** Refazer a escolha, em `/es/cookies`: esquece a resposta e recarrega, e o aviso volta. */
export function esquecerCookies(): void {
  try {
    localStorage.removeItem(CHAVE_COOKIES);
  } catch {
    // sem storage não há o que esquecer
  }
  window.location.reload();
}
