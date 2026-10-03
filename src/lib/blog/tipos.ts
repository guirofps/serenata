// Os tipos do blog (spec docs/superpowers/specs/2026-10-02-blog-seo-design.md).

export type GrupoArtigo = "pessoa" | "ocasiao" | "gospel" | "guia";

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
  /** O prompt do Higgsfield que gerou a foto, pra refazer igual. */
  imagem: { alt: string; prompt: string };
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
