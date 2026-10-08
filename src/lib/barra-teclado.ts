// A BARRA DO "CONTINUAR" ACIMA DO TECLADO NO IPHONE (08/10).
//
// O `interactive-widget=resizes-content` (31/08, `__root`) resolveu no Android:
// lá o layout encolhe com o teclado e a barra `sticky` para em cima dele. O
// iOS ignora o atributo, e o `botao_atras_do_teclado` seguiu acendendo em ~15%
// das sessões que chegam num passo de digitar (7 dias até 08/10: ~2.900 no
// nome, ~2.900 no contato, 140 a 240px de botão coberto). O dono reproduziu no
// iPhone dele: 2 a 3 toques pra avançar, porque o primeiro só fecha o teclado.
//
// O conserto é subir a barra pela diferença entre o fim da barra e o fim da
// área VISÍVEL (`visualViewport`), que é o que o teclado encolhe no iOS.
//
// Liga por aparelho (`?barra=1` grava no navegador) até o dono conferir no
// iPhone dele; depois `LIGADA_PRA_TODOS` vira true.

export const LIGADA_PRA_TODOS = false;
const CHAVE = "barra_teclado";

/** Abaixo disso é arredondamento do `visualViewport`, não teclado (ver o Quiz). */
export const FOLGA_PX = 24;

/**
 * Quanto subir a barra, em px (0 = não mexe).
 *
 * `fimDaBarra` é o `bottom` da barra na tela, `subidaAtual` o que já está
 * aplicado (o `bottom` medido já inclui a subida, então ela sai da conta pra
 * achar onde a barra estaria sem nada).
 */
export function subidaDaBarra(args: {
  fimDaBarra: number;
  subidaAtual: number;
  visivelTopo: number;
  visivelAltura: number;
}): number {
  const fimSemSubida = args.fimDaBarra + args.subidaAtual;
  const fimVisivel = args.visivelTopo + args.visivelAltura;
  const coberto = fimSemSubida - fimVisivel;
  return coberto > FOLGA_PX ? Math.round(coberto) : 0;
}

/** Ligada neste aparelho? `?barra=1` liga e `?barra=0` desliga, e fica gravado. */
export function barraSobeComTeclado(): boolean {
  if (LIGADA_PRA_TODOS) return true;
  try {
    const p = new URLSearchParams(window.location.search).get("barra");
    if (p === "1") localStorage.setItem(CHAVE, "1");
    if (p === "0") localStorage.removeItem(CHAVE);
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}
