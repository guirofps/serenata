// MICROSOFT CLARITY: mapa de calor e gravação de sessão (15/10).
//
// Irmão de `tiktok-pixel.ts` e do gtag, com as mesmas travas: fora das rotas
// de `rotas-sensiveis.ts`, só na Serenata, e o arquivo remoto espera a página
// (`carregar-depois.ts`), menos na /obrigado.
//
// ── POR QUE A TRAVA AQUI É MAIS SÉRIA QUE NO GTAG ────────────────
//
// O gtag leva a URL. O Clarity leva a URL E A TELA: grava o que está
// desenhado. No `/editar/<token>` isso é o token na barra mais o presente
// inteiro; no `/pix/<ref>`, o código copia-e-cola. O HTML do servidor já não
// põe o script nessas rotas, mas o site é SPA: quem compra vai de `/criar`
// pra `/obrigado` e de lá pro editor SEM recarregar, e o Clarity carregado no
// `/criar` continuaria gravando. Então o script envolve o `pushState` (mesmo
// truque de `scriptGuardaGa4`): rota sensível manda `clarity("stop")` ANTES
// de a URL mudar, e sair dela manda `clarity("start")`.
//
// O que o Clarity NÃO esconde sozinho: texto que a página desenha (a letra, o
// nome do presenteado). Os campos de digitar ele mascara por padrão.

import type { ChaveMarca } from "@/lib/marca-identidade";
import { MARCA_ATIVA } from "@/lib/marca-identidade";

const ID_SERENATA = "yy5ylx8k5n";

/** O projeto do Clarity é da Serenata. A Ballad gravaria no painel errado. */
export function clarityDaMarca(chave: ChaveMarca): string | null {
  return chave === "serenata" ? ID_SERENATA : null;
}

export const CLARITY_ID: string | null = clarityDaMarca(MARCA_ATIVA.chave);

/**
 * O snippet oficial com duas mudanças: o arquivo remoto entra pela porta
 * `__depoisDaPagina` (a fila `clarity()` nasce na hora, como no oficial), e a
 * trava de rota sensível descrita acima. A lista de prefixos chega serializada
 * porque o script roda antes de qualquer módulo.
 */
export function scriptClarity(id: string, prefixos: readonly string[], imediato: boolean): string {
  const lista = JSON.stringify(prefixos);
  return (
    `(function(c,l,a,r,i){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};` +
    `(c.__depoisDaPagina||function(f){f()})(function(){var t=l.createElement(r);t.async=1;` +
    `t.src="https://www.clarity.ms/tag/"+i;var y=l.getElementsByTagName(r)[0];` +
    `y?y.parentNode.insertBefore(t,y):l.head.appendChild(t)},${imediato ? "true" : "false"});` +
    `var P=${lista},parado=false;` +
    `function s(p){p=(p||"/").toLowerCase();var q=p.replace(/^\\/(es|pt)(?=\\/|$)/,"")||"/";` +
    `return P.some(function(x){return q===x.replace(/\\/$/,"")||q.indexOf(x)===0})}` +
    `function v(u){try{var x=s(new URL(u,location.href).pathname);` +
    `if(x&&!parado){parado=true;c[a]("stop")}else if(!x&&parado){parado=false;c[a]("start")}}catch(e){}}` +
    `["pushState","replaceState"].forEach(function(m){var o=history[m];` +
    `history[m]=function(st,t,u){if(u!=null)v(String(u));return o.apply(this,arguments)}});` +
    `c.addEventListener("popstate",function(){v(location.href)},true);` +
    `})(window,document,"clarity","script",${JSON.stringify(id)});`
  );
}
