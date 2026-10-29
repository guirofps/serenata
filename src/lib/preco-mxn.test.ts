import { describe, expect, it } from "vitest";
import {
  centavosMxnDe,
  centavosMxnPorCambio,
  cobrarEmPeso,
  textoEmPeso,
  usdDoPeso,
  valorPagoConfere,
} from "./preco-mxn";

describe("checkout em peso pro México", () => {
  it("a conversão pura arredonda em x49/x99 (US$ 19 → $349)", () => {
    expect(centavosMxnPorCambio(1900)).toBe(34900);
    expect(centavosMxnPorCambio(2400)).toBe(44900);
    expect(centavosMxnPorCambio(1000)).toBe(19900);
  });

  it("o México tem preço próprio em teste: US$ 19 → $199, âncora US$ 49 → $549", () => {
    expect(centavosMxnDe(1900)).toBe(19900);
    expect(centavosMxnDe(4900)).toBe(54900);
    // fora da tabela, a conversão de sempre
    expect(centavosMxnDe(2400)).toBe(44900);
  });

  it("o pedido grava o dólar do que se cobrou ($199 → US$ 10,82)", () => {
    expect(usdDoPeso(19900)).toBe(1082);
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
    expect(valorPagoConfere("usd", 1900, 1900)).toBe(true);
    expect(valorPagoConfere(null, 1900, 1900)).toBe(true);
    expect(valorPagoConfere("usd", 1000, 1900)).toBe(false);
    // o de hoje: $199 cobrado, pedido no equivalente
    expect(valorPagoConfere("mxn", 19900, usdDoPeso(19900))).toBe(true);
    // caixa aberto antes de 22/10: $349 cobrado, pedido a US$ 19
    expect(valorPagoConfere("mxn", 34900, 1900)).toBe(true);
    // valor que não bate com nenhum dos dois
    expect(valorPagoConfere("mxn", 100, 1900)).toBe(false);
    expect(valorPagoConfere("mxn", 19900, 1900)).toBe(false);
    expect(valorPagoConfere("eur", 1900, 1900)).toBe(false);
  });

  it("a tela escreve em peso o MESMO número que o caixa cobra", () => {
    expect(textoEmPeso("US$ 19")).toBe("$199 MXN");
    expect(textoEmPeso("$19")).toBe("$199 MXN");
    expect(textoEmPeso("US$ 49")).toBe("$549 MXN");
    expect(textoEmPeso("US$ 24,90")).toBe(`$${centavosMxnDe(2490) / 100} MXN`);
    expect(textoEmPeso("grátis")).toBeNull();
  });

  it("o vídeo-presente no México: US$ 12 → $129, abaixo da música, e o webhook confere", () => {
    expect(centavosMxnDe(1200)).toBe(12900);
    expect(centavosMxnDe(1200)).toBeLessThan(centavosMxnDe(1900));
    expect(textoEmPeso("US$ 12")).toBe("$129 MXN");
    expect(textoEmPeso("$12")).toBe("$129 MXN");
    // o pedido grava o dólar do que se cobrou, e o caixa em peso confere contra ele
    const pedido = usdDoPeso(centavosMxnDe(1200));
    expect(valorPagoConfere("mxn", 12900, pedido)).toBe(true);
    expect(valorPagoConfere("usd", 1200, 1200)).toBe(true);
    expect(valorPagoConfere("mxn", 1200, pedido)).toBe(false);
  });
});
