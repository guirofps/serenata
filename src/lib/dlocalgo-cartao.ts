import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MARCA_ATIVA } from "@/lib/marca-identidade";
import { marcarSeVeioDeEmail } from "@/lib/toque-email.server";
import { formatarNaMoeda, mercadoDoPais } from "@/lib/mercados";
import { paisDaRequisicao } from "@/lib/pais-requisicao.server";
import { marcarMoedaDoPedido } from "@/lib/pais-quiz";
import { valorLocalDaSessao, urlDoSite } from "@/lib/stripe-checkout";
import { nomeCompletoValido } from "@/lib/documento-mx";
import { validarDocumento } from "@/lib/documento-pais";
import {
  EXP_CARTAO_DLOCAL,
  STATUS_TRANSPARENTE,
  VALIDADE_CARTAO_MIN,
  documentoNoCartao,
  estadoDoStatus,
  grupoRecusaCartao,
  paisCartaoDlocal,
  proximoPassoConfirmacao,
  separarNome,
  tokenCartaoValido,
  type GrupoRecusaCartao,
  type RespostaConfirmacao,
} from "@/lib/cartao-dlocal";
import {
  dlocalApi,
  dlocalConfigurado,
  confirmarPagamentoDlocal,
  ErroDlocal,
  idDlocalValido,
  lerPagamentoDlocal,
  orderIdDlocal,
} from "../../api/lib/dlocalgo";

// O CARTÃO PELA dLOCAL GO (teste `cartao_dlocal`, Ballad, 11/11), do lado do
// servidor. A regra e o desenho moram em `cartao-dlocal.ts`.
//
// Mesmas travas do `criarCheckoutDlocal` e do Stripe: o preço sai do braço de
// `preco` gravado no banco, nunca do navegador; não se cobra música que não
// existe; quiz já pago não cobra; o pedido nasce PENDENTE antes do pagamento.
// E duas próprias do cartão:
//   - o `merchant_checkout_token` do confirm é lido NA dLOCAL pelo id do NOSSO
//     pedido (o GET devolve ele), nunca o que o navegador manda;
//   - a liberação é a mesma `confirmarPagamentoDlocal` do aviso: a escrita
//     condicional pendente → pago faz o aviso e a folha nunca entregarem duas vezes.
// Número do cartão não passa por aqui (só o token do SDK). O documento vai pra
// dLocal e nunca é gravado no banco nem nos logs.

type Db = ReturnType<typeof supabaseAdmin>;

export type ResultadoCriarCartao =
  | {
      ok: true;
      pagamentoId: string;
      checkoutToken: string;
      chaveSmartfields: string;
      documento: boolean;
      /**
       * O valor que ESTA cobrança vai debitar, escrito na moeda do país
       * ("$29.900 COP"). O botão de pagar desta folha é o único lugar em que a
       * pessoa lê o valor (não há página da dLocal no meio), então ele escreve
       * este, e não o que a tela calculou: se o teste de preço do país for
       * desligado com a aba aberta, o botão diz o que será cobrado.
       */
      valorTexto: string;
    }
  | { ok: false; erro: "sem-musica" | "ja-pago" | "indisponivel" | "falhou" };

async function quizComMusica(db: Db, sessionId: string) {
  const { data: quiz } = await db
    .from("quiz_responses")
    .select("id, email, respostas, attribution")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!quiz) return null;
  const { data: musica } = await db
    .from("musicas")
    .select("id")
    .eq("quiz_response_id", quiz.id)
    .not("letra", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return musica ? { quiz, musica } : null;
}

async function quizPago(db: Db, quizId: string): Promise<boolean> {
  const { data, error } = await db.from("pedidos").select("id").eq("quiz_response_id", quizId).eq("status", "pago").limit(1);
  // Na dúvida, pago: consulta que falha não vira cobrança.
  return error ? true : Boolean(data?.length);
}

function bracoDe(attribution: unknown): string | null {
  return ((attribution as { exp?: Record<string, string> } | null)?.exp ?? {})[EXP_CARTAO_DLOCAL] ?? null;
}

async function evento(db: Db, sessionId: string, nome: string, dados: Record<string, unknown>) {
  await db.from("funnel_events").insert({ event_name: nome, session_id: sessionId, event_data: dados });
}

