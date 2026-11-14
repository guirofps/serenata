import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  TEXTOS_GIFT,
  TEXTOS_TRENDING,
  textosMateriaEs,
  textosRegaloEs,
  PARA_QUEM_BALLAD,
} from "./lp-ballad";
import { LPS, lpsDaMarca } from "./lp-origem";
import type { VarianteConteudo } from "./mercados";

const VARIANTES: VarianteConteudo[] = ["eua", "mexico", "espanha", "latam", "argentina"];

/** Todo texto visível de um objeto de textos, achatado. */
function textos(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (typeof o === "function")
    return [String((o as (a: string, b: string) => string)("EMPRESA", "00.000.000/0000-00"))];
  if (Array.isArray(o)) return o.flatMap(textos);
  if (o && typeof o === "object") return Object.values(o).flatMap(textos);
  return [];
}

const TODOS = [
  ...VARIANTES.flatMap((v) => textos(textosRegaloEs(v))),
  ...VARIANTES.flatMap((v) => textos(textosMateriaEs(v))),
  ...textos(TEXTOS_GIFT),
  ...textos(TEXTOS_TRENDING),
];

describe("as pré-landings da Ballad", () => {
  it("sem travessão no texto", () => {
    for (const s of TODOS) expect(s, s).not.toMatch(/[—–]/);
  });

  it("sem preço nem moeda: o preço muda por país e só a oferta mostra", () => {
    for (const s of TODOS)
      expect(s, s).not.toMatch(/\$\s?\d|US\$|R\$|USD|MXN|€|\bdólar|\bpesos?\b|\bdollars?\b/i);
  });

  it("sem endereço e sem nome de pessoa física no rodapé", () => {
    const r = [
      textosMateriaEs("latam").rodape("ROCKETFY TECNOLOGIA LTDA", "69.498.792/0001-72"),
      TEXTOS_TRENDING.rodape("ROCKETFY TECNOLOGIA LTDA", "69.498.792/0001-72"),
    ];
    for (const s of r) {
      expect(s).not.toMatch(/Rua|Taubaté|Santo André|CEP|\d{5}-\d{3}/);
      expect(s).toContain("Ballad Gift");
      expect(s).toContain("CNPJ");
    }
  });

  it("`vos` só na Argentina; o resto fala `tú`", () => {
    const voseo = /\b(contás|escuchás|querés|escuchá|contá|podés|tenés)\b/i;
    for (const v of VARIANTES.filter((x) => x !== "argentina")) {
      for (const s of [...textos(textosRegaloEs(v)), ...textos(textosMateriaEs(v))])
        expect(s, `${v}: ${s}`).not.toMatch(voseo);
    }
    expect(textos(textosRegaloEs("argentina")).join(" ")).toMatch(voseo);
  });

  it("a Espanha diz móvil, o resto celular", () => {
    expect(textos(textosMateriaEs("espanha")).join(" ")).toContain("móvil");
    expect(textos(textosMateriaEs("espanha")).join(" ")).not.toContain("celular");
    expect(textos(textosMateriaEs("mexico")).join(" ")).toContain("celular");
  });

  it("o gráfico soma 100 e bate com o texto", () => {
    expect(PARA_QUEM_BALLAD.esposa + PARA_QUEM_BALLAD.namorada + PARA_QUEM_BALLAD.resto).toBe(100);
    for (const t of [textosMateriaEs("latam"), TEXTOS_TRENDING]) {
      expect(t.paraQuem).toContain(`${PARA_QUEM_BALLAD.esposa}%`);
      expect(t.grafico.reduce((a, g) => a + g.pct, 0)).toBe(100);
    }
  });
});

describe("as landings no painel e as rotas", () => {
  it("cada marca lê só as dele; a Serenata segue com as duas de sempre", () => {
    expect(lpsDaMarca("serenata").map((l) => l.id)).toEqual(["presente", "tendencia"]);
    expect(lpsDaMarca("ballad").map((l) => l.caminho)).toEqual([
      "/es/regalo",
      "/es/tendencia",
      "/gift",
      "/trending",
    ]);
    expect(new Set(LPS.map((l) => l.eventoCta)).size).toBe(LPS.length);
  });

  for (const arq of ["es.regalo.tsx", "gift.tsx", "es.tendencia.tsx", "trending.tsx"]) {
    it(`${arq} só existe na Ballad`, () => {
      const tsx = readFileSync(new URL(`../routes/${arq}`, import.meta.url), "utf8");
      expect(tsx).toContain('if (chaveDaMarca() !== "ballad") throw notFound();');
      expect(tsx).toContain('"noindex, follow"');
    });
  }

  // O carimbo só vale se as duas páginas chamarem: na visita e em TODO botão que leva ao quiz.
  for (const arq of ["LpRegaloBallad.tsx", "LpMateriaBallad.tsx"]) {
    it(`${arq} carimba a visita e os botões`, () => {
      const tsx = readFileSync(new URL(`../components/landing/${arq}`, import.meta.url), "utf8");
      expect(tsx).toContain("carimbarLp(lp)");
      expect(tsx).toContain("carimbarLp(lp, posicao)");
      const diretos = tsx.split("to={criar}").length - 1;
      const carimbados = tsx.split("irProCriar(").length - 1;
      expect(diretos).toBeGreaterThan(0);
      expect(carimbados).toBeGreaterThanOrEqual(diretos);
      // nenhuma página abre o quiz sozinha (o achado do CONSUMER_FINANCE)
      expect(tsx).not.toMatch(/navigate\(|window\.location/);
    });
  }
});
