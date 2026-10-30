import { useEffect, useMemo, useRef, useState } from "react";
// `/pure`: a entrada padrão do pacote injeta o Stripe.js só de ser IMPORTADA, e
// este componente vem junto com o quiz. Em 02/10 isso fazia o /criar da Ballad
// baixar ~880 KB do Stripe no primeiro segundo (LCP de 14,8s no celular em 4G).
// E desde 08/10 nem o carregador (`/pure`) vem no pacote do quiz: ele é
// importado na hora em que a folha abre (ver `stripe()` abaixo).
import type { Stripe } from "@stripe/stripe-js";
// O `@stripe/react-stripe-js` também só baixa quando a folha abre (08/10):
// ver `CheckoutStripeEmbutido.tsx` e `carregarEmbutido` abaixo.
import type { CheckoutStripeEmbutido as Embutido } from "@/components/quiz/CheckoutStripeEmbutido";
import { criarCheckoutStripe } from "@/lib/stripe-checkout";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent } from "@/lib/track";
import { usePausarVideosAtras, useVoltarFechaAFolha } from "@/lib/folha-pagamento";
import { ShieldCheck, RefreshCw, X } from "lucide-react";
import { varianteDe } from "@/lib/experimentos";
import { NaMoeda } from "@/components/quiz/PrecoDaOferta";
import { EXP_AVISO_RECUSA, TEXTO_AVISO_RECUSA, avisoRecusaLigado } from "@/lib/aviso-recusa";
import { EXP_OXXO_MX, oxxoLigado } from "@/lib/oxxo-mx";
import { EXP_SPEI_DESTAQUE, TEXTO_SPEI_DESTAQUE, speiDestaqueLigado } from "@/lib/spei-destaque";

/** O botão de pagar sem cartão, com os métodos que a dLocal mostra em cada país. */
const BOTAO_SEM_CARTAO: Record<string, string> = {
  MX: "¿Sin tarjeta? Paga en efectivo en OXXO o con transferencia",
  CO: "¿Sin tarjeta? Paga con PSE, Nequi o en efectivo",
  CL: "¿Sin tarjeta? Paga con Webpay o transferencia",
  PE: "¿Sin tarjeta? Paga con Yape, transferencia o en efectivo",
};
import { CheckoutDlocal } from "@/components/quiz/CheckoutDlocal";

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

// OS DOIS IDIOMAS DA BALLAD. O inglês do site e o espanhol do `/es` (hispanos
// dos EUA) pagam pelo mesmo Stripe; só a moldura em volta do iframe muda. O
// iframe em si sai no idioma certo pelo `locale` da sessão, que o servidor
// tira da linha do quiz (`stripe-checkout.ts`).
const TEXTOS = {
  en: {
    erro: "We couldn't open the payment right now. Please try again in a moment.",
    fechar: "Close",
    fecharPagamento: "Close payment",
    titulo: (preco: string) => `Unlock your song · ${preco}`,
    seguro: "Secure one-time payment, no subscription",
    indisponivel: "Payment isn't available right now. Please write to us and we'll sort it out.",
    tentar: "Try again",
    abrindo: "Opening secure payment…",
    obrigado: "/obrigado",
  },
  es: {
    erro: "No pudimos abrir el pago en este momento. Inténtalo de nuevo en un momento.",
    fechar: "Cerrar",
    fecharPagamento: "Cerrar el pago",
    titulo: (preco: string) => `Desbloquea tu canción · ${preco}`,
    seguro: "Pago único y seguro, sin suscripción",
    indisponivel: "El pago no está disponible en este momento. Escríbenos y lo resolvemos.",
    tentar: "Intentar de nuevo",
    abrindo: "Abriendo el pago seguro…",
    obrigado: "/es/gracias",
  },
} as const;

// Só quando a folha de pagamento ABRE, e uma vez só (o `useMemo` abaixo chama).
let stripePromise: Promise<Stripe | null> | null = null;
function stripe() {
  const chave = (import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)?.trim();
  if (!chave) return null;
  stripePromise ??= import("@stripe/stripe-js/pure").then((m) => m.loadStripe(chave));
  return stripePromise;
}

// O componente do iframe, pela mesma porta: pedido quando a folha monta, em
// paralelo com o Stripe.js e com a sessão (os dois demoram mais que ele).
// Falhou (rede piscou): esquece a promessa, e o "Try again" baixa de novo.
let embutidoPromise: Promise<typeof Embutido> | null = null;
function carregarEmbutido() {
  embutidoPromise ??= import("@/components/quiz/CheckoutStripeEmbutido").then(
    (m) => m.CheckoutStripeEmbutido,
    (e) => {
      embutidoPromise = null;
      throw e;
    },
  );
  return embutidoPromise;
}

