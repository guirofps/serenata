// As contas de calendário das DATAS ESPECIAIS, puras: o site (editor) e o
// job diário (`lembrarDatas`) usam as mesmas, e o job não pode importar as
// funções de servidor do site.

/** Dias até a próxima ocorrência de dia/mês, contando de `hoje` (0 = hoje). */
export function diasAte(dia: number, mes: number, hoje: Date): number {
  const ano = hoje.getUTCFullYear();
  const base = Date.UTC(ano, hoje.getUTCMonth(), hoje.getUTCDate());
  // 29/02 em ano que não tem: lembra no dia 28, que é quando se comemora.
  const naData = (a: number) => {
    const bissexto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
    const d = mes === 2 && dia === 29 && !bissexto ? 28 : dia;
    return Date.UTC(a, mes - 1, d);
  };
  let alvo = naData(ano);
  if (alvo < base) alvo = naData(ano + 1);
  return Math.round((alvo - base) / 86_400_000);
}

/** Hoje no fuso de Brasília, como data UTC "pura" (sem hora). */
export function hojeEmBrasilia(agora = new Date()): Date {
  const br = new Date(agora.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()));
}
