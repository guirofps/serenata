import { describe, expect, it } from "vitest";
import { dominioDoClique } from "./conversao-servidor";
import { scriptConfigGtag } from "./google-ads";
import { scriptCarregaGtag } from "./carregar-depois";

// 11/11: o serenatagift.com.br anuncia por outra conta do Google Ads. A venda vai
// pra conta do domínio do clique, e a tag do site é a da conta do domínio.

describe("dominioDoClique", () => {
  it(".com.br pelo domínio gravado na visita", () => {
    expect(dominioDoClique({ host: "serenatagift.com.br", gclid: "x" })).toBe("br");
    expect(dominioDoClique({ host: "www.serenatagift.com.br" })).toBe("br");
  });
  it("o do último clique vence o do primeiro toque", () => {
    expect(dominioDoClique({ host: "serenatagift.com", ultimo_clique: { em: "2026-11-11", gclid: "y", host: "serenatagift.com.br" } })).toBe("br");
  });
  it(".com, ou visita sem domínio gravado (de antes de 11/11), fica na conta de sempre", () => {
    expect(dominioDoClique({ host: "serenatagift.com", gclid: "x" })).toBe("com");
    expect(dominioDoClique({ gclid: "x" })).toBe("com");
    expect(dominioDoClique(null)).toBe("com");
  });
});

// Roda o script inline como o navegador rodaria, com o `location` de cada domínio.
function rodar(script: string, hostname: string) {
  const fila: unknown[][] = [];
  const carregados: string[] = [];
  const window: Record<string, unknown> = { __depoisDaPagina: (f: () => void) => f() };
  const document = { head: { appendChild: (s: { src: string }) => carregados.push(s.src) }, createElement: () => ({}) as { src: string } };
  const dataLayer = { push: (a: unknown[]) => fila.push(Array.from(a)) };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("window", "document", "location", "dataLayer", script.replace("window.dataLayer=window.dataLayer||[];", ""))(window, document, { hostname }, dataLayer);
  return { config: fila.filter((a) => a[0] === "config").map((a) => a[1]), carregados };
}

describe("tag por domínio", () => {
  it("o .com.br configura e carrega a conta dele; o .com, a de sempre", () => {
    const cfg = scriptConfigGtag("AW-1", "G-9", "AW-2");
    expect(rodar(cfg, "www.serenatagift.com.br").config).toEqual(["AW-2", "G-9"]);
    expect(rodar(cfg, "www.serenatagift.com").config).toEqual(["AW-1", "G-9"]);
    const carrega = scriptCarregaGtag("AW-1", false, "AW-2");
    expect(rodar(carrega, "serenatagift.com.br").carregados[0]).toMatch(/id=AW-2$/);
    expect(rodar(carrega, "serenatagift.com").carregados[0]).toMatch(/id=AW-1$/);
  });
  it("sem conta do .com.br (Ballad), o script é o de antes", () => {
    expect(rodar(scriptConfigGtag("AW-1", null), "www.balladgift.com").config).toEqual(["AW-1"]);
    expect(rodar(scriptCarregaGtag("AW-1", true), "www.balladgift.com").carregados[0]).toMatch(/id=AW-1$/);
  });
});
