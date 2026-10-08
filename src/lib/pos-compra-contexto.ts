import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// O CONTEXTO DA COMPRA, pros dois testes do pós-compra de 08/10.
//
//   `video_fotos_ja`    precisa da OCASIÃO (e da relação) do quiz, pra frase
//                       do bloco do vídeo.
//   `outra_musica_24h`  precisa da HORA DO PAGAMENTO, pro prazo do cartão, e
//                       do E-MAIL de quem pagou, pra já chegar preenchido no
//                       quiz da música nova.
//
// SÓ LEITURA, e só pelo `token_edicao`, que é a credencial do editor (o mesmo
// link do e-mail de entrega). O e-mail sai de `pedidos` PAGO, nunca de algo
// que o navegador mandou: é a mesma regra de `dono-por-token.ts`.
//
// Só é chamado no braço B (ver `useContextoPosCompra`): o braço A não ganha
// nem uma consulta a mais, e continua exatamente como era.

export type ContextoPosCompra = {
  ocasiao: string | null;
  relacao: string | null;
  /** `paid_at` do PRIMEIRO pedido pago desta música: a compra da música. */
  pagoEm: string | null;
  /** O e-mail desse pedido. */
  email: string | null;
};

const VAZIO: ContextoPosCompra = { ocasiao: null, relacao: null, pagoEm: null, email: null };

export const contextoPosCompra = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<ContextoPosCompra> => {
    const tk = String(data.tokenEdicao ?? "").trim();
    // Comprimento de token de verdade (a mesma trava de `donoPorTokenEdicao`).
    if (tk.length < 16 || tk.length > 128) return VAZIO;

    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select("id, quiz_response_id")
      .eq("token_edicao", tk)
      .maybeSingle();
    if (!m?.id) return VAZIO;

    const quizId = (m.quiz_response_id as string | null) ?? null;
    // O PRIMEIRO pago é a música; extra, quadro e vídeo vêm depois e não podem
    // virar a hora da compra (mesma ordem de `sessaoJaPagou`).
    const [{ data: q }, { data: p }] = await Promise.all([
      quizId
        ? db.from("quiz_responses").select("respostas").eq("id", quizId).maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from("pedidos")
        .select("paid_at, email")
        .eq(quizId ? "quiz_response_id" : "musica_id", quizId ?? m.id)
        .eq("status", "pago")
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const r = ((q as { respostas?: unknown } | null)?.respostas ?? {}) as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : null);
    const pedido = p as { paid_at?: string | null; email?: string | null } | null;
    return {
      ocasiao: texto(r.ocasiao),
      relacao: texto(r.relacao),
      pagoEm: pedido?.paid_at ?? null,
      email: pedido?.email?.trim().toLowerCase() || null,
    };
  });

// Os dois testes podem estar no B ao mesmo tempo no editor: uma consulta só
// por token, dividida entre os dois componentes.
const cache = new Map<string, Promise<ContextoPosCompra>>();

export function lerContextoPosCompra(tokenEdicao: string): Promise<ContextoPosCompra> {
  let p = cache.get(tokenEdicao);
  if (!p) {
    p = contextoPosCompra({ data: { tokenEdicao } }).catch(() => {
      // Falhou: não guarda a falha, a próxima montagem tenta de novo.
      cache.delete(tokenEdicao);
      return VAZIO;
    });
    cache.set(tokenEdicao, p);
  }
  return p;
}
