// inngest/functions/puxarCriativosAds.ts
// OS CRIATIVOS DO GOOGLE ADS, PRO RANKING DA ABA "CRIATIVOS" (08/10).
// Spec: docs/superpowers/specs/2026-10-08-aba-criativos-design.md
//
// Nesta primeira versão, só a SONDA (`criativos/sonda`): mede se o
// `click_view` acha os cliques das vendas por tipo de campanha, sem gravar
// nada. Se vídeo/Demand Gen não aparecer, o desenho muda (plano B da spec).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "../client.js";
import { consultarGoogleAds, fusoDaConta, tokenGoogleAds } from "../lib/google-ads.js";
import {
  diaAnterior,
  planejarConsultas,
  precisaConsultar,
  type RegistroClique,
} from "../../src/lib/dia-do-clique.js";
import { lotesPorTamanho } from "../../src/lib/lotes.js";
import { tentar } from "../../src/lib/tentar.js";
import {
  lerAsset,
  lerClique,
  lerLinhaAnuncio,
  lerLinhaCriativo,
  somarMetricasAnuncio,
  somarMetricasCriativo,
  type AnuncioLido,
  type Clique,
  type CriativoLido,
  type MetricaAnuncioLida,
  type MetricaCriativoLida,
} from "../../src/lib/ler-criativos-google.js";

/** Vendas pagas desde `desdeIso` cujo quiz tem gclid, com a hora da captura. */
export async function lerVendasComClique(
  db: SupabaseClient,
  desdeIso: string,
): Promise<{ gclid: string; capturadoEm: string | null; utmCampaign: string | null }[]> {
  const quizIds = new Set<string>();
  let cursor: { paid_at: string; id: string } | null = null;
  for (;;) {
    let q = db
      .from("pedidos")
      .select("id, quiz_response_id, paid_at, status, dinheiro_entrou")
      .eq("status", "pago")
      .gte("paid_at", desdeIso);
    if (cursor)
      q = q.or(
        `paid_at.gt."${cursor.paid_at}",and(paid_at.eq."${cursor.paid_at}",id.gt.${cursor.id})`,
      );
    const { data, error } = await q.order("paid_at").order("id").limit(1000);
    if (error) throw new Error("pedidos: " + error.message);
    for (const p of data ?? [])
      if (p.dinheiro_entrou !== false && p.quiz_response_id)
        quizIds.add(String(p.quiz_response_id));
    if (!data || data.length < 1000) break;
    const u = data[data.length - 1];
    cursor = { paid_at: String(u.paid_at), id: String(u.id) };
  }
  const ids = [...quizIds];
  const saida: { gclid: string; capturadoEm: string | null; utmCampaign: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("quiz_responses")
      .select(
        "id, gclid:attribution->>gclid, capturado:attribution->>captured_at, campanha:attribution->>utm_campaign",
      )
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error("quiz_responses: " + error.message);
    for (const q of (data ?? []) as Array<Record<string, string | null>>) {
      if (q.gclid)
        saida.push({
          gclid: q.gclid,
          capturadoEm: q.capturado ?? null,
          utmCampaign: q.campanha ?? null,
        });
    }
  }
  return saida;
}

const aspas = (s: string) => `'${s.replace(/[^A-Za-z0-9_-]/g, "")}'`;

/** click_view de UM dia pros gclids pedidos, em lotes de 100. */
export async function consultarCliques(
  dia: string,
  gclids: string[],
  acesso: string,
): Promise<Clique[]> {
  const achados: Clique[] = [];
  for (let i = 0; i < gclids.length; i += 100) {
    const lote = gclids
      .slice(i, i + 100)
      .map(aspas)
      .join(", ");
    const linhas = await consultarGoogleAds(
      `SELECT click_view.gclid, click_view.ad_group_ad, ad_group.id, campaign.id,
              campaign.advertising_channel_type, segments.date
       FROM click_view
       WHERE segments.date = '${dia}' AND click_view.gclid IN (${lote})`,
      acesso,
    );
    for (const l of linhas) {
      const c = lerClique(l);
      if (c) achados.push(c);
    }
  }
  return achados;
}

const DIAS = 7;
/** `2026-10-08` no fuso da conta, `desloc` dias atrás. */
function diaDaConta(fuso: string, desloc: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - desloc * 86400000));
}

