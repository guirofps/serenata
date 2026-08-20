import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";
import { literalLike } from "@/lib/sql-like";

// O SALDO DA CONTA, pro painel mostrar.
//
// Server function porque `creditos` não é legível pelo cliente (e não deve
// ser: expõe quem comprou o quê). O saldo sai de `saldo_creditos`, que soma o
// razão em vez de ler um número guardado.

export type MeusCreditos = {
  saldo: number;
  /** Comprou o quadro? Libera a folha A4 pra imprimir. */
  temQuadro: boolean;
  /** O histórico, pro suporte e pra pessoa entender o próprio saldo. */
  extrato: Array<{ quando: string; quantidade: number; origem: string; rotulo: string }>;
};

const ROTULO: Record<string, string> = {
  compra: "Você comprou",
  uso: "Música criada",
  cortesia: "Presente da Serenata",
  estorno: "Estorno",
};

export const meusCreditos = createServerFn({ method: "POST" })
  // O TOKEN, não o e-mail. Server function é rota HTTP: aceitar o e-mail como
  // parâmetro deixaria qualquer um ler saldo e histórico de compra de qualquer
  // pessoa. Quem manda é a sessão assinada pelo Supabase.
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<MeusCreditos> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { saldo: 0, temQuadro: false, extrato: [] };

    const db = supabaseAdmin();
    const [{ data: saldo }, { data: linhas }] = await Promise.all([
      db.rpc("saldo_creditos", { p_email: email }),
      db
        .from("creditos")
        .select("quantidade, origem, nota, created_at")
        .ilike("email", literalLike(email))
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    // O QUADRO NÃO É CRÉDITO: ele não entra no saldo (quantidade 0 nem seria
    // aceita pelo check da tabela). A compra dele aparece no razão como uma
    // linha de crédito 0? Não: ela não é gravada em `creditos` de jeito
    // nenhum. O que marca é o PEDIDO do produto do quadro.
    const { data: pedidosQuadro } = await db
      .from("pedidos")
      .select("id")
      .ilike("email", literalLike(email))
      .eq("status", "pago")
      // 24,90 é o preço do quadro. Quando o webhook passar a gravar o produto
      // na linha do pedido, isto vira uma comparação por código.
      .eq("valor_centavos", 2490)
      .limit(1);

    return {
      saldo: typeof saldo === "number" ? saldo : 0,
      temQuadro: (pedidosQuadro ?? []).length > 0,
      extrato: (linhas ?? []).map((l) => ({
        quando: l.created_at,
        quantidade: l.quantidade,
        origem: l.origem,
        rotulo: ROTULO[l.origem] ?? l.origem,
      })),
    };
  });
