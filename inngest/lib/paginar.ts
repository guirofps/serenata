// LER TUDO, E NÃO SÓ AS PRIMEIRAS MIL LINHAS.
//
// O PostgREST corta toda consulta em 1.000 linhas, em silêncio, e `.limit()`
// não levanta esse teto. Isto já custou três bugs do mesmo formato: uma
// leitura de CPA errada, a oferta de quadro e de vídeo que só enxergava os
// ~6 dias mais recentes de compradores (28/09), e a escada de recuperação
// conferindo "quem já comprou" contra só 1.000 das 5.000+ compras (28/09) —
// o que pode mandar "volta e compra" pra quem comprou.
//
// `montar` recebe o intervalo e devolve a consulta JÁ com `.range(de, ate)`
// e com uma ordenação estável (paginar sem ordem repete e pula linhas).
export async function todasAsPaginas<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamanho = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await montar(de, de + tamanho - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < tamanho) break;
  }
  return out;
}
