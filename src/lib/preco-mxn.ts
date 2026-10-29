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
// PREÇO DE TESTE NO MÉXICO (22/10, dono: "põe 199 pra teste, depois vamos
// aumentando"). A $349 só 4% dos leads de lá compravam, e o empate pedia ~9%;
// a Cántale vende a $99 avulsa e $169 o pacote. O preço do México deixa de
// ser o equivalente do dólar: `PRECO_MEXICO` diz quanto cada preço em dólar
// vale lá, e o que não está na tabela cai na conversão. Teste em SEQUÊNCIA,
// não A/B (o México faz ~1 venda/dia, um A/B não fecharia em semanas): ler
// venda por lead do México a $199 contra os 4% a $349. Pra subir, trocar os
// dois números (preço e âncora, na mesma proporção 19:49 do dólar).
//
// Com preço próprio, o pedido grava o EQUIVALENTE em dólar do que se cobrou
// ($199 → US$ 10,82), não o US$ 19 da tela americana: senão o painel, o Google
// e o TikTok contariam US$ 19 numa venda de US$ 10,82.
//
// Puro, sem imports: usado pelo checkout (servidor) e pelo webhook.

/** Câmbio de referência da tabela. Fixo de propósito: preço não oscila com o câmbio do dia. */
export const PESOS_POR_DOLAR = 18.4;

/**
 * Preço em dólar (centavos) → preço no México (centavos de peso). A música e a
 * âncora dela, e o vídeo-presente (28/10): pela conversão o vídeo sairia a
 * $249, mais caro que a música a $199. Fica na mesma proporção do dólar
 * (US$ 12 é ~63% de US$ 19): $129.
 */
export const PRECO_MEXICO: Readonly<Record<number, number>> = { 1900: 19900, 4900: 54900, 1200: 12900 };

/** O preço em centavos de peso pro preço em centavos de dólar (US$ 19 → 19900 pela tabela). */
export function centavosMxnDe(centavosUsd: number): number {
  return PRECO_MEXICO[centavosUsd] ?? centavosMxnPorCambio(centavosUsd);
}

/** A conversão pura, sem a tabela do México (US$ 19 → 34900). Era o preço até 22/10. */
export function centavosMxnPorCambio(centavosUsd: number): number {
  const pesos = (centavosUsd / 100) * PESOS_POR_DOLAR;
  // Pra cima até o próximo múltiplo de 50, menos 1: 349, 399, 449…
  return (Math.ceil(pesos / 50) * 50 - 1) * 100;
}

/** O país do acesso (cabeçalho da Vercel) pede o caixa em peso? */
export function cobrarEmPeso(pais: string | null | undefined): boolean {
  return String(pais ?? "").trim().toUpperCase() === "MX";
}

/** O equivalente em centavos de dólar de um valor em peso: o que o pedido grava ($199 → 1082). */
export function usdDoPeso(centavosMxn: number): number {
  return Math.round(centavosMxn / PESOS_POR_DOLAR);
}

/**
 * A sessão do Stripe cobrou o valor certo pra um pedido de `valorUsdCentavos`?
 * Moeda desconhecida = `false` (o webhook retém e avisa).
 *
 * Em peso valem dois formatos de pedido: o de hoje (o equivalente do que se
 * cobrou, `usdDoPeso`) e o de antes de 22/10 (US$ 19 cobrado a $349 pela
 * conversão), pra quem abriu o caixa antes da troca e paga depois.
 */
export function valorPagoConfere(moeda: string | null | undefined, valorPago: number, valorUsdCentavos: number): boolean {
  const m = String(moeda ?? "usd").toLowerCase();
  if (m === "usd") return valorPago === valorUsdCentavos;
  if (m === "mxn") return usdDoPeso(valorPago) === valorUsdCentavos || valorPago === centavosMxnPorCambio(valorUsdCentavos);
  return false;
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
