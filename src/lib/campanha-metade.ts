// AS REGRAS DA CAMPANHA METADE (16/11, Ralph), puras: 50% em música, vídeo e
// quadro, por e-mail, só pra quem já comprou, com 10% de controle sem e-mail.
// Sem imports com `@` (o Inngest roda como ESM puro). O motor (lotes, freio,
// ids) é o da MUSICA10, em `campanha-musica10.ts`.

import { METADE, METADE_VALE_ATE } from "./cupom.js";

export const CAMPANHA_METADE = "metade";
export const TEMPLATE_METADE = "campanha_metade";
/** % dos compradores que NÃO recebem, pra medir o que a campanha trouxe a mais. */
export const CONTROLE_PCT = 10;
/**
 * 300 por rodada, 12 rodadas por dia: ~3.600/dia. Só compradores (~8 mil): 2 a 3
 * dias. Metade do ritmo da MUSICA10, de propósito (regra de 15/10: campanha pra
 * base só pra comprador e em lote menor).
 */
export const POR_RODADA_METADE = 300;
/** Não manda e-mail com menos que isto de cupom pela frente. */
export const DIAS_MINIMOS_DE_CUPOM = 3;

function link(site: string, caminho: string, botao: string): string {
  return `${site}${caminho}?cupom=${METADE}&utm_source=email&utm_medium=campanha&utm_campaign=metade&utm_content=${botao}`;
}
/** Botão principal: música nova pelo funil, com o cupom já guardado. */
export function linkCriarMetade(site: string): string {
  return link(site, "/criar", "criar");
}
/** Vídeo e quadro moram na conta: o cupom entra pela URL e fica no navegador. */
export function linkContaMetade(site: string): string {
  return link(site, "/login", "conta");
}

/**
 * A campanha só envia enquanto o cupom ainda vale por `DIAS_MINIMOS_DE_CUPOM`
 * dias inteiros: e-mail que promete desconto morto (ou que morre amanhã) é pior
 * que e-mail nenhum.
 */
export function podeEnviarMetade(agora = new Date(), valeAte = METADE_VALE_ATE): boolean {
  const fim = Date.parse(`${valeAte}T23:59:59-03:00`);
  return fim - agora.getTime() >= DIAS_MINIMOS_DE_CUPOM * 86_400_000;
}
