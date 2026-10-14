import { describe, expect, it } from "vitest";
import { novosPorCodigo, separarCompras } from "./indicacao-links";

describe("novosPorCodigo", () => {
  it("conta uma comissão por pedido, agrupando o código em maiúsculas", () => {
    const m = novosPorCodigo([{ codigo: "JKKA5A" }, { codigo: "jkka5a" }, { codigo: "6ZFD3Z" }]);
    expect(m.get("JKKA5A")).toBe(2);
    expect(m.get("6ZFD3Z")).toBe(1);
  });

  it("ignora linha sem código", () => {
    expect(novosPorCodigo([{ codigo: null }, { codigo: "" }]).size).toBe(0);
  });
});

describe("separarCompras", () => {
  it("o que não gerou comissão é compra do dono ou de quem já era cliente", () => {
    // JKKA5A no print de 13/10: 3 compras, 1 com comissão.
    expect(separarCompras(3, 1)).toEqual({ novos: 1, outras: 2 });
  });

  it("nunca dá negativo, mesmo com comissão de pedido que a RPC não contou", () => {
    expect(separarCompras(1, 2)).toEqual({ novos: 1, outras: 0 });
  });

  it("sem compra, nada", () => {
    expect(separarCompras(0, 0)).toEqual({ novos: 0, outras: 0 });
  });
});
