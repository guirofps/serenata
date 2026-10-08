import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isQuestion, type FlowStep } from "@/lib/flow-engine";
import {
  aberturaPerguntaVale,
  cssAberturaPergunta,
  depoisDaRelacao,
  EXP_ABERTURA_PERGUNTA,
  PERGUNTA_NA_ABERTURA,
  perguntaDaAbertura,
  SUBTEXTO_NA_ABERTURA,
} from "@/lib/abertura-pergunta";
import { EXPERIMENTOS } from "@/lib/experimentos";
import { QUIZ_FLOW, QUIZ_SKIP, quizFlow, skipDoFluxo } from "@/lib/quiz-flow";

const DEZ = new Date("2026-12-10T15:00:00Z");

describe("quem recebe a pergunta na abertura", () => {
  it("só o funil pt sem tema", () => {
    expect(aberturaPerguntaVale("pt", null)).toBe(true);
    expect(aberturaPerguntaVale("pt", undefined)).toBe(true);
    expect(aberturaPerguntaVale("pt", "gospel")).toBe(false);
    expect(aberturaPerguntaVale("es", null)).toBe(false);
    expect(aberturaPerguntaVale("en", null)).toBe(false);
    expect(aberturaPerguntaVale("en", "gospel")).toBe(false);
  });
});

describe("os chips são os do passo relacao", () => {
  it("o mesmo passo, com os mesmos valores e rótulos", () => {
    const real = QUIZ_FLOW.find((s) => s.id === "relacao");
    const p = perguntaDaAbertura(QUIZ_FLOW);
    expect(p).toBe(real);
    expect(p?.field).toBe("relacao");
    expect(p?.options.map((o) => o.value).slice(0, 3)).toEqual(["esposa", "namorada", "filha"]);
  });

  it("fluxo sem o passo: sem pergunta", () => {
    const sem: FlowStep[] = QUIZ_FLOW.filter((s) => s.id !== "relacao");
    expect(perguntaDaAbertura(sem)).toBeNull();
    expect(depoisDaRelacao(sem, {}, QUIZ_SKIP)).toBeNull();
  });
});

describe("chip → próximo passo", () => {
  it("relacao é a pergunta 1 e o próximo é o nome", () => {
    expect(depoisDaRelacao(QUIZ_FLOW, { relacao: "esposa" }, QUIZ_SKIP)).toEqual({ q: 1, proximo: "nome" });
  });

  it("igual na temporada de Natal (o chip novo é em outro passo)", () => {
    expect(depoisDaRelacao(quizFlow("pt", null, DEZ), { relacao: "mae" }, QUIZ_SKIP)).toEqual({
      q: 1,
      proximo: "nome",
    });
  });

  it("respeita a pulagem por ID do motor, nunca a posição", () => {
    const pula = { nome: () => true };
    expect(depoisDaRelacao(QUIZ_FLOW, { relacao: "pet" }, pula)).toEqual({ q: 1, proximo: "ocasiao" });
  });

  it("acha o passo pelo id mesmo com um passo novo antes dele", () => {
    const comExtra: FlowStep[] = [
      QUIZ_FLOW[0],
      { id: "novo", kind: "social-proof" },
      ...QUIZ_FLOW.slice(1),
    ];
    expect(depoisDaRelacao(comExtra, {}, QUIZ_SKIP)).toEqual({ q: 1, proximo: "nome" });
  });

  it("é o mesmo destino do 'continuar' do passo relacao", () => {
    // O motor do quiz: `nextVisibleIndex` a partir do índice do passo.
    const i = QUIZ_FLOW.findIndex((s) => s.id === "relacao");
    const proximo = QUIZ_FLOW.slice(i + 1).find((s) => !skipDoFluxo(null)[s.id]?.({}));
    expect(depoisDaRelacao(QUIZ_FLOW, {}, skipDoFluxo(null))?.proximo).toBe(proximo?.id);
    expect(isQuestion(QUIZ_FLOW[i])).toBe(true);
  });
});

describe("o CSS do braço", () => {
  const css = cssAberturaPergunta();

  it("o B nasce escondido e só aparece com o carimbo B", () => {
    expect(css.startsWith(".abp-b{display:none}")).toBe(true);
    expect(css).toContain(`html[data-exp-${EXP_ABERTURA_PERGUNTA}=B] .abp-b{display:block}`);
  });

  it("o cartão só encolhe onde ele é maior que 172px", () => {
    expect(css).toContain(`@media (min-height:661px){html[data-exp-${EXP_ABERTURA_PERGUNTA}=B] .abp-cartao{max-width:172px}}`);
  });

  it("cabe num <style> inline sem escapar nada", () => {
    expect(css).not.toMatch(/["'<>&]/);
  });
});

describe("copy e registro", () => {
  it("sem travessão", () => {
    for (const t of [PERGUNTA_NA_ABERTURA, SUBTEXTO_NA_ABERTURA]) expect(t).not.toContain("—");
  });

  it("o experimento existe no código, desligado, A controle, 50/50", () => {
    const e = EXPERIMENTOS.find((x) => x.id === EXP_ABERTURA_PERGUNTA);
    expect(e?.variantes).toEqual(["A", "B"]);
    expect(e?.peso).toEqual([1, 1]);
    expect(e?.ativo).toBe(false);
  });
});

// O projeto não renderiza componente em teste: o caminho da tela é garantido
// lendo o fonte, como em `quiz-gospel-contrato.test.ts`.
describe("contrato das telas", () => {
  const QUIZ = readFileSync("src/components/quiz/Quiz.tsx", "utf8");
  const ABERTURA = readFileSync("src/components/quiz/AberturaPresente.tsx", "utf8");

  it("o quiz só passa a pergunta no pt sem tema", () => {
    expect(QUIZ).toMatch(/pergunta=\{aberturaPerguntaVale\(locale, tema\) \? perguntaDaAbertura\(QUIZ_FLOW\) : null\}/);
  });

  it("o toque faz o que o passo relacao faz e navega pelo ?step=", () => {
    const ini = QUIZ.indexOf("aoEscolher={(valor) => {");
    const fim = QUIZ.indexOf("aoComecar={() => {", ini);
    const h = QUIZ.slice(ini, fim);
    expect(ini).toBeGreaterThan(-1);
    expect(h).toMatch(/novaSessao\(\);\s*reset\(\);/);
    expect(h).toMatch(/setResposta\("relacao", valor\)/);
    expect(h).toMatch(/depoisDaRelacao\(QUIZ_FLOW, st\.respostas, SKIP\)/);
    expect(h).toMatch(/captureLeadProgress\(/);
    expect(h).toMatch(/trackEvent\("quiz_step", \{ step_id: "relacao", q: depois\.q/);
    expect(h).toMatch(/trackEventOnce\("quiz_respondeu", "relacao"/);
    expect(h).toMatch(/trackEvent\("abertura_relacao"/);
    expect(h).toMatch(/search: \{ step: depois\.proximo \}/);
  });

  it("a abertura usa o MESMO componente de chips e não usa <Variante> pro B", () => {
    expect(ABERTURA).toMatch(/<ChipsStep\s+step=\{pergunta\}/);
    expect(ABERTURA).toMatch(/className="abp-b /);
    expect(ABERTURA).toMatch(/className="abp-cartao /);
    expect(ABERTURA).not.toMatch(/<Variante exp=\{EXP_ABERTURA_PERGUNTA\}/);
    // O <style> do braço vem antes do cartão.
    expect(ABERTURA.indexOf("cssAberturaPergunta()")).toBeLessThan(ABERTURA.indexOf("abp-cartao"));
  });
});
