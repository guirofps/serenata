import { describe, expect, it } from "vitest";
import { centavosMxnDe, cobrarEmPeso, valorEsperadoNaMoeda } from "./preco-mxn";

describe("checkout em peso pro México", () => {
  it("US$ 19 vira $349 MXN (equivalente, arredondado em x49/x99)", () => {
    expect(centavosMxnDe(1900)).toBe(34900);
    expect(centavosMxnDe(2400)).toBe(44900);
    expect(centavosMxnDe(1000)).toBe(19900);
  });

  it("só o México cobra em peso; EUA e o resto seguem em dólar", () => {
    expect(cobrarEmPeso("MX")).toBe(true);
    expect(cobrarEmPeso("mx")).toBe(true);
    expect(cobrarEmPeso("US")).toBe(false);
    expect(cobrarEmPeso("BR")).toBe(false);
    expect(cobrarEmPeso(null)).toBe(false);
    expect(cobrarEmPeso(undefined)).toBe(false);
  });

  it("o webhook confere o valor na moeda da sessão; moeda estranha não libera", () => {
    expect(valorEsperadoNaMoeda("usd", 1900)).toBe(1900);
    expect(valorEsperadoNaMoeda("mxn", 1900)).toBe(34900);
    expect(valorEsperadoNaMoeda(null, 1900)).toBe(1900);
    expect(valorEsperadoNaMoeda("eur", 1900)).toBeNull();
  });
});
