// TRIAGEM DA CAIXA DE SUPORTE.
//
// O e-mail de contato@serenatagift.com nao tinha dono. Em 16/08 a caixa tinha
// 18 mensagens de cliente sem resposta, a mais velha de mais de 24h, e uma
// delas era um comprador falando em "procurar meus direitos" com a musica dele
// pronta no servidor desde sempre.
//
// A regra de quem e respondido automaticamente nao e sobre confianca no texto,
// e sobre REVERSIBILIDADE: mandar pra alguem o link do que ela ja pagou nao tem
// como dar errado. Prometer reembolso, reescrever letra ou discutir cobranca
// tem, e por isso sobe pro dono.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SITE = "https://www.serenatagift.com";
const MCP = "https://mcp.mail.hostinger.com/mcp";

export type Caso = {
  uid: number;
  de: string;
  nome: string;
  assunto: string;
  corpo: string;
  quando: string;
  locale: "pt" | "es";
  pagou: boolean;
  musica: string | null;
  tel: string | null;
  editor: string | null;
  motivo?: string;
  tipo?: "pagou-e-nao-achou" | "acha-que-e-gratis";
  texto?: string;
  assuntoResposta?: string;
};

let seq = 0;
async function mcpChamar(token: string, metodo: string, params: unknown) {
  const r = await fetch(MCP, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method: metodo, params }),
    signal: AbortSignal.timeout(45000),
  });
  const txt = await r.text();
  // A resposta pode vir como SSE (`data: {...}`) ou JSON puro.
  const linha = txt.split("\n").find((l) => l.startsWith("data:")) ?? txt;
  const j = JSON.parse(linha.startsWith("data:") ? linha.slice(5).trim() : linha);
  if (j.error) throw new Error(j.error.message ?? "erro no MCP");
  return j.result;
}

