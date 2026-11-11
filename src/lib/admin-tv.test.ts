import { describe, expect, it } from "vitest";
import { ehDaTv, resumoTv } from "./admin-tv";

describe("ehDaTv", () => {
  it("reconhece o utm_source do QR, sem ligar pra maiúscula", () => {
    expect(ehDaTv({ utm_source: "tv", utm_medium: "qrcode" })).toBe(true);
    expect(ehDaTv({ utm_source: " TV " })).toBe(true);
  });
  it("não confunde com outra origem nem com atribuição vazia", () => {
    expect(ehDaTv({ utm_source: "tiktok" })).toBe(false);
    expect(ehDaTv({ utm_source: "tvglobo" })).toBe(false);
    expect(ehDaTv({ utm_medium: "qrcode" })).toBe(false);
    expect(ehDaTv(null)).toBe(false);
  });
});

describe("resumoTv", () => {
  const leads = [
    { id: "a", attribution: { utm_source: "tv" } },
    { id: "b", attribution: { utm_source: "tv" } },
    { id: "c", attribution: { gclid: "x" } },
  ];

  it("conta visitas por sessão distinta, e letras e vendas só dos leads da TV", () => {
    const r = resumoTv({
      sessoesVisita: ["s1", "s1", "s2", "s3"],
      leads,
      comMusica: new Set(["a", "c"]),
      vendas: [
        { quiz_response_id: "a", receitaBrl: 38 },
        { quiz_response_id: "c", receitaBrl: 38 },
        { quiz_response_id: null, receitaBrl: 38 },
      ],
    });
    expect(r).toEqual({ visitas: 3, leads: 2, letras: 1, vendas: 1, receitaBrl: 38, conversaoPct: (1 / 3) * 100 });
  });

  it("leitura de visitas que falhou vira null, não zero", () => {
    const r = resumoTv({ sessoesVisita: null, leads, comMusica: new Set(), vendas: [] });
    expect(r.visitas).toBeNull();
    expect(r.conversaoPct).toBeNull();
    expect(r.leads).toBe(2);
  });

  it("sem visita, a conversão não divide por zero", () => {
    const r = resumoTv({ sessoesVisita: [], leads: [], comMusica: new Set(), vendas: [] });
    expect(r).toMatchObject({ visitas: 0, conversaoPct: null, vendas: 0 });
  });
});
