// O <head> DO BLOG, em funções puras (spec §4): o teste lê exatamente o que
// a rota publica. Cada função recebe o site (`site.ts`): o mesmo motor serve a
// Serenata e a Ballad em espanhol.

import type { SiteBlog } from "./site";
import type { Artigo } from "./tipos";

export { dataBr } from "./site";

export const LARGURA_TOPO = 1600;
export const ALTURA_TOPO = 900;
export const LARGURA_OG = 1200;
export const ALTURA_OG = 630;

type ComImagem = Pick<Artigo, "slug" | "imagem">;

export const urlDoBlog = (site: SiteBlog) => `${site.origem}${site.prefixo}`;
export const urlDoArtigo = (site: SiteBlog, slug: string) => `${urlDoBlog(site)}/${slug}`;
export const imagemDoArtigo = (_site: SiteBlog, a: ComImagem) => `/img/blog/${a.imagem.arquivo ?? a.slug}.webp`;
export const imagemOgDoArtigo = (_site: SiteBlog, a: ComImagem) => `/img/blog/${a.imagem.arquivo ?? a.slug}-og.jpg`;
export const tituloCompleto = (site: SiteBlog, a: Pick<Artigo, "tituloSeo">) => `${a.tituloSeo}${site.sufixo}`;

export function minutosDeLeitura(palavras: number): number {
  return Math.max(1, Math.round(palavras / 200));
}

function organizacao(site: SiteBlog) {
  return {
    "@type": "Organization",
    "@id": `${site.origem}/#organizacao`,
    name: site.marca,
    url: `${site.origem}/`,
    logo: { "@type": "ImageObject", url: `${site.origem}${site.logo}` },
  };
}

export function jsonLdDoArtigo(site: SiteBlog, a: Artigo) {
  const url = urlDoArtigo(site, a.slug);
  const org = organizacao(site);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: a.titulo,
        description: a.descricao,
        image: [`${site.origem}${imagemDoArtigo(site, a)}`, `${site.origem}${imagemOgDoArtigo(site, a)}`],
        datePublished: a.publicadoEm,
        dateModified: a.atualizadoEm,
        inLanguage: site.inLanguage,
        author: org,
        publisher: org,
        mainEntityOfPage: url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.textos.artigo.inicio, item: `${site.origem}${site.textos.layout.inicio}` },
          { "@type": "ListItem", position: 2, name: site.textos.artigo.blog, item: urlDoBlog(site) },
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

export function headDoArtigo(site: SiteBlog, a: Artigo) {
  const titulo = tituloCompleto(site, a);
  const og = `${site.origem}${imagemOgDoArtigo(site, a)}`;
  return {
    meta: [
      { title: titulo },
      { name: "description", content: a.descricao },
      { property: "og:type", content: "article" },
      { property: "og:title", content: titulo },
      { property: "og:description", content: a.descricao },
      { property: "og:url", content: urlDoArtigo(site, a.slug) },
      { property: "og:image", content: og },
      { property: "og:image:width", content: String(LARGURA_OG) },
      { property: "og:image:height", content: String(ALTURA_OG) },
      { property: "og:site_name", content: site.marca },
      { property: "og:locale", content: site.ogLocale },
      { property: "article:published_time", content: a.publicadoEm },
      { property: "article:modified_time", content: a.atualizadoEm },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: og },
    ],
    links: [{ rel: "canonical", href: urlDoArtigo(site, a.slug) }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLdDoArtigo(site, a)) }],
  };
}

export function headDoIndice(site: SiteBlog) {
  const { titulo, descricao } = site.textos.indice;
  return {
    meta: [
      { title: titulo },
      { name: "description", content: descricao },
      { property: "og:type", content: "website" },
      { property: "og:title", content: titulo },
      { property: "og:description", content: descricao },
      { property: "og:url", content: urlDoBlog(site) },
      { property: "og:site_name", content: site.marca },
    ],
    links: [{ rel: "canonical", href: urlDoBlog(site) }],
  };
}
