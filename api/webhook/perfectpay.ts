// Webhook da Perfect Pay: confirma o pagamento e LIBERA o presente.
//
// Gêmeo do api/webhook/cakto.ts — mesma lógica de baixo (casar música,
// idempotência, e-mail com o link), só muda o MAPEAMENTO dos campos, que na
// Perfect Pay é diferente:
//   - Autenticação: um `token` no corpo (ou ?token=), não assinatura HMAC.
//   - Status: string ("approved"/"paid"/"a"), não enum numérico.
//   - Id da transação: `code`.
//   - Valor: `sale_amount` em REAIS (não centavos).
//   - Ponte de sessão: `metadata.src` (o `?src=<session_id>` do checkout).
//
// Config no painel Perfect Pay:
//   Webhook  = https://www.serenatagift.com/api/webhook/perfectpay?token=<segredo>
//   Redirect = https://www.serenatagift.com/obrigado
//
// Regra de ouro do CLAUDE.md: NUNCA liberar sem confirmação, e o inverso
// (confirmado que não libera) é igualmente grave.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailPresentePronto, assuntoPresentePronto } from "../../emails/presente-pronto.js";
import { enviarVendaUtmify } from "../lib/utmify.js";

type Req = IncomingMessage & {
  method?: string;
  url?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type Res = ServerResponse & { status: (c: number) => Res; json: (b: unknown) => void };

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente no webhook");
  return createClient(url, key, { auth: { persistSession: false } });
}

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";

// Os UTMs da venda saem do NOSSO banco (captura first-touch), não do que o
// gateway ecoa: é o dado mais confiável que temos da origem do clique.
async function buscarAttribution(
  src: string | null,
  email: string | null,
): Promise<Record<string, string | undefined> | null> {
  try {
    const sb = db();
    if (src) {
      const { data } = await sb
        .from("quiz_responses")
        .select("attribution")
        .eq("session_id", src)
        .maybeSingle();
      if (data?.attribution) return data.attribution as Record<string, string | undefined>;
    }
    if (email) {
      const { data } = await sb
        .from("quiz_responses")
        .select("attribution")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.attribution) return data.attribution as Record<string, string | undefined>;
    }
  } catch (err) {
    console.error("[perfectpay] attribution falhou:", err);
  }
  return null;
}

async function auditar(nome: string, dados: unknown) {
  try {
    await db().from("funnel_events").insert({ event_name: nome, event_data: dados });
  } catch (err) {
    console.error("[perfectpay] auditoria falhou:", err);
  }
}

