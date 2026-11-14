import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// TESTE `preco_co`: o HTML do preço. Os três braços vão na página e o CSS dos
// experimentos esconde os que não foram sorteados; sem a linha na config, o
// HTML tem que ser o de antes (senão os três preços apareceriam lado a lado).

type Cfg = { id: string; ativo: boolean; exposicaoPct: number; nota: string; variantes: Array<{ nome: string; peso: number }> };

const PRECO_CO = (extra: Partial<Cfg> = {}): Cfg => ({
  id: "preco_co",
  ativo: true,
  exposicaoPct: 100,
  nota: "",
  variantes: [
    { nome: "A", peso: 1 },
    { nome: "B", peso: 1 },
    { nome: "C", peso: 1 },
  ],
  ...extra,
});

let NaMoeda: typeof import("./PrecoDaOferta").NaMoeda;
let exp: typeof import("@/lib/experimentos");

async function carregar(marca: "ballad" | "") {
  vi.unstubAllEnvs();
  if (marca) vi.stubEnv("VITE_MARCA", marca);
  vi.resetModules();
  exp = await import("@/lib/experimentos");
  NaMoeda = (await import("./PrecoDaOferta")).NaMoeda;
}

function html(config: Cfg[], props: { texto: string; semTeste?: boolean; como?: (t: string) => string }) {
  exp.definirConfigDoServidor(config);
  return renderToStaticMarkup(createElement(NaMoeda, props));
}

/** Só o pedaço em peso colombiano. */
function cop(h: string): string {
  const ini = h.indexOf('<span class="preco-cop">');
  const fim = h.indexOf('<span class="preco-clp">');
  return h.slice(ini, fim);
}

describe("NaMoeda na Ballad com o preco_co", () => {
  beforeAll(() => carregar("ballad"));
  afterEach(() => exp._resetConfigDoServidorParaTeste());

  it("ligado: o peso colombiano leva um span por braço, com o preço de cada um", () => {
    const h = cop(html([PRECO_CO()], { texto: "US$ 19" }));
    expect(h).toBe(
      '<span class="preco-cop">' +
        '<span data-v="preco_co:A">$39.900 COP</span>' +
        '<span data-v="preco_co:B">$29.900 COP</span>' +
        '<span data-v="preco_co:C">$34.900 COP</span>' +
        "</span>",
    );
  });

  it("a âncora também: $99.900, $74.900, $74.900", () => {
    const h = cop(html([PRECO_CO()], { texto: "US$ 49" }));
    expect(h).toContain('<span data-v="preco_co:A">$99.900 COP</span>');
    expect(h).toContain('<span data-v="preco_co:B">$74.900 COP</span>');
    expect(h).toContain('<span data-v="preco_co:C">$74.900 COP</span>');
  });

  it("a frase em volta (`como`) entra em cada braço", () => {
    const h = cop(html([PRECO_CO()], { texto: "US$ 19", como: (p) => `Desde ${p}` }));
    expect(h).toContain('<span data-v="preco_co:B">Desde $29.900 COP</span>');
  });

  it("as outras moedas não mudam", () => {
    const com = html([PRECO_CO()], { texto: "US$ 19" });
    const sem = html([], { texto: "US$ 19" });
    expect(com.replace(cop(com), "")).toBe(sem.replace(cop(sem), ""));
    expect(com).toContain('<span class="preco-mxn">$199 MXN</span>');
  });

  it("SEM a linha na config: um preço só, o de hoje", () => {
    expect(cop(html([], { texto: "US$ 19" }))).toBe('<span class="preco-cop">$39.900 COP</span>');
  });

  it("desligado: um preço só, o de hoje", () => {
    expect(cop(html([PRECO_CO({ ativo: false })], { texto: "US$ 19" }))).toBe('<span class="preco-cop">$39.900 COP</span>');
  });

  it("vídeo e extra: um preço só, mesmo com o teste ligado", () => {
    expect(cop(html([PRECO_CO()], { texto: "US$ 12" }))).toBe('<span class="preco-cop">$25.900 COP</span>');
    expect(cop(html([PRECO_CO()], { texto: "US$ 14" }))).toBe('<span class="preco-cop">$29.900 COP</span>');
  });

  it("`semTeste` (pós-compra): um preço só, o de hoje", () => {
    expect(cop(html([PRECO_CO()], { texto: "US$ 19", semTeste: true }))).toBe('<span class="preco-cop">$39.900 COP</span>');
  });

  it("braço zerado pelo peso desenha o preço do controle", () => {
    const zerado = PRECO_CO({ variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 0 }, { nome: "C", peso: 1 }] });
    expect(cop(html([zerado], { texto: "US$ 19" }))).toContain('<span data-v="preco_co:B">$39.900 COP</span>');
  });

  it("o CSS dos experimentos tem a regra de cada braço e a do controle pra quem ficou sem carimbo", () => {
    const css = exp.cssExperimentos([PRECO_CO()]);
    expect(css).toContain('[data-v="preco_co:A"],[data-v="preco_co:B"],[data-v="preco_co:C"]{display:none}');
    for (const b of ["A", "B", "C"]) {
      expect(css).toContain(`html[data-exp-preco_co="${b}"] [data-v="preco_co:${b}"]{display:contents}`);
    }
    expect(css).toContain('html[data-exp-preco_co="fora"] [data-v="preco_co:A"]{display:contents}');
    expect(css).toContain('html:not([data-exp-preco_co]) [data-v="preco_co:A"]{display:contents}');
  });
});

