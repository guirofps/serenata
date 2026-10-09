// src/lib/criativos.ts
// A CONTA DA ABA "CRIATIVOS" (08/10). Pura: recebe as linhas já lidas do
// banco e devolve os rankings. Spec: docs/superpowers/specs/2026-10-08-aba-criativos-design.md
//
// Dois números, de propósito: vídeo e anúncio pela VENDA REAL (pedido pago,
// ligado ao anúncio pelo gclid); título, descrição e imagem pela conversão
// que o GOOGLE atribui, porque o gclid não diz qual título apareceu.
import type {
  AnuncioLido, CriativoLido, MetricaAnuncioLida, MetricaCriativoLida,
} from "./ler-criativos-google";

export type VendaLigada = { anuncioId: string | null; valorBrl: number };
export type EntradaCriativos = {
  anuncios: AnuncioLido[];
  criativos: CriativoLido[];
  metricasAnuncio: MetricaAnuncioLida[];
  metricasCriativo: MetricaCriativoLida[];
  vendas: VendaLigada[];
  nomeCampanha: Record<string, string>;
};
export type LinhaVenda = {
  id: string; titulo: string; extra: string | null; miniaturas: string[]; link: string | null;
  vendas: number; receitaBrl: number; gastoBrl: number; cpaBrl: number | null; roas: number | null;
  impressoes: number; cliques: number; ctr: number | null; views: number | null;
  assistido: { p25: number; p50: number; p75: number; p100: number } | null;
};
export type LinhaGoogle = {
  id: string; campo: string; titulo: string; longo: boolean; miniatura: string | null;
  conversoes: number | null; valorConv: number | null; gastoBrl: number | null; custoPorConv: number | null;
  impressoes: number | null; cliques: number | null; ctr: number | null;
};
export type Criativos = {
  videos: LinhaVenda[]; anuncios: LinhaVenda[]; titulos: LinhaGoogle[]; descricoes: LinhaGoogle[];
  imagens: LinhaGoogle[]; semAnuncio: number;
};

export const miniaturaYoutube = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

type Acumulado = {
  vendas: number; receita: number; gasto: number; imp: number; cliques: number;
  views: number | null; pesoQ: number; q: { p25: number; p50: number; p75: number; p100: number };
};
const vazio = (): Acumulado => ({ vendas: 0, receita: 0, gasto: 0, imp: 0, cliques: 0, views: null, pesoQ: 0, q: { p25: 0, p50: 0, p75: 0, p100: 0 } });

function juntar(a: Acumulado, b: Acumulado): Acumulado {
  return {
    vendas: a.vendas + b.vendas, receita: a.receita + b.receita, gasto: a.gasto + b.gasto,
    imp: a.imp + b.imp, cliques: a.cliques + b.cliques,
    views: a.views === null ? b.views : b.views === null ? a.views : a.views + b.views,
    pesoQ: a.pesoQ + b.pesoQ,
    q: { p25: a.q.p25 + b.q.p25, p50: a.q.p50 + b.q.p50, p75: a.q.p75 + b.q.p75, p100: a.q.p100 + b.q.p100 },
  };
}

const visivel = (a: Acumulado) => a.imp > 0 || a.vendas > 0;
const porVendas = (x: LinhaVenda, y: LinhaVenda) => y.vendas - x.vendas || y.gastoBrl - x.gastoBrl;

function linhaVenda(
  id: string, titulo: string, extra: string | null, miniaturas: string[], link: string | null, a: Acumulado,
): LinhaVenda {
  return {
    id, titulo, extra, miniaturas, link,
    vendas: a.vendas, receitaBrl: a.receita, gastoBrl: a.gasto,
    cpaBrl: a.vendas > 0 && a.gasto > 0 ? a.gasto / a.vendas : null,
    roas: a.gasto > 0 ? a.receita / a.gasto : null,
    impressoes: a.imp, cliques: a.cliques, ctr: a.imp > 0 ? a.cliques / a.imp : null,
    views: a.views,
    assistido: a.pesoQ > 0
      ? { p25: a.q.p25 / a.pesoQ, p50: a.q.p50 / a.pesoQ, p75: a.q.p75 / a.pesoQ, p100: a.q.p100 / a.pesoQ }
      : null,
  };
}

const ehImagem = (campo: string) => campo.endsWith("IMAGE") && !campo.includes("LOGO");

