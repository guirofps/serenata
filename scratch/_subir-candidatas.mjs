// SÓ LEITURA: candidatas a subir orçamento pela regra do manual v2 (3 dias fechados com CPA real ≤ R$ 25 E gastando
// 95%+ do orçamento). Janela: os 3 dias antes de hoje. Uso: node scratch/_subir-candidatas.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const { access_token } = await (await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_ADS_CLIENT_ID,client_secret:env.GOOGLE_ADS_CLIENT_SECRET,refresh_token:env.GOOGLE_ADS_REFRESH_TOKEN,grant_type:"refresh_token"})})).json();
const cab={Authorization:"Bearer "+access_token,"developer-token":env.GOOGLE_ADS_DEVELOPER_TOKEN,"content-type":"application/json","login-customer-id":"3442238598"};
const q = async (query) => { const j = await (await fetch(`https://googleads.googleapis.com/v25/customers/6923198164/googleAds:search`, { method: "POST", headers: cab, body: JSON.stringify({ query }) })).json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0,400)); return j.results ?? []; };
const dia = (n) => new Date(Date.now()-3*3600e3-n*864e5).toISOString().slice(0,10);
const dias = [dia(3), dia(2), dia(1)];
const camp = await q(`SELECT campaign.id, campaign.name, campaign_budget.amount_micros FROM campaign WHERE campaign.status = 'ENABLED'`);
const met = await q(`SELECT campaign.id, segments.date, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${dias[0]}' AND '${dias[2]}' AND campaign.status = 'ENABLED'`);
const u = new URL(readFileSync("supabase/.temp/pooler-url","utf8").trim());
const c = new pg.Client({ host:u.hostname, port:Number(u.port||5432), user:decodeURIComponent(u.username), database:"postgres", password:env.SUPABASE_DB_PASSWORD, ssl:{rejectUnauthorized:false} });
await c.connect(); await c.query("begin read only");
const V = (await c.query(`select q.attribution->>'utm_campaign' k, to_char(p.paid_at - interval '3 hour','YYYY-MM-DD') d, count(*) n from pedidos p join quiz_responses q on q.id=p.quiz_response_id where p.status='pago' and p.payment_id not like '%:up:%' and p.payment_id not like 'credito:%' and p.payment_id not like 'cortesia:%' and p.paid_at >= $1 and p.paid_at < $2 and q.attribution->>'utm_campaign' ~ '^[0-9]+$' group by 1,2`, [`${dias[0]}T03:00Z`, `${dia(0)}T03:00Z`])).rows;
await c.end();
const out = [];
for (const x of camp) {
  const id = x.campaign.id, orc = Number(x.campaignBudget.amountMicros)/1e6;
  const g = dias.map(d => met.filter(m=>m.campaign.id===id && m.segments.date===d).reduce((a,m)=>a+Number(m.metrics.costMicros)/1e6,0));
  const v = dias.map(d => Number(V.find(r=>r.k===id && r.d===d)?.n ?? 0));
  const G = g.reduce((a,b)=>a+b,0), N = v.reduce((a,b)=>a+b,0);
  if (G < 1) continue;
  const cpaDia = g.map((gi,i)=> v[i] ? gi/v[i] : null);
  const uso = g[2] / orc;
  const ok = N >= 3 && G/N <= 25 && cpaDia.every(c => c !== null && c <= 30) && uso >= 0.95;
  out.push({ ok, nome: x.campaign.name, orc, G, N, cpa: N ? G/N : null, dias: cpaDia.map(c=>c===null?"sem":c.toFixed(0)).join("/"), uso });
}
out.sort((a,b)=>(b.ok-a.ok) || (a.cpa??999)-(b.cpa??999));
for (const r of out) console.log(`${r.ok?"SOBE ":"     "} CPA 3d ${r.cpa? r.cpa.toFixed(1).padStart(5):"  -  "} (dias ${r.dias.padEnd(11)}) ${String(r.N).padStart(3)}V R$ ${r.G.toFixed(0).padStart(5)} | ontem usou ${(r.uso*100).toFixed(0).padStart(3)}% de R$ ${r.orc} | ${r.nome}`);
