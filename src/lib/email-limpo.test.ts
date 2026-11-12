import { describe, expect, it } from "vitest";
import { emailPlausivel, emailGravavel, semPontoNoFim } from "./email-limpo";

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

describe("emailPlausivel", () => {
  it("aceita os formatos comuns", () => {
    for (const e of ["maria.silva@gmail.com", "joao_2@hotmail.com.br", "a+b@outlook.com", "x@sub.dominio-ok.com", "x@xn--caf-dma.com"])
      expect(emailPlausivel(e), e).toBe(true);
  });
  it("recusa o que o Resend recusa (08/10)", () => {
    for (const e of ["gmail.@hotmail.com", ".ana@gmail.com", "brendaperes..24@gmail.com", "carlãojose29@gmail.com", "x@gmail..com", "x@gmail.comj9", "@gmail.com66996534277", "x@-gmail.com", "x@gmail-.com"])
      expect(emailPlausivel(e), e).toBe(false);
  });
});

describe("emailGravavel (captura parcial do lead, 12/11)", () => {
  it("grava o endereço bom, já sem ponto no fim", () => {
    expect(emailGravavel("ana@gmail.com.")).toBe("ana@gmail.com");
    expect(emailGravavel("  ana@gmail.com ")).toBe("ana@gmail.com");
  });
  it("não grava o que ainda está sendo digitado (espaço, acento, sem domínio)", () => {
    for (const e of ["ana maria@gmail.com", "joão@gmail.com", "ab cd.@hotmail.com", "ana@", "ana@gmail", "", null, undefined])
      expect(emailGravavel(e as string | null | undefined), String(e)).toBeNull();
  });
});
