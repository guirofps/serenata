import { describe, expect, it } from "vitest";
import { buildUserMessage, instrucaoNomeCantado } from "@/lib/letra-prompt";
import { EXP_NOME_CANTADO, nomeCantadoLigado } from "@/lib/nome-cantado";
import { EXPERIMENTOS } from "@/lib/experimentos";

const NORMAL = {
  relacao: "esposa", nome: "Carolina", ocasiao: "aniversario", estilo: "sertanejo", voz: "masculina",
  tom: "emocionante", historia1: "A gente se conheceu no ônibus 312.", historia2: "Ela ri alto.",
  recado: "Te amo, Carol", filhos: "",
};

const LINHA = { ativo: true, variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 1 }] };
const attr = (b: unknown) => ({ gclid: "x", exp: { preco: "A", nome_cantado: b } });

describe("a mensagem do braço B", () => {
  it("é a mensagem do A mais o bloco do nome no fim, e só isso", () => {
    const a = buildUserMessage(NORMAL, "pt");
    const b = buildUserMessage(NORMAL, "pt", { nomeCantado: "Carolina" });
    expect(b).toBe(`${a}\n\n${instrucaoNomeCantado("Carolina")}`);
    expect(b).toMatchSnapshot();
  });

  it("o texto da instrução (congelado)", () => {
    expect(instrucaoNomeCantado("Carolina")).toMatchSnapshot();
    expect(instrucaoNomeCantado("Carolina")).not.toContain("—");
  });

  it("sem nome, ou com nome que não passa no `sanitizeNome`, é o A", () => {
    const a = buildUserMessage(NORMAL, "pt");
    expect(buildUserMessage(NORMAL, "pt", {})).toBe(a);
    expect(buildUserMessage(NORMAL, "pt", { nomeCantado: "" })).toBe(a);
    expect(buildUserMessage(NORMAL, "pt", { nomeCantado: "Ana 2" })).toBe(a);
    expect(buildUserMessage(NORMAL, "pt", { nomeCantado: "x".repeat(41) })).toBe(a);
  });

  it("fora do português não muda nada", () => {
    expect(buildUserMessage(NORMAL, "es", { nomeCantado: "Carolina" })).toBe(buildUserMessage(NORMAL, "es"));
    expect(buildUserMessage(NORMAL, "en", { nomeCantado: "Carolina" })).toBe(buildUserMessage(NORMAL, "en"));
  });

  it("o louvor não ganha o bloco (é pra Deus, não pra um nome)", () => {
    const L = { ...NORMAL, tema: "gospel", tipo: "louvor", relacao: "deus", nome: "Deus" };
    expect(buildUserMessage(L, "pt", { nomeCantado: "Deus" })).toBe(buildUserMessage(L, "pt"));
  });
});

describe("o braço lido no servidor", () => {
  it("B com o experimento ativo liga", () => {
    expect(nomeCantadoLigado(attr("B"), LINHA)).toBe(true);
  });

  it("controle, fora, vazio ou desconhecido não liga", () => {
    for (const b of ["A", "fora", "", "C", 1, null, undefined]) {
      expect(nomeCantadoLigado(attr(b), LINHA)).toBe(false);
    }
    expect(nomeCantadoLigado(null, LINHA)).toBe(false);
    expect(nomeCantadoLigado({}, LINHA)).toBe(false);
    expect(nomeCantadoLigado("lixo", LINHA)).toBe(false);
  });

  it("desligado pelo `ativo`: ninguém liga, nem quem tem B gravado", () => {
    expect(nomeCantadoLigado(attr("B"), { ...LINHA, ativo: false })).toBe(false);
    expect(nomeCantadoLigado(attr("B"), null)).toBe(false);
  });

  it("B com peso 0 é tratado como o controle (forçar pela URL não vale)", () => {
    const zerado = { ativo: true, variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 0 }] };
    expect(nomeCantadoLigado(attr("B"), zerado)).toBe(false);
  });
});

describe("o experimento no catálogo", () => {
  it("os quatro de 16/10 existem, desligados, com A como controle", () => {
    for (const id of [EXP_NOME_CANTADO, "letra_na_revisao", "ouvir_de_novo", "pix_reabre"]) {
      const e = EXPERIMENTOS.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      expect(e?.ativo).toBe(false);
      expect(e?.variantes).toEqual(["A", "B"]);
      expect(e?.peso).toEqual([1, 1]);
      expect(e?.nota).not.toContain("—");
    }
  });
});
