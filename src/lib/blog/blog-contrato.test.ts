import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAUTA } from "@/conteudo/blog/pauta";

const ler = (f: string) => readFileSync(f, "utf8");

describe("rotas do blog", () => {
  const ROTAS = ["src/routes/blog.index.tsx", "src/routes/blog.$slug.tsx"];

  it("só existem na Serenata", () => {
    for (const r of ROTAS) expect(ler(r), r).toMatch(/chaveDaMarca\(\) !== "serenata"\) throw notFound\(\)/);
  });

  it("slug desconhecido é 404", () => {
    expect(ler("src/routes/blog.$slug.tsx")).toMatch(/if \(!artigo\) throw notFound\(\)/);
  });

  it("head sai das funções puras testadas", () => {
    expect(ler("src/routes/blog.$slug.tsx")).toMatch(/headDoArtigo\(/);
    expect(ler("src/routes/blog.index.tsx")).toMatch(/headDoIndice\(/);
  });
});

describe("componentes do blog", () => {
  it("nunca injetam HTML cru", () => {
    const arquivos = [
      ...readdirSync("src/components/blog").map((f) => `src/components/blog/${f}`),
      "src/routes/blog.index.tsx",
      "src/routes/blog.$slug.tsx",
    ];
    for (const f of arquivos) expect(ler(f), f).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("o CTA e o cabeçalho levam o tema gospel pro quiz", () => {
    expect(ler("src/components/blog/CtaCriar.tsx")).toMatch(/search=\{\{ t: "gospel" \}\}/);
    expect(ler("src/components/blog/LayoutBlog.tsx")).toMatch(/<BotaoCriar tema=\{tema\}/);
  });

  it("um <audio> só por artigo, sem baixar antes do play", () => {
    const corpo = ler("src/components/blog/CorpoArtigo.tsx");
    expect(corpo.match(/<audio/g)?.length).toBe(1);
    expect(corpo).toMatch(/preload="none"/);
  });
});

describe("indexação", () => {
  const sitemap = ler("public/sitemap.xml");

  it("o sitemap tem o /blog e os dez artigos, com lastmod", () => {
    expect(sitemap).toContain("<loc>https://www.serenatagift.com/blog</loc>");
    for (const s of PAUTA) {
      const bloco = sitemap.slice(sitemap.indexOf(`<loc>https://www.serenatagift.com/blog/${s}</loc>`));
      expect(bloco.indexOf("<loc>"), s).toBe(0);
      expect(bloco.slice(0, bloco.indexOf("</url>")), s).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    }
  });

  it("o robots libera o /blog", () => {
    expect(ler("public/robots.txt")).toMatch(/^Allow: \/blog$/m);
  });

  it("a home portuguesa e a página de esposa linkam o blog", () => {
    expect(ler("src/routes/index.tsx")).toMatch(/<Link to="\/blog"/);
    expect(ler("src/routes/musica-personalizada-para-esposa.tsx")).toMatch(/<Link to="\/blog"/);
  });
});
