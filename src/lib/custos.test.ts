import { describe, expect, it } from "vitest";
import { MODELO_LETRA, PRECOS } from "./custos";

// O ACOPLAMENTO ENTRE O MODELO E O PREÇO.
//
// `registrarCustoLetra` procura o preço pelo NOME do modelo. Trocar o modelo
// sem pôr o preço dele na tabela não quebra nada — a chamada funciona, a letra
// sai, e o painel contabiliza pelo preço do outro modelo. O erro só aparece
// comparando o painel com a fatura da Anthropic, semanas depois.
//
// Foi exatamente o risco da troca de 20/08 (Sonnet 5 -> Haiku 4.5), onde o
// preço errado seria o DOBRO do real.

describe("modelo da letra e tabela de preço", () => {
  it("o modelo ativo tem preço próprio na tabela", () => {
    expect(PRECOS.anthropic).toHaveProperty(MODELO_LETRA);
  });

  it("o preço do modelo ativo está completo e é positivo", () => {
    const p = PRECOS.anthropic[MODELO_LETRA];
    for (const campo of ["in", "out", "cacheRead", "cacheWrite"] as const) {
      expect(p[campo], campo).toBeGreaterThan(0);
    }
  });

  it("saída custa mais que entrada — pega tabela colada trocada", () => {
    const p = PRECOS.anthropic[MODELO_LETRA];
    expect(p.out).toBeGreaterThan(p.in);
  });

  it("cache: leitura 0,1x da entrada e escrita 1,25x, em todo modelo da tabela", () => {
    for (const [nome, p] of Object.entries(PRECOS.anthropic)) {
      expect(p.cacheRead, `${nome} cacheRead`).toBeCloseTo(p.in * 0.1, 12);
      expect(p.cacheWrite, `${nome} cacheWrite`).toBeCloseTo(p.in * 1.25, 12);
    }
  });
});
