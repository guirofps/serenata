// TESTE `ouvir_de_novo` (Serenata, funil pt): depois que a prévia corta, um
// "Ouvir de novo" que volta a prévia pro começo.
//
// ── POR QUE ──────────────────────────────────────────────────────
//
// No corte o botão de play fica desabilitado (`travou`) e a única coisa que a
// tela oferece é comprar. Quem quer ouvir o próprio nome cantado de novo, ou
// mostrar pra alguém do lado, não tem como: recarrega a página ou desiste. A
// prévia é o que vende (a letra lida em silêncio não segura a emoção), e
// ouvir duas vezes é o comportamento de quem gostou.
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = como é hoje: no corte, o player trava e não volta.
//   B = no corte aparece "Ouvir de novo": a prévia volta pro 0 e toca, e o
//       corte vale de novo no mesmo ponto (a trava olha o `currentTime`, não
//       quantas vezes tocou). O popup continua aparecendo uma vez só.
//
// ── COMO LER ─────────────────────────────────────────────────────
//
// RECEITA POR LEAD por braço (`attribution.exp.ouvir_de_novo`). O uso do
// botão (`previa_ouvir_de_novo`, com a vez) é diagnóstico, não resultado: um
// botão muito usado que derruba a compra perdeu.

export const EXP_OUVIR_DE_NOVO = "ouvir_de_novo";

/**
 * O braço B vale aqui? Só no funil pt (a Serenata), nunca no modo `completo`
 * (as demos tocam inteiras e não têm corte). Pela inicial, pela mesma razão
 * de `folha-pix.ts`: renomear B -> B2 não pode desligar o braço em silêncio.
 */
export function ouvirDeNovoLigado(
  variante: string | null | undefined,
  locale: string,
  completo: boolean,
): boolean {
  if (completo || locale !== "pt") return false;
  return String(variante ?? "").trim().toUpperCase().startsWith("B");
}
