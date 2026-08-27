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

export type OfertaPaga = { id: string; creditos: number };

export type ResultadoCredito = {
  creditou: boolean;
  quadro: boolean;
  /** Erro que NÃO é duplicata. Quem chamou tem que alertar o dono. */
  erro: string | null;
};

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
  const out: ResultadoCredito = { creditou: false, quadro: false, erro: null };

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

  return out;
}
