/**
 * Tira espaço das pontas e ponto(s) no FIM do e-mail ("a@hotmail.com." vira
 * "a@hotmail.com"). O Asaas recusa o endereço com ponto final como inválido,
 * e em 26/09 isso impediu uma pessoa de gerar o PIX três vezes seguidas.
 * Também junta pontos seguidos no domínio ("@gmail..com"), que nunca são
 * válidos: em 27/09 um comprador pagou com esse endereço e o e-mail de
 * entrega não tinha como chegar. Fora isso não "conserta" nada: domínio
 * errado continua errado, e antes do @ não se mexe.
 */
export function semPontoNoFim(email: string): string {
  const limpo = email.trim().replace(/\.+$/, "");
  const arroba = limpo.lastIndexOf("@");
  if (arroba < 0) return limpo;
  return limpo.slice(0, arroba + 1) + limpo.slice(arroba + 1).replace(/\.{2,}/g, ".");
}
