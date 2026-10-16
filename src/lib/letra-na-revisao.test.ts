import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ADIANTAMENTOS,
  _resetRefroesAdiantadosParaTeste,
  adiantarRefroes,
  chaveDosRefroes,
  hashTexto,
  jsonEstavel,
  letraNaRevisaoLigada,
  pegarRefroesAdiantados,
} from "@/lib/letra-na-revisao";
import type { RefroesGerados } from "@/lib/coautoria";

const R = { relacao: "esposa", nome: "Carol", historia1: "Nos conhecemos no ônibus.", recado: "" };
const DADOS: RefroesGerados = { titulo: "T", estiloSuno: "pop", refroes: ["um", "dois"] };

beforeEach(() => _resetRefroesAdiantadosParaTeste());

describe("a chave", () => {
  it("não depende da ordem das respostas", () => {
    const outraOrdem = { recado: "", historia1: R.historia1, nome: "Carol", relacao: "esposa" };
    expect(chaveDosRefroes("s1", outraOrdem, "pt")).toBe(chaveDosRefroes("s1", R, "pt"));
  });

  it("muda com a resposta, a sessão e o idioma", () => {
    const base = chaveDosRefroes("s1", R, "pt");
    expect(chaveDosRefroes("s1", { ...R, nome: "Carolina" }, "pt")).not.toBe(base);
    expect(chaveDosRefroes("s2", R, "pt")).not.toBe(base);
    expect(chaveDosRefroes("s1", R, "es")).not.toBe(base);
  });

  it("campo undefined é o mesmo que campo ausente", () => {
    expect(jsonEstavel({ a: 1, b: undefined })).toBe(jsonEstavel({ a: 1 }));
  });

  it("listas mantêm a ordem (é conteúdo, não chave)", () => {
    expect(jsonEstavel({ v: ["a", "b"] })).not.toBe(jsonEstavel({ v: ["b", "a"] }));
  });

  it("o hash tem 8 dígitos hexadecimais e é determinístico", () => {
    expect(hashTexto("abc")).toMatch(/^[0-9a-f]{8}$/);
    expect(hashTexto("abc")).toBe(hashTexto("abc"));
    expect(hashTexto("abc")).not.toBe(hashTexto("abd"));
  });
});

describe("a promessa adiantada", () => {
  it("é reaproveitada uma vez só, com a mesma chave", async () => {
    const gerar = vi.fn(async () => DADOS);
    const chave = chaveDosRefroes("s1", R, "pt");
    expect(adiantarRefroes(chave, gerar)).toBe(true);
    const pega = pegarRefroesAdiantados(chave);
    expect(pega).not.toBeNull();
    await expect(pega!.promessa).resolves.toEqual(DADOS);
    // Consumida: "outra opção" e "tentar de novo" chamam de novo.
    expect(pegarRefroesAdiantados(chave)).toBeNull();
    expect(gerar).toHaveBeenCalledTimes(1);
  });

  it("respostas mudaram: nada a reaproveitar", () => {
    adiantarRefroes(chaveDosRefroes("s1", R, "pt"), async () => DADOS);
    expect(pegarRefroesAdiantados(chaveDosRefroes("s1", { ...R, nome: "Ana" }, "pt"))).toBeNull();
  });

  it("a mesma chave nunca dispara duas vezes (StrictMode, re-render)", () => {
    const gerar = vi.fn(async () => DADOS);
    const chave = chaveDosRefroes("s1", R, "pt");
    expect(adiantarRefroes(chave, gerar)).toBe(true);
    expect(adiantarRefroes(chave, gerar)).toBe(false);
    expect(gerar).toHaveBeenCalledTimes(1);
  });

  it("no máximo MAX_ADIANTAMENTOS por página, e a nova substitui a velha", () => {
    const gerar = vi.fn(async () => DADOS);
    for (let i = 0; i < MAX_ADIANTAMENTOS; i++) {
      expect(adiantarRefroes(chaveDosRefroes("s1", { ...R, recado: String(i) }, "pt"), gerar)).toBe(true);
    }
    expect(adiantarRefroes(chaveDosRefroes("s1", { ...R, recado: "x" }, "pt"), gerar)).toBe(false);
    expect(pegarRefroesAdiantados(chaveDosRefroes("s1", { ...R, recado: "0" }, "pt"))).toBeNull();
    expect(
      pegarRefroesAdiantados(chaveDosRefroes("s1", { ...R, recado: String(MAX_ADIANTAMENTOS - 1) }, "pt")),
    ).not.toBeNull();
  });

  it("marca quando já chegou, e a falha não vaza como rejeição solta", async () => {
    const chave = chaveDosRefroes("s1", R, "pt");
    adiantarRefroes(chave, async () => DADOS);
    await new Promise((r) => setTimeout(r, 0));
    expect(pegarRefroesAdiantados(chave)?.pronta).toBe(true);

    const chave2 = chaveDosRefroes("s2", R, "pt");
    adiantarRefroes(chave2, async () => {
      throw new Error("sobrecarga");
    });
    const pega = pegarRefroesAdiantados(chave2);
    await expect(pega!.promessa).rejects.toThrow("sobrecarga");
  });
});

describe("o braço", () => {
  it("só o B, só no pt", () => {
    expect(letraNaRevisaoLigada("B", "pt")).toBe(true);
    expect(letraNaRevisaoLigada("B2", "pt")).toBe(true);
    expect(letraNaRevisaoLigada("A", "pt")).toBe(false);
    expect(letraNaRevisaoLigada("fora", "pt")).toBe(false);
    expect(letraNaRevisaoLigada(null, "pt")).toBe(false);
    expect(letraNaRevisaoLigada("B", "es")).toBe(false);
    expect(letraNaRevisaoLigada("B", "en")).toBe(false);
  });
});
