import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { criarCheckoutDlocal, confirmarCheckoutDlocal } from "@/lib/dlocalgo-checkout";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent } from "@/lib/track";

// OXXO E TRANSFERÊNCIA (México, teste `oxxo_mx`), DENTRO da folha do Stripe.
//
// A página de pagamento é da dLocal Go (o transparente deles é só cartão), e
// abre num iframe aqui dentro: a pessoa não sai do balladgift.com, igual ao
// caixa do Stripe. Se o iframe não carregar no aparelho dela, o link de baixo
// abre a mesma página numa aba.
//
// O PAGO NÃO DEPENDE DA VOLTA: enquanto a folha está aberta, ela pergunta ao
// servidor a cada 6s (que pergunta à dLocal). Transferência cai em minutos e a
// pessoa vai pra `/es/gracias` sozinha. A ficha do OXXO se paga na loja depois:
// aí quem entrega é o aviso da dLocal, por e-mail.

const T = {
  voltar: "Pagar con tarjeta",
  abrindo: "Abriendo el pago seguro…",
  erro: "No pudimos abrir el pago en efectivo en este momento. Inténtalo de nuevo o paga con tarjeta.",
  tentar: "Intentar de nuevo",
  comoFunciona:
    "Elige OXXO para recibir tu ficha y pagarla en efectivo en cualquier OXXO (vale 3 días), o transferencia para pagar desde tu banco. Tu canción completa llega a tu correo en cuanto se confirme el pago.",
  outraAba: "¿No se ve bien? Abrir el pago en otra pestaña",
};

const A_CADA_MS = 6000;

export function CheckoutDlocal({ aoVoltar, aoSemMusica }: { aoVoltar: () => void; aoSemMusica: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    setUrl(null);
    criarCheckoutDlocal({ data: { sessionId: getOrCreateSessionId() } })
      .then((r) => {
        if (!vivo) return;
        if (r.ok) {
          setUrl(r.url);
          trackEvent("dlocal_checkout_abriu", { pagamento: r.pagamentoId });
          return;
        }
        trackEvent("dlocal_checkout_erro", { erro: r.erro });
        if (r.erro === "sem-musica") return aoSemMusica();
        if (r.erro === "ja-pago") {
          window.location.href = "/es/gracias";
          return;
        }
        setErro(true);
      })
      .catch(() => {
        if (!vivo) return;
        trackEvent("dlocal_checkout_erro", { erro: "rede" });
        setErro(true);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  // Pergunta se já pagou enquanto a folha está aberta.
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    const t = window.setInterval(() => {
      confirmarCheckoutDlocal({ data: { sessionId: getOrCreateSessionId() } })
        .then((r) => {
          if (!vivo || r.estado !== "pago") return;
          trackEvent("dlocal_checkout_pago", {});
          window.location.href = "/es/gracias?metodo=oxxo";
        })
        .catch(() => {});
    }, A_CADA_MS);
    return () => {
      vivo = false;
      window.clearInterval(t);
    };
  }, [url]);

  return (
    <div>
      <button
        onClick={() => {
          trackEvent("dlocal_checkout_voltou_cartao", {});
          aoVoltar();
        }}
        className="mb-2 ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {T.voltar}
      </button>
      <p className="mx-2 mb-3 rounded-xl bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {T.comoFunciona}
      </p>
      {erro ? (
        <div className="px-3 py-6 text-center">
          <p className="text-sm text-amber-900">{T.erro}</p>
          <button
            onClick={() => setTentativa((n) => n + 1)}
            className="cta mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" /> {T.tentar}
          </button>
        </div>
      ) : !url ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> {T.abrindo}
        </p>
      ) : (
        <>
          <iframe
            src={url}
            title="Pago OXXO o transferencia"
            className="h-[70vh] min-h-[520px] w-full rounded-xl border border-primary/10 bg-white"
            allow="payment; clipboard-write"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("dlocal_checkout_outra_aba", {})}
            className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" /> {T.outraAba}
          </a>
        </>
      )}
    </div>
  );
}
