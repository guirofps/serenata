// O CHECKOUT EM PESO PRO MÉXICO (Ballad, 21/10/2026).
//
// As campanhas do México abriram 15 checkouts em dois dias e só 1 pagou; nos
// outros 14 a pessoa saiu sem nem tentar o cartão. O caixa mostrava "US$ 19"
// pra quem não pensa em dólar. O Adaptive Pricing do Stripe (preço local
// automático) está ligado na conta, mas não converte nada: ele exige o preço
// numa moeda em que a conta RECEBE, e a conta da Ballad é brasileira, só
// recebe em real. Então o preço em peso é nosso: TABELADO aqui, equivalente
// ao preço em dólar, arredondado pra cima no "x49/x99" que o mexicano lê como
// preço de loja (US$ 19 → $349 MXN).
//
// SÓ O CAIXA MUDA, e SÓ pra quem está no México. A página continua igual e o
// funil dos EUA não é tocado (decisão do dono). O pedido continua em DÓLAR
// (`valor_centavos`): painel, conversão do Google e TikTok seguem lendo dólar.
// O webhook confere o valor pago em peso contra esta MESMA tabela.
//
// Puro, sem imports: usado pelo checkout (servidor) e pelo webhook.

/** Câmbio de referência da tabela. Fixo de propósito: preço não oscila com o câmbio do dia. */
export const PESOS_POR_DOLAR = 18.4;

/** O preço em centavos de peso pro preço em centavos de dólar (US$ 19 → 34900). */
export function centavosMxnDe(centavosUsd: number): number {
  const pesos = (centavosUsd / 100) * PESOS_POR_DOLAR;
  // Pra cima até o próximo múltiplo de 50, menos 1: 349, 399, 449…
  return (Math.ceil(pesos / 50) * 50 - 1) * 100;
}

/** O país do acesso (cabeçalho da Vercel) pede o caixa em peso? */
export function cobrarEmPeso(pais: string | null | undefined): boolean {
  return String(pais ?? "").trim().toUpperCase() === "MX";
}

/**
 * Quanto a sessão do Stripe DEVE ter cobrado, na moeda dela, pra um pedido de
 * `valorUsdCentavos`. Moeda desconhecida = `null` (o webhook retém e avisa).
 */
export function valorEsperadoNaMoeda(moeda: string | null | undefined, valorUsdCentavos: number): number | null {
  const m = String(moeda ?? "usd").toLowerCase();
  if (m === "usd") return valorUsdCentavos;
  if (m === "mxn") return centavosMxnDe(valorUsdCentavos);
  return null;
}

/**
 * O texto de um preço em dólar ("US$ 19", "$49") escrito em peso, pela MESMA
 * tabela do caixa: "$349 MXN". Texto sem número = `null` (a tela fica em dólar).
 *
 * É o que a página mostra pra quem está no México (21/10, dono: "mostra o
 * preço em peso na página também"): o caixa já cobrava $349 e a página dizia
 * US$ 19, conta de câmbio que ninguém faz no celular.
 */
export function textoEmPeso(textoUsd: string): string | null {
  const m = String(textoUsd).match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const usd = Number(m[1].replace(",", "."));
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return `$${centavosMxnDe(Math.round(usd * 100)) / 100} MXN`;
}
