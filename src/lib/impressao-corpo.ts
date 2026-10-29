// A IMPRESSÃO DO CORPO de uma chamada ao Stripe, pra entrar na chave de
// idempotência. O Stripe recusa a mesma chave com corpo diferente (400 por
// 24h), e o corpo muda sem a gente mexer no código (título, e-mail, idioma).
// Corpo igual = mesma chave = mesma sessão. Usada pelo caixa da música
// (`stripe-checkout.ts`, 16/10) e pelo do upsell (`stripe-upsell.ts`, 29/10).

/** SHA-256 curto do corpo, pela Web Crypto (sem `node:crypto` no bundle do cliente). */
export async function impressaoDoCorpo(corpo: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(corpo));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}
