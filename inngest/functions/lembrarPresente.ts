import { inngest } from "../client.js";
import { cabecalhosDescadastro } from "../lib/descadastro.js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { podeMandarMarketing } from "../lib/frequencia.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { comUtm } from "../../src/lib/utm-email.js";
import { emailLembretePresente, assuntoLembrete, textoLembreteEn, textoLembreteEsEua } from "../../emails/lembrete-presente.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { todasAsPaginas } from "../lib/paginar.js";
import { paisPraEmail } from "../../src/lib/pais-quiz.js";
import { noPais } from "../../emails/mercado-email.js";
import { jaTravado, soltarTrava, travarEnvio } from "../lib/trava-envio.js";

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

const SITE = MARCA_ATIVA.url;

// Janela: 1h (era 3h até 28/09). Medido de 14 a 27/09: 49% dos compradores
// não tinham aberto o editor 3h depois de pagar, e o upsell acontece quase
// todo na primeira hora (40 dos 64 vídeos). Lembrar em 1h pega a pessoa ainda
// com o presente na cabeça. 96h evita ressuscitar compra velha e parecer spam.
const MIN_H = 1;
const MAX_H = 96;
// Teto por rodada (16/10). Antes não precisava: a consulta sem página via só
// 1.000 pedidos quaisquer. Com a janela inteira à vista, a 1ª rodada acharia
// o represamento de dias de uma vez; 40 por hora drena sem pico no domínio
// (o regime normal é ~7 por hora).
const MAX_POR_RODADA = 40;

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
  // Com janela (29/10), a mesma da fila: `funnel_events` sem `created_at` foi o
  // que estourou o PostgREST em 04/10. Erro conta como "já mandou" (`jaTravado`).
  const desde = new Date(Date.now() - (MAX_H + 48) * 3600000).toISOString();
  return jaTravado(sb, "lembrete_presente_enviado", { musica_id: musicaId }, desde);
}

