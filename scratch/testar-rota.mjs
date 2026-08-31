// TESTA UMA ROTA `api/` SEM SUBIR NADA.
//
// O `vite dev` nao serve `api/` (sao funcoes da Vercel, resolvidas pelos
// rewrites do vercel.json) e o `vercel dev` quebra nesta maquina porque tenta
// usar yarn. Sobra o caminho direto: importar o handler e chamar ele com um
// req/res de mentira.
//
// Isto teria pegado os DOIS defeitos que eu so vi depois de subir:
//   - a tag "made with suno" viajando dentro do MP3
//   - o stream expirado devolvendo 200 com zero byte
//
// uso: npx tsx scratch/testar-rota.mjs <id-da-musica>
import { readFileSync, writeFileSync } from "node:fs";

const root = "C:/Users/Guilherme Rojas/Desktop/musica-personalizada";
// As envs que a funcao espera receber da Vercel.
for (const l of readFileSync(root + "/.env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/[\r\n]/g, "");
}

const id = process.argv[2];
if (!id) {
  console.error("uso: npx tsx scratch/testar-rota.mjs <id-da-musica>");
  process.exit(1);
}

const { default: handler } = await import("../api/previa/[id].ts");

// Um `res` de mentira que guarda o que a rota escreveria.
const pedacos = [];
const res = {
  statusCode: 200,
  headers: {},
  status(c) { this.statusCode = c; return this; },
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
  json(b) { this.corpo = JSON.stringify(b); return this; },
  send(b) { this.corpo = b; return this; },
  end(b) { if (b) pedacos.push(b); return this; },
};

await handler({ method: "GET", query: { id }, headers: {}, url: `/api/previa/${id}` }, res);

const corpo = pedacos.length ? Buffer.concat(pedacos.map((p) => Buffer.from(p))) : null;
console.log("status :", res.statusCode);
console.log("headers:", JSON.stringify(res.headers));
if (res.corpo) console.log("corpo  :", String(res.corpo).slice(0, 200));
if (corpo) {
  console.log("bytes  :", corpo.length);
  writeFileSync(root + "/scratch/rota-local.mp3", corpo);
  console.log("gravado em scratch/rota-local.mp3 — confira com ffprobe");
}
