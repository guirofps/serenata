import { describe, expect, it } from "vitest";
import { ARTIGOS } from "@/conteudo/blog";
import { headDoArtigo, headDoIndice } from "./seo";
import { BLOG_SERENATA } from "./site";

// O motor do blog passou a servir dois sites (20/10). A Serenata não pode mudar
// por fora: o <head> de cada artigo e do índice fica congelado no snapshot
// gravado ANTES da troca.
describe("a Serenata sai igual depois do motor", () => {
  it.each(ARTIGOS.map((a) => [a.slug, a] as const))("artigo %s", (_s, a) => {
    expect(JSON.stringify(headDoArtigo(BLOG_SERENATA, a))).toMatchSnapshot();
  });
  it("índice", () => {
    expect(JSON.stringify(headDoIndice(BLOG_SERENATA))).toMatchSnapshot();
  });
});

describe("o motor com SiteBlog", () => {
  const base = { slug: "x", imagem: { alt: "a", prompt: "p" } };
  it("a Serenata é o /blog", async () => {
    const { BLOG_SERENATA } = await import("./site");
    expect(BLOG_SERENATA.prefixo).toBe("/blog");
  });
  it("o título leva a marca do site", async () => {
    const { BLOG_SERENATA } = await import("./site");
    const { tituloCompleto } = await import("./seo");
    expect(tituloCompleto(BLOG_SERENATA, { tituloSeo: "Algo" })).toBe("Algo | Serenata");
  });
  it("a imagem é o slug, ou o arquivo quando o artigo diz qual", async () => {
    const { BLOG_SERENATA } = await import("./site");
    const { imagemDoArtigo, imagemOgDoArtigo } = await import("./seo");
    expect(imagemDoArtigo(BLOG_SERENATA, base)).toBe("/img/blog/x.webp");
    expect(imagemDoArtigo(BLOG_SERENATA, { ...base, imagem: { ...base.imagem, arquivo: "y" } })).toBe("/img/blog/y.webp");
    expect(imagemOgDoArtigo(BLOG_SERENATA, { ...base, imagem: { ...base.imagem, arquivo: "y" } })).toBe("/img/blog/y-og.jpg");
  });
});
