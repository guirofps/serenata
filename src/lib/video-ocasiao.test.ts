import { describe, expect, it } from "vitest";
import { EXP_VIDEO_FOTOS_JA, linhaDoVideoPorOcasiao } from "./video-ocasiao";
import { EXPERIMENTOS } from "./experimentos";
import { QUIZ_FLOW } from "./quiz-flow";

describe("linhaDoVideoPorOcasiao", () => {
  it("aniversário fala do status do WhatsApp no dia", () => {
    expect(linhaDoVideoPorOcasiao({ ocasiao: "aniversario" })).toBe(
      "Imagina isso no status do WhatsApp no dia do aniversário",
    );
  });

  it("casamento e declaração ganham frase própria", () => {
    expect(linhaDoVideoPorOcasiao({ ocasiao: "casamento" })).toMatch(/festa/);
    expect(linhaDoVideoPorOcasiao({ ocasiao: "declaracao" })).toMatch(/WhatsApp/);
  });

  it("aceita maiúscula e espaço", () => {
    expect(linhaDoVideoPorOcasiao({ ocasiao: " Aniversario " })).toBe(
      linhaDoVideoPorOcasiao({ ocasiao: "aniversario" }),
    );
  });

  it("memorial nunca ganha frase de status", () => {
    expect(linhaDoVideoPorOcasiao({ ocasiao: "memorial" })).toBeNull();
  });

  it("louvor a Deus fica com a frase de sempre, qualquer que seja a ocasião", () => {
    expect(linhaDoVideoPorOcasiao({ ocasiao: "aniversario", relacao: "deus" })).toBeNull();
  });

  it("sem ocasião, ocasião 'outro' ou desconhecida: frase de sempre", () => {
    expect(linhaDoVideoPorOcasiao({})).toBeNull();
    expect(linhaDoVideoPorOcasiao({ ocasiao: null })).toBeNull();
    expect(linhaDoVideoPorOcasiao({ ocasiao: "outro" })).toBeNull();
    expect(linhaDoVideoPorOcasiao({ ocasiao: "constructor" })).toBeNull();
    expect(linhaDoVideoPorOcasiao({ ocasiao: "toString" })).toBeNull();
  });

  it("toda ocasião do quiz pt tem decisão (frase ou de propósito a de sempre)", () => {
    const passo = QUIZ_FLOW.find((s) => "id" in s && s.id === "ocasiao") as
      | { options: Array<{ value: string }> }
      | undefined;
    expect(passo).toBeDefined();
    const semFrase = new Set(["memorial", "outro"]);
    for (const { value } of passo!.options) {
      const linha = linhaDoVideoPorOcasiao({ ocasiao: value });
      if (semFrase.has(value)) expect(linha).toBeNull();
      else expect(linha, value).toBeTruthy();
    }
  });

  it("nenhuma frase tem travessão", () => {
    for (const o of ["aniversario", "casamento", "declaracao", "homenagem", "formatura", "soporque"]) {
      expect(linhaDoVideoPorOcasiao({ ocasiao: o })).not.toMatch(/[—–]/);
    }
  });

  it("o experimento existe no chão do código, desligado e 50/50", () => {
    const e = EXPERIMENTOS.find((x) => x.id === EXP_VIDEO_FOTOS_JA);
    expect(e?.variantes).toEqual(["A", "B"]);
    expect(e?.peso).toEqual([1, 1]);
    expect(e?.ativo).toBe(false);
  });
});
