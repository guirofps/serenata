// A ENTREGA DO PRESENTE, uma vez só, pra qualquer gateway.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// Até 27/08 só a Perfect Pay confirmava pagamento, então a entrega morava
// dentro do webhook dela. Com a Woovi entrando, passam a existir DOIS lugares
// que liberam o mesmo produto — e duas cópias de "manda o e-mail com o link
// do editor" divergem no primeiro conserto que alguém faz numa só.
//
// O que fica aqui é o que é igual em todo gateway: achar a música, REFAZER a
// que não ficou pronta, e mandar o e-mail. O que é diferente (assinatura,
// mapeamento de campos, conciliação de valor) continua em cada webhook.
//
// ── A REGRA DE OURO, INVERTIDA ───────────────────────────────────
//
// "Nunca cobrar por algo que não foi produzido" tem um espelho igualmente
// grave: cobrado e não entregue. Aconteceu em 12/08 às 23:46 — a música
// falhou às 23:39, a pessoa pagou sete minutos depois, e o e-mail saiu com
// links de uma música que não existia. Por isso `refazerSeFaltou` roda ANTES
// do e-mail, em todo gateway, e não como remendo de um só.
//
// ── E-MAIL QUE FALHA NÃO DERRUBA O WEBHOOK ───────────────────────
//
// Devolver 500 faria o gateway reenviar o evento, e o comprador receberia o
// mesmo e-mail duas ou três vezes. A falha vira evento de auditoria e o
// pagamento continua registrado: dá pra reenviar depois, olhando o painel.

import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { avisarDonos } from "../../src/lib/avisar-donos.js";
import { emailPresentePronto, assuntoPresentePronto } from "../../emails/presente-pronto.js";
import { emailEmProducao, assuntoEmProducao } from "../../emails/entrega-em-producao.js";
import { literalLike } from "../../src/lib/sql-like.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { normalizarLocale } from "../../src/lib/i18n.js";

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : MARCA_ATIVA.url;

export type MusicaDaEntrega = {
  id: string;
  token: string;
  token_edicao: string;
  titulo: string | null;
  quiz_response_id: string | null;
  status: string | null;
  audio_path: string | null;
};

/** A música mais recente daquele quiz, com tudo que a entrega precisa. */
export async function musicaDoQuiz(
  sb: SupabaseClient,
  quizId: string,
): Promise<MusicaDaEntrega | null> {
  const { data } = await sb
    .from("musicas")
    .select("id, token, token_edicao, titulo, quiz_response_id, status, audio_path")
    .eq("quiz_response_id", quizId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MusicaDaEntrega | null) ?? null;
}

/**
 * PAGOU E A MÚSICA NÃO FICOU PRONTA: refaz agora.
 *
 * Devolve `true` quando disparou a refação, pra quem chamou registrar. Não
 * estoura: se o Inngest estiver fora, o pagamento continua gravado e o
 * problema aparece no painel em vez de virar 500 e reenvio de webhook.
 */
