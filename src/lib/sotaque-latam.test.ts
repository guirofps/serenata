import { describe, expect, it } from "vitest";
import { sotaqueDaMusica, sotaqueLigado } from "./sotaque-latam";
import { ehGeneroLatamNeutro, estiloParaSuno } from "./generos";

const VIVO = { ativo: true, variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 1 }] };
const comB = { exp: { sotaque_latam: "B" } };

describe("sotaque_latam: braço", () => {
  it("só B vivo liga", () => {
    expect(sotaqueLigado(comB, VIVO)).toBe(true);
    expect(sotaqueLigado({ exp: { sotaque_latam: "A" } }, VIVO)).toBe(false);
    expect(sotaqueLigado({}, VIVO)).toBe(false);
    expect(sotaqueLigado(comB, { ...VIVO, ativo: false })).toBe(false);
    expect(sotaqueLigado(comB, { ativo: true, variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 0 }] })).toBe(false);
    expect(sotaqueLigado(comB, null)).toBe(false);
  });
  it("só Colômbia, Chile e Peru, e só gênero neutro", () => {
    expect(sotaqueDaMusica({ pais: "CO", generoNeutro: true, attribution: comB, linha: VIVO })).toBe("acento colombiano");
    expect(sotaqueDaMusica({ pais: "cl", generoNeutro: true, attribution: comB, linha: VIVO })).toBe("acento chileno");
    expect(sotaqueDaMusica({ pais: "PE", generoNeutro: true, attribution: comB, linha: VIVO })).toBe("acento peruano");
    for (const pais of ["MX", "US", "ES", "AR", null]) expect(sotaqueDaMusica({ pais, generoNeutro: true, attribution: comB, linha: VIVO })).toBeNull();
    expect(sotaqueDaMusica({ pais: "CO", generoNeutro: false, attribution: comB, linha: VIVO })).toBeNull();
    expect(sotaqueDaMusica({ pais: "CO", generoNeutro: true, attribution: {}, linha: VIVO })).toBeNull();
  });
});

describe("sotaque_latam: estilo do Suno", () => {
  it("o sotaque entra logo depois do texto curado e o A fica igual", () => {
    const a = estiloParaSuno({ genero: "vallenato", voz: "masculina" });
    const b = estiloParaSuno({ genero: "vallenato", voz: "masculina", sotaque: "acento colombiano" });
    expect(b).toBe(a.replace(", voz masculina", ", acento colombiano, voz masculina"));
    expect(estiloParaSuno({ genero: "vallenato", voz: "masculina", sotaque: null })).toBe(a);
    expect(b.length).toBeLessThanOrEqual(190);
  });
  it("lista neutra: vallenato sim; gênero de outra língua não", () => {
    expect(ehGeneroLatamNeutro("vallenato")).toBe(true);
    expect(ehGeneroLatamNeutro("sertanejo")).toBe(false);
    expect(ehGeneroLatamNeutro(null)).toBe(false);
  });
});