export function CheckoutStripe({
  precoTexto,
  aoFechar,
  aoSemMusica,
  locale = "en",
}: {
  precoTexto: string;
  aoFechar: () => void;
  /** A trava do servidor barrou: volta pra espera da música, igual ao PIX. */
  aoSemMusica: () => void;
  /** O idioma da moldura. Fora do espanhol, inglês (o padrão da Ballad). */
  locale?: string;
}) {
  const T = locale === "es" ? TEXTOS.es : TEXTOS.en;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // A folha montou = a pessoa tocou em pagar: só agora o Stripe.js baixa, em
  // paralelo com a criação da sessão.
  const sp = useMemo(() => stripe(), []);
  const abertaEm = useRef(Date.now());
  const [CheckoutEmbutido, setCheckoutEmbutido] = useState<typeof Embutido | null>(null);
  // Teste `aviso_recusa` (18/10): ver `aviso-recusa.ts`.
  const [avisoRecusa] = useState(() => avisoRecusaLigado(varianteDe(EXP_AVISO_RECUSA)));
  const AVISO = locale === "es" ? TEXTO_AVISO_RECUSA.es : TEXTO_AVISO_RECUSA.en;
  // Teste `oxxo_mx` (23/10): no México, o OXXO e a transferência da dLocal Go
  // ao lado do cartão (ver `oxxo-mx.ts`). O país é o que o servidor carimbou.
  const [pais] = useState(() =>
    typeof document !== "undefined" ? String(document.documentElement.getAttribute("data-pais") ?? "").toUpperCase() : "",
  );
  const paisMx = pais === "MX";
  // COLÔMBIA, CHILE E PERU (29/10): a dLocal entra como CANAL do mercado novo,
  // não como teste (quem está lá nunca viu outra folha). Métodos conferidos com
  // cobranças de teste: PSE e Nequi, Webpay, Yape. O México segue no `oxxo_mx`.
  const [oxxo] = useState(() =>
    paisMx
      ? oxxoLigado(varianteDe(EXP_OXXO_MX), "MX", locale)
      : locale === "es" && (pais === "CO" || pais === "CL" || pais === "PE"),
  );
  // Teste `spei_destaque` (30/10): a transferência na frente do OXXO, com a
  // escolha na nossa folha (ver `spei-destaque.ts`). Só pra quem vê o botão.
  const [speiDestaque] = useState(() => oxxo && speiDestaqueLigado(varianteDe(EXP_SPEI_DESTAQUE), pais));
  const [metodo, setMetodo] = useState<"cartao" | "oxxo">("cartao");
  useEffect(() => {
    if (paisMx && locale === "es") trackEvent("oxxo_mx_exposto", { braco: varianteDe(EXP_OXXO_MX) });
    if (paisMx && oxxo) trackEvent("spei_destaque_exposto", { braco: varianteDe(EXP_SPEI_DESTAQUE) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O iframe (ver `carregarEmbutido`). Junto com o "Try again": se o arquivo
  // não veio, a nova tentativa pede de novo.
  useEffect(() => {
    let vivo = true;
    carregarEmbutido()
      .then((c) => {
        if (vivo) setCheckoutEmbutido(() => c);
      })
      .catch(() => {
        if (!vivo) return;
        trackEvent("stripe_checkout_erro", { erro: "arquivo" });
        setErro(T.erro);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

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
          // A porta de quem já pagou, no idioma de quem está pagando.
          window.location.href = T.obrigado;
          return;
        }
        setErro(T.erro);
      })
      .catch(() => {
        if (!vivo) return;
        trackEvent("stripe_checkout_erro", { erro: "rede" });
        setErro(T.erro);
      });
    return () => {
      vivo = false;
    };
    // `aoSemMusica` muda a cada render do pai; a sessão só é pedida de novo
    // quando a pessoa toca em "Try again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  usePausarVideosAtras();

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
      {/* O FUNDO SÓ FECHA DEPOIS DE 0,8s (08/10). Era o único jeito de fechar,
          e fechava no primeiro toque: um toque duplo no "comprar" abria a folha
          e o segundo toque, caindo no fundo, fechava (uma sessão fechou 1s
          depois de reabrir). Fechar de propósito agora tem o X. */}
      <button
        aria-label={T.fechar}
        onClick={() => {
          if (Date.now() - abertaEm.current < 800) return;
          trackEvent("stripe_checkout_fechou", { pelo: "fundo" });
          aoFechar();
        }}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />
      {/* `dvh` onde existe (29/10): no Safari do iPhone `vh` é a altura SEM a barra
          do navegador, e o pé da folha (o botão de pagar) ficava atrás dela. */}
      <div className="relative max-h-[94vh] supports-[height:100dvh]:max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-primary/10 bg-background px-3 pb-6 pt-4 shadow-2xl sm:rounded-3xl">
        <button
          aria-label={T.fecharPagamento}
          onClick={() => {
            trackEvent("stripe_checkout_fechou", { pelo: "x" });
            aoFechar();
          }}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
        <div className="mb-3 px-2 text-center">
          <p className="font-display text-lg font-semibold"><NaMoeda texto={precoTexto} como={T.titulo} /></p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" /> {T.seguro}
          </p>
        </div>

        {metodo === "oxxo" ? (
          <CheckoutDlocal
            pais={pais === "CO" || pais === "CL" || pais === "PE" ? pais : "MX"}
            aoVoltar={() => setMetodo("cartao")}
            aoSemMusica={aoSemMusica}
            escolherMetodo={speiDestaque}
          />
        ) : !sp ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {T.indisponivel}
          </p>
        ) : erro ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-amber-900">{erro}</p>
            <button
              onClick={() => setTentativa((n) => n + 1)}
              className="cta mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" /> {T.tentar}
            </button>
          </div>
        ) : !clientSecret || !CheckoutEmbutido ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> {T.abrindo}
          </p>
        ) : (
          <>
            {oxxo && (
              <button
                onClick={() => {
                  trackEvent("dlocal_oxxo_escolhido", { pais });
                  setMetodo("oxxo");
                }}
                className="mx-2 mb-3 flex w-[calc(100%-1rem)] items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 text-sm font-medium text-primary"
              >
                {speiDestaque ? TEXTO_SPEI_DESTAQUE.botao : (BOTAO_SEM_CARTAO[pais] ?? BOTAO_SEM_CARTAO.MX)}
              </button>
            )}
            <CheckoutEmbutido stripe={sp} options={opcoes} />
            {/* Embaixo do botão de pagar, onde o erro de recusa aparece. */}
            {avisoRecusa && (
              <div className="mx-2 mt-3 rounded-xl border border-primary/10 bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">{AVISO.titulo}</p>
                <p className="mt-0.5">{AVISO.texto}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
