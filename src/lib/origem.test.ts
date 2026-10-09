import { describe, expect, it } from "vitest";
import { chaveOrigem } from "./origem";

describe("chaveOrigem (tabela 'De onde vem')", () => {
  it("utm_source manda, com a campanha", () => {
    expect(chaveOrigem({ utm_source: "instagram", utm_campaign: "gleysi" })).toEqual({ origem: "instagram", campanha: "gleysi" });
  });
  it("link só com utm_campaign NÃO perde a campanha (link da influenciadora, 09/10)", () => {
    expect(chaveOrigem({ utm_campaign: "gleysi", referrer: "https://l.instagram.com/" })).toEqual({
      origem: "l.instagram.com",
      campanha: "gleysi",
    });
    expect(chaveOrigem({ utm_campaign: "gleysi" })).toEqual({ origem: "direto / orgânico", campanha: "gleysi" });
  });
  it("o resto continua como era", () => {
    expect(chaveOrigem({ gclid: "x", utm_campaign: "123" })).toEqual({ origem: "google (gclid)", campanha: "123" });
    expect(chaveOrigem({ fbclid: "x" })).toEqual({ origem: "meta (fbclid)", campanha: null });
    expect(chaveOrigem({ referrer: "https://www.serenatagift.com/blog" })).toEqual({ origem: "direto / orgânico", campanha: null });
    expect(chaveOrigem({ referrer: "lixo" })).toEqual({ origem: "referência", campanha: null });
    expect(chaveOrigem(null)).toEqual({ origem: "direto / orgânico", campanha: null });
  });
});
