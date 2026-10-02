import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// O projeto não renderiza componente em teste (`vitest.config.ts`): o caminho
// das telas é garantido lendo o fonte, como em `admin-painel-contrato.test.ts`.
const ROTA = readFileSync("src/routes/criar.tsx", "utf8");
const QUIZ = readFileSync("src/components/quiz/Quiz.tsx", "utf8");
const ABERTURA = readFileSync("src/components/quiz/AberturaPresente.tsx", "utf8");
const STORE = readFileSync("src/lib/quiz-store.ts", "utf8");
const TEXTOS = readFileSync("src/lib/textos.ts", "utf8");

describe("telas do quiz gospel", () => {
  it("/criar aceita ?t e passa o tema ao quiz", () => {
    expect(ROTA).toMatch(/t: z\.string\(\)\.optional\(\)/);
    expect(ROTA).toMatch(/temaUrl=\{temaDoParametro\(t\)\}/);
  });

  it("o quiz monta fluxo e pulagem pelo tema", () => {
    expect(QUIZ).toMatch(/quizFlow\(locale, tema\)/);
    expect(QUIZ).toMatch(/skipDoFluxo\(tema\)/);
    expect(QUIZ).not.toMatch(/, QUIZ_SKIP\)/);
  });

  it("o tema é carimbado antes do quiz_started", () => {
    const carimbo = QUIZ.indexOf("carimbarTema(temaUrl)");
    const inicio = QUIZ.indexOf('trackEventOnce("quiz_started"');
    expect(carimbo).toBeGreaterThan(-1);
    expect(carimbo).toBeLessThan(inicio);
  });

  it("o tema só é gravado nas respostas depois da reidratação da store", () => {
    expect(QUIZ).toMatch(/onFinishHydration\(gravar\)/);
  });

  it("escolher o tipo passa por aplicarTipo", () => {
    expect(QUIZ).toMatch(/setRespostas\(aplicarTipo\(/);
    expect(STORE).toMatch(/setRespostas: \(respostas\) =>/);
  });

  it("o passo do funil gospel usa a escala normal e o tipo não grava lead", () => {
    expect(QUIZ).toMatch(/numeroCanonico\(quizFlow\(locale\), step\)/);
    expect(QUIZ).toMatch(/\(isQuestion\(step\) && qNum > 0\) \|\| isContact\(step\)/);
  });

  it("a revisão mostra o tipo e esconde Deus", () => {
    expect(QUIZ).toMatch(/const ordem = \["tipo", "relacao"/);
    expect(QUIZ).toMatch(/respostas\.tipo === "louvor" && \(k === "relacao" \|\| k === "nome"\)/);
    expect(TEXTOS).toMatch(/tipo: "O que é"/);
  });

  it("a abertura tem a copy gospel e o exemplo real", () => {
    expect(ABERTURA).toMatch(/const COPY_GOSPEL/);
    expect(ABERTURA).toContain("CRIAR MEU LOUVOR GRÁTIS");
    expect(ABERTURA).toContain("Denise, mulher de palavra e de fé");
    expect(ABERTURA).toContain('"denise"');
  });
});
