// Os tipos do blog (spec docs/superpowers/specs/2026-10-02-blog-seo-design.md).

// "regalo" e "fe": os grupos do blog da Ballad em espanhol (20/10).
export type GrupoArtigo = "pessoa" | "ocasiao" | "gospel" | "guia" | "regalo" | "fe";

export type Artigo = {
  slug: string;
  /** A busca-alvo, minúscula. */
  palavraChave: string;
  grupo: GrupoArtigo;
  /** O H1. */
  titulo: string;
  /** O <title> sem o " | Serenata"; até 60 caracteres com ele. */
  tituloSeo: string;
  /** Meta description, 120 a 160 caracteres. */
  descricao: string;
  publicadoEm: string; // "AAAA-MM-DD"
  atualizadoEm: string;
  /**
   * O prompt do Higgsfield que gerou a foto, pra refazer igual. `arquivo` é o
   * nome em `public/img/blog/` quando não é o próprio slug (a Ballad reaproveita
   * as fotos da Serenata).
   */
  imagem: { alt: string; prompt: string; arquivo?: string };
  /** Slugs dos exemplos públicos tocados no corpo. */
  musicas: string[];
  /** O CTA vai pra /criar?t=gospel. */
  tema?: "gospel";
  relacionados: string[];
  faq: { q: string; a: string }[];
  /** Markdown restrito (`markdown.ts`). */
  corpo: string;
};

export type Inline =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrito"; texto: string }
  | { tipo: "italico"; texto: string }
  | { tipo: "link"; texto: string; href: string; interno: boolean };

export type Bloco =
  | { tipo: "h2"; texto: string; id: string }
  | { tipo: "h3"; texto: string }
  | { tipo: "p"; inline: Inline[] }
  | { tipo: "lista"; ordenada: boolean; itens: Inline[][] }
  | { tipo: "citacao"; linhas: string[] }
  | { tipo: "musica"; slug: string }
  | { tipo: "cta"; texto?: string };

/** O que um cartão de artigo precisa: sem o corpo, que pesa, e sem o prompt da imagem (vai pro HTML). */
export type ResumoArtigo = { slug: string; titulo: string; descricao: string; alt: string; arquivo?: string };

export function resumoDoArtigo(a: Artigo): ResumoArtigo {
  const r: ResumoArtigo = { slug: a.slug, titulo: a.titulo, descricao: a.descricao, alt: a.imagem.alt };
  if (a.imagem.arquivo) r.arquivo = a.imagem.arquivo;
  return r;
}
