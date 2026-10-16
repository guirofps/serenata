// SÓ LEITURA: ritmo de HOJE contra ONTEM e contra 7 dias atrás, na mesma hora: gasto do Google por hora e por campanha,
// leads e vendas do banco. Uso: node scratch/_ritmo-hoje.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const { access_token } = await (await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_ADS_CLIENT_ID,client_secret:env.GOOGLE_ADS_CLIENT_SECRET,refresh_token:env.GOOGLE_ADS_REFRESH_TOKEN,grant_type:"refresh_token"})})).json();
const cab={Authorization:"Bearer "+access_token,"developer-token":env.GOOGLE_ADS_DEVELOPER_TOKEN,"content-type":"application/json","login-customer-id":"3442238598"};
const q = async (query) => { const j = await (await fetch(`https://googleads.googleapis.com/v25/customers/6923198164/googleAds:search`, { method: "POST", headers: cab, body: JSON.stringify({ query }) })).json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0,400)); return j.results ?? []; };
const agora = new Date(Date.now()-3*3600e3); const H = agora.getUTCHours();
const dia = (n) => new Date(Date.now()-3*3600e3-n*864e5).toISOString().slice(0,10);
const [hoje, ontem, sem] = [dia(0), dia(1), dia(7)];
const r = await q(`SELECT campaign.name, segments.date, segments.hour, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '${sem}' AND '${hoje}'`);
const ate = (d) => r.filter(x=>x.segments.date===d && x.segments.hour < H);
const soma = (rows,f="costMicros") => rows.reduce((a,x)=>a+Number(x.metrics[f]||0),0);
console.log(`hora ${H}h BRT, horas cheias de 0h a ${H-1}h:`);
for (const [rot,d] of [["hoje",hoje],["ontem",ontem],["-7d",sem]]) { const rows = ate(d); console.log(`  ${rot} ${d}: R$ ${(soma(rows)/1e6).toFixed(0)} | ${soma(rows,"impressions")} imp | ${soma(rows,"clicks")} cliques`); }
console.log("por hora (R$): hoje / ontem / -7d");
for (let h=0; h<H; h++) { const f=(d)=> (soma(r.filter(x=>x.segments.date===d && x.segments.hour===h))/1e6).toFixed(0).padStart(5); console.log(`  ${String(h).padStart(2)}h ${f(hoje)} ${f(ontem)} ${f(sem)}`); }
const porC = {}; for (const x of r) { if (x.segments.hour >= H) continue; const k = x.campaign.name; porC[k] ??= {h:0,o:0}; if (x.segments.date===hoje) porC[k].h += Number(x.metrics.costMicros)/1e6; if (x.segments.date===ontem) porC[k].o += Number(x.metrics.costMicros)/1e6; }
console.log("por campanha até a mesma hora (hoje × ontem), as que mais mudaram:");
for (const [k,v] of Object.entries(porC).sort((a,b)=>Math.abs(b[1].h-b[1].o)-Math.abs(a[1].h-a[1].o)).slice(0,15)) console.log(`  R$ ${v.h.toFixed(0).padStart(5)} × ${v.o.toFixed(0).padStart(5)} | ${k}`);
const u = new URL(readFileSync("supabase/.temp/pooler-url","utf8").trim());
const c = new pg.Client({ host:u.hostname, port:Number(u.port||5432), user:decodeURIComponent(u.username), database:"postgres", password:env.SUPABASE_DB_PASSWORD, ssl:{rejectUnauthorized:false} });
await c.connect(); await c.query("begin read only");
for (const [rot,d] of [["hoje",hoje],["ontem",ontem],["-7d",sem]]) {
  const ini = `${d}T03:00Z`, fim = new Date(Date.parse(ini) + H*3600e3).toISOString();
  const l = (await c.query(`select count(*) n from quiz_responses where created_at >= $1 and created_at < $2 and email is not null`, [ini, fim])).rows[0].n;
  const v = (await c.query(`select count(*) n, coalesce(sum(valor_centavos),0)/100 r from pedidos where status='pago' and paid_at >= $1 and paid_at < $2 and coalesce(dinheiro_entrou,true)`, [ini, fim])).rows[0];
  console.log(`  banco ${rot}: ${l} leads | ${v.n} pagamentos | R$ ${Math.round(v.r)}`);
}
await c.end();
