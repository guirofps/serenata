import { describe, expect, it } from "vitest";
import type { Artigo } from "./tipos";
import { dataBr, headDoArtigo, headDoIndice, minutosDeLeitura, tituloCompleto } from "./seo";

const a: Artigo = {
  slug: "musica-personalizada-para-mae",
  palavraChave: "música personalizada para mãe",
  grupo: "pessoa",
  titulo: "Música personalizada para mãe: um presente feito da história dela",
  tituloSeo: "Música personalizada para mãe: como fazer",
  descricao: "Descrição.",
  publicadoEm: "2026-10-02",
  atualizadoEm: "2026-10-03",
  imagem: { alt: "alt", prompt: "p" },
  musicas: ["eva"],
  relacionados: [],
  faq: [{ q: "A letra é de graça?", a: "Sim." }],
  corpo: "",
};

const meta = (h: ReturnType<typeof headDoArtigo>, chave: string) =>
  h.meta.find((m) => ("property" in m && m.property === chave) || ("name" in m && m.name === chave));

describe("headDoArtigo", () => {
  const h = headDoArtigo(a);

  it("título com a marca e no máximo 60 caracteres", () => {
    expect(tituloCompleto(a)).toBe("Música personalizada para mãe: como fazer | Serenata");
    expect(h.meta[0]).toEqual({ title: tituloCompleto(a) });
    expect(tituloCompleto(a).length).toBeLessThanOrEqual(60);
  });

  it("canonical e og:image absolutos", () => {
    expect(h.links).toContainEqual({
      rel: "canonical",
      href: "https://www.serenatagift.com/blog/musica-personalizada-para-mae",
    });
    expect(meta(h, "og:image")).toMatchObject({
      content: "https://www.serenatagift.com/img/blog/musica-personalizada-para-mae-og.jpg",
    });
    expect(meta(h, "og:type")).toMatchObject({ content: "article" });
    expect(meta(h, "article:modified_time")).toMatchObject({ content: "2026-10-03" });
  });

  it("JSON-LD com Article, BreadcrumbList e FAQPage", () => {
    const ld = JSON.parse(h.scripts[0].children);
    const tipos = ld["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(tipos).toEqual(["Article", "BreadcrumbList", "FAQPage"]);
    const artigo = ld["@graph"][0];
    expect(artigo.headline).toBe(a.titulo);
    expect(artigo.dateModified).toBe("2026-10-03");
    expect(ld["@graph"][2].mainEntity[0].name).toBe("A letra é de graça?");
    expect(ld["@graph"][1].itemListElement.map((i: { name: string }) => i.name)).toEqual(["Início", "Blog", a.titulo]);
  });
});

describe("headDoIndice", () => {
  it("canonical do /blog e título até 60", () => {
    const h = headDoIndice();
    expect(h.links).toContainEqual({ rel: "canonical", href: "https://www.serenatagift.com/blog" });
    expect((h.meta[0] as { title: string }).title.length).toBeLessThanOrEqual(60);
  });
});

describe("utilitários", () => {
  it("data em dd/mm/aaaa sem passar por Date (sem fuso, sem hidratação divergente)", () => {
    expect(dataBr("2026-10-02")).toBe("02/10/2026");
  });
  it("minutos de leitura a 200 palavras por minuto, mínimo 1", () => {
    expect(minutosDeLeitura(1400)).toBe(7);
    expect(minutosDeLeitura(50)).toBe(1);
  });
});
