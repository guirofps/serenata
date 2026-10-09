import { useEffect, useMemo, useRef, useState } from "react";
// `/pure`: a entrada padrão injeta o Stripe.js só de ser importada (ver `CheckoutStripe`).
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { criarCheckoutVideoStripe, confirmarVideoStripe } from "@/lib/stripe-upsell";
import { trackEvent } from "@/lib/track";

// A FOLHA DO VÍDEO NA BALLAD GIFT: o checkout embutido do Stripe dentro do
// editor, no lugar da folha de PIX da Serenata (`FolhaPixUpsell`).
//
// `loadStripe` só roda quando a folha ABRE: o Stripe.js pesa 270 KB e o editor
// inteiro não precisa dele pra quem só veio copiar o link.

// A moldura nos dois idiomas da Ballad (o iframe segue o `locale` que o
// servidor tira da compra, em `stripe-upsell.ts`).
const TEXTOS = {
  en: {
    jaTem: "Your video is already on its way. It shows up right here when it's ready.",
    erro: "We couldn't open the payment right now. Please try again in a moment.",
    fechar: "Close",
    titulo: (preco: string) => `Your gift video in HD · ${preco}`,
    seguro: "Secure one-time payment, no subscription",
    tentar: "Try again",
    abrindo: "Opening secure checkout…",
  },
  es: {
    jaTem: "Tu video ya viene en camino. Aparece aquí mismo cuando esté listo.",
    erro: "No pudimos abrir el pago en este momento. Inténtalo de nuevo en un momento.",
    fechar: "Cerrar",
    titulo: (preco: string) => `Tu video regalo en HD · ${preco}`,
    seguro: "Pago único y seguro, sin suscripción",
    tentar: "Intentar de nuevo",
    abrindo: "Abriendo el pago seguro…",
  },
} as const;

let stripePromise: Promise<Stripe | null> | null = null;
function stripe() {
  const chave = (import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim();
  if (!chave) return null;
  stripePromise ??= loadStripe(chave);
  return stripePromise;
}

export function FolhaStripeVideo({
  tokenEdicao,
  precoTexto,
  aoPagar,
  aoFechar,
  locale = "en",
}: {
  tokenEdicao: string;
  precoTexto: string;
  aoPagar: () => void;
  aoFechar: () => void;
  /** O idioma da moldura. Fora do espanhol, inglês (o padrão da Ballad). */
  locale?: string;
}) {
  const T = locale === "es" ? TEXTOS.es : TEXTOS.en;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const sessao = useRef<string | null>(null);
  // Em ref: o `onComplete` entra nas `options` do Stripe, e trocar as options
  // depois de montado é mudança que o provedor não aceita.
  const aoPagarRef = useRef(aoPagar);
  aoPagarRef.current = aoPagar;

  useEffect(() => {
    let vivo = true;
    setErro(null);
    setClientSecret(null);
    criarCheckoutVideoStripe({ data: { tokenEdicao } })
      .then((r) => {
        if (!vivo) return;
        if (r.ok) {
          sessao.current = r.sessaoId;
          setClientSecret(r.clientSecret);
          trackEvent("stripe_video_abriu", { sessao: r.sessaoId });
          return;
        }
        trackEvent("stripe_video_erro", { erro: r.erro });
        setErro(r.erro === "ja-tem" ? T.jaTem : T.erro);
      })
      .catch(() => {
        if (!vivo) return;
        trackEvent("stripe_video_erro", { erro: "rede" });
        setErro(T.erro);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenEdicao, tentativa]);

  const opcoes = useMemo(
    () => ({
      clientSecret,
      onComplete: () => {
        trackEvent("stripe_video_completo", { sessao: sessao.current });
        // O navegador só avisa; quem confirma é a API do Stripe, no servidor.
        // Se isto falhar, o webhook libera do mesmo jeito.
        if (sessao.current) void confirmarVideoStripe({ data: { sessaoId: sessao.current } }).catch(() => {});
        aoPagarRef.current();
      },
    }),
    [clientSecret],
  );

  const promessa = stripe();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label={T.fechar}
        onClick={() => {
          trackEvent("stripe_video_fechou");
          aoFechar();
        }}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />
      <div className="relative max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-primary/10 bg-background px-3 pb-6 pt-4 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
        <div className="mb-3 px-2 text-center">
          <p className="font-display text-lg font-semibold">{T.titulo(precoTexto)}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" /> {T.seguro}
          </p>
        </div>
        {erro ? (
          <div className="space-y-3 px-2 py-6 text-center">
            <p className="text-sm">{erro}</p>
            <button
              type="button"
              onClick={() => setTentativa((n) => n + 1)}
              className="mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" /> {T.tentar}
            </button>
          </div>
        ) : clientSecret && promessa ? (
          <EmbeddedCheckoutProvider stripe={promessa} options={opcoes}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{T.abrindo}</p>
        )}
      </div>
    </div>
  );
}
