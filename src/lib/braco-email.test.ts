import { describe, expect, it } from "vitest";
import { POSICAO_DO_TESTE, bracoDoTeste, bracoPorId } from "./braco-email";

// O braço tem que ser recalculável na leitura e INDEPENDENTE entre os testes.

describe("bracoPorId", () => {
  it("ímpar é B, par é A, contando do fim", () => {
    const id = "7f3c2a10-1111-4222-8333-0000000000a1";
    expect(bracoPorId(id, 1)).toBe("b"); // '1'
    expect(bracoPorId(id, 2)).toBe("a"); // 'a' = 10
    expect(bracoPorId("x-0000000000b0", 2)).toBe("b"); // 'b' = 11
    expect(bracoPorId("x-00000000000f", 1)).toBe("b");
    expect(bracoPorId("x-00000000000E", 1)).toBe("a"); // maiúscula vale
  });

  it("o mesmo critério do teste de assunto da letra na posição 1", () => {
    // mandarLetra: parseInt(quizId.slice(-1), 16) % 2 === 1 ? "b" : "a"
    for (const c of "0123456789abcdef") {
      const id = `00000000-0000-4000-8000-00000000000${c}`;
      expect(bracoPorId(id, 1)).toBe(parseInt(id.slice(-1), 16) % 2 === 1 ? "b" : "a");
    }
  });

  it("id vazio, curto ou estranho fica no A", () => {
    expect(bracoPorId(null, 1)).toBe("a");
    expect(bracoPorId("", 1)).toBe("a");
    expect(bracoPorId("ab", 3)).toBe("a");
    expect(bracoPorId("xxxx-", 1)).toBe("a");
    expect(bracoPorId("abc1", 0)).toBe("a");
  });
});

describe("bracoDoTeste", () => {
  it("cada teste usa uma posição diferente, e nenhuma é a 1 (já usada)", () => {
    const posicoes = Object.values(POSICAO_DO_TESTE);
    expect(new Set(posicoes).size).toBe(posicoes.length);
    expect(posicoes).not.toContain(1);
    for (const p of posicoes) expect(p).toBeLessThanOrEqual(12);
  });

  it("os braços se cruzam: dá pra ser B num e A noutro", () => {
    // posição 2 ímpar (recuperacao_prazo B), posição 4 par (limite_frequencia A)
    const id = "00000000-0000-4000-8000-000000002010";
    expect(bracoDoTeste("recuperacao_prazo", id)).toBe("b");
    expect(bracoDoTeste("limite_frequencia", id)).toBe("a");
    expect(bracoDoTeste("pedido_reacao", id)).toBe("a");
  });

  it("divide meio a meio numa amostra grande", () => {
    let b = 0;
    // 16^4: todas as combinações dos 4 últimos caracteres.
    const n = 65536;
    for (let i = 0; i < n; i++) {
      const id = `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;
      if (bracoDoTeste("limite_frequencia", id) === "b") b++;
    }
    expect(b).toBe(n / 2);
  });

  it("fora do português é sempre A", () => {
    const id = "00000000-0000-4000-8000-0000000000f0";
    expect(bracoDoTeste("recuperacao_prazo", id, "pt")).toBe("b");
    expect(bracoDoTeste("recuperacao_prazo", id, "es")).toBe("a");
    expect(bracoDoTeste("recuperacao_prazo", id, "en")).toBe("a");
  });
});
