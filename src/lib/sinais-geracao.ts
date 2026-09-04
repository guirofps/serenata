// OS SINAIS DE QUE A GERAÇÃO PAROU, sem depender de nada pra serem lidos.
//
// ── POR QUE ESTE ARQUIVO SAIU DE DENTRO DO JOB ───────────────────
//
// A lógica morava em `inngest/functions/vigiaGeracao.ts`. Em 04/09/2026 o
// Inngest teve uma queda de 58 minutos ("Degraded Function Execution", das
// 15h11 às 16h09 BRT): ele aceitava os eventos com 200 e não criava execução
// nenhuma. 25 músicas pararam, um comprador pagou às 15h29, ficou sem entrega
// e abriu contestação no mesmo dia.
//
// O vigia não avisou, e não podia: ele é um cron do Inngest. O detector de
// incêndio estava ligado na tomada que pegou fogo.
//
// Importar a lógica de dentro do job traria o cliente do Inngest junto. Então
// ela mora aqui, pura, e os DOIS vigias a chamam: o de dentro (que também
// conserta redisparando) e o de fora, em Vercel Cron, que só sabe gritar mas
// grita mesmo quando o Inngest está morto.

export type MotivoAlerta =
  | "nada-saiu"
  | "fila-grande"
  | "provedor-recusando"
  | "orquestrador-mudo";

/**
 * Os sinais que valem acordar o dono.
 *
 * São QUATRO, e cada um nasceu de uma quebra real:
 *
 *   `nada-saiu`           tem gente escrevendo letra e não saiu música nenhuma
 *   `fila-grande`         tanta coisa presa que não é soluço
 *   `provedor-recusando`  as músicas FALHAM em vez de travar (03/09)
 *   `orquestrador-mudo`   nada preso, nada falhando, nada saindo (04/09)
 *
 * O quarto é o formato da queda do ORQUESTRADOR, e é o mais silencioso de
 * todos: quando o Inngest para, a música nem chega a `aguardando` em alguns
 * caminhos, nada vai pra `falhou`, e a fila pode estar curta no começo. Os
 * três primeiros dependem de a fila ENGORDAR ou de alguma coisa FALHAR — os
 * dois levam tempo, e é tempo com campanha rodando.
 *
 * O que o quarto olha é a ausência: teve gente entrando (letra escrita) e o
 * relógio da última música pronta parou. Sem tráfego ele dorme, igual aos
 * outros, porque `letrasNovas` é a prova de que tem gente no funil.
 */
export function lerOsSinais(d: {
  letrasNovas: number;
  prontasNaJanela: number;
  totalPresas: number;
  falhas: number;
  /** Minutos desde que a última música ficou pronta. `null` = nenhuma, nunca. */
  minutosSemProntas?: number | null;
}): { avisar: boolean; motivo: MotivoAlerta | null } {
  if (d.falhas >= 3 && d.falhas >= d.prontasNaJanela) {
    return { avisar: true, motivo: "provedor-recusando" };
  }
  if (d.letrasNovas >= 3 && d.prontasNaJanela === 0) {
    return { avisar: true, motivo: "nada-saiu" };
  }
  if (d.totalPresas >= 15) return { avisar: true, motivo: "fila-grande" };

  // O SINAL DO ORQUESTRADOR MUDO.
  //
  // 25 minutos é o número, e ele não é redondo por acaso: o pipeline inteiro
  // leva 84s a 110s (medido em 23/07), e a mediana do dia é 112s. Vinte e
  // cinco minutos são 13x isso. Abaixo disso o alerta gritaria com fila
  // pesada de horário de pico, que é o dia bom, e alerta que mente uma vez
  // deixa de ser lido.
  //
  // Ele exige `letrasNovas` maior que zero pelo mesmo motivo dos outros: sem
  // tráfego, "nenhuma música em 25 minutos" é madrugada, não é pane.
  if (d.letrasNovas >= 1 && d.minutosSemProntas != null && d.minutosSemProntas >= 25) {
    return { avisar: true, motivo: "orquestrador-mudo" };
  }
  return { avisar: false, motivo: null };
}

/** O que o dono precisa ler no assunto do e-mail, sem abrir. */
export function assuntoDoAlerta(motivo: MotivoAlerta, n: number): string {
  switch (motivo) {
    case "provedor-recusando":
      return `🚨 O provedor está RECUSANDO: ${n} músicas falharam. Pause as campanhas.`;
    case "nada-saiu":
      return `🚨 Nenhuma música saiu com gente no funil. Pause as campanhas.`;
    case "fila-grande":
      return `🚨 ${n} músicas presas na fila. Pause as campanhas.`;
    case "orquestrador-mudo":
      return `🚨 Nada é gerado há ${n} minutos e ninguém reclamou. Pause as campanhas.`;
  }
}
