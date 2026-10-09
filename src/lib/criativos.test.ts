// src/lib/criativos.test.ts
import { describe, expect, it } from "vitest";
import { montarCriativos, miniaturaYoutube, ordenarPor, type EntradaCriativos } from "./criativos";

const anuncio = (id: string, videos: string[], nome = `ad ${id}`) => ({
  id, campanha_id: "c1", grupo_id: "g1", nome, tipo: "DEMAND_GEN_VIDEO_RESPONSIVE_AD", status: "ENABLED", videos,
});
const met = (anuncio_id: string, dia: string, custo: number, imp: number, extra: Partial<Record<string, number | null>> = {}) => ({
  dia, anuncio_id, custo_brl: custo, impressoes: imp, cliques: imp / 10, views: null, p25: null, p50: null, p75: null, p100: null,
  conversoes_google: 0, valor_conv_google: 0, ...extra,
});
const video = (id: string, yt: string) => ({ id, tipo: "video" as const, texto: null, youtube_id: yt, imagem_url: null, nome: `vídeo ${yt}` });

function entrada(p: Partial<EntradaCriativos>): EntradaCriativos {
  return { anuncios: [], criativos: [], metricasAnuncio: [], metricasCriativo: [], vendas: [], nomeCampanha: { c1: "CAMPEÃO 1#" }, ...p };
}

describe("anúncios (venda real)", () => {
  it("soma gasto e vendas, calcula CPA, ROAS e CTR", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", ["v1"])],
      criativos: [video("v1", "YT1")],
      metricasAnuncio: [met("a1", "2026-10-06", 60, 1000), met("a1", "2026-10-07", 40, 1000)],
      vendas: [{ anuncioId: "a1", valorBrl: 38 }, { anuncioId: "a1", valorBrl: 38 }],
    }));
    expect(r.anuncios[0]).toMatchObject({
      id: "a1", titulo: "ad a1", extra: "CAMPEÃO 1#", vendas: 2, receitaBrl: 76, gastoBrl: 100,
      cpaBrl: 50, roas: 0.76, impressoes: 2000, cliques: 200, ctr: 0.1, miniaturas: [miniaturaYoutube("YT1")],
    });
  });
  it("sem venda, CPA é null; sem gasto, ROAS é null", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", []), anuncio("a2", [])],
      metricasAnuncio: [met("a1", "2026-10-07", 50, 100)],
      vendas: [{ anuncioId: "a2", valorBrl: 38 }],
    }));
    const a1 = r.anuncios.find((x) => x.id === "a1");
    const a2 = r.anuncios.find((x) => x.id === "a2");
    expect(a1?.cpaBrl).toBeNull();
    expect(a2?.gastoBrl).toBe(0);
    expect(a2?.roas).toBeNull();
    expect(a2?.cpaBrl).toBeNull();
  });
  it("% assistido é a média ponderada pelas impressões", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", ["v1"])],
      criativos: [video("v1", "YT1")],
      metricasAnuncio: [
        met("a1", "2026-10-06", 1, 100, { p25: 0.8, p50: 0.4, p75: 0.2, p100: 0.1, views: 10 }),
        met("a1", "2026-10-07", 1, 300, { p25: 0.4, p50: 0.2, p75: 0.1, p100: 0.05, views: 20 }),
      ],
    }));
    const q = r.anuncios[0].assistido!;
    expect(q.p25).toBeCloseTo(0.5);
    expect(q.p50).toBeCloseTo(0.25);
    expect(q.p75).toBeCloseTo(0.125);
    expect(q.p100).toBeCloseTo(0.0625);
    expect(r.anuncios[0].views).toBe(30);
  });
  it("ordena por vendas, desempate pelo gasto, e esconde quem não teve impressão nem venda", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", []), anuncio("a2", []), anuncio("a3", []), anuncio("a4", [])],
      metricasAnuncio: [met("a1", "2026-10-07", 10, 100), met("a2", "2026-10-07", 90, 100), met("a3", "2026-10-07", 5, 100)],
      vendas: [{ anuncioId: "a3", valorBrl: 38 }],
    }));
    expect(r.anuncios.map((x) => x.id)).toEqual(["a3", "a2", "a1"]);
  });
  it("venda sem anúncio identificado vai pro rodapé", () => {
    const r = montarCriativos(entrada({ vendas: [{ anuncioId: null, valorBrl: 38 }, { anuncioId: "x", valorBrl: 38 }] }));
    expect(r.semAnuncio).toBe(1);
  });
  it("clique achado sem anúncio (PMAX) fica separado do não encontrado", () => {
    const r = montarCriativos(entrada({
      vendas: [
        { anuncioId: null, valorBrl: 38, achadoSemAnuncio: true },
        { anuncioId: null, valorBrl: 38 },
      ],
    }));
    expect(r.semAnuncio).toBe(1);
    expect(r.semAnuncioPmax).toBe(1);
  });
});

