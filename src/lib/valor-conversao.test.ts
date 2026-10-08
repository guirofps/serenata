import { describe, expect, it } from "vitest";
import { valorDaCompra, valorDoCheckout } from "@/lib/valor-conversao";

describe("valorDaCompra", () => {
  it("usa o valor que o gateway confirmou, não o braço da tela", () => {
    // Grudado no braço E (R$ 54,90, peso 0): cobrado R$ 38.
    expect(valorDaCompra({ locale: "pt", pedido: { valorCentavos: 3800, gateway: "asaas" }, reserva: 54.9 })).toBe(38);
    // MUSICA10 sobre R$ 38.
    expect(valorDaCompra({ locale: "pt", pedido: { valorCentavos: 2800, gateway: "woovi" }, reserva: 38 })).toBe(28);
  });

  it("Stripe vale no inglês (dólar nos dois lados)", () => {
    expect(valorDaCompra({ locale: "en", pedido: { valorCentavos: 1900, gateway: "stripe" }, reserva: 24 })).toBe(19);
  });

  it("Perfect Pay do espanhol grava em reais: fica a reserva em dólar", () => {
    expect(valorDaCompra({ locale: "es", pedido: { valorCentavos: 5300, gateway: "perfectpay" }, reserva: 9.9 })).toBe(9.9);
  });

  it("sem pedido, valor nulo ou zero (crédito), fica a reserva", () => {
    expect(valorDaCompra({ locale: "pt", pedido: null, reserva: 38 })).toBe(38);
    expect(valorDaCompra({ locale: "pt", pedido: { valorCentavos: null, gateway: "asaas" }, reserva: 38 })).toBe(38);
    expect(valorDaCompra({ locale: "pt", pedido: { valorCentavos: 0, gateway: "credito" }, reserva: 38 })).toBe(38);
  });

  it("gateway de outra moeda no português não vale", () => {
    expect(valorDaCompra({ locale: "pt", pedido: { valorCentavos: 1900, gateway: "stripe" }, reserva: 38 })).toBe(38);
  });
});

describe("valorDoCheckout", () => {
  const base = { valorDaTela: 54.9, valorCobravel: 38 };

  it("português cobra o braço cobrável, não o da tela", () => {
    expect(valorDoCheckout({ locale: "pt", ...base })).toBe(38);
  });

  it("cupom e convite mandam no valor", () => {
    expect(valorDoCheckout({ locale: "pt", ...base, comCupomCentavos: 2800 })).toBe(28);
    expect(valorDoCheckout({ locale: "pt", ...base, comConviteCentavos: 3420 })).toBe(34.2);
  });

  it("espanhol é o link da Perfect Pay do braço da tela", () => {
    expect(valorDoCheckout({ locale: "es", valorDaTela: 9.9, valorCobravel: 9.9, comCupomCentavos: 792 })).toBe(9.9);
  });

  it("inglês cobra o braço cobrável", () => {
    expect(valorDoCheckout({ locale: "en", valorDaTela: 24, valorCobravel: 19 })).toBe(19);
  });
});
