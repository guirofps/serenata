// AS DUAS COLUNAS DE COMPRA DA ABA "LINKS" (13/10).
//
// "Comprou" contava toda venda que chegou pelo link, inclusive o DONO
// comprando outra música pelo próprio link e quem já era cliente. Nenhuma das
// duas dá comissão (a trigger `indicacao_comissionar` só paga a primeira
// compra de alguém novo), e o painel parecia dizer que a comissão falhou.
//
// A fonte de "cliente novo" é a própria `indicacao_comissoes`: a trigger é
// quem decide, e reler a decisão dela é o único jeito de o painel nunca
// discordar do que foi pago. O resto das compras do link é "outras".

/** Comissões (de pedido ainda pago) por código. Uma linha = um cliente novo. */
export function novosPorCodigo(linhas: { codigo: string | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of linhas) {
    const c = (l.codigo ?? "").trim().toUpperCase();
    if (!c) continue;
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}

/**
 * Separa as compras do link. `novos` é limitado a `pagos` porque as duas
 * contas vêm de leituras diferentes (a RPC e a tabela de comissões), e uma
 * coluna negativa seria pior que um número um pouco curto.
 */
export function separarCompras(pagos: number, novos: number): { novos: number; outras: number } {
  const nv = Math.max(0, Math.min(novos, pagos));
  return { novos: nv, outras: Math.max(0, pagos - nv) };
}
