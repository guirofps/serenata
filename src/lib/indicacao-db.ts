import type { supabaseAdmin } from "@/lib/supabase-admin";
import { literalLike } from "@/lib/sql-like";
import { normalizarCodigo } from "@/lib/indicacao";

type Db = ReturnType<typeof supabaseAdmin>;

/**
 * O CONVITE QUE ESTA COMPRA PODE USAR, conferido no servidor.
 *
 * O código chega pela `attribution`, que o navegador escreve. Então nada dele
 * vale até passar por aqui:
 *
 *   - o código existe e é de alguém;
 *   - quem compra não é o dono do código;
 *   - quem compra nunca comprou (um pedido reembolsado também conta, senão
 *     comprar, pedir reembolso e recomprar pelo link fabricaria desconto);
 *   - é o funil em português (o espanhol cobra em dólar pela Perfect Pay,
 *     onde o preço é do produto e não nosso).
 *
 * Qualquer falha de leitura devolve `null`: sem desconto, preço cheio. É o
 * lado seguro — errar pra cá custa R$ 3,80 a um convidado, errar pro outro
 * daria desconto a quem não tem direito.
 *
 * A trigger da comissão (`20260926000000_indicacao.sql`) confere as mesmas
 * regras de novo na hora do pagamento. Não é redundância: aqui decide o
 * DESCONTO, lá decide a COMISSÃO, e entre um e outro a pessoa pode ter pago
 * outra coisa.
 */
export async function conviteDaCompra(
  db: Db,
  args: {
    attribution: unknown;
    email: string | null | undefined;
    locale: string | null | undefined;
  },
): Promise<{ codigo: string } | null> {
  if (args.locale === "es") return null;
  const codigo = normalizarCodigo((args.attribution as { ref?: unknown } | null)?.ref);
  if (!codigo) return null;
  try {
    const { data: dono, error } = await db
      .from("indicacao_codigos")
      .select("email")
      .eq("codigo", codigo)
      .maybeSingle();
    if (error || !dono?.email) return null;

    const email = String(args.email ?? "")
      .trim()
      .toLowerCase();
    if (email) {
      if (email === dono.email) return null;
      const { data: antes, error: e2 } = await db
        .from("pedidos")
        .select("id")
        .ilike("email", literalLike(email))
        .in("status", ["pago", "reembolsado"])
        .gt("valor_centavos", 0)
        .not("gateway", "in", "(credito,manual)")
        .or("dinheiro_entrou.is.null,dinheiro_entrou.eq.true")
        .limit(1);
      if (e2 || (antes ?? []).length > 0) return null;
    }
    return { codigo };
  } catch (err) {
    console.error("[indicacao] conferir convite falhou:", (err as Error).message);
    return null;
  }
}

/** Já comprou de verdade? É o que dá direito a ter um link. */
export async function jaComprou(db: Db, email: string): Promise<boolean> {
  const { data } = await db
    .from("pedidos")
    .select("id")
    .ilike("email", literalLike(email))
    .eq("status", "pago")
    .gt("valor_centavos", 0)
    .not("gateway", "in", "(credito,manual)")
    .or("dinheiro_entrou.is.null,dinheiro_entrou.eq.true")
    .limit(1);
  return (data ?? []).length > 0;
}