export const criarCartaoDlocal = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; bracoLocal?: string }) => ({
    sessionId: String(data?.sessionId ?? "").slice(0, 100),
    // Teste de preço do país (`preco_co`, 12/11): o braço que a folha mostra.
    bracoLocal: typeof data?.bracoLocal === "string" ? data.bracoLocal.slice(0, 24) : undefined,
  }))
  .handler(async ({ data }): Promise<ResultadoCriarCartao> => {
    const chaveSmartfields = process.env.DLOCALGO_SMARTFIELDS_KEY?.trim();
    if (MARCA_ATIVA.chave !== "ballad" || !dlocalConfigurado() || !chaveSmartfields) return { ok: false, erro: "indisponivel" };
    // O país é o do cabeçalho desta requisição, nunca do navegador.
    const pais = paisDaRequisicao();
    const paisCartao = paisCartaoDlocal(pais);
    const mercado = mercadoDoPais(pais);
    if (!paisCartao || !mercado.temDlocal) return { ok: false, erro: "indisponivel" };
    const sessionId = data.sessionId;
    if (!sessionId) return { ok: false, erro: "falhou" };
    const db = supabaseAdmin();

    const achado = await quizComMusica(db, sessionId);
    // NUNCA COBRAR POR ALGO QUE AINDA NÃO FOI PRODUZIDO.
    if (!achado) return { ok: false, erro: "sem-musica" };
    const { quiz, musica } = achado;
    if (await quizPago(db, quiz.id)) return { ok: false, erro: "ja-pago" };

    const { valorLocal, valorDoPedido, bracoPreco } = await valorLocalDaSessao(
      db,
      quiz.attribution,
      mercado,
      data.bracoLocal,
    );

    // REABRIR A FOLHA CRIA OUTRA COBRANÇA: o token do SDK vale pra uma
    // tentativa, e uma cobrança velha pode já ter sido tentada. A pendente
    // anterior do cartão vira `cancelado`; se ela ainda for paga (3DS que
    // volta tarde), o aviso aceita `cancelado` → pago e avisa se for a segunda.
    await db
      .from("pedidos")
      .update({ status: "cancelado" })
      .eq("quiz_response_id", quiz.id)
      .eq("gateway", "dlocalgo")
      .eq("status", "pendente")
      .eq("status_gateway", STATUS_TRANSPARENTE);

    const respostas = (quiz.respostas as Record<string, unknown> | null) ?? {};
    const nome = String(respostas.nome ?? "").trim().slice(0, 40);
    const email = String(quiz.email ?? "").trim() || undefined;
    const site = urlDoSite();
    const volta = `${site}/es/pago-tarjeta`;

    try {
      const p = await dlocalApi<{ id: string; merchant_checkout_token?: string }>("POST", "/payments", {
        currency: mercado.moeda.toUpperCase(),
        amount: valorLocal / 10 ** mercado.decimais,
        country: mercado.pais,
        order_id: orderIdDlocal(quiz.id),
        description: (nome ? `Canción personalizada para ${nome}` : "Tu canción personalizada").slice(0, 100),
        ...(email ? { payer: { email } } : {}),
        payment_type: "CREDIT_CARD,DEBIT_CARD",
        allow_transparent: true,
        success_url: volta,
        back_url: volta,
        notification_url: `${site}/api/webhook/dlocalgo`,
      });
      const token = p?.merchant_checkout_token;
      if (!p?.id || !idDlocalValido(p.id) || !token) throw new ErroDlocal("resposta sem id/token", 502);

      const { error } = await db.from("pedidos").insert({
        payment_id: `dlocalgo:${p.id}`,
        gateway: "dlocalgo",
        status: "pendente",
        status_gateway: STATUS_TRANSPARENTE,
        email: email ?? null,
        valor_centavos: valorDoPedido,
        quiz_response_id: quiz.id,
        musica_id: musica.id,
        // Sem `pix_url`: não há página pra reabrir, e a volta do OXXO e o
        // lembrete da ficha só pegam pedido com link. Validade curta: a regra de
        // "reabrir a ficha" exige 6h de folga e nunca pega o cartão.
        pix_url: null,
        pix_expira: new Date(Date.now() + VALIDADE_CARTAO_MIN * 60e3).toISOString(),
      });
      if (error) throw new Error(error.message);
      await marcarSeVeioDeEmail(db, `dlocalgo:${p.id}`);
      await marcarMoedaDoPedido(db, `dlocalgo:${p.id}`, { moeda: mercado.moeda, valorMoeda: valorLocal, pais });
      await evento(db, sessionId, "cartao_dlocal_criado", {
        pagamento: p.id,
        braco: bracoDe(quiz.attribution),
        pais: paisCartao,
        valor_centavos: valorDoPedido,
        valor_local: valorLocal,
        ...(bracoPreco ? { braco_preco: bracoPreco } : {}),
      });
      return {
        ok: true,
        pagamentoId: p.id,
        checkoutToken: token,
        chaveSmartfields,
        documento: documentoNoCartao(paisCartao),
        valorTexto: formatarNaMoeda(mercado, valorLocal),
      };
    } catch (err) {
      console.error("[cartao-dlocal] criar falhou:", err instanceof ErroDlocal ? `${err.status} ${err.message}` : err);
      await evento(db, sessionId, "cartao_dlocal_erro", {
        etapa: "criar",
        status: err instanceof ErroDlocal ? err.status : null,
        erro: String(err instanceof Error ? err.message : err).slice(0, 160),
        pais: paisCartao,
      });
      return { ok: false, erro: "falhou" };
    }
  });

