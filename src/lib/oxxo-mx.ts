// TESTE `oxxo_mx` (Ballad, 23/10): OXXO e transferência pra quem está no México.
//
// O México vende pouco pro lead que gera: 34 leads a R$ 1-3 e 1 venda em 23/10,
// e o Stripe da conta (brasileira) não tem OXXO. No suporte do mesmo dia: "no
// me gusta pagar con tarjetas, ¿tendrás opción de OXXO?".
//
//   A = a folha do Stripe como é hoje (só cartão).
//   B = a mesma folha com "¿Sin tarjeta? Paga en OXXO o transferencia", que
//       abre a página da dLocal Go dentro da folha (`CheckoutDlocal.tsx`).
//
// Só aparece no México (o `data-pais` que o servidor carimba, o mesmo do preço
// em peso) e no espanhol; o servidor confere o país de novo antes de cobrar.
// Ler por VENDA POR LEAD entre leads do México, por braço. Age depois do
// clique em pagar: está no `POS_COMPRA` do `vigiaExperimento`.

export const EXP_OXXO_MX = "oxxo_mx";

/** O botão do OXXO aparece? Braço B, México, espanhol. */
export function oxxoLigado(variante: string | null | undefined, pais: string | null | undefined, locale: string): boolean {
  return (
    locale === "es" &&
    String(pais ?? "").trim().toUpperCase() === "MX" &&
    String(variante ?? "").trim().toUpperCase().startsWith("B")
  );
}
