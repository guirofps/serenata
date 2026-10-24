import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MARCA_ATIVA } from "@/lib/marca-identidade";
import { marcarSeVeioDeEmail } from "@/lib/toque-email.server";
import { centavosMxnDe, cobrarEmPeso, usdDoPeso } from "@/lib/preco-mxn";
import { valorCentavosDaSessao, urlDoSite } from "@/lib/stripe-checkout";
import { dlocalApi, dlocalConfigurado, confirmarPagamentoDlocal, ErroDlocal, orderIdDlocal } from "../../api/lib/dlocalgo";

// OXXO E TRANSFERÊNCIA NO MÉXICO (Ballad, 23/10), do lado do servidor.
//
// Mesmas regras do `criarCheckoutStripe`: o preço sai do braço sorteado no
// banco, nunca do navegador; não se cobra música que não existe; o pedido nasce
// pendente ANTES do pagamento. E uma a mais: SÓ PRA QUEM ESTÁ NO MÉXICO, pelo
// mesmo `x-vercel-ip-country` que decide o preço em peso. A tela só mostra o
// botão no México, e o servidor confere de novo: o OXXO não existe fora de lá.
//
// A página de pagamento é da dLocal (o checkout transparente deles é só pra
// cartão), aberta DENTRO da nossa folha (`CheckoutDlocal.tsx`).

/** A ficha do OXXO vale 3 dias: a pessoa paga na loja quando passar por uma. */
const VALIDADE_DIAS = 3;

export type ResultadoCheckoutDlocal =
  | { ok: true; url: string; pagamentoId: string }
  | { ok: false; erro: "sem-musica" | "ja-pago" | "indisponivel" | "falhou" };

