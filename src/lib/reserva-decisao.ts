// O QUE O GERADOR RESERVA FAZ COM CADA MÚSICA, sem tocar em nada.
//
// Em 09/10/2026, das 18h06 às ~18h47, o Inngest aceitou o evento `musica/gerar`
// e não executou nada (a mesma falha de 04/09). A música só nascia pelo job
// dele, então nenhuma ficou pronta em 40 minutos e quem estava na prévia não
// pôde comprar. `api/gerador-reserva.ts` roda em Vercel Cron a cada minuto e
// gera o que ninguém está gerando. A regra mora aqui, pura e testada, porque
// errar pra um lado deixa o cliente esperando e errar pro outro paga o Suno
// duas vezes pela mesma música.
//
// ── O SINAL É "NINGUÉM MEXEU NA LINHA" ───────────────────────────
//
// A coautoria grava a música JÁ com a letra final e dispara o evento no mesmo
// instante; o job marca `gerando` e grava a task do provedor em segundos. Com
// o Inngest de pé, uma linha `aguardando` intocada por 3 minutos não existe.
// Com ele parado, é tudo que existe.

/** Linha `aguardando` sem ninguém mexer por este tempo: o job nunca começou. */
export const PARADA_MIN = 3;
/** `gerando` sem task do provedor: marcaram pra gerar e o job não disparou. */
export const SEM_TASK_MIN = 5;
/**
 * Task do JOB sem a música pronta por este tempo: o job morreu no polling.
 * O provedor entrega o arquivo final em 57-74s (medido em 30/08) e o job
 * pergunta de 10 em 10 segundos; 8 minutos é folga de sobra.
 */
export const TASK_ORFA_MIN = 8;
/** Task que FALHOU e ninguém disparou outra: o job tem um respiro de até 10 min antes da próxima tentativa. */
export const FALHA_ORFA_MIN = 15;
/** Task que nunca termina: desiste dela. O job desiste aos 6 minutos de polling. */
export const TASK_TIMEOUT_MIN = 12;
/** Enquanto a posse do reserva for mais nova que isto, o job do Inngest não toca na música. */
export const RESERVA_SEGURA_MIN = 45;
/** Gerações que o reserva paga por música antes de desistir e deixar pra repescagem. */
export const MAX_TENTATIVAS = 2;

export type LinhaAndando = {
  status: string;
  updated_at: string;
  task_atual: string | null;
  task_em: string | null;
  reserva_em: string | null;
  reserva_tentativas: number | null;
};

export type Decisao = "nada" | "gerar" | "acompanhar";

const minutos = (desde: string | null, agora: number) =>
  desde ? (agora - Date.parse(desde)) / 60000 : Infinity;

/** Antes de perguntar ao provedor: a linha merece atenção? */
export function oQueFazer(m: LinhaAndando, agora: number): Decisao {
  if (m.status !== "aguardando" && m.status !== "gerando") return "nada";

  // Já é do reserva.
  if (m.reserva_em) {
    if (m.task_atual) return "acompanhar";
    // Assumiu e não chegou a disparar (a função caiu no meio): tenta de novo.
    return minutos(m.reserva_em, agora) >= PARADA_MIN ? "gerar" : "nada";
  }

  // Alguém mexeu há pouco: o job (ou o ajuste, ou o webhook) está vivo nela.
  if (minutos(m.updated_at, agora) < PARADA_MIN) return "nada";

  if (m.status === "aguardando") return m.task_atual ? "acompanhar" : "gerar";

  // `gerando`
  if (!m.task_atual) return minutos(m.updated_at, agora) >= SEM_TASK_MIN ? "gerar" : "nada";
  return minutos(m.task_em, agora) >= TASK_ORFA_MIN ? "acompanhar" : "nada";
}

export type EstadoDaTask = "sucesso" | "falhou" | "andando";
export type DepoisDaConsulta = "finalizar" | "gerar" | "desistir" | "nada";

/**
 * Depois de perguntar ao provedor pela `task_atual`.
 *
 * A task PRONTA é sempre terminada, de quem quer que seja: a gravação já foi
 * paga, e terminar é só baixar e guardar. É o caso de uma queda no MEIO do
 * polling do job.
 */
export function depoisDaConsulta(m: LinhaAndando, estado: EstadoDaTask, agora: number): DepoisDaConsulta {
  if (estado === "sucesso") return "finalizar";
  const idade = minutos(m.task_em, agora);
  const tentativas = m.reserva_tentativas ?? 0;

  if (!m.reserva_em) {
    // A task é do JOB. Falha recente pode estar no respiro dele; andando pode
    // só ser o provedor lento. Só assume quando passou do tempo dele.
    if (estado === "falhou") return idade >= FALHA_ORFA_MIN ? "gerar" : "nada";
    return idade >= TASK_TIMEOUT_MIN * 2 ? "gerar" : "nada";
  }

  // A task é do reserva.
  if (estado === "andando" && idade < TASK_TIMEOUT_MIN) return "nada";
  return tentativas < MAX_TENTATIVAS ? "gerar" : "desistir";
}
