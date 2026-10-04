import { describe, expect, it } from "vitest";
import { quizFlow, QUIZ_SKIP, skipDoFluxo } from "@/lib/quiz-flow";
import { QUIZ_FLOW_EN } from "@/lib/quiz-flow-en";
import { aplicarTipo, numeroCanonico, OCASIOES_LOUVOR } from "@/lib/quiz-flow-gospel";
import { indexOfId, isQuestion, nextVisibleIndex, type FlowStep } from "@/lib/flow-engine";

const PT = quizFlow("pt");
const G = quizFlow("pt", "gospel");

/** Percorre o fluxo do jeito que o `Quiz` faz: de visível em visível. */
function caminho(flow: FlowStep[], respostas: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (let i = 0; i !== -1; i = nextVisibleIndex(flow, i, respostas, skipDoFluxo("gospel"))) {
    ids.push(flow[i].id);
  }
  return ids;
}
const opcoes = (flow: FlowStep[], id: string) =>
  (flow.find((s) => s.id === id) as { options?: { value: string }[] }).options!.map((o) => o.value);

describe("quiz gospel", () => {
  it("sem tema, o fluxo e a pulagem são os de hoje", () => {
    expect(quizFlow("pt", null)).toBe(PT);
    expect(skipDoFluxo(null)).toBe(QUIZ_SKIP);
    expect(PT.some((s) => s.id.endsWith("_louvor") || s.id === "tipo")).toBe(false);
  });

  it("espanhol ignora o tema; inglês sem tema segue o de sempre", () => {
    expect(quizFlow("es", "gospel")).toEqual(quizFlow("es"));
    expect(quizFlow("en", null)).toBe(QUIZ_FLOW_EN);
  });

  it("tipo é o segundo passo", () => {
    expect(G[0].id).toBe("abertura");
    expect(G[1].id).toBe("tipo");
    expect(opcoes(G, "tipo")).toEqual(["louvor", "presente"]);
  });

  it("o louvor pula pra quem e nome e usa os próprios passos", () => {
    expect(caminho(G, { tipo: "louvor" })).toEqual([
      "abertura", "tipo", "ocasiao_louvor", "prova1", "estilo", "voz",
      "historia1_louvor", "historia2_louvor", "recado_louvor",
      "contato", "revisao", "reveal", "oferta",
    ]);
  });

  it("o presente percorre os passos de sempre", () => {
    expect(caminho(G, { tipo: "presente" })).toEqual([
      "abertura", "tipo", "relacao", "nome", "ocasiao", "prova1", "estilo", "voz",
      "historia1", "historia2", "recado", "contato", "revisao", "reveal", "oferta",
    ]);
  });

  it("estilo oferece os cinco gospel; tom troca romântica e divertida por reverente", () => {
    expect(opcoes(G, "estilo")).toEqual([
      "gospel_adoracao", "gospel_tradicional", "gospel_pentecostal", "gospel_sertanejo", "gospel_pop",
    ]);
    const voz = G.find((s) => s.id === "voz") as { extraChips: { options: { value: string }[] } };
    expect(voz.extraChips.options.map((o) => o.value)).toEqual(["reverente", "emocionante", "animada"]);
  });

  it("ocasiões do louvor", () => {
    expect(opcoes(G, "ocasiao_louvor")).toEqual([...OCASIOES_LOUVOR]);
  });

  it("o recado do louvor não pergunta de filhos; o do presente continua perguntando", () => {
    expect((G.find((s) => s.id === "recado_louvor") as { extra?: unknown }).extra).toBeUndefined();
    expect((G.find((s) => s.id === "recado") as { extra?: unknown }).extra).toBeDefined();
  });

  it("não mexe no array do português", () => {
    expect(opcoes(PT, "estilo")).toContain("gospel");
    expect(opcoes(PT, "estilo")).not.toContain("gospel_pop");
  });

  it("passo gospel aberto sem tema cai na abertura", () => {
    expect(indexOfId(PT, "historia1_louvor")).toBe(0);
  });
});

