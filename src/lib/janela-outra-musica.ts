// TESTE `outra_musica_24h` (08/10): o cartão "Faça outra pra mais alguém"
// logo depois da compra, visível por 24 horas.
//
// 7,2% dos compradores já compram uma SEGUNDA música, a preço cheio, em até 7
// dias. O pacote "extra" (R$ 28, `creditos.ts`) existe, mas no pós-compra ele é
// uma linha de rodapé. O braço B põe a oferta como cartão no momento em que a
// pessoa acabou de ver a primeira dar certo.
//
// ── O PRAZO É DO CARTÃO, NÃO DO PREÇO ────────────────────────────
//
// O relógio conta a partir do PAGAMENTO da música (`pedidos.paid_at`, lido no
// servidor) e, passadas 24h, o cartão some. O preço NÃO muda: o mesmo pacote
// continua no `/dashboard`, no e-mail e na linha "Quem é a próxima?". Por isso
// a frase diz que o CONVITE fica aqui por mais tanto tempo, e nunca que a
// oferta acaba: prometer desconto que expira, quando ele não expira, é
// alegação falsa, e alegação falsa derruba conta no Google Ads.

/** O id do teste. Constante porque id digitado errado devolve o controle em silêncio. */
export const EXP_OUTRA_MUSICA_24H = "outra_musica_24h";

export const JANELA_OUTRA_MUSICA_MS = 24 * 60 * 60 * 1000;

/**
 * Quanto falta pro cartão sumir, em ms, ou `null` quando ele não deve
 * aparecer (sem data de pagamento, data inválida ou janela vencida).
 *
 * Pagamento "no futuro" (relógio do celular atrasado) conta como recém-pago:
 * o teto é a janela inteira, nunca mais que 24h.
 */
export function msRestantesOutraMusica(
  pagoEm: string | number | Date | null | undefined,
  agora: number,
): number | null {
  if (pagoEm == null || pagoEm === "") return null;
  const t = pagoEm instanceof Date ? pagoEm.getTime() : new Date(pagoEm).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(agora)) return null;
  const restante = Math.min(JANELA_OUTRA_MUSICA_MS, t + JANELA_OUTRA_MUSICA_MS - agora);
  return restante > 0 ? restante : null;
}

/**
 * "23h 5min", "45min", "1min". Arredonda o minuto PRA CIMA: com 30 segundos
 * restando o cartão ainda está na tela, e "0min" seria mentira.
 */
export function textoRestanteOutraMusica(ms: number): string {
  const minutos = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** Horas inteiras desde o pagamento, pro evento. `null` sem data válida. */
export function horasDesdeCompra(
  pagoEm: string | number | Date | null | undefined,
  agora: number,
): number | null {
  if (pagoEm == null || pagoEm === "") return null;
  const t = pagoEm instanceof Date ? pagoEm.getTime() : new Date(pagoEm).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((agora - t) / 3_600_000));
}
