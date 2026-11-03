// QUAL CONTA DO STRIPE COBRA ESTE QUIZ? (Ballad, teste `stripe_conta`, 03/11)
//
// A conta de hoje é brasileira (liquida em real): o cartão americano, mexicano
// ou espanhol vira compra internacional pro banco de quem paga, e ~56% das
// tentativas eram recusadas (`do_not_honor`, Radar). A conta nova é da Ltd do
// Ralph no Reino Unido (liquida em euro). O teste mede se o banco recusa menos
// quando quem cobra é uma empresa inglesa.
//
//   A = a conta de sempre (`STRIPE_SECRET_KEY`)
//   B = a conta do Reino Unido (`STRIPE_UK_SECRET_KEY`)
//
// Braço pelo 9º caractere do fim do id do quiz (do 5º ao 8º já são de outros
// testes): recalculável na leitura, sem gravar nada, e o mesmo quiz
// cai sempre na mesma conta (reabrir a folha não troca de caixa).
//
// Só a MÚSICA entra no teste. Upsell (vídeo, extra) segue na conta de sempre.
//
// Desligar sem deploy: `STRIPE_UK_OFF=1` na Vercel (todo mundo volta pro A).
// Sem a chave da conta nova, também A. O webhook e a leitura de sessão
// continuam aceitando as duas contas, então desligar não perde pagamento.

export type ContaStripe = "br" | "uk";

/**
 * A VERSÃO DA API, FIXA NAS DUAS CONTAS. A conta de sempre está em 2020-03-02
 * (todo o código foi escrito e testado nela); a do Reino Unido nasceu na
 * versão do dia (2026-10-28), em que `ui_mode: "embedded"` virou
 * `"embedded_page"` e a criação da sessão era recusada. Com o cabeçalho, as
 * duas respondem igual. Conferido em 03/11 criando e expirando uma sessão em
 * cada moeda (usd, mxn, eur, cop, clp, pen) na conta nova.
 */
export const VERSAO_API_STRIPE = "2020-03-02";

/** O braço, pelo 9º caractere do fim do id do quiz. */
export function bracoStripeConta(quizId: string): "A" | "B" {
  const limpo = quizId.replace(/-/g, "");
  const c = limpo[limpo.length - 9] ?? "0";
  return parseInt(c, 16) % 2 === 0 ? "A" : "B";
}

/** A conta que cobra a música deste quiz, com o interruptor e a chave conferidos. */
export function contaStripeDoQuiz(
  quizId: string,
  env: Record<string, string | undefined> = process.env,
): ContaStripe {
  if (env.STRIPE_UK_OFF === "1" || !env.STRIPE_UK_SECRET_KEY || !env.STRIPE_UK_PUBLISHABLE_KEY) return "br";
  return bracoStripeConta(quizId) === "B" ? "uk" : "br";
}

/** As contas com chave neste deploy, a de sempre primeiro. */
export function contasStripeLigadas(env: Record<string, string | undefined> = process.env): ContaStripe[] {
  const out: ContaStripe[] = [];
  if (env.STRIPE_SECRET_KEY) out.push("br");
  if (env.STRIPE_UK_SECRET_KEY) out.push("uk");
  return out;
}

export function chaveSecretaDa(conta: ContaStripe, env: Record<string, string | undefined> = process.env): string | undefined {
  return (conta === "uk" ? env.STRIPE_UK_SECRET_KEY : env.STRIPE_SECRET_KEY)?.trim() || undefined;
}
