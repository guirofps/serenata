// Webhook do Resend: entrega, abertura, clique, bounce e reclamação.
//
// POR QUE EXISTE: a gente registra que MANDOU e-mail (360 letras e 273 da
// sequência de recuperação em 14 dias) e nunca soube se alguém abre. Toda
// decisão sobre e-mail até hoje foi no escuro, inclusive a de investir na
// sequência de recuperação. Sem isto não dá pra dizer se o canal funciona ou
// se está falando com a parede.
//
// Config no painel do Resend (Webhooks → Add):
//   URL = https://www.serenatagift.com/api/webhook/resend
//   Eventos = email.delivered, email.opened, email.clicked,
//             email.bounced, email.complained
//   O segredo que ele mostra (whsec_...) vai em RESEND_WEBHOOK_SECRET.
//
// ASSINATURA: o Resend assina no padrão Svix. Verificar é obrigatório e
// FAIL-CLOSED — sem segredo configurado, recusa. É o erro herdado que o
// CLAUDE.md manda não repetir (`!secretEsperado ||` aceitando qualquer POST).
//
// SOBRE ABERTURA: o Resend detecta abertura por pixel de imagem. Cliente que
// bloqueia imagem (boa parte do Gmail no celular não bloqueia, mas o Apple
// Mail infla) distorce pra cima e pra baixo. Serve pra comparar um e-mail com
// o outro, não como número absoluto.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type Req = IncomingMessage & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & { status: (c: number) => Res; json: (b: unknown) => void };

// A assinatura é sobre o corpo CRU. Com o parser do Vercel ligado, o JSON
// re-serializado quase nunca bate byte a byte com o original.
export const config = { api: { bodyParser: false } };

function cabecalho(req: Req, nome: string): string | null {
  const v = req.headers[nome];
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;
}

function corpoCru(req: Req): Promise<string> {
  return new Promise((ok, falha) => {
    const partes: Buffer[] = [];
    req.on("data", (p: Buffer) => partes.push(p));
    req.on("end", () => ok(Buffer.concat(partes).toString("utf8")));
    req.on("error", falha);
  });
}

