// TESTE `cartao_dlocal` (Ballad, 11/11): o CARTÃO da América Latina pela dLocal
// Go, dentro da nossa folha, contra o Stripe de hoje.
//
//   A = como é hoje: o cartão abre o Embedded Checkout do Stripe (conta
//       brasileira cobrando cartão de fora: `do_not_honor`, Radar, débito).
//   B = o cartão abre os SmartFields da dLocal Go na própria folha (o
//       "transparente" deles, só pra cartão): campo do cartão, nome do titular
//       e, fora do México, o documento. Cobrança local, na moeda do país.
//
// Só no México, Peru, Colômbia e Chile, só no espanhol. Dinheiro e
// transferência (OXXO, SPEI, Yape, PSE, Webpay...) não mudam nos dois braços.
// Ler por PAGO ÷ `cartao_dlocal_exposto` por braço e por país (a folha abriu =
// clicou em pagar). Age depois do clique: está no `POS_COMPRA` do `vigiaExperimento`.
//
// O fluxo (docs da dLocal Go, "Transparent checkout", conferido em 11/11 com a
// chamada real de criação nos 4 países):
//   1. servidor cria o pagamento com `allow_transparent: true` e recebe o
//      `merchant_checkout_token` (o GET do pagamento também devolve ele);
//   2. navegador: `dlocalGo.initialize(chaveSmartFields, token)`, monta o campo
//      `card` e, no pagar, `createCardToken(campo, { name })`;
//   3. servidor: `POST /v1/payments/confirm/{token}` com o token do cartão.
//      Pode voltar `redirect_url` (3DS); senão o GET diz PAID ou REJECTED.
//
// Puro: a folha, o servidor e os testes usam as mesmas regras.

export const EXP_CARTAO_DLOCAL = "cartao_dlocal";

export const PAISES_CARTAO_DLOCAL = ["MX", "PE", "CO", "CL"] as const;
export type PaisCartaoDlocal = (typeof PAISES_CARTAO_DLOCAL)[number];

/** O SDK de produção dos SmartFields (o de sandbox é `checkout-sbx`). */
export const SDK_SMARTFIELDS = "https://checkout.dlocalgo.com/js/dlocalgo-smartfields-bundled.js";

/**
 * Marca do pedido pendente do cartão da dLocal em `pedidos.status_gateway`.
 * Separa ele das fichas de OXXO/transferência (mesmo `gateway = dlocalgo`): a
 * volta do OXXO e o lembrete da ficha não podem tratar o cartão como ficha. Ao
 * pagar, o status vira o de sempre (`PAID:<tipo>`).
 */
export const STATUS_TRANSPARENTE = "TRANSPARENTE";

/** Quanto tempo o pedido pendente do cartão vale (a ficha de OXXO vale 3 dias). */
export const VALIDADE_CARTAO_MIN = 60;

export function paisCartaoDlocal(pais: string | null | undefined): PaisCartaoDlocal | null {
  const p = String(pais ?? "").trim().toUpperCase();
  return (PAISES_CARTAO_DLOCAL as readonly string[]).includes(p) ? (p as PaisCartaoDlocal) : null;
}

/** Este visitante vê o teste (os dois braços)? */
export function expostoCartaoDlocal(pais: string | null | undefined, locale: string): boolean {
  return locale === "es" && paisCartaoDlocal(pais) !== null;
}

/** O cartão sai pela dLocal? Braço B, país com dLocal, espanhol. */
export function cartaoDlocalLigado(variante: string | null | undefined, pais: string | null | undefined, locale: string): boolean {
  return expostoCartaoDlocal(pais, locale) && String(variante ?? "").trim().toUpperCase().startsWith("B");
}

/**
 * O documento vai junto do cartão? Fora do México sim (CC, DNI, RUN, os mesmos
 * da ficha). No México não: o CURP derrubou 29 de 51 na folha do OXXO (31/10),
 * e cartão no México não costuma pedir. Se a dLocal recusar por documento, a
 * folha mostra o campo e tenta de novo (`pedeDocumento`).
 */
export function documentoNoCartao(pais: PaisCartaoDlocal): boolean {
  return pais !== "MX";
}

