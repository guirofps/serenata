import { getOrCreateSessionId } from "@/lib/session-context";
import { type Locale, LOCALE_PADRAO } from "@/lib/i18n";

// Ida pro CHECKOUT (Perfect Pay).
//
// Duas coisas viajam com o comprador e não podem faltar:
//
// 1. `src` = o session_id do nosso funil. A Perfect Pay ecoa isso de volta no
//    webhook como `metadata.src`, e é ASSIM que o pagamento é casado com a
//    música certa. Sem ele, sobra casar por e-mail (que a pessoa pode digitar
//    diferente no checkout) — e o webhook não tem fallback de adivinhação, de
//    propósito.
//
// 2. Os UTMs. O script da Utmify captura na visita e guarda em
//    `localStorage.utmify_data`; como a ida ao checkout é por JavaScript (e
//    não um <a> que o script reescreve), o repasse é feito aqui na mão. Três
//    fontes, em ordem de confiança: store da Utmify, a URL atual, e a nossa
//    captura first-touch.

// Um produto por idioma na Perfect Pay: o brasileiro cobra R$ 37 no PIX ou
// cartão, o internacional cobra em dólar. Mesmo gateway, mesmo webhook, IDs
// diferentes — e é o `src` (nosso session_id) que casa o pagamento com a
// música, não o produto.
const CHECKOUT: Record<Locale, string> = {
  pt: "https://go.perfectpay.com.br/PPU38CQER4D",
  es: "https://go.centerpag.com/PPU38CQF4HJ",
};

/** Compat: código que não conhece idioma continua indo pro produto BR. */
export const CHECKOUT_URL = CHECKOUT.pt;

const PARAMS_RASTREIO = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "gclid",
  "fbclid",
  "src",
  "sck",
] as const;

function leJson(chave: string): Record<string, unknown> | null {
  try {
    const cru = localStorage.getItem(chave);
    return cru ? (JSON.parse(cru) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Monta a URL do checkout com sessão e UTMs. */
export function urlCheckout(extra?: {
  email?: string;
  telefone?: string;
  cupom?: string;
  locale?: Locale;
}): string {
  const p = new URLSearchParams();

  // A ponte com o webhook.
  p.set("src", getOrCreateSessionId());

  // IDIOMA DO CHECKOUT.
  //
  // O produto internacional abre em INGLÊS por padrão. A pessoa fazia o funil
  // inteiro em espanhol, clicava em comprar, e caía numa tela pedindo "Your
  // full name" e "Email address". Em 09/08 foram 9 cliques em comprar no funil
  // espanhol e zero vendas; em três dias, 507 leads espanhóis e UMA venda.
  //
  // `?lang=es` vira "DATOS PERSONALES / Nombre completo / Correo electrónico".
  // Conferido abrindo o checkout de verdade, não pela documentação.
  //
  // Só no espanhol: o produto BR já abre em português, e mandar `lang` pra ele
  // é parâmetro a mais sem efeito conhecido — não se mexe no que está vendendo.
  const locale = extra?.locale ?? LOCALE_PADRAO;
  if (locale === "es") p.set("lang", "es");

  // Só o e-mail é pré-preenchido. O NOME não: o único nome que temos é o do
  // HOMENAGEADO (quem vai receber a música), e mandá-lo aqui fazia o gateway
  // registrar "Cliente: Zé" quando quem comprava era a esposa dele. Nome
  // errado no pedido atrapalha suporte, nota e conciliação — melhor a pessoa
  // digitar o dela.
  if (extra?.email) p.set("email", extra.email);

  // O TELEFONE, quando ela deixou na tela de espera, é DELA (não do
  // homenageado) — foi digitado pra receber o aviso da música. Conferido
  // abrindo o checkout de verdade: `?phone=` cai no campo Telefone já
  // formatado. É um campo a menos num formulário onde a gente perde muita
  // gente: em 7 dias, 223 sessões clicaram em comprar e só 86 geraram pedido.
  if (extra?.telefone) p.set("phone", extra.telefone);

  // CUPOM já aplicado. Conferido abrindo os dois checkouts de verdade: `?ppc=`
  // aplica sozinho e a tela mostra "Cupom SRN27 aplicado com sucesso". Sem
  // isso a pessoa teria que achar o campo "Adicionar Cupom", que fica
  // escondido atrás de um passo — e cada campo escondido é gente perdida.
  if (extra?.cupom) p.set("ppc", extra.cupom);

  if (typeof window !== "undefined") {
    const daUrl: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => (daUrl[k] = v));
    // AS CHAVES DA UTMIFY, uma por uma.
    //
    // `utmify_data` NUNCA EXISTIU. Conferido no navegador em 19/08: a UTMify
    // guarda `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` e
    // `utm_term` como chaves SEPARADAS no localStorage, não num JSON. A
    // primeira fonte desta lista era código morto desde que foi escrita.
    //
    // Isso não aparecia porque a atribuição vinha de carona: o script da
    // UTMify reescreve os links internos com os UTMs, então `daUrl` acabava
    // achando o que a fonte morta deveria ter dado. Um acidente que funciona é
    // um acidente que quebra sozinho um dia, e agora que o script carrega
    // depois da hidratação, a carona ficou mais frágil ainda.
    //
    // Lendo as chaves de verdade, a atribuição para de depender disso.
    const daUtmify: Record<string, string> = {};
    for (const chave of PARAMS_RASTREIO) {
      const v = window.localStorage.getItem(chave);
      if (v) daUtmify[chave] = v;
    }

    const fontes = [daUrl, daUtmify, leJson("mp_attribution")].filter(
      Boolean,
    ) as Array<Record<string, unknown>>;

    for (const chave of PARAMS_RASTREIO) {
      if (p.has(chave)) continue; // `src` já foi
      for (const f of fontes) {
        const v = f[chave];
        if (v) {
          p.set(chave, String(v));
          break;
        }
      }
    }
  }

  return `${CHECKOUT[locale] ?? CHECKOUT.pt}?${p.toString()}`;
}

/** Leva pro checkout. */
export function irParaCheckout(extra?: {
  email?: string;
  telefone?: string;
  cupom?: string;
  locale?: Locale;
}) {
  window.location.href = urlCheckout(extra);
}
