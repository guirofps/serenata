import { describe, expect, it } from "vitest";
import { buildUserMessage } from "@/lib/letra-prompt";

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
