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

import { diaBr } from "./painel-resumo";

/**
 * Os DIAS (no Brasil) que uma janela cobre, pras tabelas guardadas por data
 * (`gastos_ads`, `metricas_campanha`): o primeiro e o último, inclusivos.
 *
 * O fim da janela é exclusivo, então o último dia é o do instante logo antes
 * dele. Cortar o ISO em UTC errava por fuso: meia-noite de Brasília é 03:00
 * UTC, e a janela "ontem" terminava com a data de HOJE — o gasto de hoje
 * entrava em ontem (02/10: painel R$ 8.433 contra R$ 5.473 do Google).
 */
export function diasDaJanela(inicio: Date, fim: Date): { de: string; ate: string } {
  return { de: diaBr(inicio.getTime()), ate: diaBr(fim.getTime() - 1) };
}

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
