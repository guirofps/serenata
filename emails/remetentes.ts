// DE ONDE CADA E-MAIL SAI.
//
// Dois remetentes, e a divisão não é estética: é contenção de estrago.
//
// O domínio raiz carrega o que a pessoa PAGOU pra receber — a entrega da
// música, o link de acesso, o lembrete de montar o presente. Se a reputação
// dele cair, o comprador para de receber o que comprou, e isso é o pior
// desfecho possível.
//
// O subdomínio carrega o que a pessoa NÃO pediu — a recuperação de quem fez o
// quiz e não comprou. Esse tipo de e-mail junta reclamação de spam por
// natureza, por melhor que seja escrito. No subdomínio, a reputação que ele
// queima é a dele: o transacional continua limpo.
//
// A separação é feita em DNS (DKIM e SPF próprios em `envio.serenatagift.com`),
// então os provedores tratam os dois como remetentes distintos de verdade.

/** Transacional: entrega, magic link, lembrete de montar, desculpa. */
export const REMETENTE_TRANSACIONAL = "Serenata <contato@serenatagift.com>";

/** Recuperação: a letra por e-mail e a sequência de quem não comprou. */
export const REMETENTE_RECUPERACAO = "Serenata <ola@envio.serenatagift.com>";

/**
 * Pra onde a resposta vai.
 *
 * O subdomínio não recebe e-mail — não tem caixa, só manda. Sem este
 * `reply_to`, quem responde a recuperação escreve pro vazio, e a resposta de
 * um cliente é a coisa mais valiosa que um disparo produz.
 */
export const RESPONDER_PARA = "contato@serenatagift.com";
