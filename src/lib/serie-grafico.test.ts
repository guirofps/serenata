import { describe, expect, it } from "vitest";
import { granularidadeDe, montarSerie } from "./admin-dados";

// A SÉRIE DO GRÁFICO PRINCIPAL, testada onde ela erra em silêncio: o FUSO.
//
// O `custos.porDia` que existia antes fatiava a string ISO em UTC
// (`created_at.slice(0,10)`), então uma venda da madrugada brasileira caía no
// dia anterior. Num gráfico de 30 barras ninguém percebe; num gráfico por HORA
// — que é o que o recorte "Hoje" passou a mostrar — a coluna aparece no lugar
// errado e a leitura do dia inteiro desanda.

/** O dia 20/08/2026 no fuso do Brasil, expresso em UTC (UTC-3). */
const DIA_20 = {
  inicio: new Date("2026-08-20T03:00:00.000Z"),
  fim: new Date("2026-08-21T03:00:00.000Z"),
  dias: 1,
};

const venda = (iso: string, brl = 100) => ({ quando: Date.parse(iso), brl });

describe("granularidadeDe", () => {
  it("um dia vira hora; mais que isso vira dia", () => {
    expect(granularidadeDe(1)).toBe("hora");
    expect(granularidadeDe(2)).toBe("dia");
    expect(granularidadeDe(30)).toBe("dia");
  });
});

describe("montarSerie — baldes de hora", () => {
  it("o dia tem 24 baldes, rotulados 00 a 23 no fuso do Brasil", () => {
    const s = montarSerie([], DIA_20, "hora");
    expect(s).toHaveLength(24);
    expect(s[0].rotulo).toBe("00");
    expect(s[23].rotulo).toBe("23");
  });

  it("A MADRUGADA FICA NO DIA CERTO — a regressão que este teste existe pra travar", () => {
    // 04:00Z é 01:00 no Brasil, ainda dia 20. Fatiando em UTC isso dava dia 20
    // também, mas 02:00Z (23:00 BR do dia 19) cairia no 20 — o erro de verdade.
    const s = montarSerie([venda("2026-08-20T04:00:00Z", 250)], DIA_20, "hora");
    expect(s[1].rotulo).toBe("01");
    expect(s[1].receitaBrl).toBe(250);
    expect(s.reduce((t, p) => t + p.receitaBrl, 0)).toBe(250);
  });

  it("uma venda às 23h do Brasil é o último balde, não o primeiro do dia seguinte", () => {
    // 23:30 BR = 02:30Z do dia 21.
    const s = montarSerie([venda("2026-08-21T02:30:00Z")], DIA_20, "hora");
    expect(s[23].receitaBrl).toBe(100);
  });

  it("venda de fora da janela é ignorada, não empurrada pra ponta", () => {
    const s = montarSerie(
      [venda("2026-08-19T12:00:00Z"), venda("2026-08-22T12:00:00Z")],
      DIA_20,
      "hora",
    );
    expect(s.reduce((t, p) => t + p.receitaBrl, 0)).toBe(0);
  });

  it("soma duas vendas do mesmo balde e conta as duas", () => {
    const s = montarSerie(
      [venda("2026-08-20T17:10:00Z", 37), venda("2026-08-20T17:50:00Z", 63)],
      DIA_20,
      "hora",
    );
    expect(s[14]).toMatchObject({ rotulo: "14", receitaBrl: 100, vendas: 2 });
  });
});

describe("montarSerie — o corte em agora", () => {
  it("`ate` para a série, pra a linha não despencar até o fim do dia", () => {
    // 10:00 BR = 13:00Z.
    const s = montarSerie([], DIA_20, "hora", Date.parse("2026-08-20T13:00:00Z"));
    expect(s).toHaveLength(10);
    expect(s[9].rotulo).toBe("09");
  });

  it("sem `ate`, vai até o fim da janela — é o caso do período anterior", () => {
    expect(montarSerie([], DIA_20, "hora")).toHaveLength(24);
  });
});

describe("montarSerie — baldes de dia", () => {
  const semana = {
    inicio: new Date("2026-08-14T03:00:00.000Z"),
    fim: new Date("2026-08-21T03:00:00.000Z"),
    dias: 7,
  };

  it("sete dias, sete baldes, rotulados dd/mm", () => {
    const s = montarSerie([], semana, "dia");
    expect(s).toHaveLength(7);
    expect(s[0].rotulo).toBe("14/08");
    expect(s[6].rotulo).toBe("20/08");
  });

  it("venda da madrugada entra no dia brasileiro, não no anterior", () => {
    // 00:30 BR do dia 20 = 03:30Z do dia 20.
    const s = montarSerie([venda("2026-08-20T03:30:00Z", 90)], semana, "dia");
    expect(s[6]).toMatchObject({ rotulo: "20/08", receitaBrl: 90 });
    expect(s[5].receitaBrl).toBe(0);
  });
});
