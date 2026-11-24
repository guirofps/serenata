// SELO DE BLACK FRIDAY NA OFERTA (Serenata, 24/11/2026) e o teste `black_friday`.
//
// Pedido do Ralph: um selo de Black Friday no cartão de preço da oferta. Ele
// escolheu, entre oito desenhos, o cartão PRETO com "60% OFF" gigante.
//
// ── O QUE MUDA E O QUE NÃO MUDA ──────────────────────────────────
//
// O PREÇO NÃO MUDA. O selo vai em cima do riscado e do preço de sempre, e o
// "60%" é a conta deles (de R$ 97 por R$ 38 = 60,8%), feita AQUI a partir do
// plano que a tela mostra, nunca escrita à mão: se o preço ou o riscado mudar,
// o número do selo muda junto, e abaixo de `PCT_MINIMO` o selo não aparece.
//
// Sem selo: quem tem crédito (não vê preço), cupom ou convite (paga outro
// valor, a conta não bate), fora do português e fora da Serenata.
//
// ── O TESTE ──────────────────────────────────────────────────────
//
//   A  o cartão de preço de sempre
//   B  o cartão preto com BLACK FRIDAY / 60% OFF e botão dourado
//
// As duas versões vêm no HTML. O cabeçalho do selo nasce escondido por CLASSE
// (`.bf-topo` em `styles.css`) e só o carimbo `data-exp-black_friday="B"` no
// <html> acende o braço B. Classe própria, e não `<Variante>`: sem a linha no
// banco o `<Variante>` não tem regra nenhuma e as duas versões apareceriam.
// Sem a linha, com o teste desligado ou sem JavaScript: A.
//
// ── SAI SOZINHO ──────────────────────────────────────────────────
//
// A Black Friday é sexta, 27/11. O selo vale até domingo, 29/11, 23h59 de
// Brasília (`BLACK_FRIDAY_ATE`). Depois disso a tela nem desenha o cabeçalho,
// com o teste ligado ou não. Sem frase de prazo na tela: o preço continua o
// mesmo depois, e "só até domingo" seria mentira.
//
// ── O QUE MEDIR ──────────────────────────────────────────────────
//
// RECEITA POR LEAD, por braço (`attribution.exp.black_friday`), entre as
// sessões com `black_friday_exposto` (quem abriu a oferta podendo ver o selo).

export const EXP_BLACK_FRIDAY = "black_friday";

/** Domingo, 29/11/2026, 23h59m59s de Brasília (UTC-3). */
export const BLACK_FRIDAY_ATE = "2026-11-30T02:59:59Z";

/** Abaixo disso não vale um selo de desconto. */
export const PCT_MINIMO = 30;

export function blackFridayAberta(agora: Date): boolean {
  return agora.getTime() <= Date.parse(BLACK_FRIDAY_ATE);
}

/** "R$ 97" → 97; "R$ 49,90" → 49.9. `null` se não for um preço em real. */
export function reaisDoTexto(texto: string): number | null {
  const m = texto.match(/^R\$\s?(\d{1,4})(?:,(\d{2}))?$/);
  if (!m) return null;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0);
}

/**
 * O desconto do riscado pro preço, em % inteiro arredondado PRA BAIXO (o selo
 * nunca promete mais do que a conta dá). `null` quando não há o que anunciar.
 */
export function pctDoSelo(preco: string, riscado: string): number | null {
  const p = reaisDoTexto(preco);
  const r = reaisDoTexto(riscado);
  if (p === null || r === null || r <= 0 || p >= r) return null;
  const pct = Math.floor((1 - p / r) * 100);
  return pct >= PCT_MINIMO ? pct : null;
}

/**
 * O número do selo, ou `null` (sem selo). `planos` são todos os preços que a
 * tela pode mostrar (um por braço do teste de preço): o selo só existe se
 * TODOS dão o mesmo desconto, porque o cabeçalho é um só e não pode dizer 60%
 * em cima de um preço que dá outra conta.
 */
export function seloBlackFriday(args: {
  agora: Date;
  locale: string;
  ballad: boolean;
  temCredito: boolean;
  temCupom: boolean;
  temConvite: boolean;
  planos: { texto: string; ancora: string }[];
}): number | null {
  if (args.ballad || args.locale !== "pt") return null;
  if (args.temCredito || args.temCupom || args.temConvite) return null;
  if (!blackFridayAberta(args.agora) || args.planos.length === 0) return null;
  const pcts = args.planos.map((p) => pctDoSelo(p.texto, p.ancora));
  const primeiro = pcts[0];
  if (primeiro === null || pcts.some((p) => p !== primeiro)) return null;
  return primeiro;
}
