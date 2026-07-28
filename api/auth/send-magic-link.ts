// Envia o LINK DE ACESSO (magic link) à conta do comprador.
//
// Imports relativos COM extensão .js: este arquivo vira ESM em runtime na
// Vercel e o resolver do Node não aceita specifier sem extensão.
//
// Fluxo (adaptado do numaya, mas sem depender de pagamento — o checkout ainda
// é fake door):
//   1. Recebe { email }.
//   2. Só segue se esse e-mail TEM música (terminou o quiz). Sem isso, não há
//      conta a criar: o painel ficaria vazio.
//   3. Garante a conta em auth.users (cria com email_confirm, ou reaproveita).
//   4. Amarra as músicas daquele e-mail ao user_id (é o vínculo que o painel lê).
//   5. Gera o magic link nativo do Supabase e envia por Resend.
//
// Anti-enumeração: responde 200 SEMPRE (mesmo sem música), pra não virar um
// oráculo de "este e-mail comprou / não comprou". Só ENVIA quando há música.
// Quando o pagamento real entrar, o portão do passo 2 troca de "tem música"
// para "tem pedido pago" — uma linha.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailAcesso } from "../../emails/acesso.js";

type Req = IncomingMessage & {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & { status: (c: number) => Res; json: (b: unknown) => void };

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

// A origem para onde o magic link volta. Em produção é o domínio real; em
// `vercel dev` é o host da requisição (localhost). Nunca confiar num host
// arbitrário pra produção, então só aceita o header quando não há env.
function origem(req: Req): string {
  const env = process.env.VITE_APP_URL;
  if (env?.startsWith("http")) return env.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? (req.headers.host as string);
  if (host) return `${proto}://${host}`;
  return "https://www.serenatagift.com";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    const corpo = (req.body ?? {}) as { email?: unknown };
    const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "e-mail inválido" });

    const sb = db();

    // ── 2. Esse e-mail tem música? ───────────────────────────────
    // As músicas não guardam e-mail direto: o e-mail vive em quiz_responses,
    // e a música referencia quiz_response_id.
    const { data: quizzes } = await sb
      .from("quiz_responses")
      .select("id")
      .eq("email", email);
    const quizIds = (quizzes ?? []).map((q) => q.id);

    let temMusica = false;
    if (quizIds.length > 0) {
      const { data: musicas } = await sb
        .from("musicas")
        .select("id")
        .in("quiz_response_id", quizIds)
        .limit(1);
      temMusica = (musicas ?? []).length > 0;
    }

    // Anti-enumeração: mesma resposta com ou sem música.
    if (!temMusica) return res.status(200).json({ ok: true });

    // ── 3. Garante a conta ───────────────────────────────────────
    // createUser é idempotente na prática: se já existe, dá erro "already
    // registered" e a gente segue (o generateLink funciona pra conta
    // existente). email_confirm:true é o que faz o magic link entrar sem a
    // pessoa ter confirmado e-mail manualmente.
    await sb.auth.admin.createUser({ email, email_confirm: true });

    // ── 4. Gera o link e descobre o user_id ──────────────────────
    const { data: linkData, error: erroLink } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origem(req)}/auth/callback` },
    });
    const actionLink = linkData?.properties?.action_link;
    const uid = linkData?.user?.id;
    if (erroLink || !actionLink || !uid) {
      console.error("[magic-link] generateLink falhou:", erroLink?.message);
      // 200 mesmo assim: não expõe estado interno a quem chama.
      return res.status(200).json({ ok: true });
    }

    // ── 5. Amarra as músicas à conta ─────────────────────────────
    // Só as que ainda não têm dono. Idempotente: reentrar não muda nada.
    await sb
      .from("musicas")
      .update({ user_id: uid })
      .in("quiz_response_id", quizIds)
      .is("user_id", null);

    // ── 6. Envia por Resend ──────────────────────────────────────
    const chave = process.env.RESEND_API_KEY;
    if (!chave) {
      console.error("[magic-link] RESEND_API_KEY ausente");
      return res.status(200).json({ ok: true });
    }
    const { error: erroEmail } = await new Resend(chave).emails.send({
      from: "Serenata <contato@serenatagift.com>",
      to: [email],
      subject: "Seu acesso à Serenata",
      html: emailAcesso({ link: actionLink }),
    });
    if (erroEmail) {
      console.error("[magic-link] envio falhou:", erroEmail.message);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[magic-link] erro:", err);
    // Nunca vaza detalhe interno; o front mostra sempre a mesma mensagem.
    return res.status(200).json({ ok: true });
  }
}
