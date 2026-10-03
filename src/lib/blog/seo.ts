// O <head> DO BLOG, em funções puras (spec §4): o teste lê exatamente o que
// a rota publica.

import type { Artigo } from "./tipos";

export const SITE = "https://www.serenatagift.com";
export const URL_BLOG = `${SITE}/blog`;
export const LARGURA_TOPO = 1600;
export const ALTURA_TOPO = 900;
export const LARGURA_OG = 1200;
export const ALTURA_OG = 630;

export const urlDoArtigo = (slug: string) => `${URL_BLOG}/${slug}`;
export const imagemDoArtigo = (slug: string) => `/img/blog/${slug}.webp`;
export const imagemOgDoArtigo = (slug: string) => `/img/blog/${slug}-og.jpg`;
export const tituloCompleto = (a: Pick<Artigo, "tituloSeo">) => `${a.tituloSeo} | Serenata`;

export function minutosDeLeitura(palavras: number): number {
  return Math.max(1, Math.round(palavras / 200));
}

/** "2026-10-02" → "02/10/2026". Sem `Date`: servidor e navegador escrevem igual. */
export function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const ORGANIZACAO = {
  "@type": "Organization",
  "@id": `${SITE}/#organizacao`,
  name: "Serenata",
  url: `${SITE}/`,
  logo: { "@type": "ImageObject", url: `${SITE}/img/logo-serenata.png` },
};

export function jsonLdDoArtigo(a: Artigo) {
  const url = urlDoArtigo(a.slug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: a.titulo,
        description: a.descricao,
        image: [`${SITE}${imagemDoArtigo(a.slug)}`, `${SITE}${imagemOgDoArtigo(a.slug)}`],
        datePublished: a.publicadoEm,
        dateModified: a.atualizadoEm,
        inLanguage: "pt-BR",
        author: ORGANIZACAO,
        publisher: ORGANIZACAO,
        mainEntityOfPage: url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: URL_BLOG },
          { "@type": "ListItem", position: 3, name: a.titulo, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: a.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

export function headDoArtigo(a: Artigo) {
  const titulo = tituloCompleto(a);
  const og = `${SITE}${imagemOgDoArtigo(a.slug)}`;
  return {
    meta: [
      { title: titulo },
      { name: "description", content: a.descricao },
      { property: "og:type", content: "article" },
      { property: "og:title", content: titulo },
      { property: "og:description", content: a.descricao },
      { property: "og:url", content: urlDoArtigo(a.slug) },
      { property: "og:image", content: og },
      { property: "og:image:width", content: String(LARGURA_OG) },
      { property: "og:image:height", content: String(ALTURA_OG) },
      { property: "og:site_name", content: "Serenata" },
      { property: "og:locale", content: "pt_BR" },
      { property: "article:published_time", content: a.publicadoEm },
      { property: "article:modified_time", content: a.atualizadoEm },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: og },
    ],
    links: [{ rel: "canonical", href: urlDoArtigo(a.slug) }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLdDoArtigo(a)) }],
  };
}

const TITULO_INDICE = "Blog: ideias de presente com música | Serenata";
const DESCRICAO_INDICE =
  "Ideias de presente que emocionam: como fazer uma música personalizada pra mãe, pai, namorada, avós, bodas, Natal e louvor, com exemplos reais pra ouvir.";

export function headDoIndice() {
  return {
    meta: [
      { title: TITULO_INDICE },
      { name: "description", content: DESCRICAO_INDICE },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITULO_INDICE },
      { property: "og:description", content: DESCRICAO_INDICE },
      { property: "og:url", content: URL_BLOG },
      { property: "og:site_name", content: "Serenata" },
    ],
    links: [{ rel: "canonical", href: URL_BLOG }],
  };
}
