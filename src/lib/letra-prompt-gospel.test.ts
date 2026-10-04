import { describe, expect, it } from "vitest";
import { buildUserMessage, LOUVOR_INSTRUCOES } from "@/lib/letra-prompt";
import { WORSHIP_INSTRUCTIONS_EN } from "@/lib/letra-prompt-en";

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
  it("no espanhol não muda nada", () => {
    expect(buildUserMessage({ ...G, tipo: "louvor" }, "es")).toBe(buildUserMessage(NORMAL, "es"));
  });
});

// A PORTA CRISTÃ DA BALLAD (03/10).
describe("inglês", () => {
  const EN = {
    relacao: "mae", nome: "Rose", ocasiao: "aniversario", estilo: "worship_en", voz: "female",
    tom: "emocionante", historia1: "My mom raised us alone in Tulsa.", historia2: "She makes peach cobbler.",
    recado: "Thank you for everything", filhos: "",
  };
  it("sem tema, igual a antes", () => {
    expect(buildUserMessage({ ...EN, tema: "Gospel" }, "en")).toBe(buildUserMessage(EN, "en"));
  });
  it("presente com fé ganha a linha de fé em inglês", () => {
    const m = buildUserMessage({ ...EN, tema: "gospel", tipo: "presente" }, "en");
    expect(m).toContain("Faith: the person ordering is a Christian.");
    expect(m).not.toContain("Fé:");
    expect(m.replace(/\nFaith: .*\n/, "\n")).toBe(buildUserMessage(EN, "en"));
  });
  it("louvor é dirigido a Deus, em inglês", () => {
    const m = buildUserMessage({ ...EN, tema: "gospel", tipo: "louvor", relacao: "deus", nome: "God", ocasiao: "testemunho", tom: "reverente" }, "en");
    expect(m.startsWith("Recipient: God. This is a WORSHIP SONG")).toBe(true);
    expect(m).toContain(WORSHIP_INSTRUCTIONS_EN);
    expect(m).toContain("Occasion: a testimony of what God did");
    expect(m).toContain("Requested mood: reverent");
    expect(m).toContain("Music genre: modern praise and worship");
    expect(m).not.toContain("Honoree");
    expect(m).not.toMatch(/Destinatário|Ocasião/);
  });
});
