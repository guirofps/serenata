import { type Locale, MOEDA } from "@/lib/i18n";
import { MARCA } from "@/lib/marca";

// O QUE FALTAVA DE SEO TÉCNICO, num lugar só.
//
// Auditado em 13/08 contra o site no ar: não existia robots.txt, não existia
// sitemap, e nenhuma página tinha canonical, hreflang, og:image ou dados
// estruturados. O site renderiza no servidor e os títulos são bons, então a
// base estava de pé — faltava tudo que diz ao Google COMO ler o que já existe.
//
// O item mais caro da lista é o hreflang. A gente tem duas homes irmãs, uma em
// português e uma em espanhol, vendendo a mesma coisa. Sem declarar que são
// versões de idioma da mesma página, elas competem entre si e o Google escolhe
// uma — normalmente a errada para metade do público.

const SITE = "https://www.serenatagift.com";

const URLS: Record<Locale, { home: string; criar: string }> = {
  pt: { home: `${SITE}/`, criar: `${SITE}/criar` },
  es: { home: `${SITE}/es`, criar: `${SITE}/es/criar` },
};

/** Canonical + o par de idiomas. Vai no `links` do head da rota. */
export function linksDeIdioma(locale: Locale, pagina: "home" | "criar" = "home") {
  return [
    { rel: "canonical", href: URLS[locale][pagina] },
    { rel: "alternate", hrefLang: "pt-BR", href: URLS.pt[pagina] },
    { rel: "alternate", hrefLang: "es", href: URLS.es[pagina] },
    // Quem chega de um idioma que a gente não fala cai no português, que é
    // onde o negócio realmente está.
    { rel: "alternate", hrefLang: "x-default", href: URLS.pt[pagina] },
  ];
}

/**
 * A imagem que aparece quando alguém compartilha a home.
 *
 * Existia só na página-presente. Compartilhar a home no WhatsApp caía no
 * ícone do site, que é o mesmo problema que a gente já tinha corrigido lá em
 * 01/08 do outro lado e nunca trouxe pra cá.
 */
export const METATAGS_COMPARTILHAR = [
  { property: "og:image", content: `${SITE}/og-presente.jpg` },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "1200" },
  { property: "og:site_name", content: MARCA.nome },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: `${SITE}/og-presente.jpg` },
];

/**
 * Dados estruturados do produto.
 *
 * Não é enfeite: é o que permite o Google mostrar preço e avaliação no
 * resultado, e é o formato em que os assistentes de IA leem o que a gente
 * vende. Preço declarado igual ao real, sem inventar nota de avaliação que a
 * gente não coleta — schema com dado falso vira penalidade, não enfeite.
 */
export function dadosEstruturados(locale: Locale) {
  const es = locale === "es";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: es ? "Canción personalizada + página regalo" : "Música personalizada + página presente",
    description: es
      ? "Cuenta la historia de alguien que quieres y recibe la letra al instante, gratis. La canción cantada llega en una página lista para enviar, con karaoke, fotos y código QR."
      : "Conte a história de alguém querido e receba a letra na hora, de graça. A música cantada chega numa página pronta pra enviar, com karaokê, fotos e QR Code.",
    brand: { "@type": "Brand", name: MARCA.nome },
    url: URLS[locale].home,
    image: `${SITE}/og-presente.jpg`,
    offers: {
      "@type": "Offer",
      // O preço sai do catálogo de moeda, nunca cravado aqui. Já ficou pra
      // trás uma vez: o site subiu pra US$ 9,90 e este bloco seguiu anunciando
      // 9.00 pro Google, que é o número que aparece no resultado de busca.
      price: MOEDA[locale].valor.toFixed(2),
      priceCurrency: es ? "USD" : "BRL",
      availability: "https://schema.org/InStock",
      url: URLS[locale].criar,
    },
  };
}
