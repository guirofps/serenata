// src/lib/ler-criativos-google.ts
// A LEITURA DAS RESPOSTAS DA API DO GOOGLE ADS (REST v25, chaves em camelCase,
// número inteiro como string). Pura e sem imports: o job grava o que sai daqui
// e o teste prende o formato. Os nomes de campo de vídeo mudam entre versões
// da API; se o Google renomear, o teste com a resposta gravada acusa.

export type Linha = Record<string, unknown>;

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function texto(v: unknown): string | null {
  return v === undefined || v === null || v === "" ? null : String(v);
}

export function idDoAnuncio(recurso: string | null | undefined): string | null {
  const m = /\/adGroupAds\/\d+~(\d+)$/.exec(String(recurso ?? ""));
  return m ? m[1] : null;
}

export type Clique = {
  gclid: string;
  anuncioId: string | null;
  grupoId: string | null;
  campanhaId: string | null;
  tipoCampanha: string | null;
  dia: string | null;
};

export function lerClique(r: Linha): Clique | null {
  const cv = obj(r.clickView);
  const gclid = texto(cv.gclid);
  if (!gclid) return null;
  return {
    gclid,
    anuncioId: idDoAnuncio(texto(cv.adGroupAd)),
    grupoId: texto(obj(r.adGroup).id),
    campanhaId: texto(obj(r.campaign).id),
    tipoCampanha: texto(obj(r.campaign).advertisingChannelType),
    dia: texto(obj(r.segments).date),
  };
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function idDoAsset(recurso: unknown): string | null {
  const m = /\/assets\/(\d+)$/.exec(String(recurso ?? ""));
  return m ? m[1] : null;
}

export type AnuncioLido = {
  id: string; campanha_id: string | null; grupo_id: string | null; nome: string | null;
  tipo: string | null; status: string | null; videos: string[];
};
export type MetricaAnuncioLida = {
  dia: string; anuncio_id: string; custo_brl: number; impressoes: number; cliques: number;
  views: number | null; p25: number | null; p50: number | null; p75: number | null; p100: number | null;
  conversoes_google: number; valor_conv_google: number;
};

export function lerLinhaAnuncio(r: Linha): { anuncio: AnuncioLido; metrica: MetricaAnuncioLida | null } | null {
  const aga = obj(r.adGroupAd);
  const ad = obj(aga.ad);
  const id = texto(ad.id);
  if (!id) return null;
  const listas = [obj(ad.demandGenVideoResponsiveAd).videos, obj(ad.videoResponsiveAd).videos];
  const videos: string[] = [];
  for (const l of listas) if (Array.isArray(l)) for (const v of l) { const a = idDoAsset(obj(v).asset); if (a) videos.push(a); }
  const avulso = idDoAsset(obj(obj(ad.videoAd).video).asset);
  if (avulso) videos.push(avulso);
  const anuncio: AnuncioLido = {
    id,
    campanha_id: texto(obj(r.campaign).id),
    grupo_id: texto(obj(r.adGroup).id),
    nome: texto(ad.name),
    tipo: texto(ad.type),
    status: texto(aga.status),
    videos: [...new Set(videos)],
  };
  const dia = texto(obj(r.segments).date);
  const m = obj(r.metrics);
  const metrica: MetricaAnuncioLida | null = dia
    ? {
        dia,
        anuncio_id: id,
        custo_brl: (num(m.costMicros) ?? 0) / 1e6,
        impressoes: num(m.impressions) ?? 0,
        cliques: num(m.clicks) ?? 0,
        views: num(m.videoTrueviewViews),
        p25: num(m.videoQuartileP25Rate),
        p50: num(m.videoQuartileP50Rate),
        p75: num(m.videoQuartileP75Rate),
        p100: num(m.videoQuartileP100Rate),
        conversoes_google: num(m.conversions) ?? 0,
        valor_conv_google: num(m.conversionsValue) ?? 0,
      }
    : null;
  return { anuncio, metrica };
}

export type CriativoLido = {
  id: string; tipo: "video" | "imagem" | "texto" | "outro"; texto: string | null;
  youtube_id: string | null; imagem_url: string | null; nome: string | null;
};
export type MetricaCriativoLida = {
  dia: string; criativo_id: string; campo: string; custo_brl: number | null; impressoes: number | null;
  cliques: number | null; conversoes_google: number | null; valor_conv_google: number | null;
};

export function lerAsset(r: Linha): CriativoLido | null {
  const a = obj(r.asset);
  const id = texto(a.id);
  if (!id) return null;
  const t = String(a.type ?? "");
  const yt = obj(a.youtubeVideoAsset);
  return {
    id,
    tipo: t === "YOUTUBE_VIDEO" ? "video" : t === "IMAGE" ? "imagem" : t === "TEXT" ? "texto" : "outro",
    texto: texto(obj(a.textAsset).text),
    youtube_id: texto(yt.youtubeVideoId),
    imagem_url: texto(obj(obj(a.imageAsset).fullSize).url),
    nome: texto(yt.youtubeVideoTitle) ?? texto(a.name),
  };
}

export function lerLinhaCriativo(r: Linha): { criativo: CriativoLido; metrica: MetricaCriativoLida | null } | null {
  const criativo = lerAsset(r);
  if (!criativo) return null;
  const dia = texto(obj(r.segments).date);
  const campo = texto(obj(r.adGroupAdAssetView).fieldType);
  const m = obj(r.metrics);
  const custo = num(m.costMicros);
  return {
    criativo,
    metrica:
      dia && campo
        ? {
            dia, criativo_id: criativo.id, campo,
            custo_brl: custo === null ? null : custo / 1e6,
            impressoes: num(m.impressions),
            cliques: num(m.clicks),
            conversoes_google: num(m.conversions),
            valor_conv_google: num(m.conversionsValue),
          }
        : null,
  };
}

const soma = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : a + b);

