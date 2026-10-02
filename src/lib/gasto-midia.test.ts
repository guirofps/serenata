import { describe, expect, it } from "vitest";
import { somarGasto } from "./gasto-midia";

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