/** Padrão Svix: HMAC-SHA256 de `id.timestamp.corpo`, chave em base64. */
function assinaturaConfere(req: Req, corpo: string, segredo: string): boolean {
  const id = cabecalho(req, "svix-id");
  const ts = cabecalho(req, "svix-timestamp");
  const assinaturas = cabecalho(req, "svix-signature");
  if (!id || !ts || !assinaturas) return false;

  // Janela de 5 minutos: sem isso, um POST capturado uma vez vale pra sempre.
  const idade = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(idade) || idade > 300) return false;

  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", chave)
    .update(`${id}.${ts}.${corpo}`)
    .digest("base64");

  // O cabeçalho pode trazer várias ("v1,aaa v1,bbb") durante rotação de chave.
  return assinaturas.split(" ").some((par) => {
    const recebida = par.split(",")[1];
    if (!recebida) return false;
    const a = Buffer.from(recebida);
    const b = Buffer.from(esperada);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

type Evento = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    from?: string;
    click?: { link?: string };
    bounce?: { type?: string };
  };
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const segredo = process.env.RESEND_WEBHOOK_SECRET;
  if (!segredo) {
    console.error("[resend] RESEND_WEBHOOK_SECRET ausente — recusando");
    return res.status(500).json({ error: "webhook nao configurado" });
  }

  let corpo: string;
  try {
    corpo = await corpoCru(req);
  } catch {
    return res.status(400).json({ error: "corpo ilegivel" });
  }

  if (!assinaturaConfere(req, corpo, segredo)) {
    console.warn("[resend] assinatura invalida");
    return res.status(401).json({ error: "assinatura invalida" });
  }

  let ev: Evento;
  try {
    ev = JSON.parse(corpo) as Evento;
  } catch {
    return res.status(400).json({ error: "json invalido" });
  }

  const tipo = ev.type ?? "desconhecido"; // "email.opened"
  const d = ev.data ?? {};
  const para = Array.isArray(d.to) ? d.to[0] : d.to;

  try {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env ausente");
    await createClient(url, key, { auth: { persistSession: false } })
      .from("funnel_events")
      .insert({
        // "email.opened" → "email_opened", que é como os outros eventos do
        // funil são nomeados (snake_case, sem ponto).
        event_name: tipo.replace(/\./g, "_"),
        event_data: {
          email_id: d.email_id ?? null,
          // O ASSUNTO é o que permite separar "letra pronta" de "recuperação
          // 2" na hora de medir. Sem ele, abertura vira um número só, inútil.
          assunto: d.subject ?? null,
          para: para ?? null,
          link: d.click?.link ?? null,
          bounce: d.bounce?.type ?? null,
          quando: ev.created_at ?? null,
        },
      });
  } catch (err) {
    // Auditoria não pode derrubar o webhook: erro aqui faria o Resend
    // reenviar em loop um evento que não muda nada no produto.
    console.error("[resend] gravacao falhou:", err);
  }

  // E-MAIL DE ENTREGA QUE VOLTOU = COMPRADOR SEM O PRODUTO.
  //
  // Medido em 13/08: 9 e-mails voltaram em 48h, todos pro Gmail e todos com
  // bounce "Transient" (o Gmail recusa temporariamente e depois desiste). DOIS
  // deles eram entrega de quem PAGOU: música pronta, conta criada, e a pessoa
  // sem saber onde está o presente dela.
  //
  // O bounce era mudo. O Resend registrava, ninguém lia, e o cliente virava
  // ticket dias depois — ou nem isso, virava reembolso.
  //
  // Aqui a régua é a mesma do alerta de música: só acorda alguém se a pessoa
  // PAGOU. Bounce de e-mail de letra é lead que não recebeu uma prévia; bounce
  // de entrega é produto vendido e não entregue.
  if (tipo === "email.bounced" && para) {
    try {
      const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const chave = process.env.RESEND_API_KEY;
      if (url && key && chave) {
        const sb = createClient(url, key, { auth: { persistSession: false } });
        const { data: pedido } = await sb
          .from("pedidos")
          .select("id, telefone, quiz_response_id")
          .eq("email", para.toLowerCase())
          .eq("status", "pago")
          .limit(1)
          .maybeSingle();

        if (pedido) {
          const { data: m } = pedido.quiz_response_id
            ? await sb
                .from("musicas")
                .select("token, titulo")
                .eq("quiz_response_id", pedido.quiz_response_id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
            : { data: null };

          const { Resend } = await import("resend");
          await new Resend(chave).emails.send({
            from: "Serenata <contato@serenatagift.com>",
            to: ["guilhermerojasiqueira@gmail.com"],
            subject: `🔴 COMPRADOR não recebeu o e-mail: ${para}`,
            html:
              `<p><strong>O e-mail de entrega voltou. Essa pessoa pagou e não sabe onde está a música dela.</strong></p>` +
              `<p>E-mail: ${para}<br>` +
              `Telefone: ${pedido.telefone ?? "não temos"}<br>` +
              `Assunto que voltou: ${d.subject ?? "-"}<br>` +
              `Motivo: ${d.bounce?.type ?? "-"}</p>` +
              (m?.token
                ? `<p>Link do presente, pra mandar no WhatsApp:<br>` +
                  `https://www.serenatagift.com/p/${m.token}</p>`
                : "") +
              `<p>O jeito mais rápido é o botão "mandar o link de acesso no WhatsApp", na aba Recuperados do /recuperar.</p>`,
          });
        }
      }
    } catch (err) {
      console.error("[resend] aviso de bounce falhou:", err);
    }
  }

  return res.status(200).json({ ok: true });
}
