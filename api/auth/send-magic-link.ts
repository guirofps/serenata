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
import { emailAcesso, assuntoAcesso } from "../../emails/acesso.js";

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

    // ── 2. Esse e-mail merece um link? ───────────────────────────
    // Duas portas de entrada, e QUALQUER uma serve:
    //   (a) já tem CONTA (comprou antes, ou foi vinculado por user_id); ou
    //   (b) tem MÚSICA gerada pelo e-mail do quiz (terminou o funil).
    // Só checar (b) deixava de fora quem já tem conta mas cujo e-mail não bate
    // com um quiz_response — o comprador ficava travado na tela de "confira
    // seu e-mail" sem nunca receber nada.
    const { data: conta } = await sb
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    const temConta = Boolean(conta);

    // As músicas não guardam e-mail direto: o e-mail vive em quiz_responses,
    // e a música referencia quiz_response_id.
    const { data: quizzes } = await sb
      .from("quiz_responses")
      .select("id, locale")
      .eq("email", email)
      .order("created_at", { ascending: false });
    const quizIds = (quizzes ?? []).map((q) => q.id);

    // O idioma da conta é o do lead MAIS RECENTE com este e-mail. Não existe
    // outra fonte: o pedido de link chega de um formulário que só tem e-mail,
    // e alguém pode ter comprado nos dois funis.
    const locale =
      (quizzes ?? [])[0]?.locale === "es" ? ("es" as const) : ("pt" as const);

    // As músicas prontas viram LINKS DIRETOS no e-mail. O magic link é de uso
    // único, expira, e é morto por qualquer pedido novo: três formas de falhar
    // pra chegar a algo já pago. O token do editor não tem nenhuma delas, então
    // o e-mail leva os dois e o login vira atalho, não portão.
    let musicasProntas: { titulo: string | null; token_edicao: string }[] = [];
    if (quizIds.length > 0) {
      const { data: musicas } = await sb
        .from("musicas")
        .select("titulo, token_edicao, created_at")
        .in("quiz_response_id", quizIds)
        .eq("status", "pronta")
        .not("token_edicao", "is", null)
        .order("created_at", { ascending: false });
      musicasProntas = musicas ?? [];
    }
    // O portão continua sendo "tem música", inclusive a que ainda está gerando:
    // quem acabou de comprar precisa entrar mesmo antes de a música existir.
    let temMusica = musicasProntas.length > 0;
    if (!temMusica && quizIds.length > 0) {
      const { data: qualquer } = await sb
        .from("musicas")
        .select("id")
        .in("quiz_response_id", quizIds)
        .limit(1);
      temMusica = (qualquer ?? []).length > 0;
    }

    // Anti-enumeração: mesma resposta pra quem não tem conta nem música.
    if (!temConta && !temMusica) return res.status(200).json({ ok: true });

    // ENDEREÇO QUE JÁ VOLTOU não recebe de novo.
    //
    // Este caminho é o mais perigoso dos três, porque é o único que a PESSOA
    // dispara: quem não acha o e-mail vai pro login e pede link. Se o endereço
    // está morto, cada pedido é mais um bounce, e ela pode repetir dez vezes.
    // Foi assim que o endereço do Rodrigo levou duas entregas devolvidas.
    //
    // A resposta continua 200 e igual à dos outros casos: dizer "seu e-mail
    // está bloqueado" aqui entregaria informação sobre a conta a quem só
    // digitou um endereço.
    const { data: morto } = await sb
      .from("emails_mortos")
      .select("email")
      .eq("email", email)
      .is("liberado_em", null)
      .maybeSingle();
    if (morto) {
      console.warn("[magic-link] endereço bloqueado por bounce:", email);
      return res.status(200).json({ ok: true });
    }

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
      // O `lang` viaja no retorno porque a tela de callback é o ÚNICO lugar
      // sem sessão e sem prefixo de rota: quando o link expira, ela não teria
      // como saber em que língua falar, nem pra qual login mandar de volta.
      options: { redirectTo: `${origem(req)}/auth/callback?lang=${locale}` },
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
    const presentes = musicasProntas.map((m) => ({
      titulo: m.titulo,
      tokenEdicao: m.token_edicao,
    }));
    const site = origem(req);
    const linhasPresentes = presentes.length
      ? "\n\n" +
        (locale === "es" ? "O entra directo, sin cuenta:" : "Ou vá direto, sem entrar na conta:") +
        "\n" +
        presentes
          .map((p) => `${p.titulo?.trim() || "Sua música"}: ${site}/editar/${p.tokenEdicao}`)
          .join("\n")
      : "";
    const avisoUltimo =
      locale === "es"
        ? "\n\nSi pediste el link más de una vez, usa el correo MÁS RECIENTE: al pedir uno nuevo, los anteriores dejan de funcionar."
        : "\n\nSe você pediu o link mais de uma vez, use o e-mail MAIS RECENTE: ao pedir um novo, os anteriores param de funcionar.";
    const { error: erroEmail } = await new Resend(chave).emails.send({
      // A ETIQUETA DO ENVIO. O Resend devolve isto em todo evento
      // (entregue, aberto, clicado, devolvido), e e o unico jeito de
      // saber DEPOIS qual e-mail performou: o assunto carrega o nome da
      // pessoa e nem sempre vem no evento.
      tags: [{ name: "template", value: "magic_link" }],
      from: "Serenata <contato@serenatagift.com>",
      to: [email],
      subject: assuntoAcesso(locale),
      html: emailAcesso({ link: actionLink, locale, presentes }),
      // Versão em texto puro: e-mail só-HTML tem mais cara de spam. O
      // multipart/alternative melhora a entrega, ainda mais em domínio novo.
      text:
        `Entrar na sua conta Serenata, sem senha:\n${actionLink}\n\n` +
        `Este link é de uso único e expira em 60 minutos. Se não foi você que pediu, pode ignorar este e-mail.` +
        avisoUltimo +
        linhasPresentes,
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
