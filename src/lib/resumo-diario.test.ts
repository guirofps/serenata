import { describe, expect, it } from "vitest";
import { canalDe, ontemEmBrasilia, resumirDia, somarDias, tipoUpsell } from "./resumo-diario";

describe("canalDe", () => {
  it("TikTok vence Google quando os dois aparecem (ttclid manda)", () => {
    expect(canalDe({ ttclid: "x", gclid: "y" })).toBe("TikTok");
  });
  it("gclid sem utm é Google", () => {
    expect(canalDe({ gclid: "abc" })).toBe("Google");
  });
  it("convite da página presente", () => {
    expect(canalDe({ utm_source: "presente" })).toBe("Convite");
    expect(canalDe({ ref: "K7M2QX" })).toBe("Indicação");
    // Anúncio primeiro e link depois: conta pro anúncio (first-touch).
    expect(canalDe({ gclid: "x", ref: "K7M2QX" })).toBe("Google");
  });
  it("sem atribuição é Direto", () => {
    expect(canalDe(null)).toBe("Direto");
    expect(canalDe({})).toBe("Direto");
  });
});

describe("tipoUpsell", () => {
  it("lê o tipo da referência", () => {
    expect(tipoUpsell("asaas:up:video:123")).toBe("video");
    expect(tipoUpsell("woovi:up:quadro:abc")).toBe("quadro");
    expect(tipoUpsell("asaas:up:tres:abc")).toBe("extra");
  });
  it("pedido da música, com ou sem sufixo de bump, não é upsell", () => {
    expect(tipoUpsell("serenata:548bf46d:v")).toBeNull();
    expect(tipoUpsell("PPCPMTB5HK04CEBNAG")).toBeNull();
  });
});

describe("resumirDia", () => {
  const base = { taxaBrl: 0.5, bumpQuadro: false, bumpVideo: false };
  const r = resumirDia({
    pedidos: [
      {
        ...base,
        paymentId: "woovi:a",
        valorBrl: 38,
        atribuicao: { utm_source: "google", utm_campaign: "111" },
      },
      {
        ...base,
        paymentId: "woovi:b:v",
        valorBrl: 57.9,
        bumpVideo: true,
        atribuicao: { gclid: "g", utm_campaign: "111" },
      },
      { ...base, paymentId: "woovi:c", valorBrl: 38, atribuicao: { ttclid: "t" } },
      { ...base, paymentId: "asaas:up:video:c", valorBrl: 24.9, atribuicao: null },
    ],
    gastoGoogle: [
      { campanhaId: "111", nome: "CAMPEÃO 2", gastoBrl: 60 },
      { campanhaId: "222", nome: "Parada", gastoBrl: 0 },
    ],
    gastoOutros: { tiktok: 20 },
    custoProducaoBrl: 5,
  });

  it("upsell soma na receita mas não conta como venda", () => {
    expect(r.vendas).toBe(3);
    expect(r.upsells.video).toEqual({ n: 1, brl: 24.9 });
    expect(r.receitaBrl).toBeCloseTo(158.8);
    expect(r.ticketBrl).toBeCloseTo(158.8 / 3);
  });
  it("bump é contagem dentro da venda", () => {
    expect(r.bumps).toEqual({ quadro: 0, video: 1 });
  });
  it("lucro tira mídia, produção e taxas", () => {
    expect(r.lucroBrl).toBeCloseTo(158.8 - 60 - 20 - 5 - 2);
  });
  it("CPA por campanha só com venda de Google daquela campanha; campanha sem gasto e sem venda some", () => {
    expect(r.porCampanha).toEqual([
      { id: "111", nome: "CAMPEÃO 2", gastoBrl: 60, vendas: 2, cpaBrl: 30 },
    ]);
  });
  it("canais em ordem de vendas", () => {
    expect(r.porCanal.map((c) => [c.canal, c.vendas])).toEqual([
      ["Google", 2],
      ["TikTok", 1],
    ]);
  });
});

describe("datas em Brasília", () => {
  it("às 01h de Brasília (04h UTC) ontem é o dia anterior", () => {
    expect(ontemEmBrasilia(new Date("2026-09-26T04:00:00Z"))).toBe("2026-09-25");
  });
  it("às 23h de Brasília (02h UTC do dia seguinte) ainda é o mesmo 'hoje'", () => {
    expect(ontemEmBrasilia(new Date("2026-09-26T02:00:00Z"))).toBe("2026-09-24");
  });
  it("somarDias atravessa mês", () => {
    expect(somarDias("2026-09-30", 1)).toBe("2026-10-01");
  });
});

describe("CPA de campanha que quase não gastou", () => {
  it("venda de clique antigo com gasto de centavos não vira CPA", () => {
    const r = resumirDia({
      pedidos: [
        {
          paymentId: "w:1",
          valorBrl: 38,
          taxaBrl: 0,
          bumpQuadro: false,
          bumpVideo: false,
          atribuicao: { gclid: "g", utm_campaign: "9" },
        },
      ],
      gastoGoogle: [{ campanhaId: "9", nome: "Velha", gastoBrl: 0.04 }],
      gastoOutros: {},
      custoProducaoBrl: 0,
    });
    expect(r.porCampanha[0]).toMatchObject({ vendas: 1, cpaBrl: null });
  });
});