// A Perfect Pay pode mandar aninhado (JSON) ou achatado (form). Os acessos
// abaixo tentam os dois: `customer.email` OU `customer_email`.
type Corpo = {
  token?: string;
  code?: string;
  sale_status_enum_key?: string;
  sale_status_detail?: string;
  sale_status?: string;
  order_status?: string;
  sale_amount?: number | string;
  currency_enum_key?: string;
  customer?: {
    email?: string;
    full_name?: string;
    name?: string;
    // O checkout coleta telefone; guardar é o que permite falar com quem
    // comprou quando o e-mail cai no spam ou a entrega falha.
    phone_formated_ddi?: string;
    phone_formated?: string;
    phone?: string;
    identification_number?: string;
  };
  customer_email?: string;
  customer_name?: string;
  metadata?: { src?: string; ref?: string };
  src?: string;
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    const body = (req.body ?? {}) as Corpo;

    // ── 1. SEGREDO, FAIL-CLOSED ──────────────────────────────
    // Sem o segredo configurado, RECUSA (não libera) — o erro "webhook
    // fail-open" do CLAUDE.md. O token vem no corpo ou em ?token=.
    const esperado = process.env.PERFECTPAY_WEBHOOK_SECRET;
    if (!esperado) {
      await auditar("perfectpay_sem_segredo_configurado", {});
      console.error("[perfectpay] PERFECTPAY_WEBHOOK_SECRET não configurado — recusando");
      return res.status(503).json({ error: "webhook não configurado" });
    }
    let tokenUrl: string | null = null;
    try {
      tokenUrl = new URL(req.url ?? "", "http://x").searchParams.get("token");
    } catch {
      tokenUrl = null;
    }
    const recebido = body.token ?? tokenUrl;
    if (recebido !== esperado) {
      await auditar("perfectpay_recusado", { motivo: "token inválido" });
      return res.status(401).json({ error: "token inválido" });
    }

    // ── 2. EXTRAI OS CAMPOS ──────────────────────────────────
    const paymentId = body.code ?? null;
    const email = (body.customer?.email ?? body.customer_email ?? "").trim().toLowerCase() || null;
    const nomeCliente = body.customer?.full_name ?? body.customer?.name ?? body.customer_name ?? null;
    const telefone =
      body.customer?.phone_formated_ddi ??
      body.customer?.phone_formated ??
      body.customer?.phone ??
      null;
    // `src` = session_id do nosso funil, mandado no checkout como ?src=.
    const src = body.metadata?.src ?? body.metadata?.ref ?? body.src ?? null;
    const rawStatus = String(
      body.sale_status_enum_key ?? body.sale_status_detail ?? body.sale_status ?? body.order_status ?? "",
    ).toLowerCase();
    const reais = typeof body.sale_amount === "number" ? body.sale_amount : Number(body.sale_amount);

    // Auditoria SEM o token (é o nosso segredo; não guarda em claro).
    await auditar(`perfectpay_${rawStatus || "sem_status"}`, {
      code: paymentId,
      email,
      nome: nomeCliente,
      telefone,
      src,
      sale_amount: body.sale_amount ?? null,
    });

    // ── 3. REEMBOLSO / CHARGEBACK ────────────────────────────
    if (/refund|reembols|estorn|charge\s*back|chargeback|dispute/.test(rawStatus)) {
      if (paymentId) {
        await db().from("pedidos").update({ status: "reembolsado" }).eq("payment_id", paymentId);
        // A Utmify precisa saber do estorno, senão o relatório conta uma venda
        // que não existe mais.
        await enviarVendaUtmify({
          orderId: paymentId,
          status: /charge\s*back|chargeback|dispute/.test(rawStatus) ? "chargedback" : "refunded",
          valorCentavos: Number.isFinite(reais) ? Math.round(reais * 100) : 0,
          email,
          nome: nomeCliente,
          src,
          attribution: await buscarAttribution(src, email),
          reembolsadoEm: new Date(),
        });
      }
      return res.status(200).json({ ok: true, reembolsado: true });
    }

    // ── 4. É PAGAMENTO APROVADO? ─────────────────────────────
    const pago = ["approved", "paid", "a", "aprovado"].includes(rawStatus);

    // ── 4b. COBRANÇA GERADA E AINDA NÃO PAGA ─────────────────
    //
    // Antes isto respondia 200 e ia embora. O resultado é que a gente não
    // enxergava uma etapa inteira: em 10/08 o dono viu 2 Pix pendentes no
    // painel da Perfect Pay que não existiam em lugar nenhum aqui.
    //
    // Muda a leitura do funil. "6 cliques em comprar e 1 venda" parece atrito
    // no checkout; "6 cliques, 3 cobranças geradas e 1 paga" é abandono de Pix,
    // que é o problema mais recuperável que existe — a pessoa já decidiu.
    //
    // NÃO filtra por 'pix' no texto do status de propósito: cada gateway
    // escreve de um jeito e adivinhar vocabulário por documentação é como a
    // gente já errou antes. Grava tudo que não é aprovado nem estorno, com o
    // texto CRU junto, e o vocabulário real a gente aprende do dado.
    if (!pago) {
      // O PAYLOAD INTEIRO do pendente, uma vez só.
      //
      // A auditoria normal guarda seis campos escolhidos a dedo, e o resto do
      // corpo some. Isso deixou uma pergunta sem resposta que vale dinheiro:
      // a Perfect Pay manda o CÓDIGO COPIA-E-COLA do Pix junto?
      //
      // Se manda, o e-mail de Pix abandonado leva o código dentro e a pessoa
      // paga em 15 segundos sem voltar ao site. Se não manda, só dá pra
      // devolver ela ao checkout pra refazer tudo — funciona muito menos.
      // 43% de quem gera Pix não paga, então a diferença entre os dois
      // cenários é grande.
      //
      // SEM O TOKEN: ele é o nosso segredo e o resto do arquivo já toma esse
      // cuidado. Guardar credencial em claro numa tabela de eventos seria
      // trocar uma dúvida barata por um problema caro.
      try {
        const corpo = { ...(body as Record<string, unknown>) };
        delete corpo.token;
        await auditar("perfectpay_pending_payload", { corpo });
      } catch (err) {
        console.error("[perfectpay] payload não auditado:", err);
      }

      if (paymentId) {
        const sbP = db();
        const { data: jaExiste } = await sbP
          .from("pedidos")
          .select("id, status")
          .eq("payment_id", paymentId)
          .maybeSingle();

        // NUNCA rebaixa um pedido que já avançou. A Perfect Pay reenvia, e
        // reenvio fora de ordem ("pendente" chegando depois do "aprovado")
        // transformaria uma venda paga em pendente — some do faturamento e
        // some da entrega. Só escreve em linha nova ou em linha pendente.
        if (!jaExiste || jaExiste.status === "pendente") {
          // Casa com a sessão pelo mesmo caminho do pagamento aprovado: `src`
          // primeiro, e-mail como reserva. Sem isso o pendente vira uma linha
          // órfã, e é justamente o vínculo que permite lembrar a pessoa depois.
          let quizP: { id: string } | null = null;
          if (src) {
            const { data } = await sbP.from("quiz_responses").select("id").eq("session_id", src).maybeSingle();
            quizP = data;
          }
          if (!quizP && email) {
            const { data } = await sbP
              .from("quiz_responses")
              .select("id")
              .eq("email", email)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            quizP = data;
          }

          const { error } = await sbP.from("pedidos").upsert(
            {
              payment_id: paymentId,
              gateway: "perfectpay",
              status: "pendente",
              status_gateway: rawStatus || null,
              email,
              valor_centavos: Number.isFinite(reais) ? Math.round(reais * 100) : null,
              quiz_response_id: quizP?.id ?? null,
            },
            { onConflict: "payment_id" },
          );
          if (error) {
            // Não derruba o webhook: pendente é informação, não entrega. Se
            // falhar, o pior caso é continuar cego como antes — devolver erro
            // faria a Perfect Pay reenviar em loop por causa de um registro
            // que não libera nada pra ninguém.
            console.error("[perfectpay] pendente não gravado:", error.message);
          }
        }
      }
      return res.status(200).json({ ok: true, nota: `status não aprovado (${rawStatus})` });
    }
    if (!paymentId) {
      await auditar("perfectpay_sem_code", { body });
      return res.status(400).json({ error: "evento sem code" });
    }

    const sb = db();

    // ── 5. IDEMPOTÊNCIA ──────────────────────────────────────
    // A Perfect Pay reenvia. Só encerra cedo se o pedido JÁ estiver pago;
    // pedido gravado mas sem entrega precisa seguir e completar.
    const { data: existente } = await sb
      .from("pedidos")
      .select("id, status, musica_id")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (existente?.status === "pago") {
      return res.status(200).json({ ok: true, duplicado: true });
    }

    // ── 6. CASA O PAGAMENTO COM A SESSÃO ─────────────────────
    // Só pelo src (session_id) ou pelo e-mail. SEM fallback "quiz anônimo mais
    // recente": sob concorrência entrega a música da pessoa errada (erro
    // herdado listado no CLAUDE.md — o próprio perfectpay.js antigo fazia isso).
    let quiz: { id: string } | null = null;
    if (src) {
      const { data } = await sb.from("quiz_responses").select("id").eq("session_id", src).maybeSingle();
      quiz = data;
    }
    if (!quiz && email) {
      const { data } = await sb
        .from("quiz_responses")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      quiz = data;
    }

    const { data: musica } = quiz
      ? await sb
          .from("musicas")
          .select("id, token, token_edicao, titulo, quiz_response_id")
          .eq("quiz_response_id", quiz.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    // ── 7. GRAVA O PEDIDO ────────────────────────────────────
    // sale_amount vem em REAIS; guardamos em centavos.
    const { error: erroPedido } = await sb.from("pedidos").upsert(
      {
        payment_id: paymentId,
        gateway: "perfectpay",
        status: "pago",
        // Sobrescreve o status cru do pendente: a linha é a mesma (upsert por
        // payment_id), e deixar o texto antigo faria o painel mostrar "pix
        // aguardando" numa venda já paga.
        status_gateway: rawStatus || null,
        email,
        valor_centavos: Number.isFinite(reais) ? Math.round(reais * 100) : null,
        quiz_response_id: quiz?.id ?? null,
        musica_id: musica?.id ?? null,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" },
    );
    if (erroPedido) {
      await auditar("perfectpay_pedido_falhou", { paymentId, erro: erroPedido.message });
      console.error("[perfectpay] gravar pedido falhou:", erroPedido.message);
      return res.status(500).json({ error: "falha ao gravar pedido" });
    }

    // Telefone de quem comprou fica no lead: é o único canal alternativo
    // quando o e-mail cai no spam. Nunca derruba o webhook.
    if (telefone && quiz?.id) {
      try {
        await sb.from("quiz_responses").update({ whatsapp: telefone }).eq("id", quiz.id);
      } catch (err) {
        console.error("[perfectpay] telefone não gravado:", err);
      }
    }

    // ── CONTA DO COMPRADOR ───────────────────────────────────
    // Criada com o e-mail da COMPRA, não com o do quiz. São frequentemente
    // diferentes (a pessoa digita um no funil e paga com outro), e é o e-mail
    // da compra que ela vai usar pra entrar. Sem isto, quem paga com e-mail
    // diferente pede o link de acesso e não recebe nada.
    if (email && musica) {
      try {
        await sb.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: nomeCliente ? { nome: nomeCliente } : {},
        });
      } catch {
        // Já existe: seguimos e apenas amarramos a música.
      }
      try {
        const { data: conta } = await sb.from("users").select("id").eq("email", email).maybeSingle();
        if (conta?.id) {
          await sb.from("musicas").update({ user_id: conta.id }).eq("id", musica.id);
        }
      } catch (err) {
        console.error("[perfectpay] conta não vinculada:", err);
      }
    }

    // Pago sem música casada: dinheiro entrou e pedido registrado, mas não há o
    // que entregar automático. Falha alto na auditoria pra tratativa humana.
    if (!musica) {
      await auditar("perfectpay_pago_sem_musica", { paymentId, src, email });
      console.error("[perfectpay] pago mas sem música casada:", { paymentId, src, email });
      return res.status(200).json({ ok: true, alerta: "pago sem música casada" });
    }

    // ── 8. E-MAIL COM O LINK DO EDITOR ───────────────────────
    // Falha de e-mail NÃO derruba o webhook (senão a Perfect Pay reenvia o
    // evento e o comprador recebe duplicado). Vira evento de auditoria.
    if (email) {
      try {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) throw new Error("RESEND_API_KEY ausente");
        const { data: q } = await sb
          .from("quiz_responses")
          .select("respostas, locale")
          .eq("id", musica.quiz_response_id)
          .maybeSingle();
        // `.trim()`: o nome digitado no quiz costuma vir com espaço sobrando
        // ("Cardoso "), e o assunto saía com espaço duplo.
        // O IDIOMA DA VENDA vem do registro, não da requisição: um webhook
        // não tem navegador, cabeçalho nem rota de onde deduzir. Ver a
        // migration 20260807000000_locale.
        const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";
        const nome =
          ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ||
          nomeCliente?.trim() ||
          (locale === "es" ? "quien tú quieres" : "quem você ama");

        const linkEditor = `${SITE}/editar/${musica.token_edicao}`;
        const linkPresente = `${SITE}/p/${musica.token}`;
        const { error } = await new Resend(chave).emails.send({
          from: "Serenata <contato@serenatagift.com>",
          to: [email],
          subject: assuntoPresentePronto(nome, locale),
          html: emailPresentePronto({
            nome,
            titulo: musica.titulo ?? "Sua música",
            linkEditor,
            linkPresente,
            locale,
          }),
          text: `A música de ${nome} está pronta.\n\nMonte o presente (coloque uma foto e uma frase):\n${linkEditor}\n\nO presente já funciona do jeito que está:\n${linkPresente}\n\nGuarde este e-mail: o link do editor é seu e só ele deixa editar a página.`,
        });
        if (error) throw new Error(error.message);
        await auditar("perfectpay_email_enviado", { paymentId, email });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await auditar("perfectpay_email_falhou", { paymentId, email, erro: msg });
        console.error("[perfectpay] e-mail falhou:", msg);
      }
    }

    // ── 9. REPORTA A VENDA PRA UTMIFY ────────────────────────
    // Depois da entrega, de propósito: relatório nunca pode atrasar (nem
    // arriscar) o que a pessoa pagou pra receber.
    await enviarVendaUtmify({
      orderId: paymentId,
      status: "paid",
      valorCentavos: Number.isFinite(reais) ? Math.round(reais * 100) : 0,
      email,
      nome: nomeCliente,
      src,
      attribution: await buscarAttribution(src, email),
      aprovadoEm: new Date(),
    });

    console.log("[perfectpay] liberado:", { paymentId, musica: musica.id });
    return res.status(200).json({ ok: true, liberado: true });
  } catch (err) {
    console.error("[perfectpay] erro:", err);
    return res.status(500).json({ error: "interno" });
  }
}
