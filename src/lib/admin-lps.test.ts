import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LPS, comLp, lpDe } from "./lp-origem";
import { resumoLps } from "./admin-lps";

describe("comLp (o carimbo da landing na atribuição)", () => {
  const agora = "2026-11-11T20:00:00.000Z";

  it("a visita carimba a landing sem apagar o que já havia", () => {
    const r = comLp({ gclid: "abc", captured_at: "2026-11-10T00:00:00.000Z" }, "presente", undefined, agora);
    expect(r).toEqual({ gclid: "abc", captured_at: "2026-11-10T00:00:00.000Z", lp: "presente", lp_em: agora });
  });

  it("sem atribuição nenhuma, nasce um toco com a hora (o primeiro toque junta por cima depois)", () => {
    expect(comLp(null, "tendencia", undefined, agora)).toEqual({ captured_at: agora, lp: "tendencia", lp_em: agora });
  });

  it("visitar a segunda landing NÃO troca a primeira", () => {
    const antes = { captured_at: agora, lp: "presente", lp_em: agora };
    expect(comLp(antes, "tendencia", undefined, "2026-11-12T00:00:00.000Z")).toBeNull();
  });

  it("o CLIQUE no botão decide: grava a landing do botão e a posição", () => {
    const antes = { captured_at: agora, lp: "presente", lp_em: agora };
    expect(comLp(antes, "tendencia", "barra", "2026-11-12T00:00:00.000Z")).toEqual({
      captured_at: agora,
      lp: "tendencia",
      lp_em: "2026-11-12T00:00:00.000Z",
      lp_botao: "barra",
    });
  });

  it("nada a regravar devolve null", () => {
    const antes = { captured_at: agora, lp: "presente", lp_em: agora, lp_botao: "final" };
    expect(comLp(antes, "presente", "final", agora)).toBeNull();
    expect(comLp(antes, "presente", undefined, agora)).toBeNull();
  });
});

describe("lpDe", () => {
  it("só reconhece landing que existe", () => {
    expect(lpDe({ lp: "presente" })).toBe("presente");
    expect(lpDe({ lp: "tendencia" })).toBe("tendencia");
    expect(lpDe({ lp: "outra" })).toBeNull();
    expect(lpDe({ utm_source: "tv" })).toBeNull();
    expect(lpDe(null)).toBeNull();
  });
});

describe("resumoLps", () => {
  const leads = [
    { id: "a", attribution: { lp: "presente", lp_botao: "barra" } },
    { id: "b", attribution: { lp: "presente" } },
    { id: "c", attribution: { lp: "tendencia", lp_botao: "final" } },
    { id: "d", attribution: { gclid: "x" } },
  ];

  it("uma linha por landing: visitas e cliques por sessão distinta, letras e vendas pelo carimbo do lead", () => {
    const r = resumoLps({
      visitas: [
        { session_id: "s1", path: "/presente" },
        { session_id: "s1", path: "/presente" },
        { session_id: "s2", path: "/presente" },
        { session_id: "s3", path: "/tendencia" },
        { session_id: "s9", path: "/criar" },
      ],
      cliques: [
        { session_id: "s1", event_name: "lp_presente_cta" },
        { session_id: "s1", event_name: "lp_presente_cta" },
        { session_id: "s3", event_name: "materia_cta" },
      ],
      leads,
      comMusica: new Set(["a", "c", "d"]),
      vendas: [
        { quiz_response_id: "a", receitaBrl: 38 },
        { quiz_response_id: "c", receitaBrl: 28 },
        { quiz_response_id: "d", receitaBrl: 38 },
        { quiz_response_id: null, receitaBrl: 38 },
      ],
    });
    expect(r.map((x) => x.id)).toEqual(LPS.map((l) => l.id));
    const p = r.find((x) => x.id === "presente")!;
    expect(p).toMatchObject({ visitas: 2, cliques: 1, cliquePct: 50, leads: 2, letras: 1, vendas: 1, receitaBrl: 38, conversaoPct: 50 });
    const t = r.find((x) => x.id === "tendencia")!;
    expect(t).toMatchObject({ visitas: 1, cliques: 1, cliquePct: 100, leads: 1, letras: 1, vendas: 1, receitaBrl: 28, conversaoPct: 100 });
  });

  it("leitura que falhou vira null, não zero, e o resto segue", () => {
    const r = resumoLps({ visitas: null, cliques: null, leads, comMusica: new Set(), vendas: [] });
    expect(r[0]).toMatchObject({ visitas: null, cliques: null, cliquePct: null, conversaoPct: null, leads: 2 });
  });
});

// O carimbo só vale se as duas páginas chamarem: na visita e em TODO botão que leva ao /criar.
describe("as duas landings carimbam a visita e os botões", () => {
  for (const [arq, lp] of [["presente.tsx", "presente"], ["tendencia.tsx", "tendencia"]] as const) {
    it(arq, () => {
      const tsx = readFileSync(new URL(`../routes/${arq}`, import.meta.url), "utf8");
      expect(tsx).toContain(`carimbarLp("${lp}")`);
      expect(tsx).toContain(`carimbarLp("${lp}", posicao)`);
      // todo `to="/criar"` da página passa pela função que carimba
      const diretos = tsx.split('to="/criar"').length - 1;
      const carimbados = tsx.split("irProCriar(").length - 1;
      expect(diretos).toBeGreaterThan(0);
      expect(carimbados).toBeGreaterThanOrEqual(diretos);
    });
  }
});
