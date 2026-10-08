import type { Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

// O IFRAME DO STRIPE, num arquivo à parte (08/10).
//
// O `@stripe/react-stripe-js` (~10 KB comprimidos) vinha no pacote do quiz e
// baixava no primeiro carregamento do /criar, das duas marcas, antes de o quiz
// hidratar. Só o `CheckoutStripe` usa, e só depois que a folha de pagamento
// abre: lá ele começa a baixar este arquivo junto com o Stripe.js e a criação
// da sessão, que demoram mais que ele.
export function CheckoutStripeEmbutido({
  stripe,
  options,
}: {
  stripe: Promise<Stripe | null>;
  options: { clientSecret: string | null; onComplete: () => void };
}) {
  return (
    <EmbeddedCheckoutProvider stripe={stripe} options={options}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
