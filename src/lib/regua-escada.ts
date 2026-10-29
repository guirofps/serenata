// ONDE CADA PESSOA ESTÁ NA RÉGUA DE RECUPERAÇÃO, e desde quando.
//
// Puro, pra ter teste: o `sequenciaRecuperacao` lê os eventos de envio e
// passa pra cá.
//
// ── O RELÓGIO É O ÚLTIMO E-MAIL, QUALQUER QUE SEJA (08/10) ───────
//
// A espera do próximo degrau é contada "a partir do e-mail ANTERIOR de cada
// pessoa" (cabeçalho do `sequenciaRecuperacao`): dois e-mails no mesmo dia é o
// que faz alguém marcar spam gostando do produto.
//
// O código guardava o horário só quando o DEGRAU subia. No empate (o
// `pix_nao_pago` e o `quase_comprou` valem 2, e o degrau 2 da escada também)
// ficava o horário MAIS ANTIGO, e um envio de degrau menor depois de um maior
// não contava. Visto na auditoria de 08/10: o `pixNaoPago` manda aos 10 min
// e de novo ~20h depois; o degrau 3 da escada (24h de espera) saía 24h depois
// do PRIMEIRO lembrete, ~4h depois do segundo, porque o relógio ficava no
// mais antigo.
//
// Agora o degrau é o MAIOR já alcançado e o relógio é o envio MAIS RECENTE.

export type EventoDeEnvio = {
  event_name: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
};

export type PosicaoNaRegua = { quando: number; numero: number };

/**
 * O degrau que um envio representa. Sai do NOME do evento, não de adivinhação
 * sobre o formato do `event_data`: a escada carimba `numero`, a letra é o 1, e
 * os dois disparos dirigidos valem 2, o degrau que eles substituem.
 */
export function degrauDoEvento(e: EventoDeEnvio): number {
  if (e.event_data?.numero !== undefined) return Number(e.event_data.numero);
  if (e.event_name === "quase_comprou_enviado" || e.event_name === "pix_nao_pago_enviado") return 2;
  if (DIRIGIDOS_COM_BRACO.includes(e.event_name)) return 2;
  return 1;
}

/**
 * OS DISPAROS DIRIGIDOS DA BALLAD TAMBÉM SÃO DEGRAU (29/10).
 *
 * `recusa_rapida` (cartão recusado no Stripe) e `oxxo_pendente` (ficha do
 * OXXO não paga) são oferta pra uma pessoa num momento, como o
 * `quase_comprou`. Fora desta conta, a escada mandava o degrau 2 genérico
 * por cima deles no mesmo dia. MAS a trava dos dois é gravada nos DOIS braços
 * do teste (no A ela é só o registro pra leitura, ninguém recebe): só conta
 * a linha com `braco = "B"`, a que virou e-mail. Contar o A tiraria da
 * escada quem não recebeu nada e quebraria a comparação dos braços.
 */
export const DIRIGIDOS_COM_BRACO = ["recusa_rapida", "oxxo_pendente"];

/** Este evento é um envio de verdade? Trava do braço A dos dirigidos não é. */
export function contaNaRegua(e: EventoDeEnvio): boolean {
  if (!DIRIGIDOS_COM_BRACO.includes(e.event_name)) return true;
  return e.event_data?.braco === "B";
}

/** Por quiz: o maior degrau alcançado e o horário do envio mais recente. */
export function posicoesNaRegua(eventos: EventoDeEnvio[]): Map<string, PosicaoNaRegua> {
  const ultimo = new Map<string, PosicaoNaRegua>();
  for (const e of eventos) {
    if (!contaNaRegua(e)) continue;
    const id = String(e.event_data?.quiz_response_id ?? "");
    if (!id) continue;
    const numero = degrauDoEvento(e);
    const quando = new Date(e.created_at).getTime();
    if (!Number.isFinite(numero) || !Number.isFinite(quando)) continue;
    const atual = ultimo.get(id);
    ultimo.set(id, {
      numero: Math.max(numero, atual?.numero ?? numero),
      quando: Math.max(quando, atual?.quando ?? quando),
    });
  }
  return ultimo;
}
