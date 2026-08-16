// TRIAGEM DO SUPORTE, À MÃO.
//
// Este arquivo NÃO tem lógica. Ele chama exatamente a mesma biblioteca que a
// função das 9h usa (`inngest/lib/suporte.ts`), porque a versão anterior era
// uma cópia em JavaScript e as duas divergiram em silêncio: uma guardava quem
// já tinha sido respondido num arquivo local, a outra no banco. Resultado, o
// teste pegou 13 pessoas prestes a receber o mesmo e-mail duas vezes.
//
// Uma regra, um lugar.
//
//   npx tsx scripts/suporte-diario.mts            só o relatório
//   npx tsx scripts/suporte-diario.mts --enviar   responde as categorias seguras
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { triar, responder } from "../inngest/lib/suporte.js";

const RAIZ = process.cwd();
const ENVIAR = process.argv.includes("--enviar");

// A lib lê as credenciais do ambiente; aqui elas vêm do .env.local.
const env = Object.fromEntries(
  readFileSync(`${RAIZ}/.env.local`, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
for (const [k, v] of Object.entries(env)) process.env[k] = v as string;

const TOKEN = env.HOSTINGER_MAIL_TOKEN ?? env.HOSTINGER_API_TOKEN;
if (!TOKEN) {
  console.error("falta HOSTINGER_MAIL_TOKEN (ou HOSTINGER_API_TOKEN) no .env.local");
  process.exit(1);
}
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { caixa, auto, paraVoce, mailbox } = await triar(TOKEN);

// Uma resposta por PESSOA, não por mensagem.
const vistos = new Set<string>();
const fila = auto.filter((c) => (vistos.has(c.de) ? false : (vistos.add(c.de), true)));
const duplicados = auto.filter((c) => !fila.includes(c));

console.log(`\nSUPORTE ${new Date().toISOString().slice(0, 16)}`);
console.log(`${caixa} na caixa | ${auto.length} automáticas | ${paraVoce.length} pra você\n`);

const marcados: number[] = [];
console.log(`== AUTOMÁTICAS (${ENVIAR ? "enviando" : "seco, nada enviado"}) ==`);
for (const c of fila) {
  if (!ENVIAR) {
    console.log(`  ${c.tipo?.padEnd(20)} ${c.de}  "${c.musica ?? "?"}"`);
    continue;
  }
  const ok = await responder(TOKEN, mailbox, c);
  console.log(`  ${ok ? "ENVIADO" : "FALHOU "} ${c.tipo?.padEnd(20)} ${c.de}`);
  if (ok) marcados.push(c.uid);
  await new Promise((r) => setTimeout(r, 700));
}
if (!fila.length) console.log("  nenhuma");

// Marca no MESMO lugar que a função das 9h consulta.
if (ENVIAR) {
  const uids = [...new Set([...marcados, ...duplicados.map((c) => c.uid)])];
  if (uids.length) {
    await sb.from("funnel_events").insert(
      uids.map((uid) => ({
        event_name: "suporte_respondido",
        event_data: { uid, em: new Date().toISOString(), origem: "script manual" },
      })),
    );
    console.log(`\n  marcados como respondidos: ${uids.length}`);
  }
}

console.log(`\n== PRECISAM DE VOCÊ (${paraVoce.length}) ==`);
for (const c of paraVoce) {
  console.log(`\n  ${c.quando} | ${c.de} | ${c.motivo}`);
  console.log(`  assunto: ${c.assunto}`);
  console.log(`  diz: ${c.corpo.slice(0, 220)}`);
  console.log(
    `  banco: ${c.pagou ? "PAGOU" : "lead"} | música ${JSON.stringify(c.musica)} | tel ${c.tel ?? "-"}`,
  );
  if (c.editor) console.log(`  editor ${c.editor}`);
}
if (!paraVoce.length) console.log("  nenhuma");
