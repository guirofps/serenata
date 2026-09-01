// TIKTOK ADS: pixel e evento de compra.
//
// Irmão de `google-ads.ts`, e de propósito: mesmo desenho, mesma escada de
// dedupe, mesmas travas. Quem entender um entende o outro.
//
// ── O ID VEM DE ENV, E NÃO CRAVADO NO CÓDIGO ─────────────────────
//
// O do Google está cravado porque é um só e nunca mudou. O do TikTok nasce
// numa conta comprada pra TESTAR: se o teste não vingar, a conta morre, e um
// id cravado no código vira lixo que ninguém lembra de tirar.
//
// Sem `VITE_TIKTOK_PIXEL_ID` o módulo inteiro é NO-OP: nada carrega, nada
// dispara, nada quebra. É o que permite este código subir hoje e começar a
// medir no minuto em que o id existir, sem outro deploy de código.
//
// ── ONDE ELE NÃO ENTRA ───────────────────────────────────────────
//
// Mesma régua do gtag e da UTMify: fora das rotas de `rotas-sensiveis.ts`.
// As nossas URLs não são endereços, são CHAVES (`/editar/<token>` autoriza
// baixar o presente), e o pixel do TikTok manda a URL da página pro servidor
// deles igual ao gtag. `/obrigado` fica de fora da lista, como já fica pro
// Google, porque é lá que a conversão acontece.

/** O pixel só existe se a conta existir. Ver o bloco acima. */
export const TIKTOK_PIXEL_ID: string | undefined =
  (import.meta.env?.VITE_TIKTOK_PIXEL_ID as string | undefined)?.trim() || undefined;

declare global {
  interface Window {
    ttq?: {
      track: (evento: string, dados?: Record<string, unknown>, opcoes?: Record<string, unknown>) => void;
      page: () => void;
      identify: (dados: Record<string, unknown>) => void;
    };
  }
}

/**
 * O script base, no formato que o TikTok publica.
 *
 * Fica como string porque vai num `dangerouslySetInnerHTML` no `__root`,
 * exatamente como o do Google. Um `<script src>` nosso não serve: o snippet
 * precisa criar `window.ttq` ANTES do arquivo remoto chegar, senão os eventos
 * disparados cedo se perdem em vez de entrar na fila.
 */
export function scriptTiktok(id: string): string {
  return `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var s=d.createElement("script");s.type="text/javascript",s.async=!0,s.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(s,a)};ttq.load('${id}');ttq.page();}(window,document,'ttq');`;
}

/**
 * A COMPRA.
 *
 * `event_id` é o que o TikTok usa pra deduplicar, e ele existe pelo mesmo
 * motivo que o `transaction_id` do Google: sem ele, um F5 na `/obrigado`
 * conta a venda de novo e infla o aprendizado da campanha.
 *
 * A escada de fallback é a mesma de `google-ads.ts`, e reusa a MESMA
 * referência guardada em `sessionStorage` pela tela do PIX. Duas escadas
 * paralelas sairiam de sincronia no primeiro conserto: o Google contaria uma
 * venda e o TikTok outra, e ninguém saberia qual está certa.
 *
 * Sem id, o campo é OMITIDO. É o mesmo raciocínio de lá: id vazio faz a
 * plataforma tratar todas as vendas como a mesma e descartar o resto, o que
 * erra pra baixo. Omitir erra pra cima, e errar pra cima aqui é bem melhor.
 */
export function compraTiktok(args: {
  valor?: number;
  moeda?: "BRL" | "USD";
  eventId?: string;
}) {
  if (typeof window === "undefined" || !window.ttq) return;
  const id = args.eventId?.trim() || undefined;
  window.ttq.track(
    "CompletePayment",
    {
      value: args.valor ?? 38,
      currency: args.moeda ?? "BRL",
      contents: [{ content_type: "product", content_name: "Musica personalizada" }],
    },
    ...(id ? [{ event_id: id }] : []),
  );
}

/** Chegou no checkout. Sinal intermediário, útil enquanto a venda é rara. */
export function checkoutTiktok(args: { valor?: number; moeda?: "BRL" | "USD" }) {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.track("InitiateCheckout", {
    value: args.valor ?? 38,
    currency: args.moeda ?? "BRL",
  });
}
