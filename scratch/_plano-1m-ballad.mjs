// SÓ LEITURA: vendas da Ballad por dia (14 dias), pro plano de 16/10.
import { readFileSync } from "node:fs"; import pg from "pg";
const env = Object.fromEntries(readFileSync(".env.ballad.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^"|"$/g,"")]}));
const c = new pg.Client({ host:"aws-0-us-east-1.pooler.supabase.com", port:5432, user:"postgres."+env.SUPABASE_PROJECT_REF, password:env.SUPABASE_DB_PASSWORD, database:"postgres", ssl:{rejectUnauthorized:false} });
await c.connect(); await c.query("begin read only");
const r = await c.query(`select (p.paid_at - interval '3 hours')::date dia, count(*) filter (where p.quiz_response_id is not null) vendas, count(*) filter (where p.quiz_response_id is null) ups, round(sum(p.valor_centavos)/100.0) usd,
  count(*) filter (where q.locale='es') es from pedidos p left join quiz_responses q on q.id=p.quiz_response_id where p.status='pago' and p.paid_at >= now() - interval '15 days' group by 1 order by 1`);
const g = await c.query(`select dia, round(sum(custo_brl)) custo from metricas_campanha where dia >= current_date - 15 group by dia order by dia`).catch(()=>({rows:[]}));
const G = Object.fromEntries(g.rows.map(x=>[x.dia.toISOString().slice(0,10), x.custo]));
for (const x of r.rows) { const d=x.dia.toISOString().slice(0,10); console.log(d, "vendas", x.vendas, "ups", x.ups, "US$", x.usd, "es", x.es, "gasto R$", G[d] ?? "?"); }
await c.end();
