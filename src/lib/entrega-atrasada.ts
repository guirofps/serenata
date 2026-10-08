// QUEM PAGOU E AINDA NÃO RECEBEU A ENTREGA, NA JANELA INTEIRA.
//
// A segunda varredura do `api/vigia-pagamento.ts` pedia os 40 pagos mais
// NOVOS e só DEPOIS tirava quem já tinha recebido. Com ~150 vendas por dia,
// 40 pagos são as últimas 4 a 6 horas: a janela de 72h existia no papel. Um
// comprador cuja entrega falhou de manhã saía da lista à tarde e nunca mais
// era tentado (auditoria de 08/10). É o mesmo formato do defeito de 11/09
// (ascendente com teto pegava só os velhos), do outro lado.
//
// Agora a janela é lida inteira (paginada), quem já recebeu sai ANTES do teto,
// e o teto vale só pra quantos se entregam por rodada.
//
// Puro: o vigia faz as consultas e passa as linhas.

/** Lotes pra `.in(...)`: uuid demais numa URL só estoura o limite do PostgREST. */
export function emLotes<T>(itens: readonly T[], tamanho: number): T[][] {
  if (tamanho < 1) throw new Error("tamanho de lote inválido");
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

/**
 * Os pagos sem entrega registrada, um por quiz, na ordem recebida (do mais
 * novo pro mais velho), até `max`.
 *
 * Um por quiz: o mesmo quiz com dois pedidos pagos (pagou duas vezes) é UMA
 * entrega, e mandar duas seria o vigia repetindo e-mail.
 */
export function faltamEntregar<T extends { quiz_response_id: string | null }>(
  pagos: readonly T[],
  jaEntregues: ReadonlySet<string>,
  max: number,
): T[] {
  const out: T[] = [];
  const vistos = new Set<string>();
  for (const p of pagos) {
    const q = p.quiz_response_id;
    if (!q || jaEntregues.has(q) || vistos.has(q)) continue;
    vistos.add(q);
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}