/** Nome do titular em primeiro nome e sobrenome, como o confirm da dLocal quer. */
export function separarNome(nome: string): { primeiro: string; ultimo: string } {
  const partes = String(nome ?? "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (partes.length <= 1) return { primeiro: partes[0] ?? "", ultimo: partes[0] ?? "" };
  return { primeiro: partes[0], ultimo: partes.slice(1).join(" ") };
}

/** O token do cartão que o SDK devolve: só letras, números, hífen e sublinhado. */
export function tokenCartaoValido(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(t);
}

/** O 3DS só redireciona pra página HTTPS da dLocal. */
export function urlTresDsValida(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)dlocalgo\.com$|(^|\.)dlocal\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

export type GrupoRecusaCartao = "dados" | "saldo" | "cartao" | "risco" | "documento" | "banco";

/**
 * O grupo da recusa, pelo texto que a dLocal devolve (`status_detail` do GET ou
 * `message` do confirm). A lista de códigos da dLocal Go não é pública: casa
 * por palavra, e o que não se reconhece é bloqueio do banco, o mais comum.
 */
export function grupoRecusaCartao(texto: string | null | undefined): GrupoRecusaCartao {
  const t = String(texto ?? "").toLowerCase();
  if (/document|cpf|curp|\bdni\b|c[eé]dula|\brut\b|\brun\b/.test(t)) return "documento";
  if (/insufficient|fondos|saldo|amount exceed|limit/.test(t)) return "saldo";
  if (/cvv|cvc|security code|c[oó]digo de seguridad|expir|venc|invalid card|card number|bad.?filled|n[uú]mero de tarjeta|invalid data|payment method|card token|token/.test(t)) return "dados";
  if (/fraud|risk|riesgo|blacklist|blocked|bloque|suspect/.test(t)) return "risco";
  if (/not (supported|allowed|enabled)|no (soportad|permitid|habilitad)|international|internacional|prepaid|prepag/.test(t)) return "cartao";
  return "banco";
}

/** O que a folha diz em cada recusa. Sem promessa de reembolso. */
export const TEXTO_RECUSA_CARTAO: Record<GrupoRecusaCartao, string> = {
  banco: "Tu banco no aprobó el pago. Pasa mucho en la primera compra en una tienda en línea: abre la app de tu banco, aprueba la compra y vuelve a intentarlo, o usa otra tarjeta.",
  saldo: "Tu banco rechazó el pago por saldo o límite de la tarjeta. Prueba con otra tarjeta.",
  dados: "Algún dato de la tarjeta no coincidió (casi siempre el código de seguridad o la fecha). Revísalos y vuelve a intentarlo.",
  cartao: "Esta tarjeta no acepta este tipo de compra en línea. Prueba con otra tarjeta, de preferencia de crédito.",
  risco: "No pudimos procesar el pago con esta tarjeta. Prueba con otra tarjeta.",
  documento: "Tu banco pide tu documento para aprobar el pago. Escríbelo abajo y vuelve a intentarlo.",
};

/** A moldura da folha, no espanhol neutro do `/es` da Ballad. */
export const TEXTO_CARTAO_DLOCAL = {
  titulo: "Paga con tarjeta",
  sub: "Crédito o débito. El cobro sale en tu moneda local.",
  nome: "Nombre como aparece en la tarjeta",
  nomeErro: "Escribe tu nombre y apellido.",
  cartaoErro: "Revisa los datos de la tarjeta.",
  documentoSub: "Tu banco pide tu documento para aprobar el pago. No se publica ni se comparte.",
  pagar: (preco: string) => `Pagar ${preco}`,
  pagando: "Procesando el pago…",
  abrindo: "Abriendo el pago seguro…",
  erro: "No pudimos abrir el pago con tarjeta en este momento.",
  tentar: "Intentar de nuevo",
  outroCartao: "Probar con otra tarjeta",
  semCartao: "Pagar en efectivo o transferencia",
  pendente: "Tu pago está en proceso. En cuanto tu banco lo confirme, tu canción completa llega a tu correo.",
  seguro: "Pago seguro procesado por dLocal. No guardamos los datos de tu tarjeta.",
} as const;

export type RespostaConfirmacao = { success?: boolean; redirect_url?: string | null; payment_id?: string | null };

/**
 * O que fazer com a resposta do confirm, ANTES de ler o status no GET:
 * redirecionar pro 3DS, ou ler o pagamento. `success: false` sem 3DS é recusa,
 * mas quem decide é o GET (o confirm pode voltar sem `success` e o pagamento
 * estar PAID): por isso "ler" nos dois.
 */
export function proximoPassoConfirmacao(r: RespostaConfirmacao): { passo: "3ds"; url: string } | { passo: "ler" } {
  if (urlTresDsValida(r.redirect_url)) return { passo: "3ds", url: r.redirect_url };
  return { passo: "ler" };
}

export type EstadoCartao = "pago" | "recusado" | "pendente";

/** O status do GET da dLocal, no que a folha mostra. */
export function estadoDoStatus(status: string | null | undefined): EstadoCartao {
  const s = String(status ?? "").toUpperCase();
  if (s === "PAID") return "pago";
  if (s === "REJECTED" || s === "CANCELLED" || s === "EXPIRED") return "recusado";
  return "pendente";
}
