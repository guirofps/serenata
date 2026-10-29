import { describe, expect, it } from "vitest";
import { MAX_DIAS_DA_COMPRA, TETO_AVISOS, podeLembrarCredito } from "./credito-parado-regra";

const AGORA = Date.parse("2026-10-29T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA - d * 86400000).toISOString();

describe("podeLembrarCredito", () => {
  it("lembra crédito recente que ainda não bateu o teto", () => {
    expect(podeLembrarCredito({ compradoEm: diasAtras(3), agora: AGORA, avisosAnteriores: 0 })).toBe(true);
    expect(
      podeLembrarCredito({ compradoEm: diasAtras(30), agora: AGORA, avisosAnteriores: TETO_AVISOS - 1 }),
    ).toBe(true);
  });

  it("para no teto de avisos", () => {
    expect(
      podeLembrarCredito({ compradoEm: diasAtras(10), agora: AGORA, avisosAnteriores: TETO_AVISOS }),
    ).toBe(false);
  });

  it("não lembra crédito comprado há mais de 60 dias", () => {
    expect(
      podeLembrarCredito({ compradoEm: diasAtras(MAX_DIAS_DA_COMPRA + 1), agora: AGORA, avisosAnteriores: 0 }),
    ).toBe(false);
    expect(
      podeLembrarCredito({ compradoEm: diasAtras(MAX_DIAS_DA_COMPRA - 1), agora: AGORA, avisosAnteriores: 0 }),
    ).toBe(true);
  });

  it("falha fechada: contagem ilegível ou data ausente não lembra", () => {
    expect(podeLembrarCredito({ compradoEm: diasAtras(3), agora: AGORA, avisosAnteriores: null })).toBe(false);
    expect(podeLembrarCredito({ compradoEm: null, agora: AGORA, avisosAnteriores: 0 })).toBe(false);
    expect(podeLembrarCredito({ compradoEm: "lixo", agora: AGORA, avisosAnteriores: 0 })).toBe(false);
  });
});
