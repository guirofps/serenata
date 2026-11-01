import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Store } from "lucide-react";
import { MARCA, TEMA_CLARO } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { confirmarUpsellDlocal, type EstadoUpsellDlocal } from "@/lib/dlocalgo-upsell";
import { CHAVE_VOLTA_UPSELL, lerVoltaUpsell, type VoltaUpsell } from "@/lib/upsell-dlocal";
import { trackEvent } from "@/lib/track";

// A VOLTA DA dLOCAL DEPOIS DE UM UPSELL (teste `upsell_dlocal`, 01/11).
//
// Sem token na URL: ela passa pela dLocal. Qual presente reabrir está no
// `localStorage` deste navegador (`CHAVE_VOLTA_UPSELL`); noutro aparelho a
// página só diz que chega por e-mail, e chega: o aviso da dLocal libera sozinho.
//
// Pago: o vídeo volta pro bloco do vídeo no editor; a extra passa pela
// `/credito/<token>`, que guarda o crachá e abre o quiz.

export const Route = createFileRoute("/es/pago-upsell")({
  head: () => ({
    meta: [
      { title: `Tu pago · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PagoUpsell,
});

function PagoUpsell() {
  const [estado, setEstado] = useState<EstadoUpsellDlocal | null>(null);
  const [volta, setVolta] = useState<VoltaUpsell | null>(null);

  useEffect(() => {
    let v: VoltaUpsell | null = null;
    try {
      v = lerVoltaUpsell(localStorage.getItem(CHAVE_VOLTA_UPSELL));
    } catch {
      // navegador sem localStorage: cai no aviso de que chega por e-mail
    }
    setVolta(v);
    if (!v) {
      setEstado({ estado: "nenhum" });
      return;
    }
    const alvo = v;
    let vivo = true;
    confirmarUpsellDlocal({ data: alvo })
      .then((r) => {
        if (!vivo) return;
        trackEvent("upsell_dlocal_volta", { estado: r.estado, oferta: alvo.oferta });
        if (r.estado === "pago") {
          window.location.href =
            alvo.oferta === "extra" ? `/credito/${alvo.tokenEdicao}` : `/editar/${alvo.tokenEdicao}?de=video#video`;
          return;
        }
        setEstado(r);
      })
      .catch(() => vivo && setEstado({ estado: "nenhum" }));
    return () => {
      vivo = false;
    };
  }, []);

  const extra = volta?.oferta === "extra";
  const oQue = extra ? "tu otra canción" : "tu video";

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
            <h1 className="font-display text-2xl font-semibold leading-tight">Tu pago está en proceso</h1>
            <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
              {`Si ya pagaste desde tu banco o tu app, se confirma en unos minutos. Si elegiste pagar en efectivo, págalo en el punto indicado en tu ficha (vale 3 días). Te avisamos por correo cuando ${oQue} esté ${extra ? "lista para usar" : "listo"}.`}
            </p>
            {estado.url && (
              <a
                href={estado.url}
                className="cta mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium"
              >
                Ver mi pago
              </a>
            )}
            {volta && (
              <p className="mt-6 text-xs text-muted-foreground">
                <a className="underline" href={`/editar/${volta.tokenEdicao}`}>
                  Volver a mi regalo
                </a>
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold leading-tight">No encontramos un pago pendiente</h1>
            <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
              Si ya pagaste, te avisamos por correo en cuanto se confirme. Si algo no llega, responde ese correo y lo
              resolvemos.
            </p>
            {volta && (
              <a
                href={`/editar/${volta.tokenEdicao}`}
                className="cta mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium"
              >
                Volver a mi regalo
              </a>
            )}
          </>
        )}
      </main>
    </div>
  );
}