export async function refazerSeFaltou(
  sb: SupabaseClient,
  musica: MusicaDaEntrega,
): Promise<boolean> {
  if (musica.status === "pronta" && musica.audio_path) return false;
  try {
    await sb.from("musicas").update({ status: "gerando", erro: null }).eq("id", musica.id);
    const chave = process.env.INNGEST_EVENT_KEY;
    if (chave) {
      await fetch(`https://inn.gs/e/${chave}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "musica/gerar", data: { musicaId: musica.id } }),
      });
    }
    return true;
  } catch (err) {
    console.error("[entrega] refazer música falhou:", err);
    return false;
  }
}

export type ResultadoEntrega =
  | { ok: true; emailId: string | null }
  | { ok: false; erro: string };

/**
 * O E-MAIL COM OS DOIS LINKS.
 *
 * `linkEditor` é o do comprador (monta o presente, baixa o MP3);
 * `linkPresente` é o que ele manda pra pessoa. São dois porque o comprador é
 * quem entrega o presente — a gente nunca manda nada direto pro presenteado.
 */
export async function mandarEmailDeEntrega(
  sb: SupabaseClient,
  args: { email: string; musica: MusicaDaEntrega; nomePagador?: string | null },
): Promise<ResultadoEntrega> {
  try {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) throw new Error("RESEND_API_KEY ausente");

    const { data: q } = args.musica.quiz_response_id
      ? await sb
          .from("quiz_responses")
          .select("respostas, locale")
          .eq("id", args.musica.quiz_response_id)
          .maybeSingle()
      : { data: null };

    // O IDIOMA DA VENDA vem do registro, não da requisição: um webhook não
    // tem navegador, cabeçalho nem rota de onde deduzir. Sem idioma gravado,
    // cai no padrão da marca (pt na Serenata, en na Ballad Gift).
    const locale = normalizarLocale((q as { locale?: string } | null)?.locale);
    const ingles = locale === "en";
    // `.trim()`: o nome digitado no quiz costuma vir com espaço sobrando
    // ("Cardoso "), e o assunto saía com espaço duplo.
    const nome =
      ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ||
      args.nomePagador?.trim() ||
      (locale === "es" ? "quien tú quieres" : ingles ? "someone you love" : "quem você ama");

    // ── ELA JÁ COMPROU O QUADRO? ──────────────────────────────
    //
    // Medido em 31/08: 19 dos 24 quadros com mais de três dias NUNCA foram
    // montados. R$ 473 pagos e não usados, 79%.
    //
    // A causa está neste e-mail. O bloco do quadro era SEMPRE oferta — quem
    // acabou de pagar R$ 24,90 pelo quadro recebia, junto com a entrega, um
    // anúncio do quadro que ela já tinha, e nenhuma frase dizendo que ela
    // tinha um. O único lugar que contava a verdade era o painel, e 84% dos
    // compradores nunca entram na conta (248 de 294, medido em 18/08).
    //
    // Então a pessoa pagava por um direito que ninguém nunca mencionava.
    //
    // Lido por E-MAIL e não pelo pedido de propósito: pega o bump do
    // checkout, o upsell comprado depois e o quadro avulso pelo mesmo
    // caminho — é a mesma leitura que o painel faz.
    //
    // `literalLike` porque `%` e `_` são curingas do LIKE e são válidos num
    // endereço: sem ele, um e-mail com `%` pescaria o direito de outra pessoa.
    const { data: direitos } = await sb
      .from("quadros")
      .select("id")
      .ilike("email", literalLike(args.email))
      .is("confirmado_em", null)
      .limit(1);
    const temQuadroPraMontar = (direitos?.length ?? 0) > 0;

    // O vídeo comprado junto no checkout, esperando as fotos. Pela MÚSICA:
    // o vídeo é dela, e o bump já nasce preso a ela.
    const { data: videoEsperando } = await sb
      .from("videos")
      .select("id")
      .eq("musica_id", args.musica.id)
      .eq("status", "aguardando_fotos")
      .limit(1);
    const temVideoPraGerar = (videoEsperando?.length ?? 0) > 0;

    const linkEditor = `${SITE}/editar/${args.musica.token_edicao}`;
    const linkPresente = `${SITE}/p/${args.musica.token}`;

    // ── A MÚSICA EXISTE MESMO? ────────────────────────────────
    //
    // Em dia normal existe, porque ela é gerada ANTES do pagamento. Mas em
    // 04/09/2026 o Inngest ficou 58 minutos sem executar nada, e este e-mail
    // saiu 1 segundo depois do pagamento anunciando "A música de Fernanda
    // está pronta" — de uma música que só passou a existir 50 minutos depois.
    // O comprador clicou duas vezes, achou uma página sem áudio e abriu
    // contestação. Depois disse que "não recebeu nada": do lado dele, o que
    // chegou não era o que o assunto prometia.
    //
    // O atraso não era evitável; a MENTIRA era. Quando não há arquivo, sai o
    // e-mail que confirma o pagamento e diz que está gravando, e o "está
    // pronta" fica pra quando for verdade — quem o manda é o próprio job de
    // geração, ao terminar (`gerarMusica.ts`).
    if (!(args.musica.status === "pronta" && args.musica.audio_path)) {
      const { data: aviso, error: erroAviso } = await new Resend(chave).emails.send({
        tags: [{ name: "template", value: "entrega_em_producao" }],
        from: MARCA_ATIVA.remetenteTransacional,
        to: [args.email],
        subject: assuntoEmProducao(nome, locale),
        html: emailEmProducao({ nome, linkEditor, locale }),
        // O texto puro sempre saiu em português, inclusive no espanhol. Fica
        // assim de propósito; só o inglês ganha o seu.
        text: ingles
          ? `We got your payment. ${nome}'s song is being recorded right now.\n\nIt usually takes less than 5 minutes. If our provider has a queue, it can take up to 30. You don't need to do anything: as soon as it's ready, we'll send you another email with everything.\n\nYOUR LINK (it's already yours and won't change; the page lets you know on its own when the audio is in):\n${linkEditor}`
          : `Recebemos o seu pagamento. A música de ${nome} está sendo gravada agora.\n\nNormalmente leva menos de 5 minutos. Se o nosso fornecedor estiver com fila, pode chegar a 30. Você não precisa fazer nada: assim que ficar pronta, mandamos outro e-mail com tudo.\n\nSEU LINK (ele já é seu e não muda, a página avisa sozinha quando o áudio entrar):\n${linkEditor}`,
      });
      if (erroAviso) throw new Error(erroAviso.message);
      await registrarEnvio(sb, {
        emailId: aviso?.id,
        template: "entrega_em_producao",
        para: args.email,
        quizResponseId: args.musica.quiz_response_id ?? null,
      });
      return { ok: true, emailId: aviso?.id ?? null };
    }

    // TESTE A/B DO E-MAIL DE ENTREGA (30/09): metade B pelo último caractere
    // do id do quiz, o mesmo critério do teste de assunto da letra (a mesma
    // pessoa cai sempre no mesmo lado, e a leitura recalcula o braço pelo id).
    // Só português. Ver `variante` em `emails/presente-pronto.ts`.
    const qid = args.musica.quiz_response_id ?? "";
    const varianteEntrega: "a" | "b" =
      locale === "pt" && qid && parseInt(qid.slice(-1), 16) % 2 === 1 ? "b" : "a";

    const { data: enviado, error } = await new Resend(chave).emails.send({
      // A ETIQUETA DO ENVIO, que o Resend devolve em todo evento. É o único
      // jeito de medir DEPOIS qual e-mail performou: o assunto carrega o nome
      // da pessoa e nem sempre vem no evento.
      tags: [{ name: "template", value: "entrega" }, { name: "variante", value: varianteEntrega }],
      from: MARCA_ATIVA.remetenteTransacional,
      to: [args.email],
      subject: assuntoPresentePronto(nome, locale),
      html: emailPresentePronto({
        nome,
        titulo: args.musica.titulo ?? (ingles ? "Your song" : "Sua música"),
        linkEditor,
        linkPresente,
        temQuadroPraMontar,
        temVideoPraGerar,
        locale,
        variante: varianteEntrega,
      }),
      // Em inglês: sem WhatsApp, e quadro e vídeo só entram se forem dela.
      text: ingles
        ? `${nome}'s song is ready.\n\nYOUR LINK (set up the gift and download the MP3):\n${linkEditor}\n\nTHE LINK YOU SEND TO THEM (by text message or however you like):\n${linkPresente}\n\nThere are TWO recordings of the same lyrics: listen to both at the first link and pick the one that will play for them.\n\nThe song isn't attached to this email: it lives at these links, and they're yours forever.${
            temQuadroPraMontar
              ? `\n\nYOUR PRINT: you've already paid for it, and it just needs to be set up. It's at the same link above: ${linkEditor}?de=quadro`
              : ""
          }${
            temVideoPraGerar
              ? `\n\nYOUR VIDEO: it's already paid for. Upload the photos to the page and tap "Create my video": ${linkEditor}#video`
              : ""
          }\n\nNeed help? Just reply to this email or write to ${MARCA_ATIVA.emailContato}.`
        : `A música de ${nome} está pronta.\n\nSEU LINK (monte o presente e baixe o MP3):\n${linkEditor}\n\nO LINK QUE VOCÊ MANDA PRA ELA:\n${linkPresente}\n\nSão DUAS gravações da mesma letra: ouça as duas no primeiro link e escolha a que vai tocar pra ela.\n\nA música não vai anexada e não mandamos por WhatsApp: ela mora nesses links, e eles são seus pra sempre.${
        temQuadroPraMontar
          ? `

O SEU QUADRO: você já pagou por ele e falta montar. É no mesmo link de cima: ${linkEditor}?de=quadro`
          : ""
      }${
        temVideoPraGerar
          ? `

O SEU VÍDEO: já está pago. Suba as fotos na página e toque em "Gerar meu vídeo": ${linkEditor}#video`
          : ""
      }`,
    });
    if (error) throw new Error(error.message);

    await registrarEnvio(sb, {
      emailId: enviado?.id,
      template: "entrega",
      para: args.email,
      quizResponseId: args.musica.quiz_response_id ?? null,
    });
    return { ok: true, emailId: enviado?.id ?? null };
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    await avisarEntregaFalhou(sb, args.email, erro);
    return { ok: false, erro };
  }
}

/**
 * Quem PAGOU e não recebeu tem que virar grito, não `console.error`.
 *
 * Auditoria de 30/09: dois PIX pagos (e-mails "@gmail..com" e
 * "@gmail.com66996534277") ficaram sem entrega nenhuma, porque os quatro
 * caminhos que chamam esta função ignoravam o `{ ok: false }`. O aviso mora
 * AQUI pra valer pra todos eles de uma vez.
 *
 * Uma vez por endereço em 3 dias: o vigia de pagamento tenta de novo a cada
 * 30 min, e um alarme que repete vira alarme que ninguém lê.
 */
async function avisarEntregaFalhou(sb: SupabaseClient, email: string, erro: string) {
  try {
    const para = email.trim().toLowerCase();
    const desde = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: ja } = await sb
      .from("funnel_events")
      .select("id")
      .eq("event_name", "entrega_falhou_aviso")
      .gte("created_at", desde)
      .contains("event_data", { para })
      .limit(1);
    if ((ja ?? []).length > 0) return;
    await sb.from("funnel_events").insert({
      session_id: "sistema",
      event_name: "entrega_falhou_aviso",
      event_data: { para, erro: erro.slice(0, 300) },
    });
    const esc = (x: string) =>
      x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    await avisarDonos({
      assunto: "Comprador PAGOU e o e-mail de entrega falhou",
      html:
        `<p>O e-mail de entrega não saiu para <strong>${esc(email)}</strong>.</p>` +
        `<p>Motivo: ${esc(erro.slice(0, 300))}</p>` +
        `<p>Quase sempre é e-mail digitado errado. Corrigir o endereço no pedido e reenviar a entrega.</p>`,
    });
  } catch (e) {
    console.error("[entrega] aviso de falha também falhou:", e);
  }
}
