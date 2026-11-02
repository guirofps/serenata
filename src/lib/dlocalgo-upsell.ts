import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MARCA_ATIVA } from "@/lib/marca-identidade";
import { OFERTAS } from "@/lib/creditos";
import { marcarSeVeioDeEmail } from "@/lib/toque-email.server";
import { mercadoDoPais, usdDe, valorNaMoeda } from "@/lib/mercados";
import { paisDaRequisicao } from "@/lib/pais-requisicao.server";
import { marcarMoedaDoPedido } from "@/lib/pais-quiz";
import { urlDoSite } from "@/lib/stripe-checkout";
import { fichaServeAoVoltar, tipoPagamentoDlocal } from "@/lib/spei-destaque";
import { bracoUpsellDlocal, orderIdUpsellDlocal, paisVendeUpsellDlocal, type OfertaDlocal } from "@/lib/upsell-dlocal";
import { confirmarPagamentoDlocal, dlocalApi, dlocalConfigurado, ErroDlocal, lerPagamentoDlocal } from "../../api/lib/dlocalgo";

// VÍDEO E MÚSICA EXTRA PELA dLOCAL (teste `upsell_dlocal`, 01/11). A regra e o
// porquê moram em `upsell-dlocal.ts`.
//
// As mesmas travas do `criarCheckoutVideoStripe`: o preço sai do catálogo, a
// música vem do TOKEN de edição, só se vende upsell de música JÁ PAGA, e o
// pedido nasce pendente ANTES do pagamento. E as da música na dLocal: o país é o
// do cabeçalho desta requisição, e reabrir a folha não cria outra ficha.
//
// Pedido SEM `quiz_response_id`, como o upsell do Stripe e do PIX: é assim que
// `confirmarPagamentoDlocal` sabe que não é a música, e as consultas de "quiz
// pago" não confundem com uma segunda compra. A extra também não leva `musica_id`.

/** A ficha vale 3 dias, como a da música (`dlocalgo-checkout.ts`). */
const VALIDADE_DIAS = 3;

export type ResultadoUpsellDlocal =
  | { ok: true; url: string; pagamentoId: string }
  | { ok: false; erro: "indisponivel" | "sem-musica" | "nao-pago" | "ja-tem" | "falhou" };

export const criarUpsellDlocal = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; oferta?: OfertaDlocal }) => ({
    tokenEdicao: String(data?.tokenEdicao ?? "").slice(0, 100),
    oferta: (data?.oferta === "extra" ? "extra" : "video") as OfertaDlocal,
  }))
  .handler(async ({ data }): Promise<ResultadoUpsellDlocal> => {
    const extra = data.oferta === "extra";
    const oferta = OFERTAS.find((o) => o.id === data.oferta);
    if (MARCA_ATIVA.chave !== "ballad" || !dlocalConfigurado() || !oferta?.precoUsd) {
      return { ok: false, erro: "indisponivel" };
    }
    // O braço e o país conferidos aqui também: a tela só desenha o botão.
    const pais = paisDaRequisicao();
    if (!paisVendeUpsellDlocal(pais) || bracoUpsellDlocal(data.tokenEdicao) !== "B") {
      return { ok: false, erro: "indisponivel" };
    }
    const mercado = mercadoDoPais(pais);
    if (!data.tokenEdicao) return { ok: false, erro: "sem-musica" };
    const db = supabaseAdmin();

    const { data: m } = await db
      .from("musicas")
      .select("id, titulo, quiz_response_id")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.id || !m.quiz_response_id) return { ok: false, erro: "sem-musica" };

    const { data: pago } = await db
      .from("pedidos")
      .select("id")
      .eq("status", "pago")
      .or(`quiz_response_id.eq.${m.quiz_response_id},musica_id.eq.${m.id}`)
      .limit(1);
    if (!pago?.length) return { ok: false, erro: "nao-pago" };

    if (!extra) {
      const { data: jaTem } = await db.from("videos").select("id").eq("musica_id", m.id).limit(1);
      if (jaTem?.length) return { ok: false, erro: "ja-tem" };
    }

    const { data: q } = await db.from("quiz_responses").select("email").eq("id", m.quiz_response_id).maybeSingle();
    const email = String(q?.email ?? "").trim().toLowerCase();
    // O vídeo e o crédito saem pelo e-mail: sem ele, não há a quem entregar.
    if (!email) return { ok: false, erro: "indisponivel" };

    const centavos = Math.round(oferta.precoUsd * 100);
    const valorLocal = valorNaMoeda(mercado, centavos);
    const valorDoPedido = usdDe(mercado, valorLocal);

    // REABRIR NÃO CRIA OUTRA FICHA. Vídeo: a pendente desta música. Extra: a
    // pendente deste e-mail (ela não tem música). Sem folga de validade, ou
    // recusada lá, nasce outra; sem resposta da dLocal, volta a de sempre.
    let abertas = db
      .from("pedidos")
      .select("payment_id, pix_url, created_at")
      .eq("gateway", "dlocalgo")
      .eq("status", "pendente")
      .is("quiz_response_id", null)
      .eq("valor_centavos", valorDoPedido)
      .gt("pix_expira", new Date(Date.now() + 6 * 3600e3).toISOString());
    abertas = extra ? abertas.is("musica_id", null).eq("email", email) : abertas.eq("musica_id", m.id);
    const { data: aberta } = await abertas.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (aberta?.pix_url) {
      const pagamentoId = String(aberta.payment_id).slice("dlocalgo:".length);
      let status = "PENDING";
      let tipo: string | null | undefined;
      try {
        const lido = await lerPagamentoDlocal(pagamentoId);
        status = lido.status;
        tipo = lido.payment_method_type;
      } catch (err) {
        console.error("[dlocal-upsell] ler aberto falhou:", err instanceof ErroDlocal ? err.status : err);
      }
      const idadeMs = Date.now() - new Date(String(aberta.created_at)).getTime();
      if (status === "PENDING" && fichaServeAoVoltar(mercado.pais, undefined, tipo, idadeMs)) {
        return { ok: true, url: aberta.pix_url, pagamentoId };
      }
      // Pagou e o aviso ainda não chegou: confirma agora, e o vídeo não é cobrado de novo.
      if (status === "PAID") {
        await confirmarPagamentoDlocal(db, pagamentoId).catch((err) => console.error("[dlocal-upsell] confirmar falhou:", err));
        if (!extra) return { ok: false, erro: "ja-tem" };
      } else {
        await db.from("pedidos").update({ status: "cancelado" }).eq("payment_id", aberta.payment_id).eq("status", "pendente");
      }
    }

    const volta = `${urlDoSite()}/es/pago-upsell`;
    try {
      const p = await dlocalApi<{ id: string; redirect_url: string }>("POST", "/payments", {
        currency: mercado.moeda.toUpperCase(),
        // A dLocal quer unidade MAIOR; as casas vêm do mercado (peso chileno não tem centavo).
        amount: valorLocal / 10 ** mercado.decimais,
        country: mercado.pais,
        order_id: orderIdUpsellDlocal(data.oferta, m.id),
        description: extra ? "Otra canción personalizada" : (m.titulo ? `Video regalo: ${m.titulo}` : "Tu video regalo").slice(0, 100),
        // Só o e-mail: o documento, nos países que pedem, a página deles pede.
        payer: { email },
        payment_type: tipoPagamentoDlocal(mercado.pais, undefined),
        expiration_type: "DAYS",
        expiration_value: VALIDADE_DIAS,
        success_url: volta,
        back_url: volta,
        notification_url: `${urlDoSite()}/api/webhook/dlocalgo`,
      });
      if (!p?.id || !p.redirect_url?.startsWith("https://")) throw new ErroDlocal("resposta sem id/url", 502);

      const { error } = await db.from("pedidos").insert({
        payment_id: `dlocalgo:${p.id}`,
        gateway: "dlocalgo",
        status: "pendente",
        email,
        valor_centavos: valorDoPedido,
        // Sem quiz (ver o topo). O vídeo sabe a música; a extra não tem.
        musica_id: extra ? null : m.id,
        pix_url: p.redirect_url,
        pix_expira: new Date(Date.now() + VALIDADE_DIAS * 86400e3).toISOString(),
      });
      if (error) throw new Error(error.message);
      await marcarSeVeioDeEmail(db, `dlocalgo:${p.id}`);
      await marcarMoedaDoPedido(db, `dlocalgo:${p.id}`, { moeda: mercado.moeda, valorMoeda: valorLocal, pais });
      await db.from("funnel_events").insert({
        event_name: extra ? "dlocal_extra_criado" : "dlocal_video_criado",
        session_id: "sistema",
        event_data: { pagamento: p.id, musica_id: m.id, valor_centavos: valorDoPedido, moeda: mercado.moeda, valor_na_moeda: valorLocal },
      });
      return { ok: true, url: p.redirect_url, pagamentoId: p.id };
    } catch (err) {
      console.error("[dlocal-upsell] criar falhou:", err instanceof ErroDlocal ? `${err.status} ${err.message}` : err);
      return { ok: false, erro: "falhou" };
    }
  });

