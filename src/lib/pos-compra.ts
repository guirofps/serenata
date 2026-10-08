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
//
// A REFERÊNCIA DO CHECKOUT TRANSPARENTE (08/10). PIX e cartão do Asaas não têm
// redirect de gateway: a folha guarda a referência no `sessionStorage` (`mp_tx`,
// `guardarTransacao`) e manda pra `/obrigado` sem `?code=`. Quem pagava pela
// `/pix/<ref>` ou pela `/oferta/<token>` (link do e-mail, quase sempre aberto em
// OUTRO navegador, o do app de e-mail) chegava numa aba sem a sessão do funil:
// `sessaoJaPagou` não achava nada, a tela ficava em "procure o e-mail" e a
// conversão nunca saía. A referência resolve igual ao `code`, com as mesmas
// duas travas (pago + janela de 2h).

const JANELA_MS = 2 * 60 * 60 * 1000;

export type PresenteDaCompra = {
  tokenEdicao: string;
  token: string;
  titulo: string | null;
  nome: string | null;
  /** `true` enquanto a música ainda está gravando. */
  gerando: boolean;
  /** O que foi COBRADO (`pedidos.valor_centavos`), pro valor da conversão. */
  valorCentavos: number | null;
  /** Em que gateway: decide se `valorCentavos` está na moeda da conversão. */
  gateway: string | null;
};

/** Os `payment_id` possíveis de uma referência do transparente. */
export function idsDaReferencia(referencia: string): string[] {
  const r = referencia.trim();
  return [`asaas:${r}`, `woovi:${r}`];
}

export const buscarPresenteDaCompra = createServerFn({ method: "GET" })
  .validator((data: { code?: string; referencia?: string }) => data)
  .handler(async ({ data }): Promise<PresenteDaCompra | null> => {
    const code = String(data.code ?? "").trim();
    const referencia = String(data.referencia ?? "").trim();
    // A referência do transparente é `serenata:<uuid>[:q][:i][:d][:r2]` (~60)
    // ou o id do Asaas (`pay_...`). Upsell (`up:`) não passa por aqui.
    const porCode = code.length >= 8 && code.length <= 64;
    const porReferencia = !porCode && referencia.length >= 8 && referencia.length <= 128;
    if (!porCode && !porReferencia) return null;

    const db = supabaseAdmin();
    const colunas = "status, musica_id, quiz_response_id, paid_at, valor_centavos, gateway";
    const { data: pedido } = porCode
      ? await db.from("pedidos").select(colunas).eq("payment_id", code).maybeSingle()
      : await db
          .from("pedidos")
          .select(colunas)
          .in("payment_id", idsDaReferencia(referencia))
          .eq("status", "pago")
          .limit(1)
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
      valorCentavos: (pedido.valor_centavos as number | null) ?? null,
      gateway: (pedido.gateway as string | null) ?? null,
    };
  });
