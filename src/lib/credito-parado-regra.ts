// QUANTAS VEZES SE LEMBRA UM CRÉDITO PARADO (29/10).
//
// O `creditoParado` lembrava uma vez por semana, PRA SEMPRE: o saldo é lido do
// razão, e quem decidiu não usar o crédito continuava com saldo positivo e
// levava o mesmo "você esqueceu" toda semana, do remetente TRANSACIONAL (o que
// carrega a entrega de quem pagou). Achado na auditoria de 29/10.
//
// Agora:
//   - no máximo TETO_AVISOS lembretes por endereço numa janela de
//     JANELA_AVISOS_DIAS (contados pelos `credito_parado_avisado` gravados);
//   - crédito comprado há mais de MAX_DIAS_DA_COMPRA não é lembrado: quem não
//     voltou em dois meses não vai voltar por um e-mail, e insistir é o que
//     faz marcar como spam.

export const TETO_AVISOS = 3;
export const JANELA_AVISOS_DIAS = 120;
export const MAX_DIAS_DA_COMPRA = 60;

/**
 * Este crédito ainda pode ser lembrado?
 *
 * `compradoEm` é a compra MAIS RECENTE da pessoa (quem comprou de novo
 * recomeça a contar). `avisosAnteriores` é `null` quando a contagem não pôde
 * ser lida: aí NÃO lembra (falha fechada, como toda trava de e-mail desde 04/10).
 */
export function podeLembrarCredito(args: {
  compradoEm: string | null | undefined;
  agora: number;
  avisosAnteriores: number | null;
}): boolean {
  const { compradoEm, agora, avisosAnteriores } = args;
  if (!compradoEm) return false;
  const quando = Date.parse(compradoEm);
  if (!Number.isFinite(quando)) return false;
  if (agora - quando > MAX_DIAS_DA_COMPRA * 86400000) return false;
  if (avisosAnteriores === null) return false;
  return avisosAnteriores < TETO_AVISOS;
}
