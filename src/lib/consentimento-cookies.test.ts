import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAVE_COOKIES, paisPedeCookies, scriptConsentimento } from "@/lib/consentimento-cookies";
import { scriptTiktok } from "@/lib/tiktok-pixel";

// Roda o script do <head> de verdade, com o país e a resposta do caso.
function rodar(pais: string | null, resposta: string | null) {
  const janela: { dataLayer?: unknown[]; __cookiesPendentes?: boolean } = {};
  vi.stubGlobal("document", { documentElement: { getAttribute: () => pais } });
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k === CHAVE_COOKIES ? resposta : null) });
  vi.stubGlobal("window", janela);
  vi.stubGlobal("dataLayer", undefined);
  // `window.dataLayer` e o `dataLayer` solto são o mesmo objeto no navegador.
  Object.defineProperty(janela, "dataLayer", {
    configurable: true,
    get: () => (globalThis as unknown as { dataLayer?: unknown[] }).dataLayer,
    set: (v) => vi.stubGlobal("dataLayer", v),
  });
  new Function(scriptConsentimento())();
  const camadas = (janela.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>));
  return { camadas, pendente: janela.__cookiesPendentes };
}

afterEach(() => vi.unstubAllGlobals());

describe("aviso de cookies", () => {
  it("só a Espanha pede", () => {
    expect(paisPedeCookies("ES")).toBe(true);
    for (const p of ["MX", "US", "CO", "CL", "PE", "BR", null, undefined]) expect(paisPedeCookies(p)).toBe(false);
  });

  it("fora da Espanha o script não mexe em nada", () => {
    for (const p of ["MX", "US", null]) {
      const r = rodar(p, null);
      expect(r.camadas).toEqual([]);
      expect(r.pendente).toBeUndefined();
    }
  });

  it("na Espanha sem resposta, nega tudo e deixa o TikTok esperando", () => {
    const r = rodar("ES", null);
    const def = r.camadas.find((c) => c[0] === "consent" && c[1] === "default");
    expect(def?.[2]).toEqual({ ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
    expect(r.camadas.some((c) => c[1] === "update")).toBe(false);
    expect(r.pendente).toBe(true);
  });

  it("quem recusou continua negado", () => {
    const r = rodar("ES", "nao");
    expect(r.camadas.some((c) => c[1] === "update")).toBe(false);
    expect(r.pendente).toBe(true);
  });

  it("quem aceitou volta liberado, sem pergunta nova", () => {
    const r = rodar("ES", "sim");
    const up = r.camadas.find((c) => c[0] === "consent" && c[1] === "update");
    expect((up?.[2] as Record<string, string>).ad_storage).toBe("granted");
    expect(r.pendente).toBeUndefined();
  });

  it("o snippet do TikTok segura antes do primeiro evento", () => {
    const s = scriptTiktok("ABC123");
    expect(s.indexOf("holdConsent()")).toBeGreaterThan(s.indexOf("ttq.load('ABC123')"));
    expect(s.indexOf("holdConsent()")).toBeLessThan(s.indexOf("ttq.page()"));
  });
});
