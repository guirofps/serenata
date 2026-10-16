import { inngest } from "../client.js";
import { cabecalhosDescadastro } from "../lib/descadastro.js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { podeMandarMarketing } from "../lib/frequencia.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { comUtm } from "../../src/lib/utm-email.js";
import { emailGuardeOLink, assuntoGuardeOLink, textoGuardeOLinkEn, textoGuardeOLinkEsEua } from "../../emails/guarde-o-link.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { todasAsPaginas } from "../lib/paginar.js";

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

const SITE = MARCA_ATIVA.url;

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
// 16/10: 8 → 15. O "regime de 50 por dia" virou ~170 (as vendas triplicaram
// desde agosto), e 8 por hora (192/dia) deixava a fila sempre no limite.
const MAX_POR_RODADA = 15;

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
  const { data, error } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "guarde_link_enviado")
    .contains("event_data", { musica_id: musicaId })
    .limit(1);
  if (error) return true; // Na dúvida, já mandou (04/10): consulta que falha não pode virar reenvio.
  return (data ?? []).length > 0;
}

export const guardeOLink = inngest.createFunction(
  {
    id: "guarde-o-link",
    // Uma rodada por vez: duas sobrepostas montam a mesma fila e mandam em dobro.
    concurrency: { limit: 1 },
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "20 * * * *" }], // de hora em hora, fora do minuto cheio
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-quem-montou", async () => {
      const sb = db();
      const agora = Date.now();

      // TODOS os pedidos da janela, por página (16/10). A consulta sem
      // paginação parava nas 1.000 linhas do PostgREST (~3,5 dias de compra
      // dos 17 da janela): 376 compradores de 7 a 20 dias montaram a página e
      // nunca receberam este e-mail, que é o que evita o "perdi o link".
      const pedidos = await todasAsPaginas<{
        id: string; email: string | null; musica_id: string | null; quiz_response_id: string | null; paid_at: string;
      }>((de, ate) =>
        sb
          .from("pedidos")
          .select("id, email, musica_id, quiz_response_id, paid_at")
          .eq("status", "pago")
          .gte("paid_at", new Date(agora - MAX_DIAS * 86400000).toISOString())
          .lte("paid_at", new Date(agora - MIN_DIAS * 86400000).toISOString())
          .order("paid_at", { ascending: false })
          .order("id", { ascending: true })
          .range(de, ate),
      );

      // Quem já recebeu, numa leitura só (com janela de tempo, pela regra da
      // casa), em vez de uma consulta por música a cada hora. Falhou a
      // leitura, a rodada para: na dúvida, não manda.
      const jaEnviados = new Set(
        (
          await todasAsPaginas<{ event_data: { musica_id?: string } | null }>((de, ate) =>
            sb
              .from("funnel_events")
              .select("event_data")
              .eq("event_name", "guarde_link_enviado")
              .gte("created_at", new Date(agora - (MAX_DIAS + 2) * 86400000).toISOString())
              .order("created_at", { ascending: true })
              .order("id", { ascending: true })
              .range(de, ate),
          )
        )
          .map((e) => e.event_data?.musica_id)
          .filter(Boolean) as string[],
      );

      const out: Array<{
        email: string; nome: string; titulo: string;
        linkEditor: string; linkPresente: string; musicaId: string; locale: "pt" | "es" | "en";
        quizId: string | null;
      }> = [];
      const vistos = new Set<string>();

      // Um pedido por música (o mais novo), só os que ainda não receberam.
      const fila: typeof pedidos = [];
      for (const p of pedidos) {
        if (!p.email || !p.musica_id) continue;
        if (vistos.has(p.musica_id)) continue;
        vistos.add(p.musica_id);
        if (!jaEnviados.has(p.musica_id)) fila.push(p);
      }

      // As músicas em lotes de 100: quem não montou a página continua na fila
      // toda hora, e uma consulta por música viraria mil idas ao banco por rodada.
      const COLUNAS = "id, token, token_edicao, titulo, status, personalizada_em, foto_path, galeria, dedicatoria, quiz_response_id, locale";
      type LinhaMusica = {
        id: string; token: string | null; token_edicao: string | null; titulo: string | null; status: string;
        personalizada_em: string | null; foto_path: string | null; galeria: string[] | null; dedicatoria: string | null;
        quiz_response_id: string | null; locale: string | null;
      };
      for (let i = 0; i < fila.length && out.length < MAX_POR_RODADA; i += 100) {
        const lote = fila.slice(i, i + 100);
        const { data: linhas, error: erroMusicas } = await sb
          .from("musicas")
          .select(COLUNAS)
          .in("id", lote.map((p) => p.musica_id as string));
        if (erroMusicas) throw new Error(erroMusicas.message);
        const porId = new Map(((linhas ?? []) as LinhaMusica[]).map((m) => [m.id, m]));

        for (const p of lote) {
          if (out.length >= MAX_POR_RODADA) break;
          if (!p.email || !p.musica_id) continue;
          const m = porId.get(p.musica_id);
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

          // O quiz pela MÚSICA quando o pedido não tem (16/10): o pedido do vídeo
          // pago no Stripe nasce só com `musica_id`, e sai antes do pedido da
          // música na ordem por `paid_at`. Sem quiz o idioma caía em `pt` e o
          // comprador americano recebia o e-mail inteiro em português.
          const quizId = (p.quiz_response_id as string | null) ?? ((m.quiz_response_id as string | null) ?? null);
          const { data: q } = quizId
            ? await sb
                .from("quiz_responses")
                .select("respostas, locale")
                .eq("id", quizId)
                .maybeSingle()
            : { data: null };

          // O idioma vem do registro: cron não tem requisição de onde deduzir.
          // Ver a migration 20260807000000_locale. `en` é a Ballad Gift, onde
          // o padrão da coluna já é 'en'.
          const bruto = (q as { locale?: string } | null)?.locale ?? (m.locale as string | null);
          const locale = bruto === "es" ? "es" : bruto === "en" ? "en" : "pt";

          out.push({
            email: p.email,
            locale,
            nome:
              ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ||
              // `tú` no espanhol da Ballad (hispanos dos EUA); o da Serenata é
              // argentino.
              (locale === "es"
                ? MARCA_ATIVA.chave === "ballad" ? "quien tú quieres" : "quien vos querés"
                : locale === "en" ? "someone you love" : "quem você ama"),
            titulo:
              m.titulo ??
              (locale === "en" ? "Your song" : locale === "es" && MARCA_ATIVA.chave === "ballad" ? "Tu canción" : "Sua música"),
            linkEditor: `${SITE}/editar/${m.token_edicao}`,
            linkPresente: `${SITE}/p/${m.token}`,
            musicaId: m.id,
            quizId,
          });
        }
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
        if (await estaBloqueado(sb, c.email)) return false;
        // Teste `limite_frequencia` (08/10): no braço B, no máximo 2 e-mails
        // de marketing por endereço em 24h. Barrado aqui não grava marca, e
        // volta na próxima rodada. No A não vai ao banco.
        if (!(await podeMandarMarketing(sb, c.email, c.quizId, { locale: c.locale }))) return false;

        const { data: enviado, error } = await comUtm(new Resend(chave)).emails.send({
          tags: [{ name: "template", value: "guarde_o_link" }],
          from: MARCA_ATIVA.remetenteTransacional,
          to: [c.email],
          headers: cabecalhosDescadastro(c.email),
          subject: assuntoGuardeOLink(c.nome, c.locale),
          html: emailGuardeOLink({
            nome: c.nome,
            titulo: c.titulo,
            linkEditor: c.linkEditor,
            linkPresente: c.linkPresente,
            locale: c.locale,
          }),
          text: c.locale === "en"
            ? textoGuardeOLinkEn({ nome: c.nome, linkEditor: c.linkEditor, linkPresente: c.linkPresente })
            : c.locale === "es" && MARCA_ATIVA.chave === "ballad"
            ? textoGuardeOLinkEsEua({ nome: c.nome, linkEditor: c.linkEditor, linkPresente: c.linkPresente })
            :
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
          // O ID DO QUIZ, que faltava. Sem ele a linha de `emails_enviados`
          // grava QUE saiu e não PRA QUEM, e nenhuma pergunta sobre receita
          // por e-mail tem resposta — era o caso dos 978 `letra_pronta`
          // registrados em dois dias, todos com `quiz_response_id` nulo.
          quizResponseId: c.quizId ?? undefined,
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
