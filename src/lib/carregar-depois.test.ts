import { describe, it, expect } from "vitest";
import { scriptTiktok } from "./tiktok-pixel";
import { rotaDeConversao, scriptCarregaGtag, scriptDepoisDaPagina, scriptFontes } from "./carregar-depois";

// Os pixels esperam a página carregar, MENOS na página da venda (02/10).
function rodaTiktok(imediato: boolean) {
  let inseridos = 0;
  let guardado: (() => void) | null = null;
  const w: Record<string, unknown> = {
    __depoisDaPagina: (f: () => void, im: boolean) => (im ? f() : (guardado = f)),
  };
  const d = {
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: () => inseridos++ } }],
  };
  new Function("window", "document", scriptTiktok("ABC", imediato))(w, d);
  return { inseridos: () => inseridos, soltar: () => guardado?.(), w };
}

describe("carregar depois da página", () => {
  it("os scripts gerados são JavaScript válido", () => {
    for (const s of [scriptTiktok("A"), scriptTiktok("A", true), scriptCarregaGtag("AW-1", false), scriptDepoisDaPagina(), scriptFontes("https://x")])
      expect(() => new Function(s)).not.toThrow();
  });

  it("o TikTok cria a fila na hora mas só insere o arquivo quando a porta solta", () => {
    const t = rodaTiktok(false);
    expect(t.inseridos()).toBe(0);
    expect(Array.isArray(t.w.ttq)).toBe(true);
    t.soltar();
    expect(t.inseridos()).toBe(1);
  });

  it("na página da venda o TikTok insere na hora", () => {
    expect(rodaTiktok(true).inseridos()).toBe(1);
  });

  it("o gtag na /obrigado passa imediato=true; no resto, false", () => {
    expect(scriptCarregaGtag("AW-1", true)).toMatch(/,true\);$/);
    expect(scriptCarregaGtag("AW-1", false)).toMatch(/,false\);$/);
    expect(rotaDeConversao("/obrigado")).toBe(true);
    expect(rotaDeConversao("/es/gracias")).toBe(true);
    expect(rotaDeConversao("/criar")).toBe(false);
    expect(rotaDeConversao("/obrigadoxyz")).toBe(false);
  });
});
