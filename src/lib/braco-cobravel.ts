/**
 * Qual braço do teste de `preco` o SERVIDOR aceita cobrar.
 *
 * O braço vem de `attribution.exp.preco`, que quem grava é o navegador, e o
 * sorteio aceita `?exp=preco:<braço>` pra forçar qualquer variante da lista,
 * inclusive as de peso 0. Sem esta trava, `?exp=preco:C1` na URL cobrava
 * R$ 9 (auditoria de 30/09/2026).
 *
 * A regra: braço com peso 0 não recebe tráfego, então ninguém de verdade
 * está nele e ele é cobrado como o controle. Os braços zerados ficam na lista
 * só pra leitura do histórico. Braço desconhecido também cai no controle.
 */
export type VariantePreco = {
  nome?: string;
  peso?: number | null;
  plano?: { valor?: number | string; checkout?: unknown };
};

export function bracoCobravel(
  variantes: VariantePreco[],
  braco: string | null | undefined,
): VariantePreco | undefined {
  const controle = variantes.find((v) => v.nome === "A") ?? variantes[0];
  const achado = variantes.find((v) => v.nome === braco);
  if (!achado) return controle;
  // `peso` ausente vale 1, igual ao sorteio (`?? 1` em experimentos.ts).
  if ((achado.peso ?? 1) <= 0) return controle;
  return achado;
}
