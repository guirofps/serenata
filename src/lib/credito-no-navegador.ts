// O CRACHÁ DE QUEM COMPROU CRÉDITO SEM LOGIN.
//
// ── O PROBLEMA ───────────────────────────────────────────────────
//
// O resgate do crédito acontece no FIM do quiz seguinte, numa sessão nova, em
// outra tela, às vezes noutro dia. Nesse ponto não existe nada ligando aquela
// pessoa à compra que ela fez: o quiz é anônimo por natureza.
//
// Até 02/09 quem amarrava era o login. Só que 84% dos compradores nunca
// clicam no magic link, e o pacote de R$ 28 acabou de ser posto na
// `/obrigado` e no e-mail de entrega — justamente onde não há login. Sem isto,
// a pessoa pagava R$ 28 e a tela de oferta pedia os R$ 38 de novo.
//
// ── POR QUE GUARDAR O TOKEN E NÃO O E-MAIL ───────────────────────
//
// O `token_edicao` é PROVA de posse: o servidor resolve dono por ele
// (`dono-por-token.ts`) e o e-mail sai de `pedidos`, que só existe depois de
// dinheiro confirmado. Guardar o e-mail seria guardar uma AFIRMAÇÃO, e
// qualquer um digita o e-mail de qualquer um no DevTools pra gastar crédito
// alheio.
//
// ── O QUE ACONTECE SE SUMIR ──────────────────────────────────────
//
// Navegador limpo, aparelho trocado, aba anônima: o crachá some e a tela volta
// a cobrar. Não é perda de dinheiro, é perda de conveniência — o crédito
// continua no razão, ligado ao e-mail, e o login (ou o suporte) resgata. Por
// isso a leitura falha em silêncio em vez de quebrar a tela.

const CHAVE = "serenata_credito_token";

/** Guarda a prova de posse depois de a pessoa pagar um pacote sem estar logada. */
export function guardarCreditoNoNavegador(tokenEdicao: string) {
  try {
    if (tokenEdicao) localStorage.setItem(CHAVE, tokenEdicao);
  } catch {
    // Modo privado, cota cheia, storage bloqueado: sem crachá, mas sem tela
    // quebrada. O login continua sendo o caminho.
  }
}

/** O token guardado, se houver. */
export function creditoNoNavegador(): string | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v && v.length >= 16 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Apaga o crachá depois que o crédito foi gasto.
 *
 * Não é limpeza cosmética: um crachá que sobra faz a próxima música consultar
 * saldo de novo e mostrar "você tem crédito" pra quem não tem mais, que é a
 * promessa quebrada mais barata de produzir e mais cara de explicar.
 */
export function esquecerCreditoNoNavegador() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}
