import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";

// O PRESENTE, na própria tela de obrigado.
//
// Até agora a /obrigado mandava a pessoa procurar o e-mail. Medido em 03/08:
// de 6 compras, 3 nunca montaram o presente, e uma delas pediu 11 links de
// acesso sem conseguir entrar. Depender de e-mail no momento de maior
// intenção da vida do cliente é jogar fora o melhor instante que existe.
//
// O redirect da Perfect Pay traz `?code=` (o id da transação). Com ele dá pra
// achar o pedido e devolver o `token_edicao` — o mesmo que vai no e-mail.
//
// SEGURANÇA. O `token_edicao` autoriza editar a página, então não pode sair
// por um palpite. Duas travas:
//   1. Só responde pedido com status `pago`.
//   2. Só responde se o pagamento for RECENTE (2h). É o que mata força bruta:
//      não basta acertar um código, tem que acertar um código pago nas
//      últimas duas horas, e a operação faz ~1 venda por dia.
// Fora dessa janela a pessoa usa o e-mail ou o login, que é o caminho normal.

const JANELA_MS = 2 * 60 * 60 * 1000;

export type PresenteDaCompra = {
  tokenEdicao: string;
  token: string;
  titulo: string | null;
  nome: string | null;
  /** `true` enquanto a música ainda está gravando. */
  gerando: boolean;
};

export const buscarPresenteDaCompra = createServerFn({ method: "GET" })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }): Promise<PresenteDaCompra | null> => {
    const code = String(data.code ?? "").trim();
    if (!code || code.length < 8 || code.length > 64) return null;

    const db = supabaseAdmin();
    const { data: pedido } = await db
      .from("pedidos")
      .select("status, musica_id, quiz_response_id, paid_at")
      .eq("payment_id", code)
      .maybeSingle();

    if (!pedido || pedido.status !== "pago" || !pedido.musica_id) return null;

    const pagoEm = pedido.paid_at ? Date.parse(pedido.paid_at) : 0;
    if (!pagoEm || Date.now() - pagoEm > JANELA_MS) return null;

    const { data: m } = await db
      .from("musicas")
      .select("token, token_edicao, titulo, status")
      .eq("id", pedido.musica_id)
      .maybeSingle();
    if (!m?.token_edicao) return null;

    const { data: q } = pedido.quiz_response_id
      ? await db.from("quiz_responses").select("respostas").eq("id", pedido.quiz_response_id).maybeSingle()
      : { data: null };

    return {
      tokenEdicao: m.token_edicao,
      token: m.token,
      titulo: m.titulo ?? null,
      nome: ((q?.respostas ?? {}) as Record<string, string>).nome ?? null,
      gerando: m.status !== "pronta",
    };
  });
