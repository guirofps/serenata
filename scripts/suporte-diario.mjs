// TRIAGEM DIARIA DO SUPORTE.
//
// Le a caixa de contato@serenatagift.com, cruza cada remetente com o banco, e
// classifica. Responde sozinho SO as duas categorias mecanicas; todo o resto
// vira relatorio pro dono decidir.
//
// A regra de quem responde sozinho nao e sobre confianca no texto, e sobre
// reversibilidade: mandar pra alguem o link do que ela ja pagou nao tem como
// dar errado. Prometer reembolso, reescrever letra ou discutir cobranca tem.
//
// Uso:
//   node scripts/suporte-diario.mjs            (so relatorio, nao manda nada)
//   node scripts/suporte-diario.mjs --enviar   (responde as categorias seguras)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const RAIZ = process.cwd();
const SITE = "https://www.serenatagift.com";
const ENVIAR = process.argv.includes("--enviar");
const LEDGER = `${RAIZ}/scratch/suporte-respondidos.json`;

const env = Object.fromEntries(
  readFileSync(`${RAIZ}/.env.local`, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TOKEN = env.HOSTINGER_API_TOKEN;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ── MCP da Hostinger ────────────────────────────────────────────
let seq = 0;
async function mcp(metodo, params) {
  const r = await fetch("https://mcp.mail.hostinger.com/mcp", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method: metodo, params }),
    signal: AbortSignal.timeout(45000),
  });
  const txt = await r.text();
  const linha = txt.split("\n").find((l) => l.startsWith("data:")) ?? txt;
  return JSON.parse(linha.startsWith("data:") ? linha.slice(5).trim() : linha).result;
}
async function chamar(nome, args) {
  const r = await mcp("tools/call", { name: nome, arguments: args });
  const t = (r?.content ?? []).map((c) => c.text ?? "").join("\n");
  try { return JSON.parse(t); } catch { return t; }
}
const ler = (path, query) => chamar("email_call_api_read", { method: "GET", path, ...(query ? { query } : {}) });

// ── corpo do e-mail a partir do MIME cru ────────────────────────
function extrairTexto(cru) {
  const partes = cru.split(/\r?\n--/);
  const alvo = partes.find((p) => /Content-Type:\s*text\/plain/i.test(p)) ?? cru;
  const corte = alvo.search(/\r?\n\r?\n/);
  let corpo = corte >= 0 ? alvo.slice(corte + 2) : alvo;
  if (/Content-Transfer-Encoding:\s*base64/i.test(alvo)) {
    try { corpo = Buffer.from(corpo.replace(/\s+/g, ""), "base64").toString("utf8"); } catch {}
  } else if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(alvo)) {
    corpo = corpo.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    try { corpo = Buffer.from(corpo, "binary").toString("utf8"); } catch {}
  }
  corpo = corpo.split(/\r?\n(?:Em |On |El )[^\n]{0,140}(?:escreveu|wrote|escribió):/)[0];
  corpo = corpo.split(/Yahoo Mail:|Enviado do Yahoo|Enviado do meu|Sent from my|Obtenha o Outlook/)[0];
  return corpo.split("\n").filter((l) => !l.trimStart().startsWith(">")).join(" ").replace(/\s+/g, " ").trim();
}

// ── PALAVRAS QUE TIRAM O CASO DO AUTOMATICO ─────────────────────
// Qualquer uma delas manda pro dono, mesmo que o resto do e-mail pareça
// simples. Dinheiro e ameaca nao se responde por template.
const ESCALAR = /reembols|estorn|extorn|devolv|chargeback|procon|advogad|direitos|processar|golpe|fraude|cobra(ram|nça)|assinatura|cancel|reclama/i;

// OPINIAO SOBRE A LETRA OU A MUSICA tambem sai do automatico.
//
// Isto nao e paranoia, e um erro que o seco pegou antes de virar e-mail: a
// Silvia escreveu "gostei muito, so uma parte que nao expliquei" e a
// classificacao mandou ela pro template de "a musica e paga". Ela nao estava
// perguntando de preco, estava corrigindo a historia do marido. Responder com
// link de pagamento ali seria pior que nao responder.
//
// Quem quer ajuste precisa de letra reescrita, e isso e trabalho, nao template.
const FEEDBACK = /n[aã]o gostei|no me gust|nao curti|mudar|trocar|corrig|ajust|errado|equivocad|n[aã]o (é|e) assim|expliquei|acrescent|refaz|refazer|outra vers|otra vers|melhorar/i;

const RUIDO = /dmarc|noreply|no-reply|mailer-daemon|postmaster|report domain/i;