export function montarCriativos(e: EntradaCriativos): Criativos {
  const criativoPorId = new Map(e.criativos.map((c) => [c.id, c]));
  const anuncioPorId = new Map(e.anuncios.map((a) => [a.id, a]));

  // ── por anúncio ──
  const acc = new Map<string, Acumulado>();
  const pegar = (id: string) => acc.get(id) ?? vazio();
  for (const m of e.metricasAnuncio) {
    const a = pegar(m.anuncio_id);
    a.gasto += m.custo_brl;
    a.imp += m.impressoes;
    a.cliques += m.cliques;
    if (m.views !== null) a.views = (a.views ?? 0) + m.views;
    if (m.p25 !== null && m.impressoes > 0) {
      a.pesoQ += m.impressoes;
      a.q.p25 += (m.p25 ?? 0) * m.impressoes;
      a.q.p50 += (m.p50 ?? 0) * m.impressoes;
      a.q.p75 += (m.p75 ?? 0) * m.impressoes;
      a.q.p100 += (m.p100 ?? 0) * m.impressoes;
    }
    acc.set(m.anuncio_id, a);
  }
  let semAnuncio = 0;
  for (const v of e.vendas) {
    if (!v.anuncioId) { semAnuncio++; continue; }
    const a = pegar(v.anuncioId);
    a.vendas++;
    a.receita += v.valorBrl;
    acc.set(v.anuncioId, a);
  }

  const youtubeDe = (assetId: string) => criativoPorId.get(assetId)?.youtube_id ?? null;
  const anuncios = [...acc.entries()]
    .filter(([, a]) => visivel(a))
    .map(([id, a]) => {
      const ad = anuncioPorId.get(id);
      const yts = (ad?.videos ?? []).map(youtubeDe).filter((y): y is string => !!y);
      return linhaVenda(
        id, ad?.nome || `Anúncio ${id}`, ad?.campanha_id ? e.nomeCampanha[ad.campanha_id] ?? ad.campanha_id : null,
        yts.map(miniaturaYoutube), null, a,
      );
    })
    .sort(porVendas);

  // ── por vídeo: só anúncio com UM vídeo, pra não inventar divisão ──
  const porVideo = new Map<string, Acumulado>();
  for (const [id, a] of acc) {
    const vids = anuncioPorId.get(id)?.videos ?? [];
    if (vids.length !== 1) continue;
    porVideo.set(vids[0], juntar(porVideo.get(vids[0]) ?? vazio(), a));
  }
  const videos = [...porVideo.entries()]
    .filter(([, a]) => visivel(a))
    .map(([assetId, a]) => {
      const c = criativoPorId.get(assetId);
      const yt = c?.youtube_id ?? null;
      return linhaVenda(
        assetId, c?.nome || yt || `Vídeo ${assetId}`, null, yt ? [miniaturaYoutube(yt)] : [],
        yt ? `https://www.youtube.com/watch?v=${yt}` : null, a,
      );
    })
    .sort(porVendas);

  // ── recursos pelo Google ──
  const somaN = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : a + b);
  const porRecurso = new Map<string, MetricaCriativoLida>();
  for (const m of e.metricasCriativo) {
    const k = `${m.criativo_id}|${m.campo}`;
    const a = porRecurso.get(k);
    porRecurso.set(k, a ? {
      ...a,
      custo_brl: somaN(a.custo_brl, m.custo_brl), impressoes: somaN(a.impressoes, m.impressoes),
      cliques: somaN(a.cliques, m.cliques), conversoes_google: somaN(a.conversoes_google, m.conversoes_google),
      valor_conv_google: somaN(a.valor_conv_google, m.valor_conv_google),
    } : { ...m });
  }
  const linhasGoogle = [...porRecurso.values()]
    .filter((m) => (m.impressoes ?? 0) > 0 || (m.conversoes_google ?? 0) > 0)
    .map((m): LinhaGoogle => {
      const c = criativoPorId.get(m.criativo_id);
      return {
        id: m.criativo_id, campo: m.campo,
        titulo: c?.texto || c?.nome || `Recurso ${m.criativo_id}`,
        longo: m.campo === "LONG_HEADLINE",
        miniatura: c?.imagem_url ?? null,
        conversoes: m.conversoes_google, valorConv: m.valor_conv_google, gastoBrl: m.custo_brl,
        custoPorConv: m.custo_brl !== null && m.custo_brl > 0 && (m.conversoes_google ?? 0) > 0
          ? m.custo_brl / (m.conversoes_google as number) : null,
        impressoes: m.impressoes, cliques: m.cliques,
        ctr: m.impressoes && m.cliques !== null ? m.cliques / m.impressoes : null,
      };
    })
    .sort((x, y) => (y.conversoes ?? 0) - (x.conversoes ?? 0) || (y.gastoBrl ?? 0) - (x.gastoBrl ?? 0));

  return {
    videos,
    anuncios,
    titulos: linhasGoogle.filter((l) => l.campo === "HEADLINE" || l.campo === "LONG_HEADLINE"),
    descricoes: linhasGoogle.filter((l) => l.campo === "DESCRIPTION" || l.campo === "LONG_DESCRIPTION"),
    imagens: linhasGoogle.filter((l) => ehImagem(l.campo)),
    semAnuncio,
  };
}
