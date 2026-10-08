// O BRAÇO B DA RECUPERAÇÃO: oferta com prazo, em dois toques (teste
// `recuperacao_prazo`, 08/10). A decisão de quando cada toque sai, sem banco.
//
// SEM IMPORTS: lido pelo Inngest (ESM puro na Vercel).
//
// ── O QUE O B TROCA ──────────────────────────────────────────────
//
// O A é a escada de hoje (degrau 2 a preço cheio no dia seguinte, degrau 3 a
// R$ 29 só pra quem abriu algum e-mail). Em produção, ~3.400 envios de escada
// e indicação deram 5 vendas em 14 dias.
//
// O B troca os degraus por:
//   toque 1 · D+1  "Sua música está guardada. R$ 28 até amanhã"
//                  com o SRN27 COM PRAZO (`codigoComPrazo` em `cupom.ts`): o
//                  servidor deixa de dar o desconto às 23h59 de amanhã.
//   toque 2 · D+3  "último lembrete", 48h depois do 1. A essa hora o prazo
//                  JÁ PASSOU (o 1 vale no máximo até o fim do dia seguinte,
//                  menos de 48h), então ele é a preço normal e diz isso. Dar
//                  o R$ 28 de novo aqui transformaria o prazo do toque 1 em
//                  mentira, que é exatamente o que este teste quer evitar.
//
// Os toques são gravados como `email_sequencia_enviado` com `numero` 2 e 3 e
// `variante: "prazo"`, então a régua (`posicoesNaRegua`) entende sozinha que
// depois do toque 2 ela acabou (o português para no 3).
//
// ── QUEM ENTRA NO B ──────────────────────────────────────────────
//
// Quem ainda NÃO recebeu nenhum degrau da escada antiga. Quem já estava no
// meio dela no dia em que o teste entrou termina a escada do jeito que
// começou: trocar a conversa no meio mistura os dois braços na mesma pessoa.

/** Horas desde o e-mail anterior (qualquer um) até o toque 1. */
export const ESPERA_TOQUE_1_H = 24;
/** Horas desde o toque 1 até o toque 2. */
export const ESPERA_TOQUE_2_H = 48;
/** E nunca menos que isto desde o último e-mail de qualquer tipo. */
export const ESPERA_MINIMA_H = 24;

export type EstadoPrazo = {
  /** O maior degrau já alcançado (`posicoesNaRegua`). */
  numero: number;
  /** Último envio de qualquer tipo, em ms. */
  quando: number;
  /** Horário de cada toque do B já enviado, por toque. */
  toques: Partial<Record<1 | 2, number>>;
  /** Já recebeu algum degrau da escada ANTIGA (sem `variante: "prazo"`)? */
  temEscadaAntiga: boolean;
};

export type DecisaoPrazo =
  /** Esta pessoa segue a escada de sempre (já estava nela). */
  | { tipo: "escada" }
  /** Nada a mandar agora (cedo demais, ou os dois toques já saíram). */
  | { tipo: "esperar" }
  | { tipo: "toque"; toque: 1 | 2; numero: 2 | 3 };

const H = 3600000;

export function proximoToquePrazo(e: EstadoPrazo, agora: number): DecisaoPrazo {
  if (e.temEscadaAntiga) return { tipo: "escada" };
  if (e.toques[2] !== undefined) return { tipo: "esperar" };
  const desdeUltimo = agora - e.quando;

  if (e.toques[1] === undefined) {
    // A régua do português acaba no 3; quem chegou lá por outro caminho não
    // recomeça aqui.
    if (e.numero >= 3) return { tipo: "esperar" };
    if (desdeUltimo < ESPERA_TOQUE_1_H * H) return { tipo: "esperar" };
    return { tipo: "toque", toque: 1, numero: 2 };
  }

  if (agora - e.toques[1] < ESPERA_TOQUE_2_H * H) return { tipo: "esperar" };
  if (desdeUltimo < ESPERA_MINIMA_H * H) return { tipo: "esperar" };
  return { tipo: "toque", toque: 2, numero: 3 };
}

/**
 * Os toques do B e a presença da escada antiga, por quiz, a partir dos mesmos
 * eventos de envio que a régua já lê.
 */
export function estadoDosToques(
  eventos: Array<{ event_name: string; event_data: Record<string, unknown> | null; created_at: string }>,
): Map<string, { toques: Partial<Record<1 | 2, number>>; temEscadaAntiga: boolean }> {
  const out = new Map<string, { toques: Partial<Record<1 | 2, number>>; temEscadaAntiga: boolean }>();
  for (const ev of eventos) {
    if (ev.event_name !== "email_sequencia_enviado") continue;
    const id = String(ev.event_data?.quiz_response_id ?? "");
    if (!id) continue;
    const atual = out.get(id) ?? { toques: {}, temEscadaAntiga: false };
    if (ev.event_data?.variante === "prazo") {
      const t = Number(ev.event_data?.toque);
      const quando = Date.parse(ev.created_at);
      if ((t === 1 || t === 2) && Number.isFinite(quando)) {
        atual.toques[t] = Math.max(quando, atual.toques[t] ?? quando);
      }
    } else {
      atual.temEscadaAntiga = true;
    }
    out.set(id, atual);
  }
  return out;
}

/** A data `YYYY-MM-DD` em Brasília (UTC-3, sem horário de verão), somando dias. */
export function dataBr(agora: number, somarDias = 0): string {
  return new Date(agora - 3 * H + somarDias * 86400000).toISOString().slice(0, 10);
}

/** O último dia do R$ 28 de quem recebe o toque 1 agora: AMANHÃ, até 23h59. */
export function prazoDoToque1(agora: number): string {
  return dataBr(agora, 1);
}

/** `2026-10-10` → `10/10`, como o e-mail escreve. */
export function diaMes(data: string): string {
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}
