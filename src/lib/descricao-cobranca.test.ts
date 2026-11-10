import { describe, expect, it } from "vitest";
import { descricaoCobrancaMusica } from "./descricao-cobranca";

describe("descricaoCobrancaMusica", () => {
  it("leva o título e o caminho de volta", () => {
    expect(descricaoCobrancaMusica("Três Vezes Coragem")).toBe(
      "Serenata · Três Vezes Coragem · ouça em serenatagift.com/login",
    );
  });
  it("sem título vira 'sua música'", () => {
    expect(descricaoCobrancaMusica(null)).toBe("Serenata · sua música · ouça em serenatagift.com/login");
    expect(descricaoCobrancaMusica("  ")).toBe("Serenata · sua música · ouça em serenatagift.com/login");
  });
  it("título longo é cortado e o caminho de volta cabe nos 140 da Woovi", () => {
    const d = descricaoCobrancaMusica("x".repeat(300));
    expect(d.length).toBeLessThanOrEqual(140);
    expect(d.endsWith("ouça em serenatagift.com/login")).toBe(true);
  });
});
