import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
