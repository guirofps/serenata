import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { criarCheckoutDlocal } from "@/lib/dlocalgo-checkout";
import { getOrCreateSessionId } from "@/lib/session-context";
import { guardarTransacao } from "@/lib/google-ads";
import { trackEvent } from "@/lib/track";

// OXXO E TRANSFERÊNCIA (México, teste `oxxo_mx`), a partir da folha do Stripe.
//
// A página de pagamento é da dLocal Go (o transparente deles é só cartão), e
// abre em TELA CHEIA (24/10). Nasceu num iframe dentro da folha, mas no celular
// a página deles é mais larga que a folha e rola de lado: em 23-24/10, 4 das 7
// pessoas que escolheram OXXO tocaram em "abrir em outra aba", e nenhuma das 5
// cobranças passou do formulário (todas em `CREATED`). A volta das duas portas
// cai na `/es/pago-oxxo`, que diz se já pagou ou se a ficha está esperando.

const T = {
  voltar: "Pagar con tarjeta",
  abrindo: "Abriendo el pago seguro…",
  erro: "No pudimos abrir el pago en efectivo en este momento. Inténtalo de nuevo o paga con tarjeta.",
  tentar: "Intentar de nuevo",
  voltou: "¿No terminaste el pago? Puedes abrirlo de nuevo o pagar con tarjeta.",
  comoFunciona:
    "Elige OXXO para recibir tu ficha y pagarla en efectivo en cualquier OXXO (vale 3 días), o transferencia para pagar desde tu banco. Tu canción completa llega a tu correo en cuanto se confirme el pago.",
};

export function CheckoutDlocal({ aoVoltar, aoSemMusica }: { aoVoltar: () => void; aoSemMusica: () => void }) {
  const [erro, setErro] = useState(false);
  // VOLTOU DA DLOCAL PELO "VOLTAR" (29/10). O Safari e o Chrome do celular
  // devolvem a página congelada (bfcache), com o "Abriendo el pago seguro…"
  // girando pra sempre: o efeito já tinha terminado e nada o refaz. No
  // `pageshow` com `persisted` a folha vira a tela de tentar de novo, que
  // reabre a MESMA cobrança (o servidor devolve a que está aberta).
  const [voltou, setVoltou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const aoMostrar = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      trackEvent("dlocal_checkout_voltou_bfcache", {});
      setVoltou(true);
    };
    window.addEventListener("pageshow", aoMostrar);
    return () => window.removeEventListener("pageshow", aoMostrar);
  }, []);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    setVoltou(false);
    criarCheckoutDlocal({ data: { sessionId: getOrCreateSessionId() } })
      .then((r) => {
        if (!vivo) return;
        if (r.ok) {
          trackEvent("dlocal_checkout_abriu", { pagamento: r.pagamentoId, modo: "tela_cheia" });
          // O MESMO ID QUE O SERVIDOR MANDA PRO TIKTOK (29/10): a venda da
          // dLocal sobe pelo servidor com `eventId` = id do pagamento deles
          // (`api/lib/dlocalgo.ts`). Sem guardar aqui, a `/es/gracias` caía no
          // hash da sessão e o pixel contava a mesma venda com OUTRO id.
          guardarTransacao(r.pagamentoId);
          window.location.assign(r.url);
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
      {erro || voltou ? (
        <div className="px-3 py-6 text-center">
          <p className={voltou && !erro ? "text-sm text-muted-foreground" : "text-sm text-amber-900"}>
            {voltou && !erro ? T.voltou : T.erro}
          </p>
          <button
            onClick={() => setTentativa((n) => n + 1)}
            className="cta mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" /> {T.tentar}
          </button>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> {T.abrindo}
        </p>
      )}
    </div>
  );
}
