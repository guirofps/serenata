import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { MARCA, TEMA_CLARO } from "@/lib/marca";
import { Logo } from "@/components/marca/Logo";
import { estadoCartaoDlocal, type EstadoCartaoDlocal } from "@/lib/dlocalgo-cartao";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEvent } from "@/lib/track";
import { TEXTO_CARTAO_DLOCAL } from "@/lib/cartao-dlocal";

// A VOLTA DO 3DS DO CARTÃO DA dLOCAL (teste `cartao_dlocal`, braço B).
//
// Quando o banco pede a verificação (3D Secure), a pessoa sai da folha pra
// página do banco e volta aqui. Pergunta ao servidor (que pergunta à dLocal),
// pela SESSÃO do navegador, e só manda pra `/es/gracias` se o pagamento entrou.
// O banco pode demorar uns segundos pra confirmar: pergunta algumas vezes.

export const Route = createFileRoute("/es/pago-tarjeta")({
  head: () => ({
    meta: [
      { title: `Tu pago · ${MARCA.nome}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PagoTarjeta,
});

const ESPERAS_MS = [0, 2500, 4000, 6000, 8000];

function PagoTarjeta() {
  const [estado, setEstado] = useState<EstadoCartaoDlocal["estado"] | null>(null);

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
    (async () => {
      let ultimo: EstadoCartaoDlocal["estado"] = "nenhum";
      for (const ms of ESPERAS_MS) {
        if (ms) await new Promise((r) => setTimeout(r, ms));
        if (!vivo) return;
        try {
          ultimo = (await estadoCartaoDlocal({ data: { sessionId: getOrCreateSessionId() } })).estado;
        } catch {
          ultimo = "pendente";
        }
        if (ultimo === "pago" || ultimo === "recusado" || ultimo === "nenhum") break;
      }
      if (!vivo) return;
      trackEvent("cartao_dlocal_volta_3ds", { estado: ultimo });
      if (ultimo === "pago") {
        window.location.href = "/es/gracias?metodo=tarjeta";
        return;
      }
      setEstado(ultimo);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const voltar = `/retomar?s=${typeof window !== "undefined" ? encodeURIComponent(getOrCreateSessionId()) : ""}`;

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
        ) : estado === "pendente" ? (
          <>
            <h1 className="font-display text-2xl font-semibold leading-tight">Tu pago está en proceso</h1>
            <p className="mx-auto mt-4 max-w-sm text-muted-foreground">{TEXTO_CARTAO_DLOCAL.pendente}</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold leading-tight">
              {estado === "recusado" ? "Tu banco no aprobó el pago" : "No encontramos tu pago"}
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
              Vuelve a tu canción para intentarlo con otra tarjeta o pagar en efectivo o transferencia.
            </p>
            <a href={voltar} className="cta mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium">
              Volver a mi canción
            </a>
          </>
        )}
      </main>
    </div>
  );
}
