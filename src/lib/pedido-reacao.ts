// QUEM RECEBE O PEDIDO DE VÍDEO DE REAÇÃO (teste `pedido_reacao`, 08/10) — a
// decisão, sem banco. O job é `inngest/functions/pedirReacao.ts`.
//
// SEM IMPORTS além do `braco-email` (que também não tem): lido pelo Inngest.
//
// A = nada (como hoje). B = um e-mail no 3º dia depois da compra pedindo o
// vídeo de quem ganhou a música, com R$ 10 na próxima em troca (cupom mandado
// À MÃO pelo suporte, nunca gerado aqui).
//
// ── POR QUE 78h A 102h, E NÃO 72h ────────────────────────────────
//
// O `guardeOLink` sai pra quem montou o presente a partir de 72h depois da
// compra, de hora em hora. Começar o pedido também nas 72h colocava os dois
// na mesma hora pra mesma pessoa. Seis horas depois ainda é o 3º dia, e a
// janela de 24h garante que todo comprador passe por várias rodadas.
import { bracoDoTeste } from "./braco-email.js";

export const PEDIDO_REACAO_MIN_H = 78;
export const PEDIDO_REACAO_MAX_H = 102;

export type PedidoParaReacao = {
  email: string | null;
  quiz_response_id: string | null;
  musica_id: string | null;
  paid_at: string | null;
};

export type ConvidadoReacao = {
  email: string;
  quizId: string;
  musicaId: string;
  nome: string;
};

export function filaPedidoReacao(args: {
  pedidos: PedidoParaReacao[];
  /** Por id de quiz: idioma e nome de quem ganhou a música. */
  quizzes: Map<string, { locale: string | null; nome: string | null }>;
  /** Músicas com `status = 'pronta'`. */
  prontas: Set<string>;
  /** Endereços bloqueados, em minúsculas. */
  bloqueados: Set<string>;
  agora: number;
  max: number;
}): ConvidadoReacao[] {
  const out: ConvidadoReacao[] = [];
  const vistos = new Set<string>();
  const de = args.agora - PEDIDO_REACAO_MAX_H * 3600000;
  const ate = args.agora - PEDIDO_REACAO_MIN_H * 3600000;
  for (const p of args.pedidos) {
    if (out.length >= args.max) break;
    const email = String(p.email ?? "").trim().toLowerCase();
    if (!email || !p.quiz_response_id || !p.musica_id) continue;
    // Uma vez por pessoa, mesmo com dois pedidos na janela.
    if (vistos.has(email)) continue;
    const pago = Date.parse(String(p.paid_at ?? ""));
    if (!Number.isFinite(pago) || pago < de || pago > ate) continue;
    const q = args.quizzes.get(p.quiz_response_id);
    if (!q) continue;
    // Português, e só o braço B. O A não recebe nada: é o "como hoje".
    if ((q.locale ?? "pt") !== "pt") continue;
    if (bracoDoTeste("pedido_reacao", p.quiz_response_id, "pt") !== "b") continue;
    if (!args.prontas.has(p.musica_id)) continue;
    if (args.bloqueados.has(email)) continue;
    vistos.add(email);
    out.push({
      email,
      quizId: p.quiz_response_id,
      musicaId: p.musica_id,
      nome: String(q.nome ?? "").trim() || "quem ganhou a música",
    });
  }
  return out;
}

/**
 * Esta mensagem do suporte é RESPOSTA ao pedido de vídeo? O assunto do pedido
 * leva "vídeo de reação" e a resposta vem com "Re:" na frente.
 *
 * Existe porque a triagem automática (`inngest/lib/suporte.ts`) classificaria
 * um comprador mandando o vídeo como "pagou e não achou a música" e
 * responderia sozinha com os links dele. Aqui o caso vai pro dono, que confere
 * o vídeo e manda o cupom de R$ 10 à mão.
 */
export function ehRespostaDeReacao(assunto: string): boolean {
  return /v[ií]deo de rea[cç][aã]o/i.test(assunto);
}
