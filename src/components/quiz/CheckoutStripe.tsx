import { useEffect, useMemo, useRef, useState } from "react";
// `/pure`: a entrada padrão do pacote injeta o Stripe.js só de ser IMPORTADA, e
// este componente vem junto com o quiz. Em 02/10 isso fazia o /criar da Ballad
// baixar ~880 KB do Stripe no primeiro segundo (LCP de 14,8s no celular em 4G).
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { criarCheckoutStripe } from "@/lib/stripe-checkout";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent } from "@/lib/track";
import { ShieldCheck, RefreshCw } from "lucide-react";

// O PAGAMENTO DA BALLAD GIFT, na própria página.
//
// É o Embedded Checkout do Stripe: a tela de cartão, Apple Pay e Google Pay
// deles, dentro da nossa, na mesma folha de baixo pra cima que o PIX usa na
// Serenata. A pessoa não sai do site no momento mais caro do funil (70% de
// quem clicava em comprar e caía num checkout de outro domínio não gerava
// pedido, medido no Brasil em 27/08).
//
// O preço que o Stripe cobra NÃO vem daqui: o servidor lê o braço sorteado no
// banco e cria a sessão. Este componente só pede "abre o pagamento desta
// sessão" e mostra o que voltar.

// Só quando a folha de pagamento ABRE, e uma vez só (o `useMemo` abaixo chama).
let stripePromise: Promise<Stripe | null> | null = null;
function stripe() {
  const chave = (import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim();
  if (!chave) return null;
  stripePromise ??= loadStripe(chave);
  return stripePromise;
}

// O VOLTAR DO CELULAR FECHA A FOLHA, e só ela (08/10).
//
// Sem isto, o voltar com o pagamento aberto andava no histórico do quiz (cada
// passo é uma URL): a folha sumia e a pessoa caía na pergunta anterior, depois
// na outra, um toque por passo. Medido em 03-07/10: 3 das 17 sessões que
// abriram o checkout fizeram exatamente isso, e nenhuma voltou a pagar.
//
// A folha empurra uma entrada no histórico com a MESMA URL (e o mesmo estado
// do roteador, pra ele não achar que mudou de página). O voltar consome essa
// entrada e fecha a folha. Fechou pelo X ou pelo fundo: a entrada sobra, e o
// `back()` da desmontagem a tira, senão o próximo voltar não faria nada.
//
// O `back()` sai num timeout que a montagem seguinte cancela: em dev o React
// monta, desmonta e remonta na hora, e um `back()` imediato voltava pra entrada
// de ANTES da folha (o alvo do `back()` é fixado na chamada), fechando a folha
// que acabou de abrir. Visto no localhost em 08/10.
let backPendente: ReturnType<typeof setTimeout> | null = null;
function useVoltarFechaAFolha(fechar: () => void) {
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    if (backPendente) {
      // Remontou antes do `back()`: a entrada da folha ainda está lá, reusa.
      clearTimeout(backPendente);
      backPendente = null;
    } else {
      window.history.pushState({ ...window.history.state, folhaPagamento: true }, "", window.location.href);
    }
    let consumida = false;
    const aoVoltar = () => {
      if (window.history.state?.folhaPagamento) return;
      consumida = true;
      fecharRef.current();
    };
    window.addEventListener("popstate", aoVoltar);
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      if (consumida) return;
      backPendente = setTimeout(() => {
        backPendente = null;
        if (window.history.state?.folhaPagamento) window.history.back();
      }, 0);
    };
  }, []);
}

export function CheckoutStripe({
  precoTexto,
  aoFechar,
  aoSemMusica,
}: {
  precoTexto: string;
  aoFechar: () => void;
  /** A trava do servidor barrou: volta pra espera da música, igual ao PIX. */
  aoSemMusica: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // A folha montou = a pessoa tocou em pagar: só agora o Stripe.js baixa, em
  // paralelo com a criação da sessão.
  const sp = useMemo(() => stripe(), []);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    setClientSecret(null);
    criarCheckoutStripe({ data: { sessionId: getOrCreateSessionId() } })
      .then((r) => {
        if (!vivo) return;
        if (r.ok) {
          setClientSecret(r.clientSecret);
          trackEvent("stripe_checkout_abriu", { sessao: r.sessaoId });
          return;
        }
        trackEvent("stripe_checkout_erro", { erro: r.erro });
        if (r.erro === "sem-musica") return aoSemMusica();
        if (r.erro === "ja-pago") {
          window.location.href = "/obrigado";
          return;
        }
        setErro("We couldn't open the payment right now. Please try again in a moment.");
      })
      .catch(() => {
        if (!vivo) return;
        trackEvent("stripe_checkout_erro", { erro: "rede" });
        setErro("We couldn't open the payment right now. Please try again in a moment.");
      });
    return () => {
      vivo = false;
    };
    // `aoSemMusica` muda a cada render do pai; a sessão só é pedida de novo
    // quando a pessoa toca em "Try again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  useVoltarFechaAFolha(() => {
    trackEvent("stripe_checkout_fechou", { pelo: "voltar" });
    aoFechar();
  });

  const opcoes = useMemo(
    () => ({
      clientSecret,
      // Pago: o Stripe manda pra `return_url` (a /obrigado com o id da sessão).
      onComplete: () => trackEvent("stripe_checkout_completo"),
    }),
    [clientSecret],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={() => {
          trackEvent("stripe_checkout_fechou");
          aoFechar();
        }}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />
      <div className="relative max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-primary/10 bg-background px-3 pb-6 pt-4 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
        <div className="mb-3 px-2 text-center">
          <p className="font-display text-lg font-semibold">Unlock your song · {precoTexto}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure one-time payment, no subscription
          </p>
        </div>

        {!sp ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Payment isn't available right now. Please write to us and we'll sort it out.
          </p>
        ) : erro ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-amber-900">{erro}</p>
            <button
              onClick={() => setTentativa((n) => n + 1)}
              className="cta mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : !clientSecret ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Opening secure payment…
          </p>
        ) : (
          <EmbeddedCheckoutProvider stripe={sp} options={opcoes}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </div>
    </div>
  );
}
