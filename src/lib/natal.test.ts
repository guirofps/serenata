import { describe, expect, it } from "vitest";
import { isQuestion, type FlowStep } from "@/lib/flow-engine";
import { comNatal, natalNaJanela, OCASIAO_NATAL } from "@/lib/natal";
import { quizFlow, QUIZ_FLOW } from "@/lib/quiz-flow";
import { buildUserMessage } from "@/lib/letra-prompt";
import { OCASIAO_ES } from "@/lib/letra-prompt-es";
import { OCASIAO_EN } from "@/lib/letra-prompt-en";

/** Um instante em Brasília (UTC-3), escrito como se lê no relógio daqui. */
const brt = (iso: string) => new Date(`${iso}-03:00`);

const opcoes = (flow: FlowStep[], id: string) => {
  const p = flow.find((s) => s.id === id);
  return p && isQuestion(p) && p.input === "chips" ? p.options.map((o) => o.value) : [];
};

describe("janela de Natal (Brasília)", () => {
  it("abre em 15/11 à meia-noite de Brasília, não antes", () => {
    expect(natalNaJanela(brt("2026-11-14T23:59:59"))).toBe(false);
    expect(natalNaJanela(brt("2026-11-15T00:00:00"))).toBe(true);
  });

  it("vale dezembro inteiro e fecha na virada do ano de Brasília", () => {
    expect(natalNaJanela(brt("2026-12-01T12:00:00"))).toBe(true);
    expect(natalNaJanela(brt("2026-12-25T08:00:00"))).toBe(true);
    // 31/12 às 22h em Brasília já é 01/01 em UTC: continua aberto.
    expect(natalNaJanela(brt("2026-12-31T22:00:00"))).toBe(true);
    expect(natalNaJanela(brt("2026-12-31T23:59:59"))).toBe(true);
    expect(natalNaJanela(brt("2027-01-01T00:00:00"))).toBe(false);
  });

  it("15/11 às 01h UTC ainda é 14/11 em Brasília", () => {
    expect(natalNaJanela(new Date("2026-11-15T01:00:00Z"))).toBe(false);
    expect(natalNaJanela(new Date("2026-11-15T03:00:00Z"))).toBe(true);
  });

  it("fora da temporada", () => {
    expect(natalNaJanela(brt("2026-10-08T12:00:00"))).toBe(false);
    expect(natalNaJanela(brt("2027-06-15T12:00:00"))).toBe(false);
  });
});

describe("chip de Natal no passo da ocasião", () => {
  const DEZ = brt("2026-12-10T12:00:00");
  const OUT = brt("2026-10-08T12:00:00");

  it("aparece em primeiro, nos três idiomas, só dentro da janela", () => {
    for (const locale of ["pt", "es", "en"] as const) {
      expect(opcoes(quizFlow(locale, null, DEZ), "ocasiao")[0]).toBe(OCASIAO_NATAL);
      expect(opcoes(quizFlow(locale, null, OUT), "ocasiao")).not.toContain(OCASIAO_NATAL);
    }
  });

  it("rótulo e emoji por idioma", () => {
    const rotulo = (locale: "pt" | "es" | "en") => {
      const p = quizFlow(locale, null, DEZ).find((s) => s.id === "ocasiao");
      return p && isQuestion(p) && p.input === "chips" ? p.options[0] : null;
    };
    expect(rotulo("pt")).toEqual({ value: "natal", label: "Natal", emoji: "🎄" });
    expect(rotulo("es")).toEqual({ value: "natal", label: "Navidad", emoji: "🎄" });
    expect(rotulo("en")).toEqual({ value: "natal", label: "Christmas", emoji: "🎄" });
  });

  it("fora da janela o fluxo é o MESMO objeto de sempre", () => {
    expect(quizFlow("pt", null, OUT)).toBe(QUIZ_FLOW);
  });

  it("dentro da janela a referência é estável entre chamadas", () => {
    expect(quizFlow("pt", null, DEZ)).toBe(quizFlow("pt", null, brt("2026-11-20T12:00:00")));
  });

  it("no gospel só o ramo presente ganha o chip; o louvor não", () => {
    const g = quizFlow("pt", "gospel", DEZ);
    expect(opcoes(g, "ocasiao")[0]).toBe(OCASIAO_NATAL);
    expect(opcoes(g, "ocasiao_louvor")).not.toContain(OCASIAO_NATAL);
    expect(opcoes(quizFlow("en", "gospel", DEZ), "ocasiao_louvor")).not.toContain(OCASIAO_NATAL);
  });

  it("não mexe na ordem nem no número de passos", () => {
    expect(quizFlow("pt", null, DEZ).map((s) => s.id)).toEqual(QUIZ_FLOW.map((s) => s.id));
    expect(opcoes(quizFlow("pt", null, DEZ), "ocasiao").slice(1)).toEqual(opcoes(QUIZ_FLOW, "ocasiao"));
  });

  it("comNatal é idempotente e não altera o original", () => {
    const antes = opcoes(QUIZ_FLOW, "ocasiao");
    const uma = comNatal(QUIZ_FLOW, "pt");
    expect(comNatal(uma, "pt")).toEqual(uma);
    expect(opcoes(QUIZ_FLOW, "ocasiao")).toEqual(antes);
  });
});

describe("Natal no prompt da letra", () => {
  const R = { relacao: "esposa", nome: "Ana", ocasiao: "natal", estilo: "sertanejo_univ", voz: "masculina", historia1: "x" };

  it("os três idiomas descrevem um presente de Natal, sem cair no fallback", () => {
    expect(buildUserMessage(R, "pt")).toContain("Ocasião: Natal (um presente de Natal");
    expect(OCASIAO_ES.natal).toMatch(/^Navidad \(un regalo de Navidad/);
    expect(OCASIAO_EN.natal).toMatch(/^Christmas \(a Christmas gift/);
    expect(buildUserMessage(R, "es")).toContain(OCASIAO_ES.natal);
    expect(buildUserMessage(R, "en")).toContain(OCASIAO_EN.natal);
  });

  it("sem imposição religiosa", () => {
    expect(buildUserMessage(R, "pt")).toContain("referência religiosa só se a história ou o pedido trouxer");
  });

  it("sem travessão", () => {
    const linhaPt = buildUserMessage(R, "pt").split(/\n/).find((l) => l.startsWith("Ocasião:"))!;
    for (const t of [linhaPt, OCASIAO_ES.natal, OCASIAO_EN.natal]) expect(t).not.toContain("—");
  });
});
