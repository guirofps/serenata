import { describe, expect, it } from "vitest";
import { separarCupomDaUrl } from "./cupom-url";

describe("separarCupomDaUrl", () => {
  it("tira o cupom e mantém as UTMs", () => {
    const r = separarCupomDaUrl("https://serenatagift.com/criar?cupom=musica10&utm_source=email");
    expect(r.cupom).toBe("MUSICA10");
    expect(r.semCupom).toBe("https://serenatagift.com/criar?utm_source=email");
  });
  it("sem cupom na URL, não mexe em nada", () => {
    expect(separarCupomDaUrl("https://serenatagift.com/criar?step=oferta")).toEqual({ cupom: null, semCupom: null });
  });
  it("lixo vira nada, mas sai da URL igual", () => {
    const r = separarCupomDaUrl("https://serenatagift.com/?cupom=%3Cscript%3E");
    expect(r.cupom).toBe("SCRIPT");
    const vazio = separarCupomDaUrl("https://serenatagift.com/?cupom=%20");
    expect(vazio.cupom).toBeNull();
    expect(vazio.semCupom).toBe("https://serenatagift.com/");
  });
});