export function somarMetricasCriativo(ms: MetricaCriativoLida[]): MetricaCriativoLida[] {
  const por = new Map<string, MetricaCriativoLida>();
  for (const m of ms) {
    const k = `${m.dia}|${m.criativo_id}|${m.campo}`;
    const a = por.get(k);
    por.set(
      k,
      a
        ? {
            ...a,
            custo_brl: soma(a.custo_brl, m.custo_brl),
            impressoes: soma(a.impressoes, m.impressoes),
            cliques: soma(a.cliques, m.cliques),
            conversoes_google: soma(a.conversoes_google, m.conversoes_google),
            valor_conv_google: soma(a.valor_conv_google, m.valor_conv_google),
          }
        : { ...m },
    );
  }
  return [...por.values()];
}

/**
 * Uma linha por (dia, anúncio). O recurso `adGroupAds/{grupo}~{anúncio}`
 * permite o mesmo anúncio em dois grupos, e duas linhas com a mesma chave no
 * mesmo upsert fazem o Postgres recusar o lote inteiro. Quartis por média
 * ponderada pelas impressões.
 */
export function somarMetricasAnuncio(ms: MetricaAnuncioLida[]): MetricaAnuncioLida[] {
  const por = new Map<string, MetricaAnuncioLida>();
  const q = (a: number | null, ia: number, b: number | null, ib: number) =>
    a === null ? b : b === null ? a : ia + ib > 0 ? (a * ia + b * ib) / (ia + ib) : a;
  for (const m of ms) {
    const k = `${m.dia}|${m.anuncio_id}`;
    const a = por.get(k);
    if (!a) {
      por.set(k, { ...m });
      continue;
    }
    por.set(k, {
      ...a,
      custo_brl: a.custo_brl + m.custo_brl,
      impressoes: a.impressoes + m.impressoes,
      cliques: a.cliques + m.cliques,
      views: soma(a.views, m.views),
      p25: q(a.p25, a.impressoes, m.p25, m.impressoes),
      p50: q(a.p50, a.impressoes, m.p50, m.impressoes),
      p75: q(a.p75, a.impressoes, m.p75, m.impressoes),
      p100: q(a.p100, a.impressoes, m.p100, m.impressoes),
      conversoes_google: a.conversoes_google + m.conversoes_google,
      valor_conv_google: a.valor_conv_google + m.valor_conv_google,
    });
  }
  return [...por.values()];
}
