import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import { deveMostrarAviso, responderCookies, type RespostaCookies } from "@/lib/consentimento-cookies";
import { rotaSensivel } from "@/lib/rotas-sensiveis";
import { trackEvent } from "@/lib/track";

// O aviso de cookies da Espanha. A regra mora em `consentimento-cookies.ts`.
//
// Aceitar e recusar têm o MESMO desenho, de propósito: recusar precisa ser tão
// fácil quanto aceitar. `z-[45]` fica acima da barra de comprar (`z-40`) e
// abaixo das folhas de pagamento (`z-50`): o aviso nunca cobre o botão de pagar.
//
// Abre só depois de montar: o HTML do servidor não sabe a resposta, que mora no
// navegador, e assim a hidratação não troca nada na frente da pessoa.
export function AvisoCookies() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = React.useState(false);

  React.useEffect(() => {
    if (!deveMostrarAviso()) return;
    setAberto(true);
    trackEvent("cookies_aviso_visto");
  }, []);

  if (!aberto || rotaSensivel(caminho) || caminho === "/es/cookies") return null;

  const responder = (resposta: RespostaCookies) => {
    responderCookies(resposta);
    trackEvent("cookies_resposta", { resposta });
    setAberto(false);
  };

  const botao = "h-11 flex-1 rounded-md border border-foreground/30 bg-background text-sm font-medium text-foreground";
  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      lang="es-ES"
      className="fixed inset-x-0 bottom-0 z-[45] border-t bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 text-foreground shadow-lg"
    >
      <div className="mx-auto max-w-md">
        <p className="text-[13px] leading-snug">
          Usamos cookies de Google y TikTok para medir y mejorar nuestros anuncios. ¿Las aceptas?{" "}
          <a href="/es/cookies" className="underline underline-offset-2">
            Más información
          </a>
        </p>
        <div className="mt-2.5 flex gap-2">
          <button type="button" className={botao} onClick={() => responder("nao")}>
            Rechazar
          </button>
          <button type="button" className={botao} onClick={() => responder("sim")}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