async function ferramenta(token: string, nome: string, args: unknown) {
  const r = (await mcpChamar(token, "tools/call", { name: nome, arguments: args })) as {
    content?: { text?: string }[];
  };
  const t = (r?.content ?? []).map((c) => c.text ?? "").join("\n");
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

const ler = (token: string, path: string, query?: unknown) =>
  ferramenta(token, "email_call_api_read", { method: "GET", path, ...(query ? { query } : {}) });

/** Tira o texto legivel de um MIME cru e corta a citacao anterior. */
export function extrairTexto(cru: string): string {
  const partes = cru.split(/\r?\n--/);
  const alvo = partes.find((p) => /Content-Type:\s*text\/plain/i.test(p)) ?? cru;
  const corte = alvo.search(/\r?\n\r?\n/);
  let corpo = corte >= 0 ? alvo.slice(corte + 2) : alvo;
  if (/Content-Transfer-Encoding:\s*base64/i.test(alvo)) {
    try {
      corpo = Buffer.from(corpo.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch {
      /* deixa cru */
    }
  } else if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(alvo)) {
    corpo = corpo
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
    try {
      corpo = Buffer.from(corpo, "binary").toString("utf8");
    } catch {
      /* deixa como esta */
    }
  }
  corpo = corpo.split(/\r?\n(?:Em |On |El )[^\n]{0,140}(?:escreveu|wrote|escribió):/)[0];
  corpo = corpo.split(/Yahoo Mail:|Enviado do Yahoo|Enviado do meu|Sent from my|Obtenha o Outlook/)[0];
  return corpo
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Dinheiro e ameaca nunca viram template.
const ESCALAR =
  /reembols|estorn|extorn|devolv|chargeback|procon|advogad|direitos|processar|golpe|fraude|cobra(ram|nça)|assinatura|cancel|reclama/i;

// OPINIAO SOBRE A LETRA tambem sai do automatico.
//
// Isto foi um erro real que a rodada em seco pegou antes de virar e-mail: uma
// lead escreveu "gostei muito, so uma parte que nao expliquei" e a
// classificacao mandou ela pro template de "a musica e paga". Ela nao estava
// perguntando preco, estava corrigindo a historia do marido dela.
const FEEDBACK =
  /n[aã]o gostei|no me gust|nao curti|mudar|trocar|corrig|ajust|errado|equivocad|n[aã]o (é|e) assim|expliquei|acrescent|refaz|refazer|outra vers|otra vers|melhorar/i;

const RUIDO = /dmarc|noreply|no-reply|mailer-daemon|postmaster|report domain/i;

const TEXTOS = {
  pt: {
    achou: (nome: string, musica: string, tok: string, ed: string) =>
      `Oi${nome ? " " + nome : ""}, tudo bem?\n\nMe desculpa a demora. Sua música está pronta e o pagamento entrou certinho.\n\nEla se chama "${musica}". Estes dois links abrem direto, sem senha e sem precisar criar conta:\n\nO presente, que é o link pra você mandar pra ela:\n${SITE}/p/${tok}\n\nA página de edição, onde você coloca a foto, escreve uma frase e baixa o MP3:\n${SITE}/editar/${ed}\n\nGuarda esses dois, eles não expiram. Na página do presente, é só tocar no círculo no meio da tela pra a música começar.\n\nSe o nosso e-mail anterior não apareceu, provavelmente caiu no spam ou na aba Promoções.\n\nQualquer coisa é só responder aqui.\n\nEquipe Serenata`,
    gratis: (nome: string, musica: string, link: string) =>
      `Oi${nome ? " " + nome : ""}, tudo bem?\n\nQue bom que você gostou da letra, e me desculpa se ficou confuso.\n\nFunciona assim: a letra é gratuita, é o nosso presente pra você. A música cantada, com voz e instrumental, mais a página pronta pra presentear com link e QR Code, é a parte paga.\n\nA sua já está gravada aqui, esperando. Ela se chama "${musica}". Assim que você finalizar, libera na hora.\n\nÉ só continuar de onde você parou:\n${link}\n\nQualquer dúvida antes de decidir, me responde.\n\nEquipe Serenata`,
    assunto: { achou: "Re: sua música está pronta", gratis: "Re: sua música" },
  },
  es: {
    achou: (nome: string, musica: string, tok: string, ed: string) =>
      `Hola${nome ? " " + nome : ""}, ¿cómo estás?\n\nPerdón por la demora. Tu canción está lista y el pago entró correctamente.\n\nSe llama "${musica}". Estos dos links abren directo, sin contraseña:\n\nEl regalo, el link que le compartes a ella:\n${SITE}/p/${tok}\n\nLa página de edición, donde subes la foto, escribes una frase y descargas el MP3:\n${SITE}/editar/${ed}\n\nGuarda los dos, no expiran.\n\nCualquier cosa, respóndeme por aquí.\n\nEquipo Serenata`,
    gratis: (nome: string, musica: string, link: string) =>
      `Hola${nome ? " " + nome : ""}, ¿cómo estás?\n\nQué bueno que te gustó la letra, y perdón si quedó confuso.\n\nFunciona así: la letra es gratis, es nuestro regalo. La canción cantada, con voz e instrumentos, más la página lista para regalar con link y código QR, es la parte de pago.\n\nLa tuya ya está grabada aquí, esperando. Se llama "${musica}". Apenas completes el pago, se libera al instante.\n\nPuedes continuar desde donde quedaste:\n${link}\n\nCualquier duda, respóndeme.\n\nEquipo Serenata`,
    assunto: { achou: "Re: tu canción está lista", gratis: "Re: tu canción" },
  },
} as const;

function db(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Le a caixa, cruza com o banco e separa o que da pra responder sozinho.
 *
 * NAO envia nada: quem envia e a funcao do Inngest, que precisa do `step` pra
 * nao reenviar o lote inteiro quando uma tentativa falha no meio.
 */
export async function triar(token: string): Promise<{
  caixa: number;
  auto: Caso[];
  paraVoce: Caso[];
  mailbox: string;
}> {
  await mcpChamar(token, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "serenata-suporte", version: "1" },
  });
  const box = (await ler(token, "/api/v1/me"))?.body?.data?.mailboxes?.[0];
  if (!box) throw new Error("nenhuma caixa no token");

  const resp = await ler(token, `/api/v1/mailboxes/${box.resourceId}/folders/INBOX/messages`, {
    limit: 50,
  });
  const msgs: Record<string, unknown>[] = Array.isArray(resp?.body?.data) ? resp.body.data : [];

  const sb = db();
  // Ja respondidos ficam no proprio funnel_events: e a unica memoria que
  // sobrevive entre execucoes num ambiente sem disco.
  const { data: feitos } = await sb
    .from("funnel_events")
    .select("event_data")
    .eq("event_name", "suporte_respondido")
    .gte("created_at", new Date(Date.now() - 60 * 864e5).toISOString());
  const jaFeito = new Set((feitos ?? []).map((e) => String((e.event_data as { uid?: number })?.uid)));

  const auto: Caso[] = [];
  const paraVoce: Caso[] = [];
  for (const m of msgs) {
    const from = m.from as { address?: string; name?: string } | undefined;
    const de = (from?.address ?? "").toLowerCase();
    const assunto = String(m.subject ?? "") || "(sem assunto)";
    if (!de || RUIDO.test(`${de} ${assunto}`)) continue;
    if (jaFeito.has(String(m.uid))) continue;

    const src = await ler(
      token,
      `/api/v1/mailboxes/${box.resourceId}/folders/INBOX/messages/${m.uid}/source`,
    );
    const corpo = extrairTexto(typeof src?.body === "string" ? src.body : String(src?.body ?? ""));

    const { data: pago } = await sb
      .from("pedidos")
      .select("quiz_response_id, telefone")
      .ilike("email", de)
      .eq("status", "pago")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: q } = await sb
      .from("quiz_responses")
      .select("id, locale, session_id, whatsapp")
      .ilike("email", de)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const qid = pago?.quiz_response_id ?? q?.id;
    const { data: mus } = qid
      ? await sb
          .from("musicas")
          .select("titulo, status, token, token_edicao")
          .eq("quiz_response_id", qid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const locale = q?.locale === "es" ? ("es" as const) : ("pt" as const);
    const primeiro = (from?.name ?? "").split(" ")[0] ?? "";
    const caso: Caso = {
      uid: Number(m.uid),
      de,
      nome: from?.name ?? "",
      assunto,
      corpo,
      quando: String(m.date ?? "").slice(0, 16),
      locale,
      pagou: Boolean(pago),
      musica: mus?.titulo ?? null,
      tel: pago?.telefone ?? q?.whatsapp ?? null,
      editor: mus?.token_edicao ? `${SITE}/editar/${mus.token_edicao}` : null,
    };

    const texto = `${assunto} ${corpo}`;
    if (ESCALAR.test(texto)) {
      caso.motivo = "fala de dinheiro ou reclamação";
      paraVoce.push(caso);
      continue;
    }
    if (FEEDBACK.test(texto)) {
      caso.motivo = "quer ajuste na letra ou na música";
      paraVoce.push(caso);
      continue;
    }

    const pronta = mus?.status === "pronta";
    if (caso.pagou && pronta && mus?.token && mus?.token_edicao) {
      caso.tipo = "pagou-e-nao-achou";
      caso.texto = TEXTOS[locale].achou(primeiro, caso.musica ?? "sua música", mus.token, mus.token_edicao);
      caso.assuntoResposta = TEXTOS[locale].assunto.achou;
      auto.push(caso);
    } else if (!caso.pagou && pronta && q?.session_id) {
      caso.tipo = "acha-que-e-gratis";
      caso.texto = TEXTOS[locale].gratis(
        primeiro,
        caso.musica ?? "sua música",
        `${SITE}/retomar?s=${q.session_id}`,
      );
      caso.assuntoResposta = TEXTOS[locale].assunto.gratis;
      auto.push(caso);
    } else {
      caso.motivo = caso.pagou ? "pagou mas falta música ou token" : "não achei no banco";
      paraVoce.push(caso);
    }
  }
  return { caixa: msgs.length, auto, paraVoce, mailbox: box.resourceId };
}

/** Manda uma resposta e devolve se deu certo. */
export async function responder(token: string, mailbox: string, c: Caso): Promise<boolean> {
  const r = await ferramenta(token, "email_call_api_write", {
    method: "POST",
    path: `/api/v1/mailboxes/${mailbox}/send`,
    body: {
      to: [c.de],
      subject: c.assuntoResposta,
      text: c.texto,
      displayName: "Serenata",
      replyOf: { folder: "INBOX", uid: c.uid },
    },
  });
  return Boolean(r?.status && r.status < 300);
}
