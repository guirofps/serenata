import { describe, expect, it } from "vitest";
import type { Artigo } from "./tipos";
import { problemasDoArtigo } from "./validar";

const ctx = {
  slugsPauta: new Set(["musica-personalizada-para-mae", "musica-personalizada-para-pai", "homenagem-para-avo"]),
  slugsExemplos: new Set(["eva", "antonio"]),
};

const palavras = (n: number) => Array.from({ length: n }, () => "palavra").join(" ");

function valido(): Artigo {
  return {
    slug: "musica-personalizada-para-mae",
    palavraChave: "música personalizada para mãe",
    grupo: "pessoa",
    titulo: "Música personalizada para mãe: um presente feito da história dela",
    tituloSeo: "Música personalizada para mãe: como fazer",
    descricao: "x".repeat(140),
    publicadoEm: "2026-10-02",
    atualizadoEm: "2026-10-02",
    imagem: { alt: "Mãe ouvindo música no fone", prompt: "photo" },
    musicas: ["eva"],
    relacionados: ["musica-personalizada-para-pai", "homenagem-para-avo"],
    faq: [
      { q: "A?", a: "a" },
      { q: "B?", a: "b" },
      { q: "C?", a: "c" },
    ],
    corpo: `Uma música personalizada para mãe nasce da história dela. ${palavras(950)}

## O que contar

[[musica:eva]]

Veja [como criar](/criar) e [o pai](/blog/musica-personalizada-para-pai).

[[cta]]`,
  };
}

const com = (mudar: Partial<Artigo>) => problemasDoArtigo({ ...valido(), ...mudar }, ctx);

describe("problemasDoArtigo", () => {
  it("artigo válido não tem problema", () => {
    expect(problemasDoArtigo(valido(), ctx)).toEqual([]);
  });

  it("slug fora de kebab-case", () => {
    expect(com({ slug: "Musica_Mae" }).join()).toMatch(/slug/);
  });

  it("título de SEO passando de 60 com o sufixo", () => {
    expect(com({ tituloSeo: "Música personalizada para mãe: o guia completo de hoje" }).join()).toMatch(/tituloSeo/);
  });

  it("descrição fora de 120 a 160", () => {
    expect(com({ descricao: "curta" }).join()).toMatch(/descricao/);
    expect(com({ descricao: "x".repeat(161) }).join()).toMatch(/descricao/);
  });

  it("palavra-chave ausente do título, do título de SEO ou do primeiro parágrafo", () => {
    expect(com({ titulo: "Um presente pra ela" }).join()).toMatch(/palavraChave.*titulo/);
    expect(com({ tituloSeo: "Presente pra ela" }).join()).toMatch(/palavraChave.*tituloSeo/);
    expect(com({ corpo: valido().corpo.replace("Uma música personalizada para mãe", "Um presente") }).join()).toMatch(
      /primeiro parágrafo/,
    );
  });

  it("corpo curto ou longo demais", () => {
    expect(com({ corpo: valido().corpo.replace(palavras(950), "curto") }).join()).toMatch(/palavras/);
    expect(com({ corpo: valido().corpo.replace(palavras(950), palavras(2100)) }).join()).toMatch(/palavras/);
  });

  it("sem ##, sem música ou sem cta", () => {
    expect(com({ corpo: valido().corpo.replace("## O que contar", "O que contar") }).join()).toMatch(/##/);
    expect(com({ corpo: valido().corpo.replace("[[musica:eva]]", "") }).join()).toMatch(/musica/);
    expect(com({ corpo: valido().corpo.replace("[[cta]]", "") }).join()).toMatch(/cta/);
  });

  it("música que não é exemplo público, ou fora da lista `musicas`", () => {
    expect(com({ musicas: ["nao-existe"], corpo: valido().corpo.replace("eva]]", "nao-existe]]") }).join()).toMatch(
      /exemplo/,
    );
    expect(com({ musicas: ["eva", "antonio"] }).join()).toMatch(/musicas/);
  });

  it("relacionados: quantidade, existência e o próprio", () => {
    expect(com({ relacionados: ["musica-personalizada-para-pai"] }).join()).toMatch(/relacionados/);
    expect(com({ relacionados: ["musica-personalizada-para-pai", "fantasma"] }).join()).toMatch(/relacionados/);
    expect(com({ relacionados: ["musica-personalizada-para-pai", "musica-personalizada-para-mae"] }).join()).toMatch(
      /relacionados/,
    );
  });

  it("FAQ fora de 3 a 5", () => {
    expect(com({ faq: [{ q: "A?", a: "a" }] }).join()).toMatch(/faq/);
  });

  it("link interno pra rota que não existe", () => {
    expect(com({ corpo: valido().corpo.replace("(/criar)", "(/precos)") }).join()).toMatch(/link/);
    expect(com({ corpo: valido().corpo.replace("(/criar)", "(/criar?t=gospel)") })).toEqual([]);
  });

  it("preço em qualquer texto", () => {
    expect(com({ descricao: `Custa R$ 38 ${"x".repeat(130)}` }).join()).toMatch(/preço/);
    expect(com({ faq: [...valido().faq, { q: "Quanto?", a: "R$38" }] }).join()).toMatch(/preço/);
  });

  it("promessa proibida", () => {
    expect(com({ corpo: `${valido().corpo}\n\nPronta em 60 segundos.` }).join()).toMatch(/proibid/);
  });

  it("corpo que não parseia vira problema, não exceção", () => {
    expect(com({ corpo: "<b>oi</b>" }).join()).toMatch(/corpo/);
  });

  it("datas fora do formato ou atualização antes da publicação", () => {
    expect(com({ publicadoEm: "02/10/2026" }).join()).toMatch(/data/);
    expect(com({ atualizadoEm: "2026-10-01" }).join()).toMatch(/data/);
  });
});
