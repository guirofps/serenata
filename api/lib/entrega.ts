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
import { emailPresentePronto, assuntoPresentePronto } from "../../emails/presente-pronto.js";
import { emailEmProducao, assuntoEmProducao } from "../../emails/entrega-em-producao.js";
import { literalLike } from "../../src/lib/sql-like.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";

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
    // tem navegador, cabeçalho nem rota de onde deduzir.
    const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";
    // `.trim()`: o nome digitado no quiz costuma vir com espaço sobrando
    // ("Cardoso "), e o assunto saía com espaço duplo.
    const nome =
      ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ||
      args.nomePagador?.trim() ||
      (locale === "es" ? "quien tú quieres" : "quem você ama");

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
        from: "Serenata <contato@serenatagift.com>",
        to: [args.email],
        subject: assuntoEmProducao(nome, locale),
        html: emailEmProducao({ nome, linkEditor, locale }),
        text: `Recebemos o seu pagamento. A música de ${nome} está sendo gravada agora.\n\nNormalmente leva menos de 5 minutos. Se o nosso fornecedor estiver com fila, pode chegar a 30. Você não precisa fazer nada: assim que ficar pronta, mandamos outro e-mail com tudo.\n\nSEU LINK (ele já é seu e não muda, a página avisa sozinha quando o áudio entrar):\n${linkEditor}`,
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

    const { data: enviado, error } = await new Resend(chave).emails.send({
      // A ETIQUETA DO ENVIO, que o Resend devolve em todo evento. É o único
      // jeito de medir DEPOIS qual e-mail performou: o assunto carrega o nome
      // da pessoa e nem sempre vem no evento.
      tags: [{ name: "template", value: "entrega" }],
      from: "Serenata <contato@serenatagift.com>",
      to: [args.email],
      subject: assuntoPresentePronto(nome, locale),
      html: emailPresentePronto({
        nome,
        titulo: args.musica.titulo ?? "Sua música",
        linkEditor,
        linkPresente,
        temQuadroPraMontar,
        locale,
      }),
      text: `A música de ${nome} está pronta.\n\nSEU LINK (monte o presente e baixe o MP3):\n${linkEditor}\n\nO LINK QUE VOCÊ MANDA PRA ELA:\n${linkPresente}\n\nSão DUAS gravações da mesma letra: ouça as duas no primeiro link e escolha a que vai tocar pra ela.\n\nA música não vai anexada e não mandamos por WhatsApp: ela mora nesses links, e eles são seus pra sempre.${
        temQuadroPraMontar
          ? `

O SEU QUADRO: você já pagou por ele e falta montar. É no mesmo link de cima: ${linkEditor}?de=quadro`
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
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
