import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";
import { donoPorTokenEdicao } from "@/lib/dono-por-token";
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
  // NUNCA O E-MAIL COMO PARÂMETRO. Server function é rota HTTP: aceitar o
  // e-mail deixaria qualquer um ler saldo e histórico de compra de qualquer
  // pessoa. As duas credenciais aceitas provam posse — a sessão assinada pelo
  // Supabase, ou o `token_edicao` de uma música que a pessoa comprou.
  //
  // A segunda entrou em 02/09, quando o pacote de R$ 28 passou a ser vendido
  // na `/obrigado` e no e-mail de entrega, ou seja, PRA QUEM NÃO TEM LOGIN.
  // Sem ela o comprador pagava o crédito e, no fim do quiz seguinte, a tela
  // não via saldo nenhum e pedia os R$ 38 de novo.
  .validator((data: { token?: string; tokenEdicao?: string }) => data)
  .handler(async ({ data }): Promise<MeusCreditos> => {
    const vazio = { saldo: 0, temQuadro: false, extrato: [] };
    const db = supabaseAdmin();
    const email =
      (data.token ? await emailDaSessao(data.token) : null) ??
      (await donoPorTokenEdicao(db, data.tokenEdicao))?.email ??
      null;
    if (!email) return vazio;
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
