// src/lib/ler-criativos-google.test.ts
import { describe, expect, it } from "vitest";
import { idDoAnuncio, lerClique } from "./ler-criativos-google";

describe("idDoAnuncio", () => {
  it("tira o id do anúncio do recurso", () => {
    expect(idDoAnuncio("customers/692/adGroupAds/1771~7123456789012")).toBe("7123456789012");
  });
  it("recurso estranho é null", () => {
    expect(idDoAnuncio(undefined)).toBeNull();
    expect(idDoAnuncio("customers/692/adGroups/1771")).toBeNull();
  });
});

describe("lerClique", () => {
  it("lê a linha do click_view (camelCase da API REST)", () => {
    expect(
      lerClique({
        clickView: { gclid: "Cj0K", adGroupAd: "customers/1/adGroupAds/55~66" },
        adGroup: { id: "55" },
        campaign: { id: "44", advertisingChannelType: "DEMAND_GEN" },
        segments: { date: "2026-10-07" },
      }),
    ).toEqual({ gclid: "Cj0K", anuncioId: "66", grupoId: "55", campanhaId: "44", tipoCampanha: "DEMAND_GEN", dia: "2026-10-07" });
  });
  it("sem gclid não é clique", () => {
    expect(lerClique({ clickView: {} })).toBeNull();
  });
});
