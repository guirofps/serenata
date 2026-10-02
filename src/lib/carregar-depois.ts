// O QUE SÓ PRECISA CHEGAR DEPOIS DA PRIMEIRA PINTURA (02/10).
//
// Medido no Lighthouse (celular, 4G) no /criar da Ballad: a imagem principal
// chegava em ~2s e só aparecia aos 8,8s, porque o celular estava ocupado com o
// gtag (162 KB), o pixel do TikTok (115 KB) e a folha da Google Fonts, que
// trava a pintura (~0,8s). E 19% dos cliques pagos da Serenata (01/10) nem
// chegavam a registrar a página.
//
// Os dois pixels continuam criando a FILA na hora (`dataLayer`/`gtag()` e o
// `ttq` de mentira do snippet deles): evento disparado cedo entra na fila e
// sai quando o arquivo de verdade chega. Só o arquivo pesado espera a página.
//
// Na /obrigado nada espera: é onde a venda é contada, e quem fecha a aba um
// segundo depois de pagar não pode levar a conversão junto.

/**
 * Define `window.__depoisDaPagina(f, imediato)`: roda `f` quando a página
 * terminou de carregar e o celular ficou ocioso, com teto de 5s; ou na hora,
 * se `imediato`. Precisa vir no <head>, antes dos pixels no <body>.
 */
export function scriptDepoisDaPagina(): string {
  return `window.__depoisDaPagina=function(f,imediato){if(imediato)return f();var feito=0;function go(){if(!feito){feito=1;f()}}function ocioso(){(window.requestIdleCallback||function(c){setTimeout(c,200)})(go,{timeout:2000})}if(document.readyState==="complete")ocioso();else addEventListener("load",ocioso);setTimeout(go,5000)};`;
}

/**
 * A folha da Google Fonts SEM travar a pintura: inserida por script, ela não
 * bloqueia (só `<link rel=stylesheet>` escrito no HTML bloqueia). Com o
 * `display=swap` da URL, o texto aparece na fonte do sistema e troca quando a
 * nossa chega.
 */
export function scriptFontes(url: string): string {
  return `(function(){var l=document.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(url)};document.head.appendChild(l)})();`;
}

/** O gtag de verdade, pela mesma porta. A fila (`gtag()`) fica no HTML. */
export function scriptCarregaGtag(id: string, imediato: boolean): string {
  return `window.__depoisDaPagina(function(){var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id=${id}";document.head.appendChild(s)},${imediato ? "true" : "false"});`;
}

/** As rotas em que os pixels NÃO esperam: é nelas que a venda é contada. */
export function rotaDeConversao(caminho: string): boolean {
  return caminho === "/obrigado" || caminho.startsWith("/obrigado/") || caminho === "/es/gracias" || caminho.startsWith("/es/gracias/");
}
