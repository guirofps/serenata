import { describe, expect, it } from "vitest";
import { assuntoAcesso, bracoAcesso, semSinalDeAcesso, textoAcesso } from "./acesso-lembrete";

describe("bracoAcesso", () => {
  it("usa o 8º caractere do fim do id do quiz (ímpar = B)", () => {
    // limpo termina em ...1 2345678: o 8º do fim é "1"
    expect(bracoAcesso("00000000-0000-0000-0000-000012345678")).toBe("B");
    expect(bracoAcesso("00000000-0000-0000-0000-000022345678")).toBe("A");
  });
  it("sem quiz ou id estranho é A", () => {
    expect(bracoAcesso(null)).toBe("A");
    expect(bracoAcesso("abc")).toBe("A");
  });
  it("é independente do 5º caractere (resgate_coautoria)", () => {
    const ids = Array.from({ length: 256 }, (_, i) => `00000000-0000-0000-0000-0000${i.toString(16).padStart(2, "0")}00${(i * 7 % 16).toString(16)}000`);
    const b = ids.filter((id) => bracoAcesso(id) === "B").length;
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(256);
  });
});

describe("semSinalDeAcesso", () => {
  const nada = { abriuEditor: false, abriuPagina: false, clicouEmail: false, montou: false };
  it("só sem nenhum sinal", () => {
    expect(semSinalDeAcesso(nada)).toBe(true);
    expect(semSinalDeAcesso({ ...nada, abriuPagina: true })).toBe(false);
    expect(semSinalDeAcesso({ ...nada, abriuEditor: true })).toBe(false);
    expect(semSinalDeAcesso({ ...nada, clicouEmail: true })).toBe(false);
    expect(semSinalDeAcesso({ ...nada, montou: true })).toBe(false);
  });
});

describe("texto", () => {
  it("leva o link, o caminho do login e não tem travessão", () => {
    const t = textoAcesso({ nome: "Ana", titulo: "Três Vezes Coragem", linkEditor: "https://x/editar/abc" });
    expect(t).toContain("https://x/editar/abc");
    expect(t).toContain("serenatagift.com/login");
    expect(t).toContain('"Três Vezes Coragem"');
    expect(t + assuntoAcesso("Ana")).not.toMatch(/[—–]/);
  });
});
