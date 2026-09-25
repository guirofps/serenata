// DAR O QUE A PESSOA COMPROU, quando o upsell é pago.
//
// Música extra e "três músicas" viram CRÉDITO (linha em `creditos`); o quadro
// vira DIREITO (linha em `quadros`, com `musica_id` nulo — o nulo é o direito:
// ela ainda vai escolher de qual música o quadro é).
//
// ── POR QUE VIROU MÓDULO ─────────────────────────────────────────
//
// Até 27/08 só a Perfect Pay vendia upsell, e isto morava dentro do webhook
// dela. Com o PIX da Woovi vendendo os mesmos três produtos, passam a existir
// dois lugares creditando a mesma coisa — e duas cópias de "insere em
// creditos, ignora 23505, alerta se falhar" divergem no primeiro conserto.
//
// ── O 23505 É AMIGO, NÃO ERRO ────────────────────────────────────
//
// `creditos_um_por_pedido` e `quadros_um_por_pedido` são índices ÚNICOS por
// pedido. Reenvio do mesmo evento (que todo gateway faz) bate no índice e
// devolve 23505, que é o banco dizendo "já creditei". Tratar isso como falha
// encheria a caixa do dono de alarme por um sistema funcionando certo.
//
// Qualquer OUTRO erro é grave e vira alerta: a pessoa pagou e não recebeu.

import type { SupabaseClient } from "@supabase/supabase-js";
import { literalLike } from "../../src/lib/sql-like.js";

export type OfertaPaga = { id: string; creditos: number };

export type ResultadoCredito = {
  creditou: boolean;
  quadro: boolean;
  /** Nasceu a linha em `videos` (o render foi pedido se a música é conhecida). */
  video: boolean;
  /** Erro que NÃO é duplicata. Quem chamou tem que alertar o dono. */
  erro: string | null;
};

/**
 * A música do vídeo, quando o pedido não diz.
 *
 * O vídeo é vendido de dentro do editor, e aí o pedido já nasce com
 * `musica_id`. Mas a rota do painel também aceita a oferta, e ali não tem
 * música. Quem tem UMA música só (a imensa maioria: 279 de 290 em 17/08) não
 * precisa escolher nada. Com duas ou mais, a linha nasce sem música e espera,
 * igual ao quadro: adivinhar entregaria o vídeo da música errada.
 */
async function unicaMusicaDoEmail(sb: SupabaseClient, email: string): Promise<string | null> {
  const { data: quizzes } = await sb.from("quiz_responses").select("id").ilike("email", literalLike(email));
  const ids = (quizzes ?? []).map((q) => q.id as string);
  if (!ids.length) return null;
  const { data: musicas } = await sb
    .from("musicas")
    .select("id")
    .in("quiz_response_id", ids)
    .eq("status", "pronta")
    .limit(2);
  return musicas && musicas.length === 1 ? (musicas[0].id as string) : null;
}

/**
 * Pede o render. Não estoura: Inngest fora do ar deixa a linha em
 * `aguardando`, e o vigia pega do banco depois. Pagamento nunca vira 500 por
 * causa disto (o gateway reenviaria e a pessoa pagaria a ansiedade de novo).
 */
async function pedirRender(videoId: string): Promise<void> {
  const chave = process.env.INNGEST_EVENT_KEY;
  if (!chave) {
    console.error("[video] INNGEST_EVENT_KEY ausente, render não pedido:", videoId);
    return;
  }
  try {
    await fetch(`https://inn.gs/e/${chave}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "video/renderizar", data: { videoId } }),
    });
  } catch (err) {
    console.error("[video] evento de render falhou:", videoId, err);
  }
}

export async function creditarUpsell(
  sb: SupabaseClient,
  args: {
    oferta: OfertaPaga;
    email: string;
    pedidoId: string | null;
    /** Vai pra `creditos.nota`, pro suporte saber de onde veio. */
    nota?: Record<string, unknown>;
  },
): Promise<ResultadoCredito> {
  const out: ResultadoCredito = { creditou: false, quadro: false, video: false, erro: null };

  if (args.oferta.creditos > 0) {
    const { error } = await sb.from("creditos").insert({
      email: args.email,
      quantidade: args.oferta.creditos,
      origem: "compra",
      pedido_id: args.pedidoId,
      nota: { oferta: args.oferta.id, ...(args.nota ?? {}) },
    });
    if (error && error.code !== "23505") out.erro = `crédito: ${error.message}`;
    else out.creditou = !error;
  }

  if (args.oferta.id === "quadro") {
    const { error } = await sb.from("quadros").insert({
      email: args.email,
      pedido_id: args.pedidoId,
    });
    if (error && error.code !== "23505") {
      out.erro = [out.erro, `quadro: ${error.message}`].filter(Boolean).join(" · ");
    } else {
      out.quadro = !error;
    }
  }

  if (args.oferta.id === "video") {
    // A música: do pedido (vendido no editor) ou a única dela (painel).
    let musicaId: string | null = null;
    if (args.pedidoId) {
      const { data: p } = await sb.from("pedidos").select("musica_id").eq("id", args.pedidoId).maybeSingle();
      musicaId = (p?.musica_id as string | null) ?? null;
    }
    if (!musicaId) musicaId = await unicaMusicaDoEmail(sb, args.email);

    const { data: novo, error } = await sb
      .from("videos")
      .insert({ email: args.email, pedido_id: args.pedidoId, musica_id: musicaId })
      .select("id")
      .maybeSingle();
    if (error && error.code !== "23505") {
      out.erro = [out.erro, `vídeo: ${error.message}`].filter(Boolean).join(" · ");
    } else {
      out.video = !error;
      // Só pede render de linha NOVA e com música. 23505 é reenvio do mesmo
      // pagamento: o render dele já foi pedido na primeira vez.
      if (novo?.id && musicaId) await pedirRender(novo.id as string);
    }
  }

  return out;
}

/**
 * O VÍDEO COMPRADO JUNTO COM A MÚSICA (order bump do checkout).
 *
 * Nasce `aguardando_fotos`, e NÃO pede render: no checkout ela ainda não subiu
 * foto nenhuma, e um vídeo feito agora sairia com o fundo da marca no lugar
 * das fotos de vocês. Quem dispara é ela, no editor ("Gerar meu vídeo"), ou o
 * `videoPendente` depois de uns dias, pra ninguém pagar e ficar sem.
 *
 * Chamado pelos DOIS webhooks de pagamento (Woovi e Asaas). Devolve o erro
 * que não é duplicata, pra quem chamou alertar o dono; `videos_um_por_pedido`
 * faz o reenvio do mesmo evento bater no 23505 e não criar dois.
 */
export async function liberarVideoDoBump(
  sb: SupabaseClient,
  args: { email: string; pedidoId: string | null; musicaId: string | null },
): Promise<string | null> {
  const { error } = await sb.from("videos").insert({
    email: args.email,
    pedido_id: args.pedidoId,
    musica_id: args.musicaId,
    status: "aguardando_fotos",
  });
  if (error && error.code !== "23505") return error.message;
  return null;
}