// ── textos ──────────────────────────────────────────────────────
const T = {
  pt: {
    achou: (nome, musica, tok, ed) =>
`Oi${nome ? " " + nome : ""}, tudo bem?

Me desculpa a demora. Sua música está pronta e o pagamento entrou certinho.

Ela se chama "${musica}". Estes dois links abrem direto, sem senha e sem precisar criar conta:

O presente, que é o link pra você mandar pra ela:
${SITE}/p/${tok}

A página de edição, onde você coloca a foto, escreve uma frase e baixa o MP3:
${SITE}/editar/${ed}

Guarda esses dois, eles não expiram. Na página do presente, é só tocar no círculo no meio da tela pra a música começar.

Se o nosso e-mail anterior não apareceu, provavelmente caiu no spam ou na aba Promoções.

Qualquer coisa é só responder aqui.

Equipe Serenata`,
    gratis: (nome, musica, link) =>
`Oi${nome ? " " + nome : ""}, tudo bem?

Que bom que você gostou da letra, e me desculpa se ficou confuso.

Funciona assim: a letra é gratuita, é o nosso presente pra você. A música cantada, com voz e instrumental, mais a página pronta pra presentear com link e QR Code, é a parte paga.

A sua já está gravada aqui, esperando. Ela se chama "${musica}". Assim que você finalizar, libera na hora.

É só continuar de onde você parou:
${link}

Qualquer dúvida antes de decidir, me responde.

Equipe Serenata`,
    assunto: { achou: "Re: sua música está pronta", gratis: "Re: sua música" },
  },
  es: {
    achou: (nome, musica, tok, ed) =>
`Hola${nome ? " " + nome : ""}, ¿cómo estás?

Perdón por la demora. Tu canción está lista y el pago entró correctamente.

Se llama "${musica}". Estos dos links abren directo, sin contraseña:

El regalo, el link que le compartes a ella:
${SITE}/p/${tok}

La página de edición, donde subes la foto, escribes una frase y descargas el MP3:
${SITE}/editar/${ed}

Guarda los dos, no expiran.

Cualquier cosa, respóndeme por aquí.

Equipo Serenata`,
    gratis: (nome, musica, link) =>
`Hola${nome ? " " + nome : ""}, ¿cómo estás?

Qué bueno que te gustó la letra, y perdón si quedó confuso.

Funciona así: la letra es gratis, es nuestro regalo. La canción cantada, con voz e instrumentos, más la página lista para regalar con link y código QR, es la parte de pago.

La tuya ya está grabada aquí, esperando. Se llama "${musica}". Apenas completes el pago, se libera al instante.

Puedes continuar desde donde quedaste:
${link}

Cualquier duda, respóndeme.

Equipo Serenata`,
    assunto: { achou: "Re: tu canción está lista", gratis: "Re: tu canción" },
  },
};

