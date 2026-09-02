// DE ONDE CADA E-MAIL SAI.
//
// Dois remetentes, e a divisão não é estética: é contenção de estrago.
//
// A linha divisória mudou em 02/09, e o critério novo é PEDIU ou NÃO PEDIU.
// Antes era "pagou ou não pagou", e essa régua mandava pro subdomínio um
// e-mail que a pessoa tinha pedido explicitamente.
//
// ── O QUE MEDIU A MUDANÇA ────────────────────────────────────────
//
// Em 14 dias, 16 mil e-mails entregues:
//
//   subdomínio de recuperação .... 7.530 entregues, 16,7% de abertura
//   domínio raiz ................. 1.878 entregues, 34,6% de abertura
//   reclamações de spam .......... ZERO, nos dois, em todos os templates
//
// O webhook do Resend foi conferido e escuta `email.complained`, então o zero
// é número, não silêncio de instrumento. A premissa que justificou a separação
// ("esse tipo de e-mail junta reclamação por natureza") não se confirmou em
// nenhum template.
//
// O caso mais caro era o `letra_pronta`: 3.014 entregues em 14 dias, o maior
// volume da casa, abrindo 14,2%. Ele entrega a letra GRÁTIS que a pessoa pediu
// digitando o próprio e-mail. Chamar isso de conteúdo não solicitado era o
// erro de classificação, e ele custava metade da abertura do e-mail que
// sustenta toda a recuperação.
//
// ── ONDE CADA UM ESTÁ AGORA ──────────────────────────────────────
//
// RAIZ, o que a pessoa pediu ou comprou: a entrega da música, o magic link, o
// lembrete de montar, o quadro pago e não montado, e a LETRA. Se a reputação
// dele cair, o comprador para de receber o que comprou: é o pior desfecho
// possível, e por isso nada de marketing entra aqui.
//
// SUBDOMÍNIO, o que ninguém pediu: a escada de descontos, o "quase comprou",
// a oferta do quadro e o "volte a criar". São ofertas, e oferta é o que junta
// reclamação quando junta.
//
// ── O QUE ISSO CUSTA, E É ACEITO ─────────────────────────────────
//
// O `letra_pronta` é o primeiro e-mail que vai pra um endereço recém-digitado,
// então é ele que absorve os erros de digitação: 40 bounces permanentes em 14
// dias, uns 3 por dia, que agora batem no domínio do comprador. Em ~350
// envios/dia isso é 0,8%, abaixo da linha de 2% onde começa a machucar. É o
// preço de dobrar a abertura do e-mail mais importante do funil.
//
// A separação é feita em DNS (DKIM e SPF próprios em `envio.serenatagift.com`),
// então os provedores tratam os dois como remetentes distintos de verdade.

/**
 * O que a pessoa PEDIU ou COMPROU: entrega da música, magic link, lembrete de
 * montar, quadro pago, e a letra grátis do quiz.
 */
export const REMETENTE_TRANSACIONAL = "Serenata <contato@serenatagift.com>";

/**
 * O que ninguém pediu: a escada de descontos, o "quase comprou", a oferta do
 * quadro e o "volte a criar". Só oferta entra aqui.
 */
export const REMETENTE_RECUPERACAO = "Serenata <ola@envio.serenatagift.com>";

/**
 * Pra onde a resposta vai.
 *
 * O subdomínio não recebe e-mail — não tem caixa, só manda. Sem este
 * `reply_to`, quem responde a recuperação escreve pro vazio, e a resposta de
 * um cliente é a coisa mais valiosa que um disparo produz.
 */
export const RESPONDER_PARA = "contato@serenatagift.com";
