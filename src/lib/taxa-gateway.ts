// A TAXA DO GATEWAY DE UM PEDIDO, numa regra só (02/10/2026).
//
// Nasceu no `financeiro.ts` e saiu de lá quando o cartão Lucro do painel
// passou a descontar a taxa também: duas regras pra mesma taxa dariam dois
// lucros diferentes pro mesmo dia.
//
// Só parte dos pedidos pagos tem `taxa_centavos` gravado (o campo entrou
// depois que a operação já rodava). Ignorar os outros inflaria o lucro;
// chutar um número redondo esconderia a incerteza. Então a estimativa usa a
// taxa REAL MEDIDA de cada gateway, e quem soma sabe quanto foi estimado.
//
// As taxas vêm do CLAUDE.md, medidas em transações reais:
//   Perfect Pay  11,39% (média de R$ 4,63 no ticket de R$ 38)
//   Woovi         0,8% com piso de R$ 0,50 — no ticket de hoje, R$ 0,50
const TAXA = {
  perfectpay: (v: number) => v * 0.1139,
  woovi: (v: number) => Math.max(0.5, v * 0.008),
  asaas: (v: number) => Math.max(0.99, v * 0.0199),
  // Gateway desconhecido não recebe taxa zero: zero é uma afirmação de que
  // não houve custo, e aqui a verdade é que não se sabe. A média dos
  // conhecidos erra menos que zero.
  outro: (v: number) => v * 0.03,
} as const;

/**
 * A taxa de um pedido, na MOEDA do pedido (quem soma converte, como faz com o
 * valor). `estimada` diz se veio da alíquota em vez do extrato.
 */
export function taxaDoPedido(p: {
  valor_centavos: number | null;
  taxa_centavos: number | null;
  gateway: string | null;
}): { valor: number; estimada: boolean } {
  if (p.taxa_centavos != null) return { valor: p.taxa_centavos / 100, estimada: false };
  const f = TAXA[(p.gateway ?? "outro") as keyof typeof TAXA] ?? TAXA.outro;
  return { valor: f((p.valor_centavos ?? 0) / 100), estimada: true };
}
