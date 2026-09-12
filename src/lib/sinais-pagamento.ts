// O TRILHO DE PAGAMENTO PAROU DE RECEBER?
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// 11/09/2026, 16:44. A chave PIX da Woovi parou de resolver no DICT. A API
// deles respondia normal, criava cobrança e devolvia QR válido; o banco do
// pagador é que respondia "A conta informada não foi encontrada". Nada falhou
// do nosso lado, nada falhou do lado deles, e nenhum alarme tocou.
//
// Foram TRÊS HORAS até alguém notar, e quem notou foi o dono olhando o painel
// e estranhando. Umas 15 vendas.
//
// ── O SINAL É O RELÓGIO, NÃO A FILA ──────────────────────────────
//
// Mesma lição do `orquestrador-mudo` em `sinais-geracao.ts`. Todo sinal que
// depende de "algo falhar" é cego aqui, porque NADA falha: as cobranças
// nascem certinhas e ficam esperando um pagamento que não vem.
//
// O que morre na hora exata é o relógio: o tempo desde o último pagamento,
// HAVENDO cobrança nova sendo gerada. Medido no dia da queda, o intervalo
// mediano entre pagamentos era ~10 minutos e a mediana pra pagar depois de
// gerar era 1,4 minuto.
//
// ── E POR QUE ELE DORME DE MADRUGADA ─────────────────────────────
//
// Às 4 da manhã, 40 minutos sem pagamento é só não ter gente no site. Sem a
// condição de `pixGerados`, este alarme tocaria toda madrugada e viraria
// e-mail que ninguém lê — que é o jeito mais eficiente de desligar um alerta
// sem desligá-lo.

export type DiagnosticoPagamento = {
  /** Minutos desde o último pagamento confirmado. `null` = nunca houve. */
  minutosSemPagamento: number | null;
  /** Cobranças criadas dentro da janela de silêncio. É o "tem gente lá". */
  pixGeradosNaJanela: number;
  /** Quantas dessas já passaram do tempo normal de pagar, e não pagaram. */
  maduras: number;
};

/**
 * 40 minutos: quatro vezes o intervalo mediano entre pagamentos num dia
 * normal. Com isso, a queda de 11/09 teria acendido às 17:25 em vez das
 * 19:30.
 *
 * Mais curto vira ruído em hora fraca; mais longo devolve o problema que
 * este arquivo existe pra resolver.
 */
export const MINUTOS_MUDO = 40;

/**
 * Cinco cobranças na janela: é o que separa "o trilho quebrou" de "não tem
 * ninguém no site". Na queda real foram 6 entre 16:44 e 17:30.
 */
export const PIX_MINIMO = 5;

export function trilhoMudo(d: DiagnosticoPagamento): { avisar: boolean; motivo: string | null } {
  const { minutosSemPagamento, pixGeradosNaJanela, maduras } = d;

  // Sem nenhum pagamento na história é conta nova ou banco vazio, não queda.
  if (minutosSemPagamento == null) return { avisar: false, motivo: null };

  // A ORDEM IMPORTA: a condição de tráfego vem ANTES do relógio. Sem gente
  // gerando PIX, silêncio não é sintoma de nada.
  if (pixGeradosNaJanela < PIX_MINIMO) return { avisar: false, motivo: null };

  if (minutosSemPagamento < MINUTOS_MUDO) return { avisar: false, motivo: null };

  return {
    avisar: true,
    motivo:
      `${minutosSemPagamento} min sem nenhum pagamento, com ${pixGeradosNaJanela} PIX gerados nesse período ` +
      `(${maduras} deles já passaram do tempo normal de pagar). ` +
      `O trilho de pagamento pode ter parado de liquidar.`,
  };
}
