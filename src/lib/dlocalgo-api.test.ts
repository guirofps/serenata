import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinaturaDlocalConfere, idDlocalValido, orderIdDlocal, taxaDlocalCentavos } from "../../api/lib/dlocalgo";

describe("orderIdDlocal", () => {
  it("só usa o que a dLocal aceita (letras, números, hífen, sublinhado)", () => {
    const id = orderIdDlocal("b1c2d3e4-0000-4000-8000-000000000000", 1792800000000);
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
    expect(id.startsWith("b1c2d3e4-0000-4000-8000-000000000000-")).toBe(true);
  });
});

describe("assinaturaDlocalConfere", () => {
  // O exemplo da documentação: HMAC-SHA256(secretKey, apiKey + corpo).
  const api = "MyMerchantApiKey";
  const seg = "MyMerchantSecretKey";
  const corpo = '{"payment_id":"DP-283"}';
  const hex = createHmac("sha256", seg).update(api + corpo).digest("hex");

  it("aceita a assinatura certa", () => {
    expect(assinaturaDlocalConfere(`V2-HMAC-SHA256, Signature: ${hex}`, corpo, api, seg)).toBe(true);
  });
  it("recusa corpo mexido, chave errada ou cabeçalho faltando", () => {
    expect(assinaturaDlocalConfere(`V2-HMAC-SHA256, Signature: ${hex}`, '{"payment_id":"DP-284"}', api, seg)).toBe(false);
    expect(assinaturaDlocalConfere(`V2-HMAC-SHA256, Signature: ${hex}`, corpo, api, "outra")).toBe(false);
    expect(assinaturaDlocalConfere(undefined, corpo, api, seg)).toBe(false);
    expect(assinaturaDlocalConfere(`V2-HMAC-SHA256, Signature: ${hex}`, corpo, undefined, seg)).toBe(false);
  });
});

describe("idDlocalValido", () => {
  it("aceita só o formato deles", () => {
    expect(idDlocalValido("DP-8740586")).toBe(true);
    expect(idDlocalValido("../payments")).toBe(false);
    expect(idDlocalValido(123)).toBe(false);
  });
});

describe("taxaDlocalCentavos", () => {
  it("2,99% + US$ 0,20", () => {
    expect(taxaDlocalCentavos(1082)).toBe(52);
  });
});
