import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Store } from "lucide-react";
import { MARCA, TEMA_CLARO } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { confirmarCheckoutDlocal, type EstadoDlocal } from "@/lib/dlocalgo-checkout";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent } from "@/lib/track";

// A VOLTA DA DLOCAL GO (OXXO e transferência, México, teste `oxxo_mx`).
//
// A página de pagamento deles devolve a pessoa pra cá, pelas duas portas
// (pagou ou voltou). Não é a `/es/gracias` de propósito: quem gerou a ficha do
// OXXO AINDA NÃO PAGOU, e a `/es/gracias` diz "pago confirmado". Aqui a gente
// pergunta ao servidor (que pergunta à dLocal) e só manda pra `/es/gracias` se
// o pagamento entrou. Ficha esperando: diz onde pagar e que a canção chega por
// e-mail quando o OXXO confirmar.
//
// A página deles roda num iframe dentro da folha: se a volta abriu aqui DENTRO
// do iframe, a página sai pra janela de cima antes de qualquer coisa.

export const Route = createFileRoute("/es/pago-oxxo")({
  head: () => ({
    meta: [
      { title: `Tu pago · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PagoOxxo,
});

// COLÔMBIA, CHILE E PERU (29/10) voltam pela mesma porta, mas o pagamento deles
// quase sempre é na hora (PSE, Webpay, Yape): "pendente" ali é "ainda
// confirmando", não "vá até a loja". Só a ficha em dinheiro espera os 3 dias.
const PENDENTE_LATAM = {
  titulo: "Tu pago está en proceso",
  texto:
    "Si ya pagaste desde tu banco o tu app, se confirma en unos minutos y tu canción completa llega a tu correo. Si elegiste pagar en efectivo, págalo en el punto indicado en tu ficha (vale 3 días).",
  botao: "Ver mi pago",
};

function PagoOxxo() {
  const [estado, setEstado] = useState<EstadoDlocal | null>(null);
  const [latam] = useState(() => {
    const p = typeof document !== "undefined" ? document.documentElement.getAttribute("data-pais") : null;
    return p === "CO" || p === "CL" || p === "PE";
  });

  useEffect(() => {
    if (window.top && window.top !== window.self) {
      try {
        window.top.location.href = window.location.href;
        return;
      } catch {
        // outro domínio por cima: segue aqui mesmo
      }
    }
    let vivo = true;
    confirmarCheckoutDlocal({ data: { sessionId: getOrCreateSessionId() } })
      .then((r) => {
        if (!vivo) return;
        trackEvent("dlocal_volta", { estado: r.estado });
        if (r.estado === "pago") {
          window.location.href = "/es/gracias?metodo=oxxo";
          return;
        }
        setEstado(r);
      })
      .catch(() => vivo && setEstado({ estado: "nenhum" }));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div style={TEMA_CLARO} className="min-h-dvh bg-background px-6 py-12 text-foreground">
      <main className="mx-auto w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        {!estado ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Revisando tu pago…
          </p>
        ) : estado.estado === "pendente" ? (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Store className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold leading-tight">
              {latam ? PENDENTE_LATAM.titulo : "Tu ficha de pago está lista"}
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
              {latam
                ? PENDENTE_LATAM.texto
                : "Págala en cualquier OXXO (o haz la transferencia) en un plazo de 3 días. En cuanto se confirme el pago, tu canción completa llega a tu correo. No necesitas hacer nada más."}
            </p>
            {estado.url && (
              <a
                href={estado.url}
                className="cta mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium"
              >
                {latam ? PENDENTE_LATAM.botao : "Ver mi ficha de pago"}
              </a>
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              ¿Prefieres pagar con tarjeta? Vuelve a tu canción y elige tarjeta:{" "}
              <a className="underline" href={`/retomar?s=${encodeURIComponent(getOrCreateSessionId())}`}>
                volver a mi canción
              </a>
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold leading-tight">No encontramos un pago pendiente</h1>
            <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
              Si ya pagaste, tu canción llega a tu correo en cuanto se confirme. Si no, vuelve a tu canción para
              pagar.
            </p>
            <a
              href={`/retomar?s=${encodeURIComponent(getOrCreateSessionId())}`}
              className="cta mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium"
            >
              Volver a mi canción
            </a>
          </>
        )}
      </main>
    </div>
  );
}
