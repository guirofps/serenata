// "VOLTOU POR UM E-MAIL" (08/10). Quem chega com `utm_source=email` (os links
// de todo e-mail, `utm-email.ts`) ganha um cookie de 3 dias. O checkout lê o
// cookie no SERVIDOR (`toque-email.server.ts`) e grava
// `pedidos.veio_de = 'email'`, que o painel conta como venda de e-mail mesmo
// com primeiro toque em anúncio (`canal-venda.ts`).
//
// Cookie, e não localStorage: o servidor lê sozinho, sem mudar a chamada de
// nenhum dos sete checkouts. Não é segredo nem decide preço, só a contagem.

export const COOKIE_TOQUE_EMAIL = "mp_email";
const TRES_DIAS_S = 3 * 24 * 60 * 60;

export function veioPorEmail(href: string): boolean {
  try {
    return new URL(href).searchParams.get("utm_source")?.toLowerCase() === "email";
  } catch {
    return false;
  }
}

export function cookieDoToque(): string {
  return `${COOKIE_TOQUE_EMAIL}=1; Max-Age=${TRES_DIAS_S}; Path=/; SameSite=Lax; Secure`;
}

/** No navegador: chamado uma vez por carregamento, no `__root`. */
export function guardarToqueEmail(): void {
  if (typeof window === "undefined") return;
  try {
    if (veioPorEmail(window.location.href)) document.cookie = cookieDoToque();
  } catch {
    // Cookie bloqueado: a venda só conta pelo primeiro toque, como antes.
  }
}
