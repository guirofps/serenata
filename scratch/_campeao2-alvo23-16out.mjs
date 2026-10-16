// 16/10 ~10h (dono escolheu "R$ 25, igual antes"): (depois trocado pra R$ 23 pelo dono, 10h) devolve o alvo de CPA na CAMPEÃO 2#, tirado à 0h23 do mesmo dia
// Em Demand Gen o alvo vai em `target_cpa` (o `maximize_conversions.target_cpa_micros` é recusado pra este contexto).
// (sem alvo ela quase parou de entregar: R$ 2 até 9h40 contra ~R$ 110 no mesmo horário de 15/10). Por NOME EXATO, e relê.
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const { access_token } = await (await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_ADS_CLIENT_ID,client_secret:env.GOOGLE_ADS_CLIENT_SECRET,refresh_token:env.GOOGLE_ADS_REFRESH_TOKEN,grant_type:"refresh_token"})})).json();
const cab={Authorization:"Bearer "+access_token,"developer-token":env.GOOGLE_ADS_DEVELOPER_TOKEN,"content-type":"application/json","login-customer-id":"3442238598"};
const CID = "6923198164", NOME = "GD | Serenata | Remkt Concorrentes | CAMPEÃO 2#";
const q = async (query) => { const j = await (await fetch(`https://googleads.googleapis.com/v25/customers/${CID}/googleAds:search`, { method: "POST", headers: cab, body: JSON.stringify({ query }) })).json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0,500)); return j.results ?? []; };
const ler = async () => (await q(`SELECT campaign.resource_name, campaign.name, campaign.status, campaign.bidding_strategy_type, campaign.maximize_conversions.target_cpa_micros, campaign.target_cpa.target_cpa_micros, campaign_budget.amount_micros FROM campaign WHERE campaign.name = '${NOME}'`));
const antes = await ler();
if (antes.length !== 1) throw new Error("achei " + antes.length + " campanhas com esse nome");
console.log("antes:", JSON.stringify(antes[0].campaign), "orç", antes[0].campaignBudget.amountMicros/1e6);
const j = await (await fetch(`https://googleads.googleapis.com/v25/customers/${CID}/campaigns:mutate`, { method: "POST", headers: cab, body: JSON.stringify({ operations: [{ update: { resourceName: antes[0].campaign.resourceName, targetCpa: { targetCpaMicros: "23000000" } }, updateMask: "target_cpa.target_cpa_micros" }] }) })).json();
if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 700));
const depois = await ler();
console.log("depois:", JSON.stringify(depois[0].campaign), "orç", depois[0].campaignBudget.amountMicros/1e6);
