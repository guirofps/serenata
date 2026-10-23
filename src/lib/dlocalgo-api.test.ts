import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinaturaDlocalConfere, idDlocalValido, taxaDlocalCentavos } from "../../api/lib/dlocalgo";

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
