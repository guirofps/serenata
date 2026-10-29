// O CHECKOUT EM PESO PRO MÉXICO (Ballad, 21/10/2026).
//
// As campanhas do México abriram 15 checkouts em dois dias e só 1 pagou; nos
// outros 14 a pessoa saiu sem nem tentar o cartão. O caixa mostrava "US$ 19"
// pra quem não pensa em dólar. O Adaptive Pricing do Stripe (preço local
// automático) está ligado na conta, mas não converte nada: ele exige o preço
// numa moeda em que a conta RECEBE, e a conta da Ballad é brasileira, só
// recebe em real. Então o preço em peso é nosso: TABELADO, equivalente ao
// preço em dólar.
//
// PREÇO DE TESTE NO MÉXICO (22/10, dono: "põe 199 pra teste, depois vamos
// aumentando"). A $349 só 4% dos leads de lá compravam, e o empate pedia ~9%;
// a Cántale vende a $99 avulsa e $169 o pacote. Teste em SEQUÊNCIA, não A/B (o
// México faz ~1 venda/dia): ler venda por lead do México a $199 contra os 4% a
// $349. Pra subir, trocar os dois números (preço e âncora, na mesma proporção
// 19:49 do dólar), agora em `mercados.ts`.
//
// DESDE 29/10 ISTO É UMA FACHADA. A tabela, o câmbio e a conferência moram em
// `mercados.ts`, que tem um mercado por país (Espanha, Colômbia, Chile, Peru
// entraram junto). Os nomes daqui ficaram pra quem já os importava, e o
// México dá os MESMOS números de antes, centavo por centavo (o teste
// `preco-mxn.test.ts` não mudou).

import {
  MERCADOS,
  centavosMxnPorCambio as porCambioMx,
  textoNaMoeda,
  usdDe,
  valorNaMoeda,
  valorPagoConfere as conferePelaTabela,
} from "./mercados.js";

const MX = MERCADOS.MX;

/** Câmbio de referência da tabela. Fixo de propósito: preço não oscila com o câmbio do dia. */
export const PESOS_POR_DOLAR = MX.porDolar;

/** Preço em dólar (centavos) → preço no México (centavos de peso). Ver `mercados.ts`. */
export const PRECO_MEXICO: Readonly<Record<number, number>> = MX.precos;

/** O preço em centavos de peso pro preço em centavos de dólar (US$ 19 → 19900 pela tabela). */
export function centavosMxnDe(centavosUsd: number): number {
  return valorNaMoeda(MX, centavosUsd);
}

/** A conversão pura, sem a tabela do México (US$ 19 → 34900). Era o preço até 22/10. */
export function centavosMxnPorCambio(centavosUsd: number): number {
  return porCambioMx(centavosUsd);
}

/** O país do acesso (cabeçalho da Vercel) pede o caixa em peso? */
export function cobrarEmPeso(pais: string | null | undefined): boolean {
  return String(pais ?? "").trim().toUpperCase() === "MX";
}

/** O equivalente em centavos de dólar de um valor em peso: o que o pedido grava ($199 → 1082). */
export function usdDoPeso(centavosMxn: number): number {
  return usdDe(MX, centavosMxn);
}

/**
 * A sessão cobrou o valor certo pra um pedido de `valorUsdCentavos`? Agora vale
 * pra toda moeda da tabela de `mercados.ts` (euro, peso colombiano…), com o
 * mesmo formato antigo do peso mexicano aceito. Moeda desconhecida = `false`.
 */
export function valorPagoConfere(moeda: string | null | undefined, valorPago: number, valorUsdCentavos: number): boolean {
  return conferePelaTabela(moeda, valorPago, valorUsdCentavos);
}

/**
 * O texto de um preço em dólar ("US$ 19", "$49") escrito em peso, pela MESMA
 * tabela do caixa: "$199 MXN". Texto sem número = `null` (a tela fica em dólar).
 */
export function textoEmPeso(textoUsd: string): string | null {
  return textoNaMoeda(MX, textoUsd);
}
