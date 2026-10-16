// SÓ LEITURA: números por dia (30 dias) pro plano de R$ 1 milhão/mês (16/10).
import { readFileSync } from "node:fs";
import pg from "pg";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const u = new URL(readFileSync("supabase/.temp/pooler-url","utf8").trim());
const c = new pg.Client({ host:u.hostname, port:Number(u.port||5432), user:decodeURIComponent(u.username), database:"postgres", password:env.SUPABASE_DB_PASSWORD, ssl:{rejectUnauthorized:false} });
await c.connect(); await c.query("begin read only"); await c.query("set local statement_timeout = '60s'");
const r = await c.query(`
with p as (
  select (paid_at - interval '3 hours')::date dia, payment_id, valor_centavos, coalesce(dinheiro_entrou,true) din, quiz_response_id
  from pedidos where status='pago' and paid_at >= now() - interval '31 days'
)
select dia,
  count(*) filter (where din and payment_id not like '%:up:%' and quiz_response_id is not null) vendas,
  round(sum(valor_centavos) filter (where din and payment_id not like '%:up:%' and quiz_response_id is not null)/100.0) rec_musica,
  count(*) filter (where din and (payment_id like '%:up:%' or quiz_response_id is null)) upsells,
  round(sum(valor_centavos) filter (where din and (payment_id like '%:up:%' or quiz_response_id is null))/100.0) rec_upsell,
  round(sum(valor_centavos) filter (where din)/100.0) receita
from p group by dia order by dia`);
const leads = await c.query(`select (created_at - interval '3 hours')::date dia, count(*) leads from quiz_responses where created_at >= now() - interval '31 days' and email is not null and coalesce(locale,'pt')='pt' group by 1 order by 1`);
const gastos = await c.query(`select dia, origem, valor_brl from gastos_ads where dia >= current_date - 31 order by dia`);
const g = {}; for (const x of gastos.rows) { const d = x.dia.toISOString().slice(0,10); g[d] = g[d] || {}; g[d][x.origem] = Number(x.valor_brl); }
const camp = await c.query(`select dia, round(sum(custo_brl)) custo from metricas_campanha where dia >= current_date - 31 group by dia order by dia`).catch(e=>({rows:[]}));
const gc = Object.fromEntries(camp.rows.map(x=>[x.dia.toISOString().slice(0,10), Number(x.custo)]));
const L = Object.fromEntries(leads.rows.map(x=>[x.dia.toISOString().slice(0,10), Number(x.leads)]));
console.log("dia        vendas recMus  ups recUps receita  leads  conv  gastoGoogle gastoOutros");
for (const x of r.rows) { const d = x.dia.toISOString().slice(0,10); const gg = gc[d] ?? g[d]?.google ?? 0; const go = Object.entries(g[d]||{}).filter(([k])=>k!=="google").map(([k,v])=>`${k}:${v}`).join(","); console.log(d, String(x.vendas).padStart(6), String(x.rec_musica).padStart(6), String(x.upsells).padStart(4), String(x.rec_upsell).padStart(6), String(x.receita).padStart(7), String(L[d]??"").padStart(6), L[d]? (100*x.vendas/L[d]).toFixed(1)+"%":"", String(gg).padStart(8), go); }
await c.end();
