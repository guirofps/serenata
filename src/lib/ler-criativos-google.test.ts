// src/lib/ler-criativos-google.test.ts
import { describe, expect, it } from "vitest";
import { idDoAnuncio, lerClique } from "./ler-criativos-google";
import { lerAsset, lerLinhaAnuncio, lerLinhaCriativo, somarMetricasAnuncio, somarMetricasCriativo } from "./ler-criativos-google";

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


describe("lerLinhaAnuncio", () => {
  const base = {
    adGroupAd: {
      status: "ENABLED",
      ad: {
        id: "777",
        name: "Video Fone",
        type: "DEMAND_GEN_VIDEO_RESPONSIVE_AD",
        demandGenVideoResponsiveAd: { videos: [{ asset: "customers/1/assets/901" }] },
      },
    },
    campaign: { id: "44" },
    adGroup: { id: "55" },
    segments: { date: "2026-10-07" },
    metrics: {
      costMicros: "12500000",
      impressions: "1000",
      clicks: "20",
      videoTrueviewViews: "300",
      videoQuartileP25Rate: 0.5,
      videoQuartileP50Rate: 0.3,
      videoQuartileP75Rate: 0.2,
      videoQuartileP100Rate: 0.1,
      conversions: 2.5,
      conversionsValue: 95,
    },
  };
  it("lê anúncio, vídeos e métrica do dia", () => {
    expect(lerLinhaAnuncio(base)).toEqual({
      anuncio: { id: "777", campanha_id: "44", grupo_id: "55", nome: "Video Fone", tipo: "DEMAND_GEN_VIDEO_RESPONSIVE_AD", status: "ENABLED", videos: ["901"] },
      metrica: {
        dia: "2026-10-07", anuncio_id: "777", custo_brl: 12.5, impressoes: 1000, cliques: 20,
        views: 300, p25: 0.5, p50: 0.3, p75: 0.2, p100: 0.1, conversoes_google: 2.5, valor_conv_google: 95,
      },
    });
  });
  it("anúncio de vídeo in-stream e responsivo de vídeo também dão o asset", () => {
    const videoAd = { ...base, adGroupAd: { ad: { id: "1", videoAd: { video: { asset: "customers/1/assets/5" } } } } };
    expect(lerLinhaAnuncio(videoAd)?.anuncio.videos).toEqual(["5"]);
    const resp = { ...base, adGroupAd: { ad: { id: "2", videoResponsiveAd: { videos: [{ asset: "customers/1/assets/6" }, { asset: "customers/1/assets/7" }] } } } };
    expect(lerLinhaAnuncio(resp)?.anuncio.videos).toEqual(["6", "7"]);
  });
  it("sem métrica de vídeo, views e quartis são null", () => {
    const busca = { ...base, metrics: { costMicros: "0", impressions: "5", clicks: "1" } };
    const m = lerLinhaAnuncio(busca)?.metrica;
    expect(m?.views).toBeNull();
    expect(m?.p25).toBeNull();
    expect(m?.conversoes_google).toBe(0);
  });
  it("sem id não é anúncio", () => {
    expect(lerLinhaAnuncio({ adGroupAd: { ad: {} } })).toBeNull();
  });
});

describe("lerAsset", () => {
  it("vídeo do YouTube, imagem e texto", () => {
    expect(lerAsset({ asset: { id: "901", type: "YOUTUBE_VIDEO", youtubeVideoAsset: { youtubeVideoId: "abc123", youtubeVideoTitle: "Fone" } } }))
      .toEqual({ id: "901", tipo: "video", texto: null, youtube_id: "abc123", imagem_url: null, nome: "Fone" });
    expect(lerAsset({ asset: { id: "8", type: "IMAGE", name: "capa", imageAsset: { fullSize: { url: "https://tpc.googlesyndication.com/x.jpg" } } } }))
      .toEqual({ id: "8", tipo: "imagem", texto: null, youtube_id: null, imagem_url: "https://tpc.googlesyndication.com/x.jpg", nome: "capa" });
    expect(lerAsset({ asset: { id: "9", type: "TEXT", textAsset: { text: "Uma música só dela" } } }))
      .toEqual({ id: "9", tipo: "texto", texto: "Uma música só dela", youtube_id: null, imagem_url: null, nome: null });
  });
});

describe("lerLinhaCriativo", () => {
  it("lê o recurso e a métrica pelo campo", () => {
    const r = lerLinhaCriativo({
      adGroupAdAssetView: { fieldType: "HEADLINE" },
      asset: { id: "9", type: "TEXT", textAsset: { text: "Presente que emociona" } },
      segments: { date: "2026-10-07" },
      metrics: { impressions: "100", clicks: "3", costMicros: "2000000", conversions: 1 },
    });
    expect(r?.metrica).toEqual({
      dia: "2026-10-07", criativo_id: "9", campo: "HEADLINE", custo_brl: 2, impressoes: 100, cliques: 3,
      conversoes_google: 1, valor_conv_google: null,
    });
  });
});

it("somarMetricasCriativo junta o mesmo recurso de anúncios diferentes", () => {
  const m = (c: number | null, i: number | null) => ({
    dia: "2026-10-07", criativo_id: "9", campo: "HEADLINE", custo_brl: c, impressoes: i, cliques: null,
    conversoes_google: 1, valor_conv_google: null,
  });
  expect(somarMetricasCriativo([m(1, 10), m(null, 5)])).toEqual([
    { dia: "2026-10-07", criativo_id: "9", campo: "HEADLINE", custo_brl: 1, impressoes: 15, cliques: null, conversoes_google: 2, valor_conv_google: null },
  ]);
});

it("somarMetricasAnuncio junta o mesmo anúncio no mesmo dia (dois grupos), sem duplicar a chave do upsert", () => {
  const m = (imp: number, p25: number | null, views: number | null) => ({
    dia: "2026-10-07", anuncio_id: "777", custo_brl: 1, impressoes: imp, cliques: 1, views,
    p25, p50: p25, p75: p25, p100: p25, conversoes_google: 1, valor_conv_google: 10,
  });
  const r = somarMetricasAnuncio([m(100, 0.8, 10), m(300, 0.4, null)]);
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ impressoes: 400, custo_brl: 2, cliques: 2, views: 10, conversoes_google: 2, valor_conv_google: 20 });
  expect(r[0].p25).toBeCloseTo(0.5);
});
