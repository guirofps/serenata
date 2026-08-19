// DISTRIBUIÇÃO DE PESO EM PORCENTAGEM INTEIRA, SEMPRE SOMANDO 100.
//
// Arredondar cada fatia isoladamente (`Math.round(peso/soma*100)`) não
// garante soma 100 — é aritmética básica, não descuido de implementação:
//   - pesos [2,1,1,1,1] arredondam pra 33+17+17+17+17 = 101
//   - três pesos iguais arredondam pra 33+33+33 = 99
// Numa tela que edita preço em produção, "quase 100" é o tipo de número que
// faz a pessoa desconfiar da tela inteira, não só da conta. Fica dormente
// enquanto os pesos do experimento em produção são cinco fatias de 20%
// exatas — mas a primeira edição de peso feita por este painel já expõe.

/**
 * Método do MAIOR RESTO (o mesmo usado pra dividir cadeiras em eleição
 * proporcional): cada fatia recebe o PISO da sua porcentagem exata, e o que
 * falta pra fechar 100 é distribuído, um ponto de cada vez, pra quem tem o
 * MAIOR resto fracionário. Empate no resto é resolvido pela ordem original
 * (índice menor primeiro) — sem isso o ponto extra saltaria de variante a
 * cada render, por causa de instabilidade de ordenação sobre valores iguais.
 *
 * Pesos todos zero (ou array vazio de pesos positivos) não carregam nenhum
 * sinal de preferência entre as fatias — trata como peso igual pra todo
 * mundo, só pra a tela nunca cair em "0% em tudo" quando o total dá zero.
 */
export function distribuirPercentuais(pesos: number[]): number[] {
  if (pesos.length === 0) return [];

  const positivos = pesos.map((p) => Math.max(0, p || 0));
  const soma = positivos.reduce((s, p) => s + p, 0);
  // Sem peso nenhum: divide igual, não zera tudo.
  const base = soma > 0 ? positivos : positivos.map(() => 1);
  const somaBase = soma > 0 ? soma : base.length;

  const exatos = base.map((p) => (p / somaBase) * 100);
  const pisos = exatos.map((e) => Math.floor(e));
  const falta = Math.round(100 - pisos.reduce((s, p) => s + p, 0));

  const restos = exatos
    .map((e, i) => ({ i, resto: e - Math.floor(e) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);

  const resultado = [...pisos];
  for (let k = 0; k < falta; k++) {
    resultado[restos[k].i] += 1;
  }
  return resultado;
}
