import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDaSessao } from "@/lib/conta-sessao";
import { literalLike } from "@/lib/sql-like";
import { asaas } from "@/lib/asaas";
import { ErroGateway, type DadosCartao, type TitularCartao } from "@/lib/gateway-cartao";
import { OFERTAS, type Oferta } from "@/lib/creditos";
import { centavosComCupom, codigoAplicado, type Alvo } from "@/lib/cupom";
import { creditarUpsell } from "../../api/lib/creditar-upsell";

// O CARTÃO DOS UPSELLS: música extra, quadro e vídeo, pelo Asaas (02/10).
//
// Até 02/10 o cartão do upsell saía pro checkout da Perfect Pay, onde extra e
// quadro estavam cadastrados, e o vídeo nem tinha cartão. Decisão do dono: a
// operação brasileira é 100% Asaas, PIX ou cartão, o que a pessoa preferir.
//
// É o MESMO desenho do `criar-pix-upsell.ts`, trocando o meio de pagamento:
//
//   - quem compra prova quem é pela sessão do painel OU pelo `token_edicao`,
//     e o e-mail que recebe o crédito sai daí, nunca do formulário;
//   - o preço sai de `OFERTAS`, pelo id. O navegador escolhe QUAL, nunca QUANTO;
//   - a referência é `up:<oferta>:<uuid>`, nova por compra, e o pedido nasce
//     PENDENTE com ela antes de cobrar. Se a autorização não vier na hora, o
//     webhook do Asaas acha esse pedido pela referência e libera
//     (`pagarUpsell`), exatamente como no PIX.
//
// ── A LIBERAÇÃO É AQUI, NA HORA ──────────────────────────────────
//
// O cartão responde sim ou não na hora, e o pedido vira pago aqui. O webhook
// sai cedo quando acha o pedido pago, então se o crédito não for dado AQUI,
// não é dado nunca. Foi o defeito dos bumps no cartão até 30/09. O
// `creditarUpsell` é idempotente pelo índice único por pedido, então o
// webhook e este caminho podem chamar a mesma venda sem duplicar.

/** A mesma regra do PIX do upsell: oculta não se compra pela rota. */
function ofertaValida(id: string): Oferta | null {
  return OFERTAS.find((o) => o.id === id && !o.oculta) ?? null;
}

/** IP de quem compra, que o Asaas exige. Mesma extração do `criar-cartao.ts`. */
function ipDoPagador(): string | null {
  try {
    const bruto =
      getRequestHeader("x-forwarded-for") ??
      getRequestHeader("x-real-ip") ??
      getRequestHeader("cf-connecting-ip");
    const ip = String(bruto ?? "")
      .split(",")[0]
      ?.trim();
    if (ip) return ip;
    if (import.meta.env?.DEV) return "127.0.0.1";
    return null;
  } catch {
    return null;
  }
}

export type ResultadoCartaoUpsell =
  | { ok: true; pago: boolean }
  | { ok: false; erro: "sem-sessao" | "oferta-invalida" | "sem-ip" | "gateway" }
  | { ok: false; erro: "recusado"; motivo: string };

/**
 * Janela contra o duplo-clique. O cartão não tem "devolve o mesmo QR": uma
 * segunda chamada é uma segunda cobrança. A tela trava o botão, e isto é a
 * trava do lado de cá: mesma pessoa, mesma oferta (e mesma música, no vídeo),
 * paga há menos de 2 minutos = já foi.
 */
const JANELA_DUPLO_MS = 2 * 60_000;

