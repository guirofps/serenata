import { describe, expect, it } from "vitest";
import { emailDaCaixa, pixVolteLigado } from "./pix-volte";

describe("pix_volte", () => {
  it("só o B do funil pt liga", () => {
    expect(pixVolteLigado("B", "pt")).toBe(true);
    expect(pixVolteLigado("b", "pt")).toBe(true);
    expect(pixVolteLigado("A", "pt")).toBe(false);
    expect(pixVolteLigado(null, "pt")).toBe(false);
    expect(pixVolteLigado("B", "es")).toBe(false);
    expect(pixVolteLigado("B", "en")).toBe(false);
  });

  it("e-mail só entra na caixa se parece e-mail", () => {
    expect(emailDaCaixa(" ana@gmail.com ")).toBe("ana@gmail.com");
    expect(emailDaCaixa("")).toBeNull();
    expect(emailDaCaixa(undefined)).toBeNull();
    expect(emailDaCaixa("ana@gmail")).toBeNull();
  });
});
