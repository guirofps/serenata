// CARTÃO RECUSADO NA BALLAD (18/10): dois testes, uma causa.
//
// ── O QUE ESTÁ ACONTECENDO ───────────────────────────────────────
//
// A conta do Stripe da Ballad é BRASILEIRA e cobra cartão americano em dólar:
// pro banco de lá, cada compra é transação internacional num comerciante
// desconhecido. De 11 a 17/10: 73 recusas em 130 tentativas (56%), 72 em
// cartão dos EUA, `do_not_honor` a mais comum, débito o mais barrado (45
// recusadas × 21 pagas). Das 31 pessoas com recusa, 15 pagaram tentando de
// novo e 16 desistiram. O caso típico (Gloria, Wells Fargo): 3 recusas, 1
// bloqueio do Stripe, e pagou 4 minutos depois, quando aprovou no banco.
//
// Quem desiste não sabe que basta aprovar no app do banco. Os dois testes
// dizem isso a ela, um na hora e outro por e-mail.
//
// ── `aviso_recusa` (linha em `experimentos`, banco da Ballad) ────
//
//   A = a folha do Stripe como é hoje.
//   B = embaixo do pagamento, um aviso curto: se recusar, aprove no app do
//       banco e tente de novo, ou use Apple Pay, Google Pay ou outro cartão.
//
// O Embedded Checkout não conta pra nós quando recusa (o erro mora dentro do
// iframe), então o aviso fica sempre à vista no B. Ler por PAGO ÷ CHECKOUT
// ABERTO (`stripe_checkout_abriu` → pedido pago) por braço. Age depois do
// clique: está no `POS_COMPRA` do `vigiaExperimento`.
//
// ── `quase_comprou` com recusa (braço pelo 6º caractere do fim do quiz) ──
//
//   A = o "quase comprou" de sempre.
//   B = quem teve o cartão RECUSADO (o Stripe guarda `last_payment_error` na
//       sessão) recebe outro texto: foi o banco, é comum, aprove no app e
//       tente de novo. Quem não teve recusa recebe o de sempre nos dois.
//
// Ler por venda em 72h entre quem TEVE recusa, por braço (a trava do envio
// grava `recusado` e `braco_recusa`). Volume baixo (~2/dia): leva semanas.

export const EXP_AVISO_RECUSA = "aviso_recusa";

/** O aviso aparece? Só no B (pela inicial, como os outros testes). */
export function avisoRecusaLigado(variante: string | null | undefined): boolean {
  return String(variante ?? "").trim().toUpperCase().startsWith("B");
}

export const TEXTO_AVISO_RECUSA = {
  en: {
    titulo: "Card declined?",
    texto:
      "US banks often block the first payment to a new international store. Approve it in your bank's app (or reply to your bank's text) and tap pay again. Apple Pay, Google Pay or another card also work.",
  },
  es: {
    titulo: "¿Te rechazaron la tarjeta?",
    // Sem "bancos de EE. UU." (28/10): o espanhol da Ballad também é o México.
    texto:
      "Los bancos suelen bloquear el primer pago a una tienda en línea nueva. Apruébalo en la app de tu banco (o responde el mensaje de tu banco) y vuelve a pagar. También puedes usar Apple Pay, Google Pay u otra tarjeta.",
  },
} as const;

export type BracoRecusaEmail = "A" | "B";

/** O braço do e-mail de recusa, pelo 6º caractere do fim do id do quiz. */
export function bracoRecusaEmail(quizId: string): BracoRecusaEmail {
  const limpo = quizId.replace(/-/g, "");
  const c = limpo[limpo.length - 6] ?? "0";
  return parseInt(c, 16) % 2 === 0 ? "A" : "B";
}

/** A sessão do Stripe teve tentativa recusada? (`expand[]=payment_intent`) */
export function sessaoTeveRecusa(sessao: unknown): boolean {
  const pi = (sessao as { payment_intent?: unknown } | null)?.payment_intent;
  if (!pi || typeof pi !== "object") return false;
  const p = pi as { status?: string; last_payment_error?: unknown };
  if (p.status === "succeeded") return false;
  return Boolean(p.last_payment_error);
}
