// O TETO QUE SOBE SOZINHO EM DIA BOM (16/10).
//
// O teto diário de geração (`inngest/lib/disjuntor.ts`) existe pra limitar o
// prejuízo de robô rodando o funil em laço. Mas em 02/10 o dia bom chegou a
// 2.498 músicas com o teto em 2.500: um pouco mais de tráfego e o funil teria
// parado de gerar música pra quem ainda não pagou, no melhor dia do mês. O dono
// pediu (16/10) que o teto suba sozinho quando estiver perto.
//
// O que separa dia bom de robô é VENDA. Robô gera música e não paga; tráfego de
// verdade vende ~12-15% das músicas geradas. Então, ao cruzar 80% do teto:
//   - venda/música >= 5%  → dia bom: sobe 50% (arredondado pra 500), até o
//     teto máximo de 10.000 (pior caso ~R$ 3.200 num dia de abuso);
//   - abaixo disso         → suspeito: NÃO sobe, só avisa os donos.
// Regra pura aqui, pra ter teste; quem lê o banco e grava é o disjuntor.

/** Acima disso o teto não protege mais nada. O painel usa o mesmo número. */
export const TETO_MAXIMO = 10_000;
/** Venda por música mínima pra contar como tráfego de verdade (normal: 12-15%). */
export const VENDA_MINIMA = 0.05;

export type DecisaoTeto =
  | { subir: true; novo: number; taxa: number }
  | { subir: false; motivo: "no-maximo" | "suspeito"; taxa: number };

export function decidirTeto(args: { teto: number; musicasHoje: number; vendasHoje: number }): DecisaoTeto {
  const taxa = args.musicasHoje > 0 ? args.vendasHoje / args.musicasHoje : 0;
  if (args.teto >= TETO_MAXIMO) return { subir: false, motivo: "no-maximo", taxa };
  if (taxa < VENDA_MINIMA) return { subir: false, motivo: "suspeito", taxa };
  const novo = Math.min(TETO_MAXIMO, Math.ceil((args.teto * 1.5) / 500) * 500);
  return { subir: true, novo, taxa };
}
