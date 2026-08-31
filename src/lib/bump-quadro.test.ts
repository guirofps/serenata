import { describe, it, expect } from "vitest";
import { CENTAVOS_QUADRO, valorComBump, referenciaDoPix } from "./criar-pix";

// O ORDER BUMP DO QUADRO cobra um valor que a pessoa viu na tela e libera um
// produto. As duas contas abaixo sao as unicas que, erradas, tiram dinheiro
// errado de alguem — o resto do caminho e gateway e banco.

describe("valor com o quadro junto", () => {
  it("sem o bump, cobra exatamente o preco do braco", () => {
    expect(valorComBump(3800, false)).toBe(3800);
    expect(valorComBump(5490, false)).toBe(5490);
  });

  it("com o bump, soma os R$ 24,90 do catalogo", () => {
    expect(CENTAVOS_QUADRO).toBe(2490);
    expect(valorComBump(3800, true)).toBe(6290);
  });

  // O preco sai do braco sorteado, e sao cinco. O bump tem que somar em cima
  // de QUALQUER um deles, nao em cima de um R$ 38 cravado.
  it("soma em cima de cada braco de preco, nao de um valor fixo", () => {
    for (const base of [900, 1900, 2900, 3800, 5490]) {
      expect(valorComBump(base, true)).toBe(base + 2490);
    }
  });
});

describe("referencia do PIX", () => {
  const quiz = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

  it("sem o bump, e a referencia de sempre", () => {
    expect(referenciaDoPix(quiz, false)).toBe(`serenata:${quiz}`);
  });

  // Sem sufixo, a Woovi devolveria "ja existe uma cobranca com este
  // Correlacao ID" com o valor antigo, e a pessoa veria erro em cima de uma
  // cobranca viva.
  it("com o bump, ganha sufixo proprio", () => {
    expect(referenciaDoPix(quiz, true)).toBe(`serenata:${quiz}:q`);
    expect(referenciaDoPix(quiz, true)).not.toBe(referenciaDoPix(quiz, false));
  });

  // O webhook faz `slice("serenata:".length).split(":")[0]` pra achar o quiz.
  // Se o sufixo entrasse antes do id, o id sairia errado e a pessoa pagaria
  // sem musica pra entregar.
  it("o webhook continua achando o quiz nas duas formas", () => {
    for (const q of [false, true]) {
      const ref = referenciaDoPix(quiz, q);
      expect(ref.slice("serenata:".length).split(":")[0]).toBe(quiz);
    }
  });
});
