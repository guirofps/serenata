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
): { totalBrl: number; googleApiBrl: number; manualBrl: number; googleBrl: number } {
  // Dia com linha da API é dia coberto, mesmo com custo zero: a campanha
  // existiu e não gastou, e isso é dado.
  const diasComApi = new Set(google.map((g) => g.dia));
  const googleApiBrl = google.reduce((s, g) => s + g.brl, 0);
  const valendo = manuais.filter((m) => !(m.origem === "google" && diasComApi.has(m.dia)));
  const manualBrl = valendo.reduce((s, m) => s + m.brl, 0);
  // Só o Google: o que o CPA do painel divide (18/10).
  const googleBrl = googleApiBrl + valendo.filter((m) => m.origem === "google").reduce((s, m) => s + m.brl, 0);
  return { totalBrl: googleApiBrl + manualBrl, googleApiBrl, manualBrl, googleBrl };
}

/**
 * O CPA do painel é SÓ do Google Ads (dono, 18/10): gasto do Google ÷ vendas
 * do canal Google (`canalDaVenda`). Dividir o gasto pelas vendas de TODOS os
 * canais misturava e-mail e orgânico e baixava o número. 0 = sem venda do
 * Google (o cartão mostra "—").
 */
export function cpaDoGoogle(gastoGoogleBrl: number, vendasGoogle: number): number {
  return vendasGoogle > 0 ? gastoGoogleBrl / vendasGoogle : 0;
}

// ── O DIA CORTADO DO COMPARATIVO (13/10) ────────────────────────────────
//
// O comparativo lê "ontem até esta mesma hora" (`janelaAnterior`), e vendas,
// receita e custos obedecem ao corte porque têm horário. O gasto NÃO tinha:
// `metricas_campanha` e `gastos_ads` guardam DIA, então o gasto de ontem
// entrava inteiro contra o de hoje pela metade. O cartão de gasto mostrava
// queda toda manhã, e CPA, ROAS e lucro, que dividem ou subtraem o gasto,
// saíam errados junto (dono, 13/10: "↘70%" no gasto, "↘189%" no lucro).
//
// O conserto mexe só no dia cortado: o Google vem hora a hora da API
// (`segments.hour`) até o minuto do corte; o manual é por dia e entra na
// fração do dia que já passou. Sem a API por hora, o Google também entra na
// fração: não é exato (de madrugada se gasta mais), mas é da mesma ordem do
// dia de hoje, e o dia inteiro não era.

/** O gasto por hora de um dia até `minutoDoDia` (0-1440): horas inteiras + a fração da hora corrente. */
export function gastoAteOMinuto(porHora: { hora: number; brl: number }[], minutoDoDia: number): number {
  const hora = Math.floor(minutoDoDia / 60);
  const fracao = (minutoDoDia % 60) / 60;
  return porHora.reduce((s, h) => s + (h.hora < hora ? h.brl : h.hora === hora ? h.brl * fracao : 0), 0);
}

export type CorteDoGasto = {
  /** O dia (no fuso das tabelas) que a janela anterior corta no meio. */
  dia: string;
  /** Minutos desde a meia-noite em que a janela anterior termina. */
  minutoDoDia: number;
  /** O Google daquele dia até o corte, hora a hora da API; `null` quando a API não respondeu. */
  googleAteAgoraBrl: number | null;
};

/** As linhas de gasto com o dia cortado trocado pelo que foi gasto até o corte. */
export function cortarDiaDoGasto(
  manuais: GastoManual[],
  google: GastoGoogleApi[],
  corte: CorteDoGasto,
): { manuais: GastoManual[]; google: GastoGoogleApi[] } {
  const fracao = Math.min(1, Math.max(0, corte.minutoDoDia / 1440));
  const doDia = google.filter((g) => g.dia === corte.dia);
  const outros = google.filter((g) => g.dia !== corte.dia);
  const googleDoDia =
    corte.googleAteAgoraBrl ?? doDia.reduce((s, g) => s + g.brl, 0) * fracao;
  return {
    manuais: manuais.map((m) => (m.dia === corte.dia ? { ...m, brl: m.brl * fracao } : m)),
    // Sem linha da API no dia, continua sem: o manual de google vale (plano B do `somarGasto`).
    google: doDia.length ? [...outros, { dia: corte.dia, brl: googleDoDia }] : outros,
  };
}
