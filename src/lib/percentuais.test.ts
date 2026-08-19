import { describe, expect, it } from "vitest";
import { distribuirPercentuais } from "./percentuais";

// Prova exatamente os dois casos que a revisão apontou como quebrados no
// arredondamento ingênuo linha a linha: pesos [2,1,1,1,1] (soma 101 com
// `Math.round` por fatia) e três pesos iguais (soma 99).

describe("distribuirPercentuais", () => {
  it("pesos [2,1,1,1,1] somam exatamente 100", () => {
    const r = distribuirPercentuais([2, 1, 1, 1, 1]);
    expect(r.reduce((s, p) => s + p, 0)).toBe(100);
  });

  it("três pesos iguais somam exatamente 100", () => {
    const r = distribuirPercentuais([1, 1, 1]);
    expect(r.reduce((s, p) => s + p, 0)).toBe(100);
  });

  it("cinco pesos iguais (o experimento em produção) somam 100 com 20% cada", () => {
    const r = distribuirPercentuais([1, 1, 1, 1, 1]);
    expect(r).toEqual([20, 20, 20, 20, 20]);
  });

  it("pesos todos zero somam 100 mesmo assim (divide igual, não zera tudo)", () => {
    const r = distribuirPercentuais([0, 0, 0]);
    expect(r.reduce((s, p) => s + p, 0)).toBe(100);
  });

  it("um peso só fica com 100%", () => {
    expect(distribuirPercentuais([7])).toEqual([100]);
  });

  it("array vazio devolve array vazio, não quebra", () => {
    expect(distribuirPercentuais([])).toEqual([]);
  });

  it("o ponto extra do resto vai pro índice menor em caso de empate", () => {
    // 3 fatias iguais: 33.33 cada, falta 1 ponto pra fechar 100. Os três
    // restos empatam (.33 cada) — o desempate é por índice, então o
    // primeiro (índice 0) recebe o ponto extra, não o último.
    expect(distribuirPercentuais([1, 1, 1])).toEqual([34, 33, 33]);
  });
});
