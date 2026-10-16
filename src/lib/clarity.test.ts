import { describe, expect, it } from "vitest";
import { clarityDaMarca, scriptClarity } from "@/lib/clarity";
import { PREFIXOS } from "@/lib/rotas-sensiveis";

// O CLARITY GRAVA A TELA, e por isso a trava da rota sensível importa mais
// aqui do que no gtag: ele não leva só a URL, leva o que está desenhado nela.

/** Roda o script num navegador de mentira e devolve o que ele pediu ao Clarity. */
function rodar(inicio: string) {
  const chamadas: unknown[][] = [];
  const empurrados: string[] = [];
  const loc = { href: `https://www.serenatagift.com${inicio}` };
  const hist = {
    pushState(_s: unknown, _t: unknown, u?: string) {
      if (u != null) loc.href = new URL(u, loc.href).href;
      empurrados.push(String(u));
    },
    replaceState(_s: unknown, _t: unknown, u?: string) {
      if (u != null) loc.href = new URL(u, loc.href).href;
    },
  };
  const ouvintes: Record<string, () => void> = {};
  const win: Record<string, unknown> = {
    addEventListener: (ev: string, f: () => void) => (ouvintes[ev] = f),
    // A porta de `carregar-depois.ts`: aqui não insere nada, só registra.
    __depoisDaPagina: () => {},
  };
  const doc = {};
  new Function(
    "window",
    "document",
    "history",
    "location",
    scriptClarity("abc123", PREFIXOS, false),
  )(win, doc, hist, loc);
  const fila = () =>
    ((win.clarity as { q?: unknown[][] })?.q ?? []).map((a) => Array.from(a as ArrayLike<unknown>));
  return { win, hist, loc, ouvintes, chamadas, fila, empurrados };
}

describe("scriptClarity", () => {
  it("cria a fila na hora e deixa o arquivo remoto pra depois da página", () => {
    const s = scriptClarity("abc123", PREFIXOS, false);
    expect(s).toContain("https://www.clarity.ms/tag/");
    expect(s).toContain("abc123");
    expect(s).toContain("__depoisDaPagina");
    const { win } = rodar("/criar");
    expect(typeof win.clarity).toBe("function");
  });

  it("para de gravar ANTES de a URL virar uma rota com token", () => {
    const { hist, fila, empurrados } = rodar("/criar");
    hist.pushState({}, "", "/editar/tok123");
    expect(fila()).toContainEqual(["stop"]);
    // O stop entrou na fila antes do pushState original rodar.
    expect(empurrados).toEqual(["/editar/tok123"]);
  });

  it("volta a gravar quando sai da rota sensível", () => {
    const { hist, fila } = rodar("/criar");
    hist.pushState({}, "", "/p/abc");
    hist.pushState({}, "", "/criar?step=nome");
    expect(fila()).toEqual([["stop"], ["start"]]);
  });

  it("navegar entre rotas comuns não mexe na gravação", () => {
    const { hist, fila } = rodar("/criar");
    hist.pushState({}, "", "/criar?step=relacao");
    hist.replaceState({}, "", "/obrigado?code=x");
    expect(fila()).toEqual([]);
  });

  it("o voltar do navegador também conta", () => {
    const { loc, ouvintes, fila } = rodar("/criar");
    loc.href = "https://www.serenatagift.com/pix/ref1";
    ouvintes.popstate();
    expect(fila()).toContainEqual(["stop"]);
  });
});

describe("clarityDaMarca", () => {
  it("só a Serenata tem Clarity", () => {
    expect(clarityDaMarca("serenata")).toBe("yy5ylx8k5n");
    expect(clarityDaMarca("ballad")).toBeNull();
  });
});
