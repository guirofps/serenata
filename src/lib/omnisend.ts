// OMNISEND: o script do site, pras campanhas de marketing (15/10).
//
// Só campanha. Letra, recuperação, entrega e as outras réguas continuam no
// Resend, com as travas de "já mandei" e de descadastro delas. O Omnisend
// entra pra o dono montar campanha sozinho; este script dá a ele a visita e
// os formulários de captura no site.
//
// Mesmas travas dos outros pixels (`tiktok-pixel.ts`, `clarity.ts`): fora das
// rotas de `rotas-sensiveis.ts` (o script lê a URL, e as nossas URLs são
// chaves), só na Serenata (a marca do Omnisend é dela), e o arquivo remoto
// espera a página pela porta de `carregar-depois.ts`.

import type { ChaveMarca } from "@/lib/marca-identidade";
import { MARCA_ATIVA } from "@/lib/marca-identidade";

const MARCA_SERENATA = "6ad0e987160c976a2a289ea1";

/** A conta do Omnisend é da Serenata. A Ballad mediria no painel errado. */
export function omnisendDaMarca(chave: ChaveMarca): string | null {
  return chave === "serenata" ? MARCA_SERENATA : null;
}

export const OMNISEND_ID: string | null = omnisendDaMarca(MARCA_ATIVA.chave);

/** O snippet oficial; a única mudança é o arquivo remoto passar pela porta. */
export function scriptOmnisend(id: string, imediato: boolean): string {
  return (
    `window.omnisend=window.omnisend||[];window.omnisend.push(["brandID",${JSON.stringify(id)}]);` +
    `window.omnisend.push(["track","$pageViewed"]);` +
    `(window.__depoisDaPagina||function(f){f()})(function(){var e=document.createElement("script");` +
    `e.type="text/javascript";e.async=!0;e.src="https://omnisnippet1.com/inshop/launcher-v2.js";` +
    `var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(e,t)},${imediato ? "true" : "false"});`
  );
}
