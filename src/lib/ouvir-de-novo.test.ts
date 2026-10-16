import { describe, expect, it } from "vitest";
import { ouvirDeNovoLigado } from "@/lib/ouvir-de-novo";

describe("ouvir_de_novo: quando o botão existe", () => {
  it("só no B, só no pt, nunca no modo completo", () => {
    expect(ouvirDeNovoLigado("B", "pt", false)).toBe(true);
    expect(ouvirDeNovoLigado("b2", "pt", false)).toBe(true);
    expect(ouvirDeNovoLigado("A", "pt", false)).toBe(false);
    expect(ouvirDeNovoLigado("fora", "pt", false)).toBe(false);
    expect(ouvirDeNovoLigado(undefined, "pt", false)).toBe(false);
    expect(ouvirDeNovoLigado("B", "es", false)).toBe(false);
    expect(ouvirDeNovoLigado("B", "en", false)).toBe(false);
    expect(ouvirDeNovoLigado("B", "pt", true)).toBe(false);
  });
});