export type ResultadoConfirmarCartao =
  | { estado: "pago" }
  | { estado: "3ds"; url: string }
  | { estado: "pendente" }
  | { estado: "recusado"; grupo: GrupoRecusaCartao }
  | { estado: "erro"; erro: "dados" | "documento" | "sem-pedido" | "falhou" };

export const confirmarCartaoDlocal = createServerFn({ method: "POST" })
  .validator(
    (data: { sessionId: string; pagamentoId: string; cardToken: string; nome?: string; documento?: string }) => ({
      sessionId: String(data?.sessionId ?? "").slice(0, 100),
      pagamentoId: String(data?.pagamentoId ?? "").slice(0, 60),
      cardToken: String(data?.cardToken ?? "").slice(0, 200),
      nome: String(data?.nome ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
      documento: String(data?.documento ?? "").slice(0, 40),
    }),
  )
  .handler(async ({ data }): Promise<ResultadoConfirmarCartao> => {
    if (MARCA_ATIVA.chave !== "ballad" || !dlocalConfigurado()) return { estado: "erro", erro: "falhou" };
    const paisCartao = paisCartaoDlocal(paisDaRequisicao());
    if (!paisCartao) return { estado: "erro", erro: "falhou" };
    if (!data.sessionId || !idDlocalValido(data.pagamentoId) || !tokenCartaoValido(data.cardToken)) return { estado: "erro", erro: "dados" };
    if (!nomeCompletoValido(data.nome)) return { estado: "erro", erro: "dados" };
    // Documento: obrigatório nos quatro países (`documentoNoCartao`; o México
    // passou a pedir em 12/11, depois de 8 de 8 "Missing fields").
    let doc: { tipo: string; documento: string } | null = null;
    if (documentoNoCartao(paisCartao) || data.documento) {
      const d = validarDocumento(paisCartao, data.documento);
      if (!d.ok) return { estado: "erro", erro: "documento" };
      doc = { tipo: d.tipo, documento: d.documento };
    }

    const db = supabaseAdmin();
    const { data: quiz } = await db.from("quiz_responses").select("id, email, attribution").eq("session_id", data.sessionId).maybeSingle();
    if (!quiz) return { estado: "erro", erro: "sem-pedido" };
    const paymentId = `dlocalgo:${data.pagamentoId}`;
    // O PEDIDO TEM QUE SER DESTA SESSÃO e do cartão: o id vem do navegador, e
    // sem esta conferência qualquer um confirmaria a cobrança de outro quiz.
    const { data: pedido } = await db
      .from("pedidos")
      .select("status, status_gateway, quiz_response_id")
      .eq("payment_id", paymentId)
      .eq("quiz_response_id", quiz.id)
      .maybeSingle();
    if (!pedido) return { estado: "erro", erro: "sem-pedido" };
    if (pedido.status === "pago") return { estado: "pago" };
    if (pedido.status !== "pendente" || pedido.status_gateway !== STATUS_TRANSPARENTE) return { estado: "erro", erro: "sem-pedido" };
    if (await quizPago(db, quiz.id)) return { estado: "pago" };

    const braco = bracoDe(quiz.attribution);
    const registrar = (resultado: string, extra: Record<string, unknown> = {}) =>
      evento(db, data.sessionId, "cartao_dlocal_confirmacao", { pagamento: data.pagamentoId, braco, pais: paisCartao, resultado, ...extra });

    try {
      // O token do confirm vem da dLocal, pelo id do nosso pedido.
      const antes = await lerPagamentoDlocal(data.pagamentoId);
      if (antes.status === "PAID") {
        await confirmarPagamentoDlocal(db, data.pagamentoId);
        return { estado: "pago" };
      }
      const token = (antes as { merchant_checkout_token?: string }).merchant_checkout_token;
      if (!token || antes.status !== "PENDING") {
        await registrar("cobranca_fechada", { status: antes.status });
        return { estado: "erro", erro: "falhou" };
      }

      const { primeiro, ultimo } = separarNome(data.nome);
      const email = String(quiz.email ?? "").trim() || undefined;
      let resposta: RespostaConfirmacao;
      try {
        resposta = await dlocalApi<RespostaConfirmacao>("POST", `/payments/confirm/${encodeURIComponent(token)}`, {
          cardToken: data.cardToken,
          clientFirstName: primeiro,
          clientLastName: ultimo,
          ...(doc ? { clientDocumentType: doc.tipo, clientDocument: doc.documento } : {}),
          ...(email ? { clientEmail: email } : {}),
        });
      } catch (err) {
        if (!(err instanceof ErroDlocal)) throw err;
        // Confirm recusado com erro (4xx): o GET ainda pode dizer outra coisa,
        // mas o motivo vem daqui. Nunca o documento no texto gravado.
        const msg = doc ? String(err.message).split(doc.documento).join("***") : String(err.message);
        const depois = await lerPagamentoDlocal(data.pagamentoId).catch(() => null);
        if (depois?.status === "PAID") {
          await confirmarPagamentoDlocal(db, data.pagamentoId);
          await registrar("pago", { via: "confirm_erro_mas_pago" });
          return { estado: "pago" };
        }
        const grupo = grupoRecusaCartao(`${depois?.status_detail ?? ""} ${msg}`);
        await registrar("recusado", { http: err.status, motivo: msg.slice(0, 160), detalhe: depois?.status_detail ?? null, grupo });
        return { estado: "recusado", grupo };
      }

      const passo = proximoPassoConfirmacao(resposta);
      if (passo.passo === "3ds") {
        await registrar("3ds");
        return { estado: "3ds", url: passo.url };
      }
      const depois = await lerPagamentoDlocal(data.pagamentoId);
      const estado = estadoDoStatus(depois.status);
      if (estado === "pago") {
        await confirmarPagamentoDlocal(db, data.pagamentoId);
        await registrar("pago");
        return { estado: "pago" };
      }
      if (estado === "recusado") {
        const grupo = grupoRecusaCartao(depois.status_detail);
        await registrar("recusado", { detalhe: depois.status_detail ?? null, grupo, success: resposta.success ?? null });
        return { estado: "recusado", grupo };
      }
      await registrar("pendente", { detalhe: depois.status_detail ?? null });
      return { estado: "pendente" };
    } catch (err) {
      console.error("[cartao-dlocal] confirmar falhou:", err instanceof ErroDlocal ? `${err.status} ${err.message}` : err);
      await registrar("erro", { erro: String(err instanceof Error ? err.message : err).slice(0, 160) });
      return { estado: "erro", erro: "falhou" };
    }
  });

export type EstadoCartaoDlocal = { estado: "pago" | "recusado" | "pendente" | "nenhum" };

/**
 * A volta do 3DS (`/es/pago-tarjeta`) pergunta: o cartão desta sessão pagou?
 * Pela SESSÃO do navegador (nunca por um id na URL); quem responde é a dLocal.
 */
export const estadoCartaoDlocal = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => ({ sessionId: String(data?.sessionId ?? "").slice(0, 100) }))
  .handler(async ({ data }): Promise<EstadoCartaoDlocal> => {
    if (MARCA_ATIVA.chave !== "ballad" || !dlocalConfigurado() || !data.sessionId) return { estado: "nenhum" };
    const db = supabaseAdmin();
    const { data: quiz } = await db.from("quiz_responses").select("id").eq("session_id", data.sessionId).maybeSingle();
    if (!quiz) return { estado: "nenhum" };
    if (await quizPago(db, quiz.id)) return { estado: "pago" };
    const { data: pedido } = await db
      .from("pedidos")
      .select("payment_id")
      .eq("quiz_response_id", quiz.id)
      .eq("gateway", "dlocalgo")
      .eq("status_gateway", STATUS_TRANSPARENTE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pedido) return { estado: "nenhum" };
    const id = String(pedido.payment_id).slice("dlocalgo:".length);
    try {
      const p = await lerPagamentoDlocal(id);
      const estado = estadoDoStatus(p.status);
      if (estado === "pago") {
        const r = await confirmarPagamentoDlocal(db, id);
        return { estado: r.ok ? "pago" : "pendente" };
      }
      return { estado };
    } catch (err) {
      console.error("[cartao-dlocal] estado falhou:", err);
      return { estado: "pendente" };
    }
  });