describe("vídeos (venda real)", () => {
  it("junta os anúncios que têm o vídeo como ÚNICO vídeo", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", ["v1"]), anuncio("a2", ["v1"]), anuncio("a3", ["v1", "v2"])],
      criativos: [video("v1", "YT1"), video("v2", "YT2")],
      metricasAnuncio: [met("a1", "2026-10-07", 10, 100), met("a2", "2026-10-07", 20, 100), met("a3", "2026-10-07", 70, 100)],
      vendas: [{ anuncioId: "a1", valorBrl: 38 }, { anuncioId: "a3", valorBrl: 38 }],
    }));
    expect(r.videos).toHaveLength(1);
    expect(r.videos[0]).toMatchObject({ id: "v1", titulo: "vídeo YT1", vendas: 1, gastoBrl: 30, link: "https://www.youtube.com/watch?v=YT1" });
  });
});

describe("títulos, descrições e imagens (conversão do Google)", () => {
  const texto = (id: string, t: string) => ({ id, tipo: "texto" as const, texto: t, youtube_id: null, imagem_url: null, nome: null });
  const mc = (criativo_id: string, campo: string, conv: number | null, custo: number | null, imp: number | null) => ({
    dia: "2026-10-07", criativo_id, campo, custo_brl: custo, impressoes: imp, cliques: imp === null ? null : imp / 20,
    conversoes_google: conv, valor_conv_google: null,
  });
  it("separa por campo, marca título longo e mantém null como null", () => {
    const r = montarCriativos(entrada({
      criativos: [texto("t1", "Presente que emociona"), texto("t2", "A história de vocês em música"), texto("d1", "Letra grátis"),
        { id: "i1", tipo: "imagem", texto: null, youtube_id: null, imagem_url: "https://x/i.jpg", nome: "capa" }],
      metricasCriativo: [
        mc("t1", "HEADLINE", 2, 20, 1000), mc("t2", "LONG_HEADLINE", 5, null, 500),
        mc("d1", "DESCRIPTION", null, null, null), mc("i1", "MARKETING_IMAGE", 1, 10, 200), mc("i1", "BUSINESS_LOGO", 9, 1, 1),
      ],
    }));
    expect(r.titulos.map((t) => [t.id, t.longo])).toEqual([["t2", true], ["t1", false]]);
    expect(r.titulos[0]).toMatchObject({ titulo: "A história de vocês em música", gastoBrl: null, custoPorConv: null, ctr: 0.05 });
    expect(r.titulos[1]).toMatchObject({ custoPorConv: 10 });
    expect(r.descricoes).toEqual([]);
    expect(r.imagens.map((i) => i.id)).toEqual(["i1"]);
    expect(r.imagens[0].miniatura).toBe("https://x/i.jpg");
  });
});

describe("ordenarPor (colunas clicáveis da aba)", () => {
  const linhas = [
    { id: "a", n: 10 as number | null, t: "Zebra" },
    { id: "b", n: null, t: "árvore" },
    { id: "c", n: 30, t: "Bola" },
    { id: "d", n: 20, t: "abacate" },
  ];
  it("número do maior pro menor e de volta; vazio sempre no fim", () => {
    expect(ordenarPor(linhas, (l) => l.n, "desc").map((l) => l.id)).toEqual(["c", "d", "a", "b"]);
    expect(ordenarPor(linhas, (l) => l.n, "asc").map((l) => l.id)).toEqual(["a", "d", "c", "b"]);
  });
  it("texto em ordem alfabética do português, sem diferenciar maiúscula e acento", () => {
    expect(ordenarPor(linhas, (l) => l.t, "asc").map((l) => l.id)).toEqual(["d", "b", "c", "a"]);
  });
  it("não mexe na lista original", () => {
    ordenarPor(linhas, (l) => l.n, "asc");
    expect(linhas.map((l) => l.id)).toEqual(["a", "b", "c", "d"]);
  });
});
