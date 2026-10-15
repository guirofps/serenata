import { describe, expect, it } from "vitest";
import { corrigirTypoCerto, pareceTypo, sugerirEmail } from "./email-typo";

describe("corrigirTypoCerto", () => {
  it("corrige os typos que mais voltaram (15/10)", () => {
    expect(corrigirTypoCerto("ana@gamil.com")).toBe("ana@gmail.com");
    expect(corrigirTypoCerto("ana@hotemail.com")).toBe("ana@hotmail.com");
    expect(corrigirTypoCerto("ana@gnail.com")).toBe("ana@gmail.com");
    expect(corrigirTypoCerto("ana@gail.com")).toBe("ana@gmail.com");
    expect(corrigirTypoCerto("ana@gmail.comm")).toBe("ana@gmail.com");
    expect(corrigirTypoCerto("ana@gmail.com.br")).toBe("ana@gmail.com");
  });
  it("não mexe em domínio certo nem em domínio curto que pode ser real", () => {
    expect(corrigirTypoCerto(" ana@gmail.com ")).toBe("ana@gmail.com");
    expect(corrigirTypoCerto("ana@hotmail.com.br")).toBe("ana@hotmail.com.br");
    expect(corrigirTypoCerto("ana@empresa.com.br")).toBe("ana@empresa.com.br");
    expect(corrigirTypoCerto("ana@he.com")).toBe("ana@he.com");
  });
  it("sem palpite, devolve como veio", () => {
    expect(corrigirTypoCerto("ana")).toBe("ana");
    expect(corrigirTypoCerto("")).toBe("");
  });
  it("a régua do servidor e o palpite da tela seguem como eram", () => {
    expect(pareceTypo("ana@gmail.com")).toBe(false);
    expect(sugerirEmail("ana@gmial.com")).toBe("ana@gmail.com");
  });
});
