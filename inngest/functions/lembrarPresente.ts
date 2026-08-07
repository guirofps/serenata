import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailLembretePresente, assuntoLembrete } from "../../emails/lembrete-presente.js";

// LEMBRETE de quem pagou e não montou o presente.
//
// Medido em 03/08: de 6 compras, 3 nunca montaram. O e-mail de entrega tem o
// botão certo, mas basta cair em Promoções pra pessoa nunca ver.
//
// Por que CRON e não um passo atrasado disparado pelo webhook: cron pega
// TODO mundo, inclusive quem comprou antes desta função existir e quem
// escapou porque o evento não foi emitido. Um `step.sleep` no webhook só
// cobriria compras futuras e falharia em silêncio se o disparo falhasse.
//
// Por que no Inngest e não no cron da Vercel: o plano Hobby limita cron a uma
// vez por dia, e o Inngest agenda por conta própria sem esse teto.

const SITE = "https://www.serenatagift.com";

// Janela: 3h dá tempo da pessoa montar sozinha sem receber cobrança à toa;
// 96h evita ressuscitar compra velha e parecer spam.
const MIN_H = 3;
const MAX_H = 96;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Já lembramos esta música?
 *
 * O registro vive em `funnel_events` (mesma trilha que o webhook usa pros
 * e-mails) e não numa coluna nova: evita migration só pra um booleano, e
 * deixa o histórico visível junto do resto. A checagem é por musica_id.
 */
async function jaLembrado(sb: ReturnType<typeof db>, musicaId: string) {
  const { data } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "lembrete_presente_enviado")
    .contains("event_data", { musica_id: musicaId })
    .limit(1);
  return (data ?? []).length > 0;
}

export const lembrarPresente = inngest.createFunction(
  {
    id: "lembrar-presente",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "0 * * * *" }], // de hora em hora
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-quem-nao-montou", async () => {
      const sb = db();
      const agora = Date.now();
      const { data: pedidos } = await sb
        .from("pedidos")
        .select("id, email, musica_id, quiz_response_id, paid_at")
        .eq("status", "pago")
        .gte("paid_at", new Date(agora - MAX_H * 3600000).toISOString())
        .lte("paid_at", new Date(agora - MIN_H * 3600000).toISOString());

      const out: Array<{
        email: string; nome: string; titulo: string; linkEditor: string;
        musicaId: string; locale: "pt" | "es";
      }> = [];

      for (const p of pedidos ?? []) {
        if (!p.email || !p.musica_id) continue;

        const { data: m } = await sb
          .from("musicas")
          .select("id, token_edicao, titulo, status, personalizada_em, foto_path, galeria, dedicatoria")
          .eq("id", p.musica_id)
          .maybeSingle();
        if (!m || m.status !== "pronta" || !m.token_edicao) continue;

        // "Montou" é qualquer sinal de que a pessoa mexeu no presente, não só
        // `personalizada_em` (que só é escrito quando sobe foto). Sem isso o
        // lembrete iria pra quem já escolheu versão, cor e efeito.
        const montou =
          Boolean(m.personalizada_em) ||
          Boolean(m.foto_path) ||
          Boolean(m.dedicatoria) ||
          ((m.galeria as string[] | null)?.length ?? 0) > 0;
        if (montou) continue;

        if (await jaLembrado(sb, m.id)) continue;

        const { data: q } = p.quiz_response_id
          ? await sb.from("quiz_responses").select("respostas, locale").eq("id", p.quiz_response_id).maybeSingle()
          : { data: null };

        // O idioma vem do registro: um cron não tem requisição de onde
        // deduzir. Ver a migration 20260807000000_locale.
        const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";

        out.push({
          email: p.email,
          locale: locale as "pt" | "es",
          // `.trim()`: nome digitado no quiz vem com espaço sobrando ("Cardoso ")
          // e o assunto sairia com espaço duplo.
          nome:
            ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ||
            (locale === "es" ? "quien tú quieres" : "quem você ama"),
          titulo: m.titulo ?? "Sua música",
          linkEditor: `${SITE}/editar/${m.token_edicao}`,
          musicaId: m.id,
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    // Um passo POR PESSOA: se o envio de uma falhar, o Inngest reexecuta só
    // aquele, e ninguém recebe o lembrete duas vezes.
    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`lembrar-${c.musicaId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();

        // Recheca na hora do envio: a pessoa pode ter montado entre a busca e
        // agora, e nada é pior que cobrar quem já fez.
        if (await jaLembrado(sb, c.musicaId)) return false;

        const { error } = await new Resend(chave).emails.send({
          from: "Serenata <contato@serenatagift.com>",
          to: [c.email],
          subject: assuntoLembrete(c.nome, c.locale),
          html: emailLembretePresente({ nome: c.nome, titulo: c.titulo, linkEditor: c.linkEditor, locale: c.locale }),
          text:
            `A música de ${c.nome} está pronta, mas a página ainda não foi montada.\n\n` +
            `Escolha a gravação, ponha as fotos e escreva uma frase sua:\n${c.linkEditor}\n\n` +
            `Não tem pressa: a música é sua e o link não expira.`,
        });
        if (error) {
          console.error("[lembrete] envio falhou:", error.message);
          return false;
        }

        await sb.from("funnel_events").insert({
          event_name: "lembrete_presente_enviado",
          event_data: { musica_id: c.musicaId, email: c.email },
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