describe("NaMoeda na Ballad com o preco_mx", () => {
  beforeAll(() => carregar("ballad"));
  afterEach(() => exp._resetConfigDoServidorParaTeste());

  const PRECO_MX = (extra: Partial<Cfg> = {}): Cfg => ({ ...PRECO_CO(), id: "preco_mx", ...extra });
  /** Só o pedaço em peso mexicano. */
  const mxn = (h: string) => h.slice(h.indexOf('<span class="preco-mxn">'), h.indexOf('<span class="preco-eur">'));

  it("ligado: o peso mexicano leva um span por braço", () => {
    expect(mxn(html([PRECO_MX()], { texto: "US$ 19" }))).toBe(
      '<span class="preco-mxn">' +
        '<span data-v="preco_mx:A">$199 MXN</span>' +
        '<span data-v="preco_mx:B">$149 MXN</span>' +
        '<span data-v="preco_mx:C">$249 MXN</span>' +
        "</span>",
    );
    const ancora = mxn(html([PRECO_MX()], { texto: "US$ 49" }));
    expect(ancora).toContain('<span data-v="preco_mx:A">$549 MXN</span>');
    expect(ancora).toContain('<span data-v="preco_mx:B">$399 MXN</span>');
    expect(ancora).toContain('<span data-v="preco_mx:C">$699 MXN</span>');
  });

  it("sem a linha, desligado, vídeo, extra e pós-compra: um preço só", () => {
    expect(mxn(html([], { texto: "US$ 19" }))).toBe('<span class="preco-mxn">$199 MXN</span>');
    expect(mxn(html([PRECO_MX({ ativo: false })], { texto: "US$ 19" }))).toBe('<span class="preco-mxn">$199 MXN</span>');
    expect(mxn(html([PRECO_MX()], { texto: "US$ 12" }))).toBe('<span class="preco-mxn">$129 MXN</span>');
    expect(mxn(html([PRECO_MX()], { texto: "US$ 14" }))).toBe('<span class="preco-mxn">$149 MXN</span>');
    expect(mxn(html([PRECO_MX()], { texto: "US$ 19", semTeste: true }))).toBe('<span class="preco-mxn">$199 MXN</span>');
  });

  it("os dois testes ligados juntos: cada moeda com os braços do SEU teste", () => {
    const h = html([PRECO_CO(), PRECO_MX()], { texto: "US$ 19" });
    expect(mxn(h)).toContain('data-v="preco_mx:B">$149 MXN');
    expect(mxn(h)).not.toContain("preco_co");
    expect(cop(h)).toContain('data-v="preco_co:B">$29.900 COP');
    expect(cop(h)).not.toContain("preco_mx");
  });

  it("só a linha da Colômbia ligada: o México fica como é", () => {
    expect(mxn(html([PRECO_CO()], { texto: "US$ 19" }))).toBe('<span class="preco-mxn">$199 MXN</span>');
  });
});

describe("NaMoeda na Serenata", () => {
  beforeAll(() => carregar(""));
  afterEach(() => exp._resetConfigDoServidorParaTeste());

  it("texto puro, com ou sem a linha do teste", () => {
    expect(html([PRECO_CO()], { texto: "R$ 38" })).toBe("R$ 38");
    expect(html([], { texto: "R$ 38" })).toBe("R$ 38");
  });
});