export const lembrarPresente = inngest.createFunction(
  {
    id: "lembrar-presente",
    // Uma rodada por vez: duas sobrepostas montam a mesma fila e mandam em dobro.
    concurrency: { limit: 1 },
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "0 * * * *" }], // de hora em hora
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-quem-nao-montou", async () => {
      const sb = db();
      const agora = Date.now();
      // Por página e ordenado (16/10): sem isto o PostgREST devolvia 1.000
      // pedidos quaisquer dos ~1.500 da janela, e o resto nunca era lembrado.
      const pedidos = await todasAsPaginas<{
        id: string; email: string | null; musica_id: string | null; quiz_response_id: string | null; paid_at: string;
      }>((de, ate) =>
        sb
          .from("pedidos")
          .select("id, email, musica_id, quiz_response_id, paid_at")
          .eq("status", "pago")
          .gte("paid_at", new Date(agora - MAX_H * 3600000).toISOString())
          .lte("paid_at", new Date(agora - MIN_H * 3600000).toISOString())
          .order("paid_at", { ascending: true })
          .order("id", { ascending: true })
          .range(de, ate),
      );

      // Quem já foi lembrado, numa leitura só e com janela de tempo. Falhou,
      // a rodada para (na dúvida, não manda).
      const jaLembrados = new Set(
        (
          await todasAsPaginas<{ event_data: { musica_id?: string } | null }>((de, ate) =>
            sb
              .from("funnel_events")
              .select("event_data")
              .eq("event_name", "lembrete_presente_enviado")
              .gte("created_at", new Date(agora - (MAX_H + 48) * 3600000).toISOString())
              .order("created_at", { ascending: true })
              .order("id", { ascending: true })
              .range(de, ate),
          )
        )
          .map((e) => e.event_data?.musica_id)
          .filter(Boolean) as string[],
      );

      // Um pedido por música: o do vídeo pelo Stripe nasce só com `musica_id`
      // e, sem quiz, mandava o lembrete em português pro comprador da Ballad.
      const porMusica = new Map<string, (typeof pedidos)[number]>();
      for (const p of pedidos) {
        if (!p.email || !p.musica_id || jaLembrados.has(p.musica_id)) continue;
        const atual = porMusica.get(p.musica_id);
        if (!atual || (!atual.quiz_response_id && p.quiz_response_id)) porMusica.set(p.musica_id, p);
      }
      const fila = [...porMusica.values()];

      const out: Array<{
        email: string; nome: string; titulo: string; linkEditor: string;
        musicaId: string; locale: "pt" | "es" | "en"; quizId: string | null;
      }> = [];

      type LinhaMusica = {
        id: string; token_edicao: string | null; titulo: string | null; status: string; personalizada_em: string | null;
        foto_path: string | null; galeria: string[] | null; dedicatoria: string | null;
        quiz_response_id: string | null; locale: string | null;
      };
      for (let i = 0; i < fila.length && out.length < MAX_POR_RODADA; i += 100) {
        const lote = fila.slice(i, i + 100);
        const { data: linhas, error: erroMusicas } = await sb
          .from("musicas")
          .select("id, token_edicao, titulo, status, personalizada_em, foto_path, galeria, dedicatoria, quiz_response_id, locale")
          .in("id", lote.map((p) => p.musica_id as string));
        if (erroMusicas) throw new Error(erroMusicas.message);
        const porId = new Map(((linhas ?? []) as LinhaMusica[]).map((m) => [m.id, m]));

        for (const p of lote) {
          if (out.length >= MAX_POR_RODADA) break;
          if (!p.email || !p.musica_id) continue;
          const m = porId.get(p.musica_id);
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

          const quizId = p.quiz_response_id ?? m.quiz_response_id ?? null;
          const { data: q } = quizId
            ? await sb.from("quiz_responses").select("respostas, locale").eq("id", quizId).maybeSingle()
            : { data: null };

          // O idioma vem do registro: um cron não tem requisição de onde
          // deduzir. Ver a migration 20260807000000_locale. `en` é a Ballad
          // Gift, onde o padrão da coluna já é 'en'.
          const bruto = (q as { locale?: string } | null)?.locale ?? m.locale;
          const locale = bruto === "es" ? "es" : bruto === "en" ? "en" : "pt";

          out.push({
            email: p.email,
            locale,
            // `.trim()`: nome digitado no quiz vem com espaço sobrando ("Cardoso ")
            // e o assunto sairia com espaço duplo.
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
            musicaId: m.id,
            quizId,
          });
        }
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
        if (await estaBloqueado(sb, c.email)) return false;
        // Teste `limite_frequencia` (08/10): no braço B, no máximo 2 e-mails
        // de marketing por endereço em 24h. Barrado aqui não grava marca, e
        // volta na próxima rodada. No A não vai ao banco.
        if (!(await podeMandarMarketing(sb, c.email, c.quizId, { locale: c.locale }))) return false;

        // A TRAVA ANTES DO ENVIO (29/10): a marca era gravada DEPOIS do Resend
        // e sem ler o erro, e uma gravação perdida repetia o lembrete de hora
        // em hora. Mesmo evento e conteúdo que o `jaLembrado` lê. Não gravou,
        // não manda.
        const trava = await travarEnvio(sb, {
          event_name: "lembrete_presente_enviado",
          event_data: { musica_id: c.musicaId, email: c.email },
        });
        if (!trava) return false;

        const { data: enviado, error } = await noPais(
          comUtm(new Resend(chave)),
          c.locale,
          // O espanhol do país do quiz (29/10): WhatsApp e `vosotros` na Espanha.
          await paisPraEmail(sb, c.quizId, c.locale),
        ).emails.send({
      // A ETIQUETA DO ENVIO. O Resend devolve isto em todo evento
      // (entregue, aberto, clicado, devolvido), e e o unico jeito de
      // saber DEPOIS qual e-mail performou: o assunto carrega o nome da
      // pessoa e nem sempre vem no evento.
      tags: [{ name: "template", value: "lembrar_presente" }],
          from: MARCA_ATIVA.remetenteTransacional,
          to: [c.email],
          headers: cabecalhosDescadastro(c.email),
          subject: assuntoLembrete(c.nome, c.locale),
          html: emailLembretePresente({ nome: c.nome, titulo: c.titulo, linkEditor: c.linkEditor, locale: c.locale }),
          text: c.locale === "en"
            ? textoLembreteEn({ nome: c.nome, linkEditor: c.linkEditor })
            : c.locale === "es" && MARCA_ATIVA.chave === "ballad"
            ? textoLembreteEsEua({ nome: c.nome, linkEditor: c.linkEditor })
            :
            `A música de ${c.nome} está pronta, mas a página ainda não foi montada.\n\n` +
            `Escolha a gravação, ponha as fotos e escreva uma frase sua:\n${c.linkEditor}\n\n` +
            `Não tem pressa: a música é sua e o link não expira.`,
        });
        if (error) {
          console.error("[lembrete] envio falhou:", error.message);
          await soltarTrava(sb, trava);
          return false;
        }
        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "lembrar_presente",
          para: c.email,
          // O ID DO QUIZ, que faltava. Sem ele a linha de `emails_enviados`
          // grava QUE saiu e não PRA QUEM, e nenhuma pergunta sobre receita
          // por e-mail tem resposta — era o caso dos 978 `letra_pronta`
          // registrados em dois dias, todos com `quiz_response_id` nulo.
          quizResponseId: c.quizId ?? undefined,
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
