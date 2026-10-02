// O GASTO DE MÍDIA DO PERÍODO (02/10/2026).
//
// Os cartões do topo do painel (gasto, CPA, ROAS, lucro) liam só o que era
// digitado em `gastos_ads`. O custo do Google já chegava sozinho, de hora em
// hora, em `metricas_campanha` (`puxarMetricasAds`), e só a tabela por
// campanha usava. Sem lançamento manual, os quatro cartões ficavam em "—".
//
// A regra: o Google vem da API; o manual vale pras outras origens (TikTok…)
// e, pro Google, só nos dias em que a API não trouxe nada — plano B pra quando
// o token cair. Num dia com dado da API, o "google" digitado à mão é ignorado,
// senão o mesmo dinheiro contaria duas vezes.

export type GastoManual = { dia: string; origem: string; brl: number };
/** Uma linha de `metricas_campanha`: uma campanha num dia. */
export type GastoGoogleApi = { dia: string; brl: number };

export function somarGasto(
  manuais: GastoManual[],
  google: GastoGoogleApi[],
): { totalBrl: number; googleApiBrl: number; manualBrl: number } {
  // Dia com linha da API é dia coberto, mesmo com custo zero: a campanha
  // existiu e não gastou, e isso é dado.
  const diasComApi = new Set(google.map((g) => g.dia));
  const googleApiBrl = google.reduce((s, g) => s + g.brl, 0);
  const manualBrl = manuais
    .filter((m) => !(m.origem === "google" && diasComApi.has(m.dia)))
    .reduce((s, m) => s + m.brl, 0);
  return { totalBrl: googleApiBrl + manualBrl, googleApiBrl, manualBrl };
}
