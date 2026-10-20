import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// O blog da Ballad em espanhol (spec 2026-10-20-blog-ballad-es-design.md).
const ler = (f: string) => readFileSync(f, "utf8");
const ROTAS = ["src/routes/es.blog.index.tsx", "src/routes/es.blog.$slug.tsx"];

describe("rotas do blog em espanhol", () => {
  it("só existem na Ballad (a Serenata tem /es, o funil argentino)", () => {
    for (const r of ROTAS) expect(ler(r), r).toMatch(/chaveDaMarca\(\) !== "ballad"\) throw notFound\(\)/);
  });

  it("slug desconhecido é 404", () => {
    expect(ler("src/routes/es.blog.$slug.tsx")).toMatch(/if \(!artigo\) throw notFound\(\)/);
  });

  it("o conteúdo entra por import() no loader, nunca no pacote de entrada", () => {
    for (const r of ROTAS) {
      expect(ler(r), r).not.toMatch(/^import [^;]*from "@\/conteudo\/blog-es";/m);
      expect(ler(r), r).toMatch(/await import\("@\/conteudo\/blog-es"\)/);
    }
  });

  it("nunca injetam HTML cru", () => {
    for (const r of ROTAS) expect(ler(r), r).not.toMatch(/dangerouslySetInnerHTML/);
  });
});

describe("indexação da Ballad", () => {
  it("o robots libera o /es/blog", () => {
    expect(ler("public/ballad/robots.txt")).toMatch(/^Allow: \/es\/blog$/m);
  });

  it("o sitemap tem o /es/blog", () => {
    expect(ler("public/ballad/sitemap.xml")).toContain("<loc>https://www.balladgift.com/es/blog</loc>");
  });

  it("a home /es linka o blog só na Ballad", () => {
    const home = ler("src/routes/es.index.tsx");
    const i = home.indexOf('<Link to="/es/blog"');
    expect(i).toBeGreaterThan(-1);
    expect(home.lastIndexOf("{BALLAD && (", i)).toBeGreaterThan(home.lastIndexOf("</footer>", i));
    expect(home.lastIndexOf("<footer", i)).toBeGreaterThan(-1);
  });
});
