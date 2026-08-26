import { describe, expect, it } from "vitest";
import { MODELO_LETRA, MODELO_LETRA_CURTA, PRECOS } from "./custos";

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

  // ── OS DOIS MODELOS, desde 26/08 ──────────────────────────────
  //
  // A letra inteira voltou pro Sonnet e as opções de refrão ficaram no Haiku.
  // Isso dobra a superfície do defeito descrito lá em cima: agora são DUAS
  // strings que precisam existir na tabela, e a que faltar é contabilizada
  // pelo preço da outra sem erro nenhum aparecer.
  it("o modelo das etapas curtas também tem preço próprio", () => {
    expect(PRECOS.anthropic).toHaveProperty(MODELO_LETRA_CURTA);
  });

  it("o modelo curto é mesmo o mais barato dos dois", () => {
    // Se um dia alguém inverter as duas constantes, o funil continua
    // funcionando e a conta sobe em silêncio. Esta linha grita.
    const bom = PRECOS.anthropic[MODELO_LETRA];
    const curto = PRECOS.anthropic[MODELO_LETRA_CURTA];
    expect(curto.out).toBeLessThan(bom.out);
  });

  it("cache: leitura 0,1x da entrada e escrita 1,25x, em todo modelo da tabela", () => {
    for (const [nome, p] of Object.entries(PRECOS.anthropic)) {
      expect(p.cacheRead, `${nome} cacheRead`).toBeCloseTo(p.in * 0.1, 12);
      expect(p.cacheWrite, `${nome} cacheWrite`).toBeCloseTo(p.in * 1.25, 12);
    }
  });
});
