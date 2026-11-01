// TESTE `upsell_dlocal` (Ballad, 01/11/2026): vídeo e música extra SEM CARTÃO.
//
// A música dá pra pagar pela dLocal (OXXO, SPEI, PSE, Nequi, Webpay, Yape), mas
// o upsell só existia no cartão do Stripe: quem pagou a música em dinheiro não
// tinha como comprar o vídeo nem a extra. Medido em 01/11: desde 29/10, 16 de
// 134 compradores (12%) pagaram por dLocal, e nenhum upsell saiu desses métodos.
//
//   A  como era: a folha só com o cartão do Stripe.
//   B  a mesma folha, com o botão "¿Sin tarjeta?" em cima do cartão. Abre a
//      página da dLocal na moeda do país, com o preço da mesma tabela.
//
// Só onde a dLocal existe (`temDlocal`: México, Colômbia, Chile e Peru) e só em
// espanhol. O braço sai do `token_edicao` (2º caractere do fim, paridade, o
// último é do `preco_video` e o 3º do `extra_ballad`): editor no celular e
// /gracias no computador caem no mesmo braço, sem carimbo nenhum.
//
// Leitura: RECEITA DE UPSELL POR FOLHA ABERTA, por braço (`upsell_dlocal_exposto`
// → pedido de upsell pago, ligado pelo e-mail), separada por país. Guarda: o
// cartão não pode cair só porque a pessoa passou a escolher a ficha e não pagar.
//
// O token de edição NUNCA vai na cobrança: as portas de volta da dLocal são uma
// página sem token (`/es/pago-upsell`), que lê do `localStorage` qual presente
// voltar a abrir. O `order_id` leva a oferta e a música, que não abrem nada.

import { mercadoDoPais, normalizarPais } from "./mercados.js";

export const EXP_UPSELL_DLOCAL = "upsell_dlocal";

/** Desligar = todo mundo no A, sem deploy de tela nova. */
export const LIGADO = true;

export type OfertaDlocal = "video" | "extra";

/** O braço deste presente. Token inválido ou teste desligado: A. */
export function bracoUpsellDlocal(tokenEdicao: string | null | undefined): "A" | "B" {
  if (!LIGADO) return "A";
  const t = String(tokenEdicao ?? "");
  const c = t.length >= 2 ? t[t.length - 2] : "";
  const n = parseInt(c, 16);
  if (Number.isNaN(n)) return "A";
  return n % 2 === 1 ? "B" : "A";
}

/** Este país vende upsell pela dLocal? País desconhecido não cai nos EUA aqui: é não. */
export function paisVendeUpsellDlocal(pais: string | null | undefined): boolean {
  const p = normalizarPais(pais);
  return Boolean(p) && mercadoDoPais(p).pais === p && mercadoDoPais(p).temDlocal;
}

/** O botão aparece? Só no B, no espanhol e nos países da dLocal. */
export function semCartaoNaFolha(a: {
  tokenEdicao: string | null | undefined;
  pais: string | null | undefined;
  locale: string | null | undefined;
}): boolean {
  return a.locale === "es" && paisVendeUpsellDlocal(a.pais) && bracoUpsellDlocal(a.tokenEdicao) === "B";
}

// A dLocal aceita só `[A-Za-z0-9-_]` no `order_id` (`orderIdDlocal`). Quem diz
// o que foi vendido é este id, gerado aqui e lido de volta da API deles, igual
// ao `metadata` do Stripe: nada do navegador decide o que se libera.
const FORMATO_ORDER_ID = /^up-(video|extra)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[a-z0-9]+$/;

export function orderIdUpsellDlocal(oferta: OfertaDlocal, musicaId: string, agora = Date.now()): string {
  return `up-${oferta}-${musicaId}-${agora.toString(36)}`;
}

/** A oferta e a música de um `order_id` nosso. Qualquer outra coisa: `null`. */
export function lerOrderIdUpsell(orderId: string | null | undefined): { oferta: OfertaDlocal; musicaId: string } | null {
  const m = FORMATO_ORDER_ID.exec(String(orderId ?? ""));
  return m ? { oferta: m[1] as OfertaDlocal, musicaId: m[2] } : null;
}

/** O botão de pagar sem cartão, com os métodos que a dLocal mostra em cada país. */
export const BOTAO_SEM_CARTAO: Record<string, string> = {
  MX: "¿Sin tarjeta? Paga en efectivo en OXXO o con transferencia",
  CO: "¿Sin tarjeta? Paga con PSE, Nequi o en efectivo",
  CL: "¿Sin tarjeta? Paga con Webpay o transferencia",
  PE: "¿Sin tarjeta? Paga con Yape, transferencia o en efectivo",
};

export const TEXTO_UPSELL_DLOCAL = {
  abrindo: "Abriendo el pago…",
  erro: "No pudimos abrir este pago. Inténtalo de nuevo o paga con tarjeta.",
  jaTem: "Tu video ya viene en camino. Aparece aquí mismo cuando esté listo.",
  avisoVideo: "Si pagas en efectivo, tu video empieza a prepararse cuando se confirme el pago.",
  avisoExtra: "Si pagas en efectivo, te avisamos por correo cuando se confirme el pago.",
} as const;

// Onde a página de volta lê qual presente reabrir. Fica no navegador, e não na
// URL: a URL da volta passa pela dLocal.
export const CHAVE_VOLTA_UPSELL = "mp_upsell_dlocal";

export type VoltaUpsell = { tokenEdicao: string; oferta: OfertaDlocal };

export function lerVoltaUpsell(bruto: string | null | undefined): VoltaUpsell | null {
  try {
    const v = JSON.parse(String(bruto ?? "")) as Partial<VoltaUpsell>;
    if (typeof v?.tokenEdicao !== "string" || !v.tokenEdicao) return null;
    if (v.oferta !== "video" && v.oferta !== "extra") return null;
    return { tokenEdicao: v.tokenEdicao, oferta: v.oferta };
  } catch {
    return null;
  }
}
