// SÓ LEITURA: por campanha ligada, ONTEM (dia inteiro) e HOJE (até agora): gasto do Google + leads e vendas reais
// do banco (utm_campaign = id, primeiro toque). Uso: node scratch/_cpa-por-campanha.mjs [serenata|ballad]
import { readFileSync } from "node:fs";
import pg from "pg";
const MARCA = process.argv[2] ?? "serenata";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const eb = Object.fromEntries(readFileSync(".env.ballad.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^"|"$/g,"")]}));
const CID = MARCA === "ballad" ? "1060198776" : "6923198164";
const { access_token } = await (await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_ADS_CLIENT_ID,client_secret:env.GOOGLE_ADS_CLIENT_SECRET,refresh_token:env.GOOGLE_ADS_REFRESH_TOKEN,grant_type:"refresh_token"})})).json();
const cab={Authorization:"Bearer "+access_token,"developer-token":env.GOOGLE_ADS_DEVELOPER_TOKEN,"content-type":"application/json","login-customer-id":"3442238598"};
const q = async (query) => { const j = await (await fetch(`https://googleads.googleapis.com/v25/customers/${CID}/googleAds:search`, { method: "POST", headers: cab, body: JSON.stringify({ query }) })).json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0,400)); return j.results ?? []; };
const hoje = new Date(Date.now()-3*3600e3).toISOString().slice(0,10);
const ontem = new Date(Date.now()-27*3600e3).toISOString().slice(0,10);
const camp = await q(`SELECT campaign.id, campaign.name, campaign_budget.amount_micros FROM campaign WHERE campaign.status = 'ENABLED'`);
const met = await q(`SELECT campaign.id, segments.date, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${ontem}' AND '${hoje}' AND campaign.status = 'ENABLED'`);
const G = {}; for (const m of met) { G[m.campaign.id] ??= {}; G[m.campaign.id][m.segments.date] = Number(m.metrics.costMicros||0)/1e6; }
const c = MARCA === "ballad"
  ? new pg.Client({ host:"aws-0-us-east-1.pooler.supabase.com", port:5432, user:"postgres."+eb.SUPABASE_PROJECT_REF, password:eb.SUPABASE_DB_PASSWORD, database:"postgres", ssl:{rejectUnauthorized:false} })
  : (() => { const u = new URL(readFileSync("supabase/.temp/pooler-url","utf8").trim()); return new pg.Client({ host:u.hostname, port:Number(u.port||5432), user:decodeURIComponent(u.username), database:"postgres", password:env.SUPABASE_DB_PASSWORD, ssl:{rejectUnauthorized:false} }); })();
await c.connect(); await c.query("begin read only");
const ini = `${ontem}T03:00Z`;
const L = (await c.query(`select attribution->>'utm_campaign' k, to_char(created_at - interval '3 hour','YYYY-MM-DD') d, count(*) n from quiz_responses where created_at >= $1 and email is not null and attribution->>'utm_campaign' ~ '^[0-9]+$' group by 1,2`, [ini])).rows;
const V = (await c.query(`select q.attribution->>'utm_campaign' k, to_char(p.paid_at - interval '3 hour','YYYY-MM-DD') d, count(*) n, sum(p.valor_centavos) v from pedidos p join quiz_responses q on q.id=p.quiz_response_id where p.status='pago' and p.payment_id not like '%:up:%' and p.payment_id not like 'credito:%' and p.payment_id not like 'cortesia:%' and p.paid_at >= $1 and q.attribution->>'utm_campaign' ~ '^[0-9]+$' group by 1,2`, [ini])).rows;
await c.end();
const pega = (rows, id, d, f="n") => Number(rows.find(r=>r.k===id && r.d===d)?.[f] ?? 0);
const fmt = (g,l,v) => `R$ ${g.toFixed(0).padStart(5)} ${String(l).padStart(3)}L ${String(v).padStart(3)}V  CPL ${l? (g/l).toFixed(2).padStart(6):"   -  "} CPA ${v? (g/v).toFixed(0).padStart(4):"  - "}`;
const linhas = camp.map(x => { const id = x.campaign.id; const go = G[id]?.[ontem] ?? 0, gh = G[id]?.[hoje] ?? 0; return { nome: x.campaign.name, orc: Number(x.campaignBudget.amountMicros||0)/1e6, go, gh, lo: pega(L,id,ontem), ho: pega(L,id,hoje), vo: pega(V,id,ontem), vh: pega(V,id,hoje) }; }).filter(r=>r.go+r.gh>0).sort((a,b)=>(b.go+b.gh)-(a.go+a.gh));
console.log(`ontem ${ontem} (dia inteiro)                          | hoje ${hoje} (até agora)`);
for (const r of linhas) console.log(`${fmt(r.go,r.lo,r.vo)} | ${fmt(r.gh,r.ho,r.vh)} | orç ${r.orc.toFixed(0).padStart(4)} | ${r.nome}`);
const t = linhas.reduce((a,r)=>({go:a.go+r.go,gh:a.gh+r.gh,lo:a.lo+r.lo,ho:a.ho+r.ho,vo:a.vo+r.vo,vh:a.vh+r.vh}),{go:0,gh:0,lo:0,ho:0,vo:0,vh:0});
console.log(`TOTAL ${fmt(t.go,t.lo,t.vo)} | ${fmt(t.gh,t.ho,t.vh)}`);
