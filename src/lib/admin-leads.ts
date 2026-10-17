// A LEITURA DA BASE DE LEADS PRO BOTÃO "BAIXAR" (aba E-mail do painel).
//
// Em PEDAÇOS, chamados em sequência pelo navegador: a base inteira passa de
// 100 mil quizzes, e numa resposta só estouraria o teto de 4,5 MB da Vercel
// (e o tempo da função). Cada chamada lê até 10 páginas por cursor
// `(created_at, id)`, nunca por OFFSET (`ler-janela.ts`).
//
// A lista de bloqueio FALHA FECHADA: se não der pra ler descadastro ou bounce,
// a função lança e nenhum arquivo sai. Arquivo sem o descadastro aplicado
// mandaria campanha pra quem pediu pra sair.
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { filtroCursor, PAGINA, type Cursor } from "@/lib/ler-janela";
import type { LinhaQuiz } from "@/lib/exportar-leads";

const PAGINAS_POR_CHAMADA = 10;

// O cursor volta do navegador e entra no filtro do PostgREST: só passa com a
// forma exata de um timestamp e de um uuid.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const lerLeadsPagina = createServerFn({ method: "POST" })
  .validator((data: { cursor: Cursor | null }) => {
    const c = data?.cursor;
    if (c && (!TIMESTAMP.test(String(c.created_at)) || !UUID.test(String(c.id)))) {
      throw new Error("cursor inválido");
    }
    return { cursor: c ? { created_at: c.created_at, id: c.id } : null };
  })
  .handler(async ({ data }): Promise<{ linhas: LinhaQuiz[]; cursor: Cursor | null }> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const db = supabaseAdmin();
    const linhas: LinhaQuiz[] = [];
    let cursor = data.cursor;
    for (let i = 0; i < PAGINAS_POR_CHAMADA; i++) {
      let consulta = db
        .from("quiz_responses")
        .select("id, email, whatsapp, locale, created_at")
        .not("email", "is", null)
        .order("created_at")
        .order("id")
        .limit(PAGINA);
      if (cursor) consulta = consulta.or(filtroCursor(cursor));
      const { data: lote, error } = await consulta;
      if (error) throw new Error(`leitura dos leads falhou: ${error.message}`);
      const l = (lote ?? []) as LinhaQuiz[];
      linhas.push(...l);
      if (l.length < PAGINA) return { linhas, cursor: null };
      const ultima = l[l.length - 1];
      cursor = { created_at: ultima.created_at, id: ultima.id };
    }
    return { linhas, cursor };
  });

type Resposta = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Uma tabela inteira por cursor na chave (`email` ou `id`), 1.000 por vez. */
async function lerTudo<T extends Record<string, unknown>>(
  pagina: (depois: string | null) => Resposta,
  chave: keyof T & string,
): Promise<T[]> {
  const tudo: T[] = [];
  let depois: string | null = null;
  for (;;) {
    const { data, error } = await pagina(depois);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as T[];
    tudo.push(...lote);
    if (lote.length < PAGINA) return tudo;
    depois = String(lote[lote.length - 1][chave]);
  }
}

type Email = { email: string };

export const listasDosLeads = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ compradoresEmail: string[]; compradoresQuiz: string[]; bloqueados: string[] }> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const db = supabaseAdmin();
    const porEmail = (tabela: "descadastros" | "emails_mortos" | "excluidos_email") => (depois: string | null) => {
      let q = db.from(tabela).select("email").order("email").limit(PAGINA);
      // Mesma regra de `bloqueados()` (inngest/lib/emails-mortos.ts): o liberado volta a valer.
      if (tabela === "emails_mortos") q = q.is("liberado_em", null);
      return depois === null ? q : q.gt("email", depois);
    };
    try {
      const [pedidos, descadastros, mortos, excluidos] = await Promise.all([
        lerTudo<{ id: string; email: string | null; quiz_response_id: string | null }>((depois) => {
          const q = db.from("pedidos").select("id, email, quiz_response_id").eq("status", "pago").order("id").limit(PAGINA);
          return depois === null ? q : q.gt("id", depois);
        }, "id"),
        lerTudo<Email>(porEmail("descadastros"), "email"),
        lerTudo<Email>(porEmail("emails_mortos"), "email"),
        lerTudo<Email>(porEmail("excluidos_email"), "email"),
      ]);
      const min = (e: string | null) => String(e ?? "").trim().toLowerCase();
      return {
        compradoresEmail: [...new Set(pedidos.map((p) => min(p.email)).filter(Boolean))],
        compradoresQuiz: [...new Set(pedidos.map((p) => p.quiz_response_id).filter((x): x is string => !!x))],
        bloqueados: [...new Set([...descadastros, ...mortos, ...excluidos].map((l) => min(l.email)).filter(Boolean))],
      };
    } catch (e) {
      throw new Error(`lista de bloqueio ilegível, nenhum arquivo sai: ${e instanceof Error ? e.message : e}`);
    }
  },
);
