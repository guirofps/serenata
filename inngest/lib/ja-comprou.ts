// ESTA PESSOA JÁ COMPROU? A pergunta que toda régua de "você não comprou" faz
// no instante do envio.
//
// ── POR CANDIDATO, NÃO A TABELA INTEIRA (08/10) ──────────────────
//
// O `mandarLetra` conferia "comprou entre a fila e o envio" lendo TODOS os
// pedidos pagos numa consulta só, e o PostgREST devolve no máximo 1.000
// linhas: com ~9.300 pagos, a trava via um em cada nove compradores. Medido
// na auditoria de 08/10: de 1 a 13 por dia de "a sua letra está pronta" (e
// `quase_comprou`, `pix_nao_pago`) chegando pra quem já tinha pago, 8 só em
// 07/10. Paginar resolveria o corte e continuaria carregando 10 páginas por
// rodada pra usar 10 nomes; a pergunta por pessoa custa duas consultas por
// índice e não cresce com a tabela.
//
// ── NA DÚVIDA, COMPROU ───────────────────────────────────────────
//
// Erro de banco devolve `true`: o e-mail de quem não comprou fica pra próxima
// rodada. Mandar "volta e compra" pra quem pagou é o erro que esta pergunta
// existe pra impedir, e é o que vira ticket de suporte.
import type { SupabaseClient } from "@supabase/supabase-js";
import { literalLike } from "../../src/lib/sql-like.js";

export async function jaComprou(sb: SupabaseClient, quizId: string, email: string): Promise<boolean> {
  const alvo = email.trim().toLowerCase();
  try {
    const [porQuiz, porEmail] = await Promise.all([
      sb.from("pedidos").select("id").eq("quiz_response_id", quizId).eq("status", "pago").limit(1),
      // Por E-MAIL também: a compra pode ter sido feita noutro quiz. `ilike`
      // com `literalLike` (os `%` e `_` de um endereço viram literais) pra
      // pegar o pedido gravado com maiúscula, e a igualdade conferida em JS.
      alvo
        ? sb.from("pedidos").select("email").ilike("email", literalLike(alvo)).eq("status", "pago").limit(5)
        : Promise.resolve({ data: [] as Array<{ email: string | null }>, error: null }),
    ]);
    if (porQuiz.error || porEmail.error) {
      console.error(
        "[ja-comprou] consulta falhou, tratando como comprador:",
        quizId,
        porQuiz.error?.message ?? porEmail.error?.message,
      );
      return true;
    }
    if ((porQuiz.data ?? []).length > 0) return true;
    return ((porEmail.data ?? []) as Array<{ email: string | null }>).some(
      (p) => String(p.email ?? "").trim().toLowerCase() === alvo,
    );
  } catch (err) {
    console.error("[ja-comprou] consulta falhou, tratando como comprador:", quizId, err);
    return true;
  }
}
