import { describe, expect, it } from "vitest";
import { semPontoNoFim } from "./email-limpo";

describe("semPontoNoFim", () => {
  it("tira o ponto final e espaços", () => {
    expect(semPontoNoFim(" go@hotmail.com. ")).toBe("go@hotmail.com");
    expect(semPontoNoFim("go@hotmail.com..")).toBe("go@hotmail.com");
  });
  it("junta pontos seguidos no domínio", () => {
    expect(semPontoNoFim("al@gmail..com")).toBe("al@gmail.com");
    expect(semPontoNoFim("al@hotmail...com.br")).toBe("al@hotmail.com.br");
  });
  it("não mexe em e-mail normal", () => {
    expect(semPontoNoFim("maria.silva@gmail.com")).toBe("maria.silva@gmail.com");
  });
});
