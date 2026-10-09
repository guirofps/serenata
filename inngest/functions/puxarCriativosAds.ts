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
import { diaAnterior, planejarConsultas } from "../../src/lib/dia-do-clique.js";
import { lerClique, type Clique } from "../../src/lib/ler-criativos-google.js";

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
    if (cursor) q = q.or(`paid_at.gt."${cursor.paid_at}",and(paid_at.eq."${cursor.paid_at}",id.gt.${cursor.id})`);
    const { data, error } = await q.order("paid_at").order("id").limit(1000);
    if (error) throw new Error("pedidos: " + error.message);
    for (const p of data ?? []) if (p.dinheiro_entrou !== false && p.quiz_response_id) quizIds.add(String(p.quiz_response_id));
    if (!data || data.length < 1000) break;
    const u = data[data.length - 1];
    cursor = { paid_at: String(u.paid_at), id: String(u.id) };
  }
  const ids = [...quizIds];
  const saida: { gclid: string; capturadoEm: string | null; utmCampaign: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("quiz_responses")
      .select("id, gclid:attribution->>gclid, capturado:attribution->>captured_at, campanha:attribution->>utm_campaign")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error("quiz_responses: " + error.message);
    for (const q of (data ?? []) as Array<Record<string, string | null>>) {
      if (q.gclid) saida.push({ gclid: q.gclid, capturadoEm: q.capturado ?? null, utmCampaign: q.campanha ?? null });
    }
  }
  return saida;
}

const aspas = (s: string) => `'${s.replace(/[^A-Za-z0-9_-]/g, "")}'`;

/** click_view de UM dia pros gclids pedidos, em lotes de 100. */
export async function consultarCliques(dia: string, gclids: string[], acesso: string): Promise<Clique[]> {
  const achados: Clique[] = [];
  for (let i = 0; i < gclids.length; i += 100) {
    const lote = gclids.slice(i, i + 100).map(aspas).join(", ");
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

export const puxarCriativosAds = inngest.createFunction(
  { id: "puxar-criativos-ads", retries: 2, concurrency: 1, triggers: [{ event: "criativos/sonda" }] },
  async ({ step }) => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !process.env.GOOGLE_ADS_CUSTOMER_ID) return { pulado: "sem credenciais" };
    const db = createClient(url, key, { auth: { persistSession: false } });

    return step.run("sonda", async () => {
      const acesso = await tokenGoogleAds();
      const fuso = await fusoDaConta(acesso);
      const vendas = await lerVendasComClique(db, new Date(Date.now() - 7 * 86400000).toISOString());
      const plano = planejarConsultas(vendas, fuso, new Date(), 8);
      const achados = new Map<string, Clique>();
      for (const { dia, gclids } of plano) {
        for (const c of await consultarCliques(dia, gclids, acesso)) achados.set(c.gclid, c);
        const faltam = gclids.filter((g) => !achados.has(g));
        if (faltam.length) for (const c of await consultarCliques(diaAnterior(dia), faltam, acesso)) achados.set(c.gclid, c);
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
      const resumo = { fuso, vendasComGclid: vistos.size, diasConsultados: plano.length, porTipo };
      console.log("[criativos] sonda", JSON.stringify(resumo));
      return resumo;
    });
  },
);
