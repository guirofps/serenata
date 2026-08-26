import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailGuardeOLink, assuntoGuardeOLink } from "../../emails/guarde-o-link.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

// O CAMINHO DE VOLTA, três dias depois da compra.
//
// ── O NÚMERO QUE JUSTIFICA ISTO ──────────────────────────────────
//
// 26/08: oito tickets de suporte num dia, CINCO deles a mesma coisa — a música
// pronta e funcionando, e a pessoa sem achar o caminho até ela. Um tinha
// montado a página com 12 fotos e voltou uma semana depois achando que não
// tinha recebido nada. Outro estava logado no painel e mesmo assim ficou
// quatro dias sem a música.
//
// Nenhum era defeito. 84% dos compradores nunca entram na conta, então o
// e-mail de entrega é a única memória que eles têm do link — e ele soterra em
// três dias.
//
// ── QUEM RECEBE: SÓ QUEM JÁ MONTOU ───────────────────────────────
//
// Quem não montou já tem o `lembrarPresente` (3h a 96h), com outro pedido e
// outro texto. Os dois juntos seriam duas cobranças na mesma semana pra mesma
// pessoa, e é assim que remetente novo cai no spam.
//
// A divisão fica limpa e sem sobreposição:
//   não montou → lembrete (monte o presente)
//   montou     → este aqui (guarde seus links)
//
// ── UM SÓ, PARA SEMPRE ───────────────────────────────────────────
//
// Não é sequência. O trabalho é deixar UM e-mail achável na caixa da pessoa,
// com a palavra "links" no assunto pra ela encontrar na busca meses depois.
// Repetir isso não melhora a busca, só gasta reputação.

const SITE = "https://www.serenatagift.com";

const MIN_DIAS = 3;
// A janela fecha em 20 dias pra não ressuscitar compra velha, e fecha ANTES do
// `volteCriar` ficar denso (ele roda de 5 a 30 dias): quem comprou tem que
// receber os dois espaçados, não no mesmo dia.
const MAX_DIAS = 20;
// Teto por rodada, pelo mesmo motivo do `volteCriar`: domínio novo não aguenta
// pico.
//
// Medido em 26/08, antes de ligar: a fila inicial tem 509 pessoas (todo mundo
// que comprou nos últimos 20 dias e montou). A 8 por hora são 192 por dia, e
// ela drena em pouco menos de três dias sem nunca dobrar o volume diário do
// domínio (uns 380/dia, quase tudo e-mail de letra). Passado o represamento, o
// regime permanente é de umas 50 por dia e o teto nunca mais encosta.
const MAX_POR_RODADA = 8;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Já mandamos pra esta música?
 *
 * Por música e não por e-mail: quem comprou duas músicas tem dois pares de
 * links diferentes e precisa dos dois. É o oposto do `volteCriar`, que é por
 * pessoa porque convida uma vez só.
 */
async function jaMandado(sb: ReturnType<typeof db>, musicaId: string) {
  const { data } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "guarde_link_enviado")
    .contains("event_data", { musica_id: musicaId })
    .limit(1);
  return (data ?? []).length > 0;
}

export const guardeOLink = inngest.createFunction(
  {
    id: "guarde-o-link",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "20 * * * *" }], // de hora em hora, fora do minuto cheio
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-quem-montou", async () => {
      const sb = db();
      const agora = Date.now();

      const { data: pedidos } = await sb
        .from("pedidos")
        .select("id, email, musica_id, quiz_response_id, paid_at")
        .eq("status", "pago")
        .gte("paid_at", new Date(agora - MAX_DIAS * 86400000).toISOString())
        .lte("paid_at", new Date(agora - MIN_DIAS * 86400000).toISOString())
        .order("paid_at", { ascending: false });

      const out: Array<{
        email: string; nome: string; titulo: string;
        linkEditor: string; linkPresente: string; musicaId: string; locale: "pt" | "es";
      }> = [];
      const vistos = new Set<string>();

      for (const p of pedidos ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if (!p.email || !p.musica_id) continue;
        if (vistos.has(p.musica_id)) continue;
        vistos.add(p.musica_id);

        const { data: m } = await sb
          .from("musicas")
          .select("id, token, token_edicao, titulo, status, personalizada_em, foto_path, galeria, dedicatoria")
          .eq("id", p.musica_id)
          .maybeSingle();
        if (!m || m.status !== "pronta" || !m.token_edicao || !m.token) continue;

        // "Montou" é qualquer sinal de que mexeu no presente, e não só
        // `personalizada_em` (que só é escrito quando sobe foto). É a MESMA
        // regra do `lembrarPresente`, invertida — se as duas divergirem,
        // alguém recebe os dois e-mails ou nenhum.
        const montou =
          Boolean(m.personalizada_em) ||
          Boolean(m.foto_path) ||
          Boolean(m.dedicatoria) ||
          ((m.galeria as string[] | null)?.length ?? 0) > 0;
        if (!montou) continue;

        if (await jaMandado(sb, m.id)) continue;

        const { data: q } = p.quiz_response_id
          ? await sb
              .from("quiz_responses")
              .select("respostas, locale")
              .eq("id", p.quiz_response_id)
              .maybeSingle()
          : { data: null };

        // O idioma vem do registro: cron não tem requisição de onde deduzir.
        // Ver a migration 20260807000000_locale.
        const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";

        out.push({
          email: p.email,
          locale: locale as "pt" | "es",
          nome:
            ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ||
            (locale === "es" ? "quien tú quieres" : "quem você ama"),
          titulo: m.titulo ?? "Sua música",
          linkEditor: `${SITE}/editar/${m.token_edicao}`,
          linkPresente: `${SITE}/p/${m.token}`,
          musicaId: m.id,
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`guardar-${c.musicaId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        if (await jaMandado(sb, c.musicaId)) return false;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "guarde_o_link" }],
          from: "Serenata <contato@serenatagift.com>",
          to: [c.email],
          subject: assuntoGuardeOLink(c.nome, c.locale),
          html: emailGuardeOLink({
            nome: c.nome,
            titulo: c.titulo,
            linkEditor: c.linkEditor,
            linkPresente: c.linkPresente,
            locale: c.locale,
          }),
          text:
            `Guarde este e-mail: são os dois links da música de ${c.nome}.\n\n` +
            `SEU LINK (baixar o MP3 e editar a página):\n${c.linkEditor}\n\n` +
            `O LINK QUE VOCÊ MANDA PRA ELA:\n${c.linkPresente}\n\n` +
            `Sua música não expira e a página continua no ar.`,
        });
        if (error) {
          console.error("[guarde-o-link] envio falhou:", error.message);
          return false;
        }

        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "guarde_o_link",
          para: c.email,
        });
        await sb.from("funnel_events").insert({
          event_name: "guarde_link_enviado",
          event_data: { musica_id: c.musicaId, email: c.email },
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
