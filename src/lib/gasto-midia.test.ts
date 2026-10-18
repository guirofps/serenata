import { describe, expect, it } from "vitest";
import { cortarDiaDoGasto, diasDaJanela, gastoAteOMinuto, somarGasto, cpaDoCanal } from "./gasto-midia";

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
    expect(g).toEqual({ totalBrl: 650, googleApiBrl: 600, manualBrl: 50, googleBrl: 600, tiktokBrl: 50 });
  });

  it("lançamento manual de google não conta em dobro no dia que a API trouxe", () => {
    const g = somarGasto(
      [{ dia: "2026-10-01", origem: "google", brl: 480 }],
      [{ dia: "2026-10-01", brl: 500 }],
    );
    expect(g).toEqual({ totalBrl: 500, googleApiBrl: 500, manualBrl: 0, googleBrl: 500, tiktokBrl: 0 });
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
    expect(g).toEqual({ totalBrl: 900, googleApiBrl: 500, manualBrl: 400, googleBrl: 900, tiktokBrl: 0 });
  });

  it("sem nada, zero", () => {
    expect(somarGasto([], [])).toEqual({ totalBrl: 0, googleApiBrl: 0, manualBrl: 0, googleBrl: 0, tiktokBrl: 0 });
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

describe("o dia cortado da janela anterior (comparativo até a mesma hora)", () => {
  it("soma as horas inteiras antes do corte e a fração da hora corrente", () => {
    const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: h, brl: 100 }));
    // 14h30: 14 horas inteiras + meia hora das 14h
    expect(gastoAteOMinuto(porHora, 14 * 60 + 30)).toBe(1450);
    expect(gastoAteOMinuto(porHora, 0)).toBe(0);
    expect(gastoAteOMinuto([{ hora: 3, brl: 900 }, { hora: 20, brl: 50 }], 10 * 60)).toBe(900);
  });

  it("troca o Google do dia cortado pelo gasto até a hora e reduz o manual na fração do dia", () => {
    const r = cortarDiaDoGasto(
      [
        { dia: "2026-10-12", origem: "tiktok", brl: 240 },
        { dia: "2026-10-11", origem: "tiktok", brl: 100 },
      ],
      [
        { dia: "2026-10-12", brl: 4000 },
        { dia: "2026-10-12", brl: 2000 },
        { dia: "2026-10-11", brl: 5000 },
      ],
      { dia: "2026-10-12", minutoDoDia: 12 * 60, googleAteAgoraBrl: 1800 },
    );
    expect(somarGasto(r.manuais, r.google)).toEqual({ totalBrl: 1800 + 5000 + 120 + 100, googleApiBrl: 6800, manualBrl: 220, googleBrl: 6800, tiktokBrl: 220 });
  });

  it("sem o gasto por hora (API fora), o Google do dia cortado também é proporcional", () => {
    const r = cortarDiaDoGasto([], [{ dia: "2026-10-12", brl: 6000 }], { dia: "2026-10-12", minutoDoDia: 6 * 60, googleAteAgoraBrl: null });
    expect(somarGasto(r.manuais, r.google).totalBrl).toBe(1500);
  });
});

// O CPA do painel é SÓ do Google Ads (dono, 18/10): gasto do Google ÷ vendas
// do canal Google. Antes dividia o gasto de tudo pelas vendas de tudo, e as
// vendas de e-mail e orgânico baixavam o número (R$ 5,66 em 18/10).
describe("gasto do Google e CPA do Google", () => {
  it("o Google é a API mais o manual do Google em dia sem API", () => {
    const r = somarGasto(
      [
        { dia: "2026-10-17", origem: "google", brl: 50 }, // dia COM API: o manual some
        { dia: "2026-10-16", origem: "google", brl: 30 }, // dia sem API: entra
        { dia: "2026-10-17", origem: "tiktok", brl: 20 }, // não é Google
      ],
      [{ dia: "2026-10-17", brl: 100 }],
    );
    expect(r.googleBrl).toBe(130);
    expect(r.totalBrl).toBe(150);
  });

  it("CPA do Google divide pelas vendas do canal Google, não pelo total", () => {
    expect(cpaDoCanal(200, 8)).toBe(25);
  });

  it("sem venda do Google devolve 0, que o cartão mostra como —", () => {
    expect(cpaDoCanal(200, 0)).toBe(0);
  });
});

// O cartão "CPA TikTok" (18/10) só aparece com gasto lançado do TikTok.
describe("gasto do TikTok", () => {
  it("é o manual com origem tiktok, à parte do Google e do resto", () => {
    const r = somarGasto(
      [
        { dia: "2026-10-18", origem: "tiktok", brl: 120 },
        { dia: "2026-10-18", origem: "outro", brl: 30 },
      ],
      [{ dia: "2026-10-18", brl: 200 }],
    );
    expect(r.tiktokBrl).toBe(120);
    expect(r.googleBrl).toBe(200);
    expect(cpaDoCanal(r.tiktokBrl, 4)).toBe(30);
  });
});
