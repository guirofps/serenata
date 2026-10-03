import { describe, expect, it } from "vitest";
import { ABAS_EXEMPLOS, EXEMPLOS_PT, capaDoExemplo, exemploPorSlug } from "./exemplos-pt";

describe("exemplos públicos", () => {
  it("os onze exemplos da home, sem slug repetido", () => {
    const slugs = EXEMPLOS_PT.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.sort()).toEqual(
      ["antonio", "bianca", "camburi", "denise", "eva", "garga", "isabela", "joaquim", "li", "rose", "theo"].sort(),
    );
  });

  it("acha pelo slug e devolve undefined pro que não existe", () => {
    expect(exemploPorSlug("eva")?.titulo).toBe("Domingo na Casa da Eva");
    expect(exemploPorSlug("nao-existe")).toBeUndefined();
  });

  it("a capa sai versionada, igual à home", () => {
    expect(capaDoExemplo(exemploPorSlug("rose")!)).toBe("/img/exemplos/avo.webp?v=2");
  });

  it("as abas da home continuam na mesma ordem", () => {
    expect(ABAS_EXEMPLOS.map((a) => a.chave)).toEqual([
      "pai", "mae", "avos", "filhos", "namorados", "esposa", "marido", "amiga",
    ]);
  });
});
