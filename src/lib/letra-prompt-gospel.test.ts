import { describe, expect, it } from "vitest";
import { buildUserMessage, LOUVOR_INSTRUCOES } from "@/lib/letra-prompt";

const NORMAL = {
  relacao: "mae", nome: "Rosa", ocasiao: "aniversario", estilo: "gospel", voz: "feminina",
  tom: "emocionante", historia1: "Minha mãe criou a gente sozinha.", historia2: "Faz bolo de fubá.",
  recado: "Obrigado por tudo", filhos: "Pedro",
};

describe("mensagem sem tema", () => {
  it("é a mesma de antes do gospel", () => {
    expect(buildUserMessage(NORMAL, "pt")).toMatchSnapshot();
    expect(buildUserMessage({ ...NORMAL, tom: "" }, "pt")).toMatchSnapshot();
  });
});

const G = { ...NORMAL, tema: "gospel" };

describe("presente com fé", () => {
  it("é a mensagem de sempre mais a linha de fé", () => {
    const m = buildUserMessage({ ...G, tipo: "presente" }, "pt");
    expect(m).toContain("Fé: quem encomendou é evangélico(a). A letra pode falar de Deus, gratidão e bênção na vida de Rosa, sem pregar e sem tirar o foco de Rosa.");
    expect(m.replace(/\nFé: .*\n/, "\n")).toBe(buildUserMessage(NORMAL, "pt"));
  });
});

describe("louvor", () => {
  const L = { ...G, tipo: "louvor", relacao: "deus", nome: "Deus", ocasiao: "gratidao", tom: "reverente" };
  const m = buildUserMessage(L, "pt");

  it("é dirigido a Deus, com as instruções do louvor", () => {
    expect(m.startsWith("Destinatário: Deus. Isto é um LOUVOR, não um presente pra uma pessoa.")).toBe(true);
    expect(m).toContain(LOUVOR_INSTRUCOES);
    expect(m).toContain("Ocasião: louvor de gratidão");
    expect(m).toContain("Tom pedido: reverente");
    expect(m).toContain("Minha mãe criou a gente sozinha.");
  });

  it("não tem homenageado, direção nem filhos, mesmo se o cliente mandar", () => {
    expect(m).not.toContain("Homenageado");
    expect(m).not.toContain("quem encomendou PARA");
    expect(m).not.toContain("Pedro");
    expect(m).not.toContain("Filhos");
  });
});

describe("valores forjados não ativam", () => {
  it("tema diferente de 'gospel' exato é mensagem normal", () => {
    expect(buildUserMessage({ ...NORMAL, tema: "Gospel", tipo: "louvor" }, "pt")).toBe(buildUserMessage(NORMAL, "pt"));
  });
  it("tipo desconhecido é presente com fé", () => {
    expect(buildUserMessage({ ...G, tipo: "x" }, "pt")).toContain("Fé: ");
    expect(buildUserMessage({ ...G, tipo: "x" }, "pt")).toContain("Homenageado: Rosa");
  });
  it("fora do português não muda nada", () => {
    expect(buildUserMessage({ ...G, tipo: "louvor" }, "es")).toBe(buildUserMessage(NORMAL, "es"));
    expect(buildUserMessage({ ...G, tipo: "louvor" }, "en")).toBe(buildUserMessage(NORMAL, "en"));
  });
});
