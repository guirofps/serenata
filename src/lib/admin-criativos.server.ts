// src/lib/admin-criativos.server.ts
// A LEITURA DA ABA "CRIATIVOS": só banco, nunca o Google (quem fala com o
// Google é o job `puxarCriativosAds`). A conta é `montarCriativos`.
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ehVenda } from "@/lib/painel-resumo";
import { cambioDoDia } from "@/lib/cambio";
import { lotesPorTamanho } from "@/lib/lotes";
import { montarCriativos, type Criativos, type VendaLigada } from "@/lib/criativos";
import type {
  AnuncioLido, CriativoLido, MetricaAnuncioLida, MetricaCriativoLida,
} from "@/lib/ler-criativos-google";

type Db = ReturnType<typeof supabaseAdmin>;
const diaBr = (d: Date) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);

async function emLotes<T>(ids: string[], ler: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const saida: T[] = [];
  for (const lote of lotesPorTamanho(ids)) saida.push(...(await ler(lote)));
  return saida;
}

/** Uma tabela por dia (cada dia é pequeno), página de 1000 dentro do dia. */
async function porDia<T>(db: Db, tabela: string, dias: string[]): Promise<T[]> {
  const partes = await Promise.all(
    dias.map(async (dia) => {
      const linhas: T[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await db.from(tabela).select("*").eq("dia", dia).range(de, de + 999);
        if (error) throw new Error(`${tabela}: ${error.message}`);
        linhas.push(...((data ?? []) as T[]));
        if (!data || data.length < 1000) break;
      }
      return linhas;
    }),
  );
  return partes.flat();
}

