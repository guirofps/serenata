import { describe, expect, it } from "vitest";
import { bracoCobravel } from "./braco-cobravel";

const V = [
  { nome: "A", peso: 1, plano: { valor: 38 } },
  { nome: "C1", peso: 0, plano: { valor: 9 } },
  { nome: "B", plano: { valor: 29 } },
];

describe("bracoCobravel", () => {
  it("braço com peso 0 forçado por ?exp= é cobrado como o controle", () => {
    expect(bracoCobravel(V, "C1")?.plano?.valor).toBe(38);
  });
  it("braço vivo cobra o próprio preço (peso ausente vale 1)", () => {
    expect(bracoCobravel(V, "B")?.plano?.valor).toBe(29);
  });
  it("braço desconhecido ou vazio cai no controle", () => {
    expect(bracoCobravel(V, "ZZ")?.plano?.valor).toBe(38);
    expect(bracoCobravel(V, undefined)?.plano?.valor).toBe(38);
  });
});