async function gravarEmLotes(
  db: SupabaseClient,
  tabela: string,
  linhas: object[],
  onConflict: string,
) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db.from(tabela).upsert(linhas.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${tabela}: ${error.message}`);
  }
}

/** As consultas de relatório, também usadas pela sonda (com LIMIT 5) pra
 * acusar nome de campo errado ANTES da primeira coleta. */
const gaqlAnuncios = (de: string, ate: string) => `
        SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status,
               ad_group_ad.ad.video_ad.video.asset,
               ad_group_ad.ad.video_responsive_ad.videos,
               ad_group_ad.ad.demand_gen_video_responsive_ad.videos,
               campaign.id, ad_group.id, segments.date,
               metrics.cost_micros, metrics.impressions, metrics.clicks,
               metrics.video_trueview_views,
               metrics.video_quartile_p25_rate, metrics.video_quartile_p50_rate,
               metrics.video_quartile_p75_rate, metrics.video_quartile_p100_rate,
               metrics.conversions, metrics.conversions_value
        FROM ad_group_ad
        WHERE segments.date BETWEEN '${de}' AND '${ate}'`;
const gaqlRecursos = (de: string, ate: string) => `
        SELECT ad_group_ad_asset_view.field_type,
               asset.id, asset.type, asset.name, asset.text_asset.text,
               asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title,
               asset.image_asset.full_size.url,
               segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.conversions_value
        FROM ad_group_ad_asset_view
        WHERE segments.date BETWEEN '${de}' AND '${ate}'`;

export const puxarCriativosAds = inngest.createFunction(
  {
    id: "puxar-criativos-ads",
    retries: 2,
    concurrency: 1,
    triggers: [{ cron: "50 * * * *" }, { event: "criativos/sonda" }],
  },
  async ({ event, step }) => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !process.env.GOOGLE_ADS_CUSTOMER_ID) return { pulado: "sem credenciais" };
    const db = createClient(url, key, { auth: { persistSession: false } });

    if (event.name === "criativos/sonda") {
      return step.run("sonda", async () => {
        const acesso = await tokenGoogleAds();
        const fuso = await fusoDaConta(acesso);
        const vendas = await lerVendasComClique(
          db,
          new Date(Date.now() - 7 * 86400000).toISOString(),
        );
        const plano = planejarConsultas(vendas, fuso, new Date(), 8);
        const achados = new Map<string, Clique>();
        for (const { dia, gclids } of plano) {
          for (const c of await consultarCliques(dia, gclids, acesso)) achados.set(c.gclid, c);
          const faltam = gclids.filter((g) => !achados.has(g));
          if (faltam.length)
            for (const c of await consultarCliques(diaAnterior(dia), faltam, acesso))
              achados.set(c.gclid, c);
        }
        // Quem NÃO foi achado, pelo tipo da campanha da utm (tabela `campanhas`).
        const { data: camps } = await db.from("campanhas").select("id, tipo");
        const tipoDe = new Map((camps ?? []).map((c) => [String(c.id), String(c.tipo)]));
        const porTipo: Record<string, { achados: number; faltando: number }> = {};
        const conta = (tipo: string, campo: "achados" | "faltando") => {
          porTipo[tipo] ??= { achados: 0, faltando: 0 };
          porTipo[tipo][campo]++;
        };
        const vistos = new Set<string>();
        for (const v of vendas) {
          if (vistos.has(v.gclid)) continue;
          vistos.add(v.gclid);
          const c = achados.get(v.gclid);
          if (c) conta(c.tipoCampanha ?? "?", "achados");
          else conta(tipoDe.get(v.utmCampaign ?? "") ?? "sem campanha conhecida", "faltando");
        }
        const hoje = diaDaConta(fuso, 0);
        const ontem = diaDaConta(fuso, 1);
        const chaves = async (gaql: string) =>
          tentar("sonda", async () => {
            const [l] = await consultarGoogleAds(`${gaql} LIMIT 5`, acesso);
            return l
              ? Object.keys(l).map((k) => `${k}: ${Object.keys((l[k] as object) ?? {}).join(",")}`)
              : ["(sem linhas)"];
          });
        const consultas = {
          anuncios: await chaves(gaqlAnuncios(ontem, hoje)),
          recursos: await chaves(gaqlRecursos(ontem, hoje)),
        };
        const resumo = {
          fuso,
          vendasComGclid: vistos.size,
          diasConsultados: plano.length,
          porTipo,
          consultas,
        };
        console.log("[criativos] sonda", JSON.stringify(resumo));
        return resumo;
      });
    }

    const fuso = await step.run("fuso", async () => fusoDaConta());
    const de = diaDaConta(fuso, DIAS - 1);
    const ate = diaDaConta(fuso, 0);
    const agoraIso = () => new Date().toISOString();

    const anuncios = await step.run("anuncios", () =>
      tentar("anuncios", async () => {
        const linhas = await consultarGoogleAds(gaqlAnuncios(de, ate));
        const porId = new Map<string, AnuncioLido>();
        const metricas: MetricaAnuncioLida[] = [];
        for (const l of linhas) {
          const x = lerLinhaAnuncio(l);
          if (!x) continue;
          porId.set(x.anuncio.id, x.anuncio);
          if (x.metrica) metricas.push(x.metrica);
        }
        await gravarEmLotes(
          db,
          "anuncios_ads",
          [...porId.values()].map((a) => ({ ...a, atualizado_em: agoraIso() })),
          "id",
        );
        await gravarEmLotes(db, "metricas_anuncio", somarMetricasAnuncio(metricas), "dia,anuncio_id");
        return { anuncios: porId.size, metricas: metricas.length };
      }),
    );

    const criativos = await step.run("criativos", () =>
      tentar("criativos", async () => {
        const porId = new Map<string, CriativoLido>();
        for (const l of await consultarGoogleAds(`
        SELECT asset.id, asset.type, asset.name,
               asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title
        FROM asset WHERE asset.type = 'YOUTUBE_VIDEO'`)) {
          const a = lerAsset(l);
          if (a) porId.set(a.id, a);
        }
        const metricas: MetricaCriativoLida[] = [];
        for (const l of await consultarGoogleAds(gaqlRecursos(de, ate))) {
          const x = lerLinhaCriativo(l);
          if (!x) continue;
          porId.set(x.criativo.id, x.criativo);
          if (x.metrica) metricas.push(x.metrica);
        }
        const somadas = somarMetricasCriativo(metricas);
        await gravarEmLotes(
          db,
          "criativos_ads",
          [...porId.values()].map((c) => ({ ...c, atualizado_em: agoraIso() })),
          "id",
        );
        await gravarEmLotes(db, "metricas_criativo", somadas, "dia,criativo_id,campo");
        return { criativos: porId.size, metricas: somadas.length };
      }),
    );

    const cliques = await step.run("cliques", () =>
      tentar("cliques", async () => {
        const acesso = await tokenGoogleAds();
        const vendas = await lerVendasComClique(
          db,
          new Date(Date.now() - 89 * 86400000).toISOString(),
        );
        // Já resolvido, ou tentado nas últimas 24h: não consulta de novo.
        const conhecidos = new Set<string>();
        const gclids = [...new Set(vendas.map((v) => v.gclid))];
        const agora = new Date();
        for (const lote of lotesPorTamanho(gclids)) {
          const { data, error } = await db
            .from("cliques_anuncio")
            .select("gclid, anuncio_id, campanha_id, dia, tentado_em")
            .in("gclid", lote);
          if (error) throw new Error("cliques_anuncio: " + error.message);
          for (const c of (data ?? []) as Array<RegistroClique & { gclid: string }>) {
            if (!precisaConsultar(c, agora, fuso)) conhecidos.add(String(c.gclid));
          }
        }
        const plano = planejarConsultas(
          vendas.filter((v) => !conhecidos.has(v.gclid)),
          fuso,
          new Date(),
          30,
        );
        let achados = 0;
        let faltando = 0;
        let falhas = 0;
        for (const { dia, gclids: doDia } of plano) {
          try {
            const vistos = new Map<string, Clique>();
            for (const c of await consultarCliques(dia, doDia, acesso)) vistos.set(c.gclid, c);
            const resto = doDia.filter((g) => !vistos.has(g));
            if (resto.length)
              for (const c of await consultarCliques(diaAnterior(dia), resto, acesso))
                vistos.set(c.gclid, c);
            const linhas = doDia.map((g) => {
              const c = vistos.get(g);
              return {
                gclid: g,
                anuncio_id: c?.anuncioId ?? null,
                grupo_id: c?.grupoId ?? null,
                campanha_id: c?.campanhaId ?? null,
                dia: c?.dia ?? dia,
                tentado_em: agoraIso(),
              };
            });
            await gravarEmLotes(db, "cliques_anuncio", linhas, "gclid");
            achados += linhas.filter((l) => l.anuncio_id).length;
            faltando += linhas.filter((l) => !l.anuncio_id).length;
          } catch (err) {
            // Um dia que falha não derruba os outros: tenta de novo na próxima hora.
            falhas++;
            console.error("[criativos] click_view do dia", dia, "falhou:", err);
          }
        }
        return { dias: plano.length, achados, faltando, falhas };
      }),
    );

    console.log("[criativos]", JSON.stringify({ anuncios, criativos, cliques }));
    return { anuncios, criativos, cliques };
  },
);
