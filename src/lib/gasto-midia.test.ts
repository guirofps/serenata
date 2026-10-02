import { describe, expect, it } from "vitest";
import { diasDaJanela, somarGasto } from "./gasto-midia";

describe("somarGasto", () => {
  it("soma o Google da API com os lançamentos de outras origens", () => {
    const g = somarGasto(
      [{ dia: "2026-10-01", origem: "tiktok", brl: 50 }],
      [
        { dia: "2026-10-01", brl: 300 },
        { dia: "2026-10-01", brl: 200 },
        { dia: "2026-10-02", brl: 100 },
      ],
    );
    expect(g).toEqual({ totalBrl: 650, googleApiBrl: 600, manualBrl: 50 });
  });

  it("lançamento manual de google não conta em dobro no dia que a API trouxe", () => {
    const g = somarGasto(
      [{ dia: "2026-10-01", origem: "google", brl: 480 }],
      [{ dia: "2026-10-01", brl: 500 }],
    );
    expect(g).toEqual({ totalBrl: 500, googleApiBrl: 500, manualBrl: 0 });
  });

  it("dia com campanha que gastou zero também é dado da API", () => {
    const g = somarGasto(
      [{ dia: "2026-10-01", origem: "google", brl: 480 }],
      [{ dia: "2026-10-01", brl: 0 }],
    );
    expect(g.totalBrl).toBe(0);
  });

  it("sem API no dia, o lançamento manual de google vale (plano B)", () => {
    const g = somarGasto(
      [
        { dia: "2026-09-20", origem: "google", brl: 400 },
        { dia: "2026-10-01", origem: "google", brl: 480 },
      ],
      [{ dia: "2026-10-01", brl: 500 }],
    );
    expect(g).toEqual({ totalBrl: 900, googleApiBrl: 500, manualBrl: 400 });
  });

  it("sem nada, zero", () => {
    expect(somarGasto([], [])).toEqual({ totalBrl: 0, googleApiBrl: 0, manualBrl: 0 });
  });
});

describe("diasDaJanela (tabelas por DIA, no fuso de Brasília)", () => {
  // Meia-noite de Brasília é 03:00 UTC. Cortar o fim da janela em UTC dava a
  // data de HOJE pra janela "ontem", e o gasto de hoje entrava junto (02/10:
  // painel R$ 8.433 contra R$ 5.473 do Google).
  it("ontem é só ontem", () => {
    const inicio = new Date("2026-10-01T03:00:00.000Z"); // 01/10 00:00 BRT
    const fim = new Date("2026-10-02T03:00:00.000Z"); // 02/10 00:00 BRT
    expect(diasDaJanela(inicio, fim)).toEqual({ de: "2026-10-01", ate: "2026-10-01" });
  });
  it("hoje até agora, inclusive depois das 21h (quando o UTC já virou)", () => {
    const inicio = new Date("2026-10-02T03:00:00.000Z");
    expect(diasDaJanela(inicio, new Date("2026-10-02T18:00:00.000Z"))).toEqual({ de: "2026-10-02", ate: "2026-10-02" });
    expect(diasDaJanela(inicio, new Date("2026-10-03T01:30:00.000Z"))).toEqual({ de: "2026-10-02", ate: "2026-10-02" });
  });
  it("7 dias fechados", () => {
    expect(
      diasDaJanela(new Date("2026-09-25T03:00:00.000Z"), new Date("2026-10-02T03:00:00.000Z")),
    ).toEqual({ de: "2026-09-25", ate: "2026-10-01" });
  });
});
