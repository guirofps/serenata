/**
 * Tira espaço das pontas e ponto(s) no FIM do e-mail ("a@hotmail.com." vira
 * "a@hotmail.com"). O Asaas recusa o endereço com ponto final como inválido,
 * e em 26/09 isso impediu uma pessoa de gerar o PIX três vezes seguidas.
 * Não "conserta" mais nada: domínio errado continua errado.
 */
export function semPontoNoFim(email: string): string {
  return email.trim().replace(/\.+$/, "");
}