// ── roda ────────────────────────────────────────────────────────
await mcp("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "serenata-suporte", version: "1" } });
const box = (await ler("/api/v1/me"))?.body?.data?.mailboxes?.[0];
const resp = await ler(`/api/v1/mailboxes/${box.resourceId}/folders/INBOX/messages`, { limit: 50 });
const msgs = Array.isArray(resp?.body?.data) ? resp.body.data : [];

if (!existsSync(`${RAIZ}/scratch`)) mkdirSync(`${RAIZ}/scratch`, { recursive: true });
// `.replace(/^﻿/, "")`: se o arquivo for editado a mao no Windows ele
// volta com BOM, e JSON.parse morre num caractere invisivel.
const jaFeito = new Set(
  existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8").replace(/^﻿/, "")) : [],
);

const auto = [], paraVoce = [];
for (const m of msgs) {
  const f = Array.isArray(m.from) ? m.from[0] : m.from;
  const de = (f?.address ?? "").toLowerCase();
  if (!de || RUIDO.test(`${de} ${m.subject ?? ""}`)) continue;
  if (jaFeito.has(String(m.uid))) continue;

  const src = await ler(`/api/v1/mailboxes/${box.resourceId}/folders/INBOX/messages/${m.uid}/source`);
  const corpo = extrairTexto(typeof src?.body === "string" ? src.body : String(src?.body ?? ""));
  await dormir(350);

  const { data: pago } = await sb.from("pedidos").select("quiz_response_id,paid_at,valor_centavos,telefone")
    .ilike("email", de).eq("status", "pago").order("paid_at", { ascending: false }).limit(1).maybeSingle();
  const { data: q } = await sb.from("quiz_responses").select("id,respostas,locale,session_id,whatsapp")
    .ilike("email", de).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const qid = pago?.quiz_response_id ?? q?.id;
  const { data: mus } = qid ? await sb.from("musicas").select("titulo,status,token,token_edicao,foto_path,dedicatoria")
    .eq("quiz_response_id", qid).order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };

  const locale = q?.locale === "es" ? "es" : "pt";
  const nome = (f?.name ?? "").split(" ")[0] || "";
  const caso = {
    uid: m.uid, de, nome: f?.name ?? "", assunto: m.subject || "(sem assunto)", corpo,
    quando: String(m.date ?? "").slice(0, 16), locale,
    pagou: Boolean(pago), musica: mus?.titulo ?? null, pronta: mus?.status === "pronta",
    tel: pago?.telefone ?? q?.whatsapp ?? null,
    presente: mus?.token ? `${SITE}/p/${mus.token}` : null,
    editor: mus?.token_edicao ? `${SITE}/editar/${mus.token_edicao}` : null,
    retomar: q?.session_id ? `${SITE}/retomar?s=${q.session_id}` : null,
  };

  // Dinheiro, ameaca ou reclamacao: sempre humano.
  const texto = `${m.subject ?? ""} ${corpo}`;
  if (ESCALAR.test(texto)) { caso.motivo = "fala de dinheiro ou reclamação"; paraVoce.push(caso); continue; }
  if (FEEDBACK.test(texto)) { caso.motivo = "quer ajuste na letra ou na música"; paraVoce.push(caso); continue; }

  if (caso.pagou && caso.pronta && caso.presente && caso.editor) {
    caso.tipo = "pagou-e-nao-achou";
    caso.texto = T[locale].achou(nome, caso.musica, mus.token, mus.token_edicao);
    caso.assuntoResposta = T[locale].assunto.achou;
    auto.push(caso);
  } else if (!caso.pagou && caso.pronta && caso.retomar) {
    caso.tipo = "acha-que-e-gratis";
    caso.texto = T[locale].gratis(nome, caso.musica, caso.retomar);
    caso.assuntoResposta = T[locale].assunto.gratis;
    auto.push(caso);
  } else {
    caso.motivo = caso.pagou ? "pagou mas falta algo (música/token)" : "não achei no banco ou pedido fora do padrão";
    paraVoce.push(caso);
  }
}

// ── envia ───────────────────────────────────────────────────────
const enviados = [];
if (ENVIAR) {
  // Uma resposta por PESSOA, nao por mensagem. Quem escreveu tres vezes
  // porque estava aflito nao merece tres e-mails iguais de volta.
  const jaNestaRodada = new Set();
  for (const c of auto) {
    if (jaNestaRodada.has(c.de)) { jaFeito.add(String(c.uid)); continue; }
    jaNestaRodada.add(c.de);
    const r = await chamar("email_call_api_write", {
      method: "POST",
      path: `/api/v1/mailboxes/${box.resourceId}/send`,
      body: { to: [c.de], subject: c.assuntoResposta, text: c.texto, displayName: "Serenata", replyOf: { folder: "INBOX", uid: c.uid } },
    });
    if (r?.status && r.status < 300) { enviados.push(c.uid); jaFeito.add(String(c.uid)); }
    await dormir(700);
  }
  writeFileSync(LEDGER, JSON.stringify([...jaFeito], null, 1), "utf8");
}

// ── relatorio ───────────────────────────────────────────────────
const L = [];
L.push(`SUPORTE ${new Date().toISOString().slice(0, 16)}`);
L.push(`${msgs.length} na caixa | ${auto.length} automáticas | ${paraVoce.length} pra você\n`);
L.push(`== RESPONDIDAS SOZINHAS (${ENVIAR ? enviados.length + " enviadas" : "seco, nada enviado"}) ==`);
for (const c of auto) L.push(`  ${c.tipo.padEnd(20)} ${c.de}  "${c.musica ?? "?"}"`);
if (!auto.length) L.push("  nenhuma");
L.push(`\n== PRECISAM DE VOCÊ (${paraVoce.length}) ==`);
for (const c of paraVoce) {
  L.push(`\n  ${c.quando} | ${c.de} | ${c.motivo}`);
  L.push(`  assunto: ${c.assunto}`);
  L.push(`  diz: ${c.corpo.slice(0, 200)}`);
  L.push(`  banco: ${c.pagou ? "PAGOU" : "lead"} | música ${JSON.stringify(c.musica)} ${c.pronta ? "pronta" : ""} | tel ${c.tel ?? "-"}`);
  if (c.editor) L.push(`  editor ${c.editor}`);
}
if (!paraVoce.length) L.push("  nenhuma");

const saida = L.join("\n");
writeFileSync(`${RAIZ}/scratch/suporte-hoje.txt`, saida, "utf8");
console.log(saida);
