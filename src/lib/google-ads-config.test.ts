import { describe, expect, it } from "vitest";
import { GOOGLE_ADS_ID, scriptConfigGtag } from "./google-ads";

// A CONTA NOVA (17/10). O GA4 era DESTINO da tag da conta suspensa
// (`GT-5TWGDWC6` / `AW-16919557808`): trocar só o AW deixaria o GA4 sem dado
// nenhum. Agora ele é configurado pelo próprio site, ao lado do Ads.
describe("scriptConfigGtag — Ads e GA4 configurados pelo site", () => {
  it("configura o Ads e o GA4, nessa ordem, depois do gtag('js')", () => {
    const s = scriptConfigGtag("AW-1", "G-1");
    expect(s).toContain("gtag('js',new Date());");
    expect(s.indexOf("gtag('config','AW-1')")).toBeGreaterThan(s.indexOf("gtag('js'"));
    expect(s.indexOf("gtag('config','G-1')")).toBeGreaterThan(s.indexOf("gtag('config','AW-1')"));
  });
  it("sem GA4, só o Ads", () => {
    expect(scriptConfigGtag("AW-1", null)).not.toContain("G-");
  });
  it("a Serenata aponta pra conta nova, nunca pra suspensa", () => {
    expect(GOOGLE_ADS_ID).toBe("AW-18519340909");
  });
});
