import { describe, expect, it } from "vitest";
import { semGatilhos, validateStory } from "./StoryStep";
import { QUIZ_FLOW as QUIZ_FLOW_PT } from "@/lib/quiz-flow";

// 08/10: história feita só de começos de frase passava na validação e o modelo
// se recusava a escrever o refrão (333 erros em 72h).
const passo = (id: string) => {
  const s = QUIZ_FLOW_PT.find((x) => x.id === id);
  if (!s || s.kind !== "question" || s.input !== "story") throw new Error("sem passo " + id);
  return s;
};

describe("história só com começos de frase", () => {
  it("tira os começos, com o nome no lugar de {nome}", () => {
    const h1 = passo("historia1");
    const t = "A gente se conheceu \nO que eu aprendi com Ana Clara foi \nO que eu mais admiro em Ana Clara é ";
    expect(semGatilhos(t, h1.triggers)).toBe("");
  });

  it("começos sem nada escrito não liberam, mesmo passando do tamanho", () => {
    const h1 = passo("historia1");
    const t = "A gente se conheceu \nO que eu aprendi com Ana Clara foi \nO que eu mais admiro em Ana Clara é ";
    expect(t.trim().length).toBeGreaterThan(h1.minChars);
    expect(validateStory(h1, t, "pt").ok).toBe(false);
  });

  it("começo completado pela pessoa libera como antes", () => {
    const h2 = passo("historia2");
    const t = "O apelido que eu dou pra Ana é Nana, porque ela dormia em qualquer lugar quando era pequena";
    expect(validateStory(h2, t, "pt").ok).toBe(true);
  });

  it("história escrita sem gatilho continua igual", () => {
    const h2 = passo("historia2");
    expect(validateStory(h2, "Ela faz um bolo de fubá todo domingo e canta errado a mesma música", "pt").ok).toBe(true);
  });
});
