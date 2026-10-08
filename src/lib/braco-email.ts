// O BRAÇO DE UM TESTE DE E-MAIL, recalculável pelo id do quiz.
//
// SEM IMPORTS: é lido pelos jobs do Inngest (ESM puro na Vercel, sem alias).
//
// ── POR QUE NÃO É SEMPRE O ÚLTIMO CARACTERE ──────────────────────
//
// Os testes de e-mail dividem pela PARIDADE de um caractere hexadecimal do id
// do quiz: a mesma pessoa cai sempre no mesmo lado, e a leitura recalcula o
// braço no SQL sem precisar de coluna nova.
//
// O teste de assunto da letra (28/09) e o do e-mail de entrega (30/09) usam o
// ÚLTIMO caractere. Se os testes de 08/10 usassem o mesmo, todo B de um seria
// B dos outros: quem recebe a oferta com prazo (recuperacao_prazo) seria
// sempre quem tem o teto de frequência (limite_frequencia), e não haveria como
// saber qual dos dois mexeu na venda. Cada teste usa um caractere diferente
// do FIM do uuid (os 12 últimos são todos hexadecimais e aleatórios no v4),
// e assim os braços se cruzam meio a meio, independentes entre si.
//
// Leitura no SQL, pra posição `k` contada do fim (1 = último):
//   position(substr(id::text, 37 - k, 1) in '13579bdf') > 0   -- braço B
//
// ── QUAL TESTE USA QUAL CARACTERE ────────────────────────────────
//
//   1 (último)      letra_pronta (assunto, 28/09) e entrega (30/09)
//   2 (penúltimo)   recuperacao_prazo   (08/10)
//   3               pedido_reacao       (08/10)
//   4               limite_frequencia   (08/10)
//
// Teste novo pega uma posição livre (5 a 12) e entra nesta tabela.

export type BracoEmail = "a" | "b";

export const POSICAO_DO_TESTE = {
  recuperacao_prazo: 2,
  pedido_reacao: 3,
  limite_frequencia: 4,
} as const;

export type TesteEmail = keyof typeof POSICAO_DO_TESTE;

/**
 * Paridade do caractere na posição `posicao` contada do fim (1 = último).
 * Ímpar é B. Id vazio, curto ou com caractere que não é hexadecimal é A: na
 * dúvida, como sempre foi.
 */
export function bracoPorId(id: string | null | undefined, posicao: number): BracoEmail {
  const s = String(id ?? "").trim().toLowerCase();
  if (!Number.isInteger(posicao) || posicao < 1 || s.length < posicao) return "a";
  const c = s.charAt(s.length - posicao);
  if (!/^[0-9a-f]$/.test(c)) return "a";
  return parseInt(c, 16) % 2 === 1 ? "b" : "a";
}

/**
 * O braço da pessoa num teste de e-mail de 08/10. Os três são só do funil
 * PORTUGUÊS: qualquer outro idioma (e quiz sem idioma conhecido, se o
 * chamador disser) fica no A, que é o de sempre.
 */
export function bracoDoTeste(
  teste: TesteEmail,
  quizId: string | null | undefined,
  locale: string | null | undefined = "pt",
): BracoEmail {
  if ((locale ?? "pt") !== "pt") return "a";
  return bracoPorId(quizId, POSICAO_DO_TESTE[teste]);
}
