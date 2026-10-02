// LEITURA DE UMA JANELA DO BANCO, EM FATIAS DE UM DIA, POR CURSOR.
//
// Substitui o `paginado` do painel, que pedia 12 páginas por OFFSET ao mesmo
// tempo, ordenadas por `id` — um uuid aleatório. Pra entregar a página N o
// banco ordenava a janela INTEIRA e jogava fora N×1000 linhas, doze vezes em
// paralelo. Foi isso que fez o painel estourar o tempo até em 7 dias
// (02/10/2026).
//
// Aqui cada fatia é um trecho do índice `(created_at, id)`, e cada página
// continua de onde a anterior parou: nada é reordenado, nada é descartado.
// O paralelismo continua, só que entre DIAS, não entre páginas do mesmo dia.
//
// Puro: recebe a consulta pronta. O painel e o cron montam a sua.

export type LinhaComCursor = { id: string; created_at: string };
export type Cursor = { created_at: string; id: string };
export type ConsultaFatia<T> = (a: {
  desde: string;
  ate: string;
  cursor: Cursor | null;
  limite: number;
}) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** O teto de linhas por requisição do PostgREST. */
export const PAGINA = 1000;
/** Quantas fatias ao mesmo tempo. Cada uma é uma conexão no PostgREST. */
export const PARALELO = 12;
/** Acima disso lança: número errado é pior que erro visível. */
export const TETO = 500_000;

const DIA_MS = 86_400_000;

/**
 * O filtro `or` do PostgREST pra "depois do cursor".
 *
 * O timestamp vai ENTRE ASPAS: o banco devolve `...123456+00:00`, e sem aspas
 * o `+` e os `:` quebram a gramática do `or=(...)`. O `id` desempata linhas
 * gravadas no mesmo instante — sem ele, um empate maior que uma página giraria
 * pra sempre.
 */
export function filtroCursor(c: Cursor): string {
  return `created_at.gt."${c.created_at}",and(created_at.eq."${c.created_at}",id.gt.${c.id})`;
}

/** A janela em pedaços de `passoMs`, a partir do início. */
export function fatiasDe(
  inicio: Date,
  fim: Date,
  passoMs = DIA_MS,
): Array<{ desde: string; ate: string }> {
  const fatias: Array<{ desde: string; ate: string }> = [];
  for (let t = inicio.getTime(); t < fim.getTime(); t += passoMs) {
    fatias.push({
      desde: new Date(t).toISOString(),
      ate: new Date(Math.min(t + passoMs, fim.getTime())).toISOString(),
    });
  }
  return fatias;
}

async function lerFatia<T extends LinhaComCursor>(
  consulta: ConsultaFatia<T>,
  desde: string,
  ate: string,
): Promise<T[]> {
  const linhas: T[] = [];
  let cursor: Cursor | null = null;
  for (;;) {
    const { data, error } = await consulta({ desde, ate, cursor, limite: PAGINA });
    if (error) throw new Error(error.message);
    const pagina = data ?? [];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;

    const ultima = pagina[pagina.length - 1];
    // Uma página cheia que termina onde a anterior terminou não vai acabar
    // nunca. Melhor erro na tela que função pendurada até a Vercel matar.
    if (cursor && ultima.created_at === cursor.created_at && ultima.id === cursor.id) {
      throw new Error(`cursor parado em ${ultima.created_at}: a consulta ignorou o cursor`);
    }
    cursor = { created_at: ultima.created_at, id: ultima.id };
    if (linhas.length >= TETO) {
      throw new Error(
        `recorte grande demais: mais de ${TETO} linhas. Diminua o período do painel.`,
      );
    }
  }
}

/**
 * Lê `[inicio, fim)` inteira, fatia por fatia, até `PARALELO` ao mesmo tempo.
 *
 * A deduplicação por `id` ficou como cinto: com cursor, escrita concorrente
 * não empurra linha entre páginas, mas a junção de fatias é o lugar onde um
 * erro de borda apareceria.
 */
export async function lerJanela<T extends LinhaComCursor>(
  consulta: ConsultaFatia<T>,
  inicio: Date,
  fim: Date,
): Promise<T[]> {
  const fatias = fatiasDe(inicio, fim);
  const resultados: T[][] = new Array(fatias.length);
  let proxima = 0;
  const trabalhador = async () => {
    while (proxima < fatias.length) {
      const i = proxima++;
      resultados[i] = await lerFatia(consulta, fatias[i].desde, fatias[i].ate);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALELO, fatias.length) }, trabalhador));

  const vistos = new Set<string>();
  const tudo: T[] = [];
  for (const lote of resultados) {
    for (const l of lote) {
      if (vistos.has(l.id)) continue;
      vistos.add(l.id);
      tudo.push(l);
    }
  }
  if (tudo.length > TETO) {
    throw new Error(`recorte grande demais: mais de ${TETO} linhas. Diminua o período do painel.`);
  }
  return tudo;
}
