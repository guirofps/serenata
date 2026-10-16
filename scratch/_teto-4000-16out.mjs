// 16/10 (dono: "pode autorizar"): teto diário de geração 2.500 → 4.000 em config_operacao, e relê.
import { readFileSync } from "node:fs";
import pg from "pg";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const u = new URL(readFileSync("supabase/.temp/pooler-url","utf8").trim());
const c = new pg.Client({ host:u.hostname, port:Number(u.port||5432), user:decodeURIComponent(u.username), database:"postgres", password:env.SUPABASE_DB_PASSWORD, ssl:{rejectUnauthorized:false} });
await c.connect();
const antes = (await c.query(`select valor, atualizado_em from config_operacao where chave='teto_musicas_dia'`)).rows[0];
await c.query(`insert into config_operacao (chave, valor, atualizado_em) values ('teto_musicas_dia','4000', now()) on conflict (chave) do update set valor=excluded.valor, atualizado_em=excluded.atualizado_em`);
const depois = (await c.query(`select valor, atualizado_em from config_operacao where chave='teto_musicas_dia'`)).rows[0];
const hoje = new Date(Date.now()-3*3600e3).toISOString().slice(0,10);
const uso = (await c.query(`select contagem from limites_uso where chave=$1`, [`musica-dia:${hoje}`])).rows[0];
console.log("antes:", antes?.valor, "| depois:", depois.valor, "| usado hoje:", uso?.contagem ?? 0);
await c.end();