export const criarCheckoutDlocal = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }): Promise<ResultadoCheckoutDlocal> => {
    if (MARCA_ATIVA.chave !== "ballad" || !dlocalConfigurado()) return { ok: false, erro: "indisponivel" };
    if (!cobrarEmPeso(getRequestHeader("x-vercel-ip-country"))) return { ok: false, erro: "indisponivel" };
    const sessionId = String(data.sessionId ?? "").slice(0, 100);
    if (!sessionId) return { ok: false, erro: "falhou" };
    const db = supabaseAdmin();

    const { data: quiz } = await db
      .from("quiz_responses")
      .select("id, email, respostas, attribution, locale")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (!quiz) return { ok: false, erro: "sem-musica" };

    // NUNCA COBRAR POR ALGO QUE AINDA NÃO FOI PRODUZIDO.
    const { data: musica } = await db
      .from("musicas")
      .select("id, titulo")
      .eq("quiz_response_id", quiz.id)
      .not("letra", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!musica) return { ok: false, erro: "sem-musica" };

    const { data: jaPago } = await db
      .from("pedidos")
      .select("id")
      .eq("quiz_response_id", quiz.id)
      .eq("status", "pago")
      .limit(1);
    if (jaPago?.length) return { ok: false, erro: "ja-pago" };

    const valorMxn = centavosMxnDe(await valorCentavosDaSessao(db, quiz.attribution));
    const valorDoPedido = usdDoPeso(valorMxn);

    // REABRIR A FOLHA NÃO CRIA OUTRA FICHA: a pendente deste quiz, do mesmo
    // valor e com folga de validade, volta igual. Duas fichas do OXXO pro mesmo
    // presente confundem quem vai pagar na loja.
    const { data: aberta } = await db
      .from("pedidos")
      .select("payment_id, pix_url, pix_expira")
      .eq("quiz_response_id", quiz.id)
      .eq("gateway", "dlocalgo")
      .eq("status", "pendente")
      .eq("valor_centavos", valorDoPedido)
      .gt("pix_expira", new Date(Date.now() + 6 * 3600e3).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (aberta?.pix_url) {
      return { ok: true, url: aberta.pix_url, pagamentoId: String(aberta.payment_id).slice("dlocalgo:".length) };
    }

    const respostas = (quiz.respostas as Record<string, unknown> | null) ?? {};
    const nome = String(respostas.nome ?? "").trim().slice(0, 40);
    const email = String(quiz.email ?? "").trim() || undefined;
    const site = urlDoSite();
    // As duas portas de volta caem na `/es/pago-oxxo`, que sai de dentro da
    // folha e diz se já pagou ou se a ficha está esperando. Nunca direto na
    // `/es/gracias`: ela diz "pago confirmado", e a ficha do OXXO ainda não foi paga.
    const volta = `${site}/es/pago-oxxo`;

    try {
      const p = await dlocalApi<{ id: string; redirect_url: string }>("POST", "/payments", {
        currency: "MXN",
        amount: valorMxn / 100,
        country: "MX",
        order_id: orderIdDlocal(quiz.id),
        description: (nome ? `Canción personalizada para ${nome}` : "Tu canción personalizada").slice(0, 100),
        payer: email ? { email } : undefined,
        // O cartão continua no Stripe: aqui só dinheiro e transferência.
        payment_type: "VOUCHER,BANK_TRANSFER",
        expiration_type: "DAYS",
        expiration_value: VALIDADE_DIAS,
        success_url: volta,
        back_url: volta,
        notification_url: `${site}/api/webhook/dlocalgo`,
      });
      if (!p?.id || !p.redirect_url?.startsWith("https://")) throw new ErroDlocal("resposta sem id/url", 502);

      const { error } = await db.from("pedidos").insert({
        payment_id: `dlocalgo:${p.id}`,
        gateway: "dlocalgo",
        status: "pendente",
        email: email ?? null,
        valor_centavos: valorDoPedido,
        quiz_response_id: quiz.id,
        musica_id: musica.id,
        // `pix_url`/`pix_expira` são o "link de pagamento" do pedido pendente:
        // aqui, a página da dLocal com a ficha do OXXO.
        pix_url: p.redirect_url,
        pix_expira: new Date(Date.now() + VALIDADE_DIAS * 86400e3).toISOString(),
      });
      if (error) throw new Error(error.message);
      await marcarSeVeioDeEmail(db, `dlocalgo:${p.id}`);
      await db.from("funnel_events").insert({
        event_name: "dlocal_checkout_criado",
        session_id: sessionId,
        event_data: { pagamento: p.id, valor_centavos: valorDoPedido, valor_mxn: valorMxn },
      });
      return { ok: true, url: p.redirect_url, pagamentoId: p.id };
    } catch (err) {
      console.error("[dlocal] criar pagamento falhou:", err instanceof ErroDlocal ? `${err.status} ${err.message}` : err);
      return { ok: false, erro: "falhou" };
    }
  });

export type EstadoDlocal = { estado: "pago" | "pendente" | "nenhum"; url?: string };

/**
 * A folha aberta e a `/es/gracias` perguntam: a ficha desta sessão já foi paga?
 * Pela SESSÃO do navegador (nunca por um id na URL), e quem responde é a API
 * da dLocal. Pago aqui adianta a entrega; a trava no banco impede duas.
 */
export const confirmarCheckoutDlocal = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }): Promise<EstadoDlocal> => {
    if (MARCA_ATIVA.chave !== "ballad" || !dlocalConfigurado()) return { estado: "nenhum" };
    const sessionId = String(data.sessionId ?? "").slice(0, 100);
    if (!sessionId) return { estado: "nenhum" };
    const db = supabaseAdmin();
    const { data: quiz } = await db.from("quiz_responses").select("id").eq("session_id", sessionId).maybeSingle();
    if (!quiz) return { estado: "nenhum" };
    const { data: pedido } = await db
      .from("pedidos")
      .select("payment_id, status, pix_url")
      .eq("quiz_response_id", quiz.id)
      .eq("gateway", "dlocalgo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pedido) return { estado: "nenhum" };
    if (pedido.status === "pago") return { estado: "pago" };
    try {
      const r = await confirmarPagamentoDlocal(db, String(pedido.payment_id).slice("dlocalgo:".length));
      if (r.ok) return { estado: "pago" };
    } catch (err) {
      console.error("[dlocal] confirmar falhou:", err);
    }
    return { estado: "pendente", url: pedido.pix_url ?? undefined };
  });