export async function carregarCriativos(janela: { inicio: Date; fim: Date }): Promise<Criativos & { atualizadoEm: string | null }> {
  const db = supabaseAdmin();
  const dias: string[] = [];
  for (let d = diaBr(janela.inicio); d <= diaBr(new Date(janela.fim.getTime() - 1)); ) {
    dias.push(d);
    const x = new Date(`${d}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + 1);
    d = x.toISOString().slice(0, 10);
  }

  // Vendas pagas no período, por cursor (paid_at, id).
  type Ped = { id: string; quiz_response_id: string | null; valor_centavos: number | null; status: string; dinheiro_entrou: boolean | null; paid_at: string };
  const pagos: Ped[] = [];
  let cursor: { paid_at: string; id: string } | null = null;
  for (;;) {
    let q = db
      .from("pedidos")
      .select("id, quiz_response_id, valor_centavos, status, dinheiro_entrou, paid_at")
      .eq("status", "pago")
      .gte("paid_at", janela.inicio.toISOString())
      .lt("paid_at", janela.fim.toISOString());
    if (cursor) q = q.or(`paid_at.gt."${cursor.paid_at}",and(paid_at.eq."${cursor.paid_at}",id.gt.${cursor.id})`);
    const { data, error } = await q.order("paid_at").order("id").limit(1000);
    if (error) throw new Error("pedidos: " + error.message);
    const pagina = (data ?? []) as Ped[];
    pagos.push(...pagina.filter(ehVenda));
    if (pagina.length < 1000) break;
    const u = pagina[pagina.length - 1];
    cursor = { paid_at: u.paid_at, id: u.id };
  }

  const quizIds = [...new Set(pagos.map((p) => p.quiz_response_id).filter((q): q is string => !!q))];
  const quizzes = await emLotes(quizIds, async (lote) => {
    const { data, error } = await db.from("quiz_responses").select("id, locale, gclid:attribution->>gclid").in("id", lote);
    if (error) throw new Error("quiz_responses: " + error.message);
    return (data ?? []) as Array<{ id: string; locale: string | null; gclid: string | null }>;
  });
  const quizPorId = new Map(quizzes.map((q) => [q.id, q]));
  const cambio = await cambioDoDia();

  const gclids = [...new Set(quizzes.map((q) => q.gclid).filter((g): g is string => !!g))];
  const cliques = await emLotes(gclids, async (lote) => {
    const { data, error } = await db.from("cliques_anuncio").select("gclid, anuncio_id, campanha_id").in("gclid", lote);
    if (error) throw new Error("cliques_anuncio: " + error.message);
    return (data ?? []) as Array<{ gclid: string; anuncio_id: string | null; campanha_id: string | null }>;
  });
  const cliquePorGclid = new Map(cliques.map((c) => [c.gclid, c]));

  const vendas: VendaLigada[] = [];
  for (const p of pagos) {
    const q = p.quiz_response_id ? quizPorId.get(p.quiz_response_id) : undefined;
    if (!q?.gclid) continue;
    const dolar = q.locale === "es" || q.locale === "en";
    vendas.push({
      anuncioId: cliquePorGclid.get(q.gclid)?.anuncio_id ?? null,
      achadoSemAnuncio: !!cliquePorGclid.get(q.gclid)?.campanha_id && !cliquePorGclid.get(q.gclid)?.anuncio_id,
      valorBrl: ((p.valor_centavos ?? 0) / 100) * (dolar ? cambio : 1),
    });
  }

  const [metricasAnuncio, metricasCriativo] = await Promise.all([
    porDia<MetricaAnuncioLida>(db, "metricas_anuncio", dias),
    porDia<MetricaCriativoLida>(db, "metricas_criativo", dias),
  ]);
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const mAnuncio = metricasAnuncio.map((m) => ({
    ...m, custo_brl: Number(m.custo_brl), impressoes: Number(m.impressoes), cliques: Number(m.cliques),
    views: num(m.views), p25: num(m.p25), p50: num(m.p50), p75: num(m.p75), p100: num(m.p100),
    conversoes_google: Number(m.conversoes_google), valor_conv_google: Number(m.valor_conv_google),
  }));
  const mCriativo = metricasCriativo.map((m) => ({
    ...m, custo_brl: num(m.custo_brl), impressoes: num(m.impressoes), cliques: num(m.cliques),
    conversoes_google: num(m.conversoes_google), valor_conv_google: num(m.valor_conv_google),
  }));

  const idsAnuncio = [...new Set([...mAnuncio.map((m) => m.anuncio_id), ...vendas.map((v) => v.anuncioId).filter((a): a is string => !!a)])];
  const anuncios = await emLotes(idsAnuncio, async (lote) => {
    const { data, error } = await db.from("anuncios_ads").select("id, campanha_id, grupo_id, nome, tipo, status, videos, atualizado_em").in("id", lote);
    if (error) throw new Error("anuncios_ads: " + error.message);
    return (data ?? []) as Array<AnuncioLido & { atualizado_em: string }>;
  });
  const idsCriativo = [...new Set([...mCriativo.map((m) => m.criativo_id), ...anuncios.flatMap((a) => a.videos ?? [])])];
  const criativos = await emLotes(idsCriativo, async (lote) => {
    const { data, error } = await db.from("criativos_ads").select("id, tipo, texto, youtube_id, imagem_url, nome").in("id", lote);
    if (error) throw new Error("criativos_ads: " + error.message);
    return (data ?? []) as CriativoLido[];
  });
  const idsCampanha = [...new Set(anuncios.map((a) => a.campanha_id).filter((c): c is string => !!c))];
  const campanhas = await emLotes(idsCampanha, async (lote) => {
    const { data, error } = await db.from("campanhas").select("id, nome").in("id", lote);
    if (error) throw new Error("campanhas: " + error.message);
    return (data ?? []) as Array<{ id: string; nome: string }>;
  });

  const atualizadoEm = anuncios.reduce<string | null>((m, a) => (!m || a.atualizado_em > m ? a.atualizado_em : m), null);
  return {
    ...montarCriativos({
      anuncios: anuncios.map((a) => ({ ...a, videos: a.videos ?? [] })),
      criativos,
      metricasAnuncio: mAnuncio,
      metricasCriativo: mCriativo,
      vendas,
      nomeCampanha: Object.fromEntries(campanhas.map((c) => [String(c.id), c.nome])),
    }),
    atualizadoEm,
  };
}
