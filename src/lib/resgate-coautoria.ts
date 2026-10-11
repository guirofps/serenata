// O RESGATE DE QUEM LARGOU A COAUTORIA NO MEIO (teste `resgate_coautoria`, 11/10).
//
// ~9% dos leads (≈140/dia, 555 de 04 a 07/10) deixam o e-mail, chegam ao fim
// do quiz (passo 9, `contato`) e saem escolhendo o refrão ou antes de
// finalizar a letra. A música só nasce no `finalizarLetra`, e sem letra o
// "letra pronta" não sai: dos 555, 25 receberam algum e-mail. São leads que
// contaram a história inteira e somem sem nenhum toque.
//
// A = como hoje, nada. C = a gente escreve a letra (as mesmas duas etapas da
// tela, com o 1º refrão), grava a música e deixa o `mandarLetra` mandar o
// "letra pronta" de sempre. Custo ~R$ 0,40 por lead do C (letra + Suno). O
// "B" (só um e-mail com o link de volta) ficou de fora: o `/retomar` só abre
// sessão com música, e devolver a pessoa ao meio da coautoria pedia rota nova.
//
// O braço sai do 5º caractere do fim do id do quiz: os testes de e-mail usam
// o 2º, 3º e 4º (`recuperacao_prazo`, `pedido_reacao`, `limite_frequencia`),
// então os sorteios são independentes. Recalculável na leitura.

export type BracoResgate = "A" | "C";

/** Só depois de 2h sem nenhum evento da sessão: quem ainda está escolhendo o refrão não é resgatado. */
export const INATIVO_MIN = 120;
/** Quiz mais velho que isso não entra: "letra pronta" um dia depois já é cobrança, não lembrança. */
export const JANELA_H = 24;
/** O passo `contato` (e-mail) na escala do funil: daqui pra frente o quiz está todo respondido. */
export const PASSO_CONTATO = 9;
/** Teto por rodada (de 15 em 15 min). A demanda do C é ~70/dia. */
export const MAX_POR_RODADA = 10;

export function bracoResgate(quizId: string): BracoResgate {
  const limpo = quizId.replace(/-/g, "");
  const c = limpo[limpo.length - 5] ?? "0";
  return parseInt(c, 16) % 2 === 0 ? "A" : "C";
}

export type CandidatoResgate = {
  furthestStep: number | null;
  email: string | null;
  locale: string | null;
  criadoEm: number;
  ultimoEventoEm: number | null;
  temMusica: boolean;
  jaResgatado: boolean;
};

/** Entra no teste? Não diz o braço: A e C passam pela MESMA porta, senão a comparação mente. */
export function entraNoResgate(c: CandidatoResgate, agora: number): boolean {
  if (c.temMusica || c.jaResgatado) return false;
  if (!c.email) return false;
  if ((c.furthestStep ?? 0) < PASSO_CONTATO) return false;
  if ((c.locale ?? "pt") !== "pt") return false;
  if (agora - c.criadoEm > JANELA_H * 3600000) return false;
  const ultimo = c.ultimoEventoEm ?? c.criadoEm;
  return agora - ultimo >= INATIVO_MIN * 60000;
}