describe("aplicarTipo", () => {
  it("louvor preenche Deus e tira os filhos", () => {
    expect(aplicarTipo({ filhos: "Ana", estilo: "gospel_pop" }, "louvor")).toEqual({
      tipo: "louvor", relacao: "deus", nome: "Deus", estilo: "gospel_pop",
    });
  });

  it("voltar do louvor pro presente limpa Deus e a ocasião do louvor", () => {
    const louvor = aplicarTipo({ ocasiao: "gratidao" }, "louvor");
    expect(aplicarTipo(louvor, "presente")).toEqual({ tipo: "presente" });
  });

  it("presente não apaga a pessoa que já foi escolhida", () => {
    expect(aplicarTipo({ relacao: "mae", nome: "Rosa", ocasiao: "aniversario" }, "presente")).toEqual({
      tipo: "presente", relacao: "mae", nome: "Rosa", ocasiao: "aniversario",
    });
  });

  it("ir pro louvor descarta ocasião de presente", () => {
    expect(aplicarTipo({ ocasiao: "declaracao" }, "louvor").ocasiao).toBeUndefined();
    expect(aplicarTipo({ ocasiao: "clamor" }, "louvor").ocasiao).toBe("clamor");
  });
});

describe("numeroCanonico (escala do funil no banco)", () => {
  const n = (id: string) => numeroCanonico(PT, G.find((s) => s.id === id)!);
  it("cada passo gospel tem o número do passo normal de mesmo campo", () => {
    expect(n("tipo")).toBe(0);
    expect(n("relacao")).toBe(1);
    expect(n("ocasiao_louvor")).toBe(3);
    expect(n("historia1_louvor")).toBe(6);
    expect(n("recado_louvor")).toBe(8);
  });
  it("no fluxo normal é igual ao questionNumber", () => {
    PT.forEach((s, i) => {
      if (isQuestion(s)) expect(numeroCanonico(PT, s)).toBe(PT.slice(0, i + 1).filter(isQuestion).length);
    });
  });
});

// A PORTA CRISTÃ DA BALLAD (03/10): a mesma camada sobre o quiz em inglês.
describe("quiz cristão em inglês", () => {
  const E = quizFlow("en", "gospel");
  function caminhoEn(respostas: Record<string, unknown>): string[] {
    const ids: string[] = [];
    for (let i = 0; i !== -1; i = nextVisibleIndex(E, i, respostas, skipDoFluxo("gospel"))) ids.push(E[i].id);
    return ids;
  }

  it("tipo é o segundo passo, com os mesmos valores do português", () => {
    expect(E[1].id).toBe("tipo");
    expect(opcoes(E, "tipo")).toEqual(opcoes(G, "tipo"));
    expect((E[1] as { text: string }).text).toBe("What would you like to create?");
  });

  it("louvor e presente andam pelos passos certos", () => {
    const louvor = caminhoEn({ tipo: "louvor" });
    expect(louvor).toContain("historia1_louvor");
    expect(louvor).not.toContain("relacao");
    const presente = caminhoEn({ tipo: "presente" });
    expect(presente).toContain("relacao");
    expect(presente).not.toContain("historia1_louvor");
  });

  it("as ocasiões do louvor gravam os mesmos valores do português", () => {
    expect(opcoes(E, "ocasiao_louvor")).toEqual([...OCASIOES_LOUVOR]);
  });

  it("estilos cristãos americanos e o tom reverente", () => {
    expect(opcoes(E, "estilo")).toEqual([
      "worship_en", "gospel_choir_en", "hymn_en", "country_gospel_en", "christian_pop_en",
    ]);
    const voz = E.find((s) => s.id === "voz") as { extraChips: { options: { value: string }[] } };
    expect(voz.extraChips.options.map((o) => o.value)).toEqual(["reverente", "emocionante", "animada"]);
  });

  it("nenhum texto em português vaza pro inglês", () => {
    const textos = JSON.stringify(E.filter((s) => ["tipo", "ocasiao_louvor", "historia1_louvor", "historia2_louvor", "recado_louvor", "estilo"].includes(s.id)));
    expect(textos).not.toMatch(/Deus|louvor pra|Senhor|ção/);
  });
});
