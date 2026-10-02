import { describe, expect, it } from "vitest";
import { taxaDoPedido } from "./taxa-gateway";

describe("taxaDoPedido", () => {
  it("usa a taxa gravada quando existe", () => {
    expect(taxaDoPedido({ valor_centavos: 3800, taxa_centavos: 77, gateway: "asaas" })).toEqual({
      valor: 0.77,
      estimada: false,
    });
  });
  it("taxa gravada zero é zero, não estimativa", () => {
    expect(taxaDoPedido({ valor_centavos: 3800, taxa_centavos: 0, gateway: "woovi" })).toEqual({ valor: 0, estimada: false });
  });
  it("estima pela alíquota medida de cada gateway", () => {
    const est = (gateway: string | null, centavos = 3800) =>
      taxaDoPedido({ valor_centavos: centavos, taxa_centavos: null, gateway }).valor;
    expect(est("woovi")).toBeCloseTo(0.5); // piso de R$ 0,50
    expect(est("woovi", 10000)).toBeCloseTo(0.8);
    expect(est("asaas")).toBeCloseTo(0.99); // piso
    expect(est("perfectpay")).toBeCloseTo(3.8 * 1.139);
    expect(est("desconhecido")).toBeCloseTo(1.14); // 3%
    expect(est(null)).toBeCloseTo(1.14);
  });
  it("marca a estimativa", () => {
    expect(taxaDoPedido({ valor_centavos: 3800, taxa_centavos: null, gateway: "woovi" }).estimada).toBe(true);
  });
});