export type EstadoUpsellDlocal = { estado: "pago" | "pendente" | "nenhum"; url?: string };

/**
 * A página de volta pergunta: esse pagamento entrou? Pelo TOKEN de edição, que é
 * a prova de posse, e quem responde é a API da dLocal. A trava no banco impede
 * duas liberações, e o aviso deles libera do mesmo jeito se ela fechar a aba.
 */
export const confirmarUpsellDlocal = createServerFn({ method: "POST" })
  .validator((data: { tokenEdicao: string; oferta?: OfertaDlocal }) => ({
    tokenEdicao: String(data?.tokenEdicao ?? "").slice(0, 100),
    oferta: (data?.oferta === "extra" ? "extra" : "video") as OfertaDlocal,
  }))
  .handler(async ({ data }): Promise<EstadoUpsellDlocal> => {
    if (MARCA_ATIVA.chave !== "ballad" || !dlocalConfigurado() || !data.tokenEdicao) return { estado: "nenhum" };
    const db = supabaseAdmin();
    const { data: m } = await db
      .from("musicas")
      .select("id, quiz_response_id")
      .eq("token_edicao", data.tokenEdicao)
      .maybeSingle();
    if (!m?.id) return { estado: "nenhum" };

    let consulta = db.from("pedidos").select("payment_id, status, pix_url").eq("gateway", "dlocalgo").is("quiz_response_id", null);
    if (data.oferta === "video") {
      consulta = consulta.eq("musica_id", m.id);
    } else {
      const { data: q } = await db.from("quiz_responses").select("email").eq("id", m.quiz_response_id).maybeSingle();
      const email = String(q?.email ?? "").trim().toLowerCase();
      if (!email) return { estado: "nenhum" };
      consulta = consulta.is("musica_id", null).eq("email", email);
    }
    const { data: pedido } = await consulta.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!pedido) return { estado: "nenhum" };
    if (pedido.status === "pago") return { estado: "pago" };
    if (pedido.status !== "pendente") return { estado: "nenhum" };
    try {
      const r = await confirmarPagamentoDlocal(db, String(pedido.payment_id).slice("dlocalgo:".length));
      if (r.ok) return { estado: "pago" };
    } catch (err) {
      console.error("[dlocal-upsell] confirmar falhou:", err);
    }
    return { estado: "pendente", url: pedido.pix_url ?? undefined };
  });
