import { describe, expect, it } from "vitest";
import { letraParcial } from "./coautoria";

// O QUE ESTE TESTE SEGURA
//
// Em streaming, TODO pedaço que chega é JSON quebrado. Se a extração tropeçar
// num deles, a pessoa vê lixo aparecendo no lugar da letra dela — o oposto do
// efeito que o streaming existe pra dar.
//
// Cada caso abaixo é um estado real do meio de um stream, não hipótese.
// Atenção ao ler: "\\n" no código é UMA barra seguida de n, que é como a
// quebra de linha viaja dentro de um JSON.
describe("letraParcial", () => {
  it("devolve vazio enquanto o campo ainda nem apareceu", () => {
    expect(letraParcial("")).toBe("");
    expect(letraParcial('{"titulo": "Vira')).toBe("");
    expect(letraParcial('{"titulo": "Viradinho", "gene')).toBe("");
  });

  it("lê o que já existe da letra, com a string ainda aberta", () => {
    expect(letraParcial('{"titulo": "X", "letra": "Você chegou dev')).toBe("Você chegou dev");
  });

  it("desfaz a quebra de linha escapada, que é o que a letra mais tem", () => {
    expect(letraParcial('{"letra": "Primeira linha\\nSegunda linha')).toBe(
      "Primeira linha\nSegunda linha",
    );
  });

  it("para no fim do campo e não invade o próximo", () => {
    expect(letraParcial('{"letra": "Só isso", "genero": "sertanejo"}')).toBe("Só isso");
  });

  it("aguenta aspas escapadas dentro da letra", () => {
    expect(letraParcial('{"letra": "ela disse \\"vem\\" e eu fui')).toBe(
      'ela disse "vem" e eu fui',
    );
  });

  it("aguenta a escapada CORTADA no fim do pedaço, sem inventar caractere", () => {
    // O pedaço terminou exatamente na barra: o resto da escapada não chegou.
    expect(letraParcial('{"letra": "linha um\\')).toBe("linha um");
  });

  it("o resultado cresce de forma monotônica conforme o stream avança", () => {
    const pedacos = [
      '{"titulo": "X"',
      '{"titulo": "X", "letra": "Ela',
      '{"titulo": "X", "letra": "Ela chegou',
      '{"titulo": "X", "letra": "Ela chegou\\ndevagar"}',
    ];
    const saidas = pedacos.map(letraParcial);
    for (let i = 1; i < saidas.length; i++) {
      expect(saidas[i].startsWith(saidas[i - 1])).toBe(true);
    }
    expect(saidas[saidas.length - 1]).toBe("Ela chegou\ndevagar");
  });
});
