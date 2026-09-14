// OS INSTANTES EM QUE A FOTO DA PÁGINA PRESENTE TROCA.
//
// A foto vira nas viradas da música (o segundo em que cada seção entra, tirado
// dos timestamps do Suno). Até 14/09/2026 a regra era "uma foto por seção", e
// isso escondia fotos em silêncio: uma música com 8 seções mostrava só as 8
// primeiras de uma galeria de 12, e o funil promete "até 12 fotos". A cliente
// sobe 12, o presenteado vê 8, e ninguém percebe até alguém reclamar.
//
// Quando há mais fotos que seções, as viradas continuam onde estão e os
// trechos mais longos são partidos ao meio até caber todas. A foto ainda troca
// no compasso da música, só que também no meio do verso comprido.

/** Menor tempo que uma foto fica na tela, pra troca não virar pisca-pisca. */
export const TELA_MINIMA_S = 4;

export function marcosDasFotos(
  secoes: number[],
  totalFotos: number,
  duracao: number | null | undefined,
): number[] {
  if (totalFotos < 2) return [];
  const fim = duracao && duracao > 0 ? duracao : null;

  // Sem estrutura de seções: espalha por igual, se souber a duração.
  if (secoes.length < 2) {
    if (!fim) return [];
    const passo = fim / totalFotos;
    return Array.from({ length: totalFotos }, (_, i) => i * passo);
  }

  const marcos = [...secoes].sort((a, b) => a - b);

  while (marcos.length < totalFotos) {
    // O trecho mais longo, incluindo o último (da última seção ao fim), quando
    // a duração é conhecida. Sem duração, só os trechos entre seções.
    let indice = -1;
    let tamanho = 0;
    for (let i = 0; i < marcos.length; i++) {
      const proximo = i + 1 < marcos.length ? marcos[i + 1] : fim;
      if (proximo == null) continue;
      const t = proximo - marcos[i];
      if (t > tamanho) {
        tamanho = t;
        indice = i;
      }
    }
    // Partir de novo deixaria alguma foto menos de TELA_MINIMA_S na tela.
    if (indice < 0 || tamanho < 2 * TELA_MINIMA_S) break;
    marcos.splice(indice + 1, 0, marcos[indice] + tamanho / 2);
  }

  return marcos;
}
