// LOTES QUE CABEM NA URL. O `.in(...)` do PostgREST vai na query string, e o
// Supabase fica atrás de um proxy que corta a URL em ~16 KB. Um gclid tem ~100
// caracteres: 200 deles passavam disso e a consulta morria (revisão de 08/10;
// `vigia-pagamento.ts` já tinha batido no mesmo muro com uuids). Corta pelo
// TAMANHO, não pela contagem. Sem imports: roda no site e no Inngest.

export function lotesPorTamanho(ids: string[], maxBytes = 6000): string[][] {
  const lotes: string[][] = [];
  let atual: string[] = [];
  let tamanho = 0;
  for (const id of ids) {
    const t = encodeURIComponent(id).length + 3; // a vírgula codificada (%2C)
    if (atual.length && tamanho + t > maxBytes) {
      lotes.push(atual);
      atual = [];
      tamanho = 0;
    }
    atual.push(id);
    tamanho += t;
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}
