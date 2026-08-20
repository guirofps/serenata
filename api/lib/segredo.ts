import { createHash, timingSafeEqual } from "node:crypto";

// COMPARAÇÃO DE SEGREDO QUE NÃO CONTA O TEMPO.
//
// Os dois webhooks de pagamento comparavam o token com `!==`. O `===` de
// string do JavaScript sai no primeiro byte diferente, e o tempo dessa saída é
// medível: quem tem paciência descobre o segredo byte a byte, e com o segredo
// na mão libera venda sem ter pago.
//
// É a mesma disciplina que `admin-auth.server.ts` já aplica na senha do
// painel. O webhook tinha ficado de fora — e é o webhook que decide quem
// recebe produto.
//
// O HASH ANTES DO `timingSafeEqual` resolve dois problemas de uma vez:
// `timingSafeEqual` LANÇA quando os buffers têm comprimento diferente (e
// desviar antes disso já vazaria o comprimento do segredo), e o SHA-256 dá
// sempre 32 bytes, venha o que vier do outro lado.

export function segredoConfere(recebido: unknown, esperado: string): boolean {
  if (typeof recebido !== "string" || !recebido || !esperado) return false;
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}