async function cobrar(
  email: string,
  args: { ofertaId: string; cartao: DadosCartao; titular: TitularCartao; musicaId?: string | null; cupom?: string },
): Promise<ResultadoCartaoUpsell> {
  const oferta = ofertaValida(args.ofertaId);
  if (!oferta) return { ok: false, erro: "oferta-invalida" };
  // Só o vídeo é de UMA música (ver `gerarCobranca` no PIX do upsell).
  const musicaDoPedido = oferta.id === "video" ? (args.musicaId ?? null) : null;
  // O cupom (campanha MUSICA10, 07/10): só o código vem do navegador.
  const catalogo = Math.round(oferta.precoBrl * 100);
  const agora = new Date();
  const valorCentavos = centavosComCupom(catalogo, args.cupom, agora, oferta.id as Alvo);
  const cupomAplicado = codigoAplicado(catalogo, args.cupom, agora, oferta.id as Alvo);
  const db = supabaseAdmin();

  const ip = ipDoPagador();
  if (!ip) return { ok: false, erro: "sem-ip" };

  let recente = db
    .from("pedidos")
    .select("id")
    .eq("gateway", "asaas")
    .eq("status", "pago")
    .ilike("email", literalLike(email))
    .like("payment_id", `asaas:up:${oferta.id}:%`)
    .gte("paid_at", new Date(Date.now() - JANELA_DUPLO_MS).toISOString());
  if (musicaDoPedido) recente = recente.eq("musica_id", musicaDoPedido);
  const { data: jaPago } = await recente.limit(1).maybeSingle();
  if (jaPago) return { ok: true, pago: true };

  const referencia = `up:${oferta.id}:${crypto.randomUUID()}`;
  const paymentId = `asaas:${referencia}`;

  // O PEDIDO ANTES DA COBRANÇA. Se a resposta do Asaas se perder no caminho,
  // o webhook ainda acha a quem creditar, pela referência.
  const { data: pedido, error: erroPendente } = await db
    .from("pedidos")
    .insert({
      payment_id: paymentId,
      gateway: "asaas",
      status: "pendente",
      email,
      valor_centavos: valorCentavos,
      titular_pix: args.titular.nome,
      ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
      ...(musicaDoPedido ? { musica_id: musicaDoPedido } : {}),
    })
    .select("id")
    .maybeSingle();
  if (erroPendente || !pedido?.id) {
    // Sem o pedido, um pagamento sem resposta ficaria sem dono. Não cobra.
    console.error("[cartao-upsell] pedido pendente não gravou:", erroPendente?.message);
    return { ok: false, erro: "gateway" };
  }

  let r;
  try {
    r = await asaas.cobrar({
      valorCentavos,
      descricao: `Serenata · ${
        oferta.id === "quadro" ? "Quadro para imprimir" : oferta.id === "video" ? "Vídeo da música" : "Música extra"
      }`,
      referencia,
      cartao: args.cartao,
      titular: args.titular,
      ipDoPagador: ip,
    });
  } catch (err) {
    // NUNCA repete o corpo: ele carrega o número do cartão.
    console.error("[cartao-upsell] asaas falhou:", err instanceof ErroGateway ? err.message : "erro desconhecido");
    return { ok: false, erro: "gateway" };
  }

  if (!r.ok) {
    await db
      .from("pedidos")
      .update({ status: "cancelado", status_gateway: r.statusCru })
      .eq("id", pedido.id)
      .eq("status", "pendente");
    return { ok: false, erro: "recusado", motivo: r.motivo };
  }

  if (!r.confirmado) {
    // Em análise: o webhook libera quando o Asaas confirmar.
    await db.from("pedidos").update({ status_gateway: r.statusCru }).eq("id", pedido.id);
    return { ok: true, pago: false };
  }

  const { error: erroPago } = await db
    .from("pedidos")
    .update({ status: "pago", status_gateway: r.statusCru, paid_at: new Date().toISOString() })
    .eq("id", pedido.id)
    .eq("status", "pendente");
  if (erroPago) console.error("[cartao-upsell] pago e pedido NÃO gravado:", erroPago.message, r.idExterno);

  const c = await creditarUpsell(db, {
    oferta,
    email,
    pedidoId: pedido.id as string,
    nota: { gateway: "asaas", meio: "cartao", referencia, cobranca: r.idExterno },
  });
  if (c.erro) console.error("[cartao-upsell] pago e NÃO liberado:", c.erro, referencia);

  return { ok: true, pago: true };
}

type Entrada = { ofertaId: string; cartao: DadosCartao; titular: TitularCartao; cupom?: string };

/** PORTA 1: logado no painel. O e-mail sai da sessão, nunca do formulário. */
export const cobrarCartaoUpsell = createServerFn({ method: "POST" })
  .validator((data: Entrada & { token: string }) => data)
  .handler(async ({ data }): Promise<ResultadoCartaoUpsell> => {
    const email = await emailDaSessao(data.token);
    if (!email) return { ok: false, erro: "sem-sessao" };
    return cobrar(email, data);
  });

/** PORTA 2: pelo link do editor. O e-mail sai do quiz da música do token. */
export const cobrarCartaoUpsellPorToken = createServerFn({ method: "POST" })
  .validator((data: Entrada & { tokenEdicao: string }) => data)
  .handler(async ({ data }): Promise<ResultadoCartaoUpsell> => {
    if (!data.tokenEdicao) return { ok: false, erro: "sem-sessao" };
    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select("id, quiz_response_id")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.quiz_response_id) return { ok: false, erro: "sem-sessao" };
    const { data: q } = await db.from("quiz_responses").select("email").eq("id", m.quiz_response_id).maybeSingle();
    const email = (q?.email as string | null)?.trim().toLowerCase();
    if (!email) return { ok: false, erro: "sem-sessao" };
    return cobrar(email, { ...data, musicaId: m.id as string });
  });
