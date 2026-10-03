import { describe, expect, it } from "vitest";
import { contarPalavras, idDoTitulo, normalizar, parsearCorpo, parsearInline } from "./markdown";

describe("parsearInline", () => {
  it("texto, negrito, itálico e links", () => {
    expect(parsearInline("Oi **forte** e *leve* [aqui](/criar) e [fora](https://g.co/x).")).toEqual([
      { tipo: "texto", texto: "Oi " },
      { tipo: "negrito", texto: "forte" },
      { tipo: "texto", texto: " e " },
      { tipo: "italico", texto: "leve" },
      { tipo: "texto", texto: " " },
      { tipo: "link", texto: "aqui", href: "/criar", interno: true },
      { tipo: "texto", texto: " e " },
      { tipo: "link", texto: "fora", href: "https://g.co/x", interno: false },
      { tipo: "texto", texto: "." },
    ]);
  });

  it("asterisco e colchete soltos ficam como texto", () => {
    expect(parsearInline("nota 5* hoje [sem link]")).toEqual([
      { tipo: "texto", texto: "nota 5* hoje [sem link]" },
    ]);
  });

  it("recusa link http e javascript", () => {
    expect(() => parsearInline("[x](http://a.com)")).toThrow(/link recusado/);
    expect(() => parsearInline("[x](javascript:alert(1))")).toThrow(/link recusado/);
  });
});

describe("parsearCorpo", () => {
  it("cada construção vira o bloco certo", () => {
    const corpo = `
Primeiro parágrafo
em duas linhas.

## O que contar

### Um detalhe

- um
- **dois**

1. primeiro
2. segundo

> Isabela, deixa eu te contar
> uma história

[[musica:isabela]]

[[cta]]

[[cta:Criar a música dela]]
`;
    expect(parsearCorpo(corpo)).toEqual([
      { tipo: "p", inline: [{ tipo: "texto", texto: "Primeiro parágrafo em duas linhas." }] },
      { tipo: "h2", texto: "O que contar", id: "o-que-contar" },
      { tipo: "h3", texto: "Um detalhe" },
      { tipo: "lista", ordenada: false, itens: [[{ tipo: "texto", texto: "um" }], [{ tipo: "negrito", texto: "dois" }]] },
      { tipo: "lista", ordenada: true, itens: [[{ tipo: "texto", texto: "primeiro" }], [{ tipo: "texto", texto: "segundo" }]] },
      { tipo: "citacao", linhas: ["Isabela, deixa eu te contar", "uma história"] },
      { tipo: "musica", slug: "isabela" },
      { tipo: "cta" },
      { tipo: "cta", texto: "Criar a música dela" },
    ]);
  });

  it("recusa HTML cru, H1, título colado em texto, bloco desconhecido e lista misturada", () => {
    expect(() => parsearCorpo("Oi <b>forte</b>")).toThrow(/HTML/);
    expect(() => parsearCorpo("# Título")).toThrow(/H1/);
    expect(() => parsearCorpo("## Título\ntexto colado")).toThrow(/linha em branco/);
    expect(() => parsearCorpo("#### Pequeno")).toThrow(/título não suportado/);
    expect(() => parsearCorpo("[[video:x]]")).toThrow(/bloco/);
    expect(() => parsearCorpo("[[musica]]")).toThrow(/bloco/);
    expect(() => parsearCorpo("- um\ndois")).toThrow(/misturad/);
  });
});

describe("utilitários", () => {
  it("normaliza acento e caixa", () => {
    expect(normalizar("Música Para MÃE")).toBe("musica para mae");
  });
  it("id do título é kebab sem acento", () => {
    expect(idDoTitulo("Qual estilo combina com ela?")).toBe("qual-estilo-combina-com-ela");
  });
  it("conta palavras de texto, títulos, listas e citações, sem contar blocos", () => {
    expect(contarPalavras(parsearCorpo("Um dois três.\n\n## Quatro cinco\n\n- seis\n\n> sete oito\n\n[[cta]]"))).toBe(8);
  });
});
