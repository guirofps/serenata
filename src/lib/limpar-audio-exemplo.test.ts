import { describe, it, expect } from "vitest";
import { ehExemplo, TOKENS_EXEMPLO } from "./token-exemplo";
import { EXEMPLOS_PT } from "./exemplos-pt";
import { EXEMPLOS_EN } from "./exemplos-en";

// Exemplo nunca entra na limpeza de áudio (`limparAudioAntigo`). Duas levas
// de estrago: os de token `ex…` (18 e 26/09, achado em 02/10) e sete músicas
// reais promovidas a exemplo, de token comum (12 a 16/09, achado em 07/10).
describe("a limpeza de áudio nunca toca exemplo", () => {
  it("reconhece os tokens `ex…` das três marcas e dos criativos", () => {
    for (const t of ["expai51378356a9", "exesmama651ba4fe", "exenwife3b4f983682", "excriativo3f9a1c2b7d"]) {
      expect(ehExemplo(t)).toBe(true);
    }
  });

  it("os sete exemplos de token comum que a limpeza apagou em setembro", () => {
    for (const t of [
      "533db522753f423e8b2227", // eva
      "2459f4b76e1b49c58be203", // denise
      "9296e7e9b5c2460faadd64", // rose
      "e406f9b4356f4a5a9e7d8e", // isabela
      "7b89d2ed634646c4b1ee95", // camburi
      "5c980fdd76344b0c81e4e1", // garga
      "7efe7bb4304d4790954603", // li
    ]) expect(ehExemplo(t)).toBe(true);
  });

  it("todo token das listas publicadas (Serenata e Ballad) é exemplo", () => {
    const tokens = [...EXEMPLOS_PT, ...EXEMPLOS_EN].map((e) => e.token).filter(Boolean);
    expect(tokens.length).toBeGreaterThanOrEqual(EXEMPLOS_PT.length);
    for (const t of tokens) {
      expect(TOKENS_EXEMPLO.has(t)).toBe(true);
      expect(ehExemplo(t)).toBe(true);
    }
  });

  it("token de cliente (hexadecimal) nunca é exemplo", () => {
    for (const t of ["7c29a95dd1684ed6b2f5db", "e8bf334a96044b469d6cbc", "", null, undefined]) {
      expect(ehExemplo(t)).toBe(false);
    }
  });

  it("token vazio de exemplo ainda não gerado não entra na lista", () => {
    expect(TOKENS_EXEMPLO.has("")).toBe(false);
  });
});
