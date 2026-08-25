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
import { pareceTypo, sugerirEmail } from "../../src/lib/email-typo.js";
import { reconhecerOferta, PRODUTO_PRINCIPAL, OFERTAS } from "../../src/lib/creditos.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { segredoConfere } from "../lib/segredo.js";

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

// Auditar não é avisar. `perfectpay_pago_sem_musica` existe desde o começo e
// funcionou: no dia 11/08 gravou certinho que uma compra de R$ 37 tinha
// entrado sem nada pra entregar. Só que era uma linha numa tabela que ninguém
// abre, então o comprador ficou 4 dias sem receber e a gente só descobriu
// varrendo o banco à mão.
//
// A régua é a mesma do alerta de música (ver gerarMusica.ts): dinheiro
// entrou = incêndio, e-mail sai na hora. A diferença é que aqui não existe
// caso de lead — se chegou neste ponto, alguém pagou.
// O e-mail vem do gateway e entra num corpo HTML. Não é confiável.
function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function alertarDono(assunto: string, html: string) {
  try {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) return;
    await new Resend(chave).emails.send({
      from: "Serenata <contato@serenatagift.com>",
      to: ["guilhermerojasiqueira@gmail.com"],
      subject: assunto,
      html,
    });
  } catch (err) {
    // Aviso nunca derruba o webhook: a Perfect Pay reenviaria o evento e o
    // comprador receberia tudo duplicado.
    console.error("[perfectpay] alerta ao dono falhou:", err);
  }
}

// A Perfect Pay pode mandar aninhado (JSON) ou achatado (form). Os acessos
// abaixo tentam os dois: `customer.email` OU `customer_email`.
type Corpo = {
  token?: string;
  code?: string;
  // QUAL PRODUTO FOI COMPRADO. A Perfect Pay manda dois niveis, `product` e o
  // `plan` dentro dele. O principal e product PPPBF7CL / plan PPLQQQ4CU.
  //
  // Os tres upsells foram criados como PRODUTOS separados (PPPBFA6E, PPPBFA6G,
  // PPPBFA6H), entao a chave de reconhecimento e `product.code`. O `plan.code`
  // fica guardado na auditoria por garantia, mas nao decide nada.
  //
  // Descoberto lendo um payload REAL da auditoria, nao chutando nome de campo.
  plan?: { code?: string; name?: string };
  product?: { code?: string; name?: string };
  /**
   * OS ITENS DA VENDA, que é onde o ORDER BUMP aparece.
   *
   * Numa venda de um produto só ele vem `[]` (conferido em 381 payloads
   * reais). Quando existir bump, a compra principal continua vindo em
   * `product.code`, e o que foi marcado na caixinha do checkout vem aqui.
   *
   * O tipo é frouxo de propósito: nunca vimos um payload COM bump, então
   * cravar o formato seria chutar. O que a gente faz é varrer o pedaço todo
   * atrás de códigos conhecidos, o que funciona em qualquer formato.
   */
  plan_itens?: unknown;
  sale_status_enum_key?: string;
  sale_status_detail?: string;
  sale_status?: string;
  order_status?: string;
  sale_amount?: number | string;
  currency_enum_key?: string;
  // Uma linha por parte que recebe. A do gateway vem com
  // `affiliation_type_enum: 0`; a sua, com `producer`.
  commission?: Array<{ commission_amount?: number; affiliation_type_enum?: number; affiliation_type_enum_key?: string }>;
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
    // Comparação de tempo constante — ver `api/lib/segredo.ts`.
    if (!segredoConfere(recebido, esperado)) {
      // QUAL VENDA FOI RECUSADA, e nunca o token.
      //
      // Em 18/08, no reenvio dos postbacks perdidos, 5 chegaram sem token e
      // foram recusados. A auditoria só dizia "token inválido", então não
      // havia como saber QUAIS vendas ficaram de fora: a recusa estava certa e
      // a informação, inútil. Agora ela guarda o código do pagamento, o
      // produto e o e-mail, que é o suficiente pra reenviar de novo ou
      // entregar à mão.
      //
      // O token não entra aqui de propósito: é o nosso segredo, e auditoria é
      // lida por mais gente que produção.
      await auditar("perfectpay_recusado", {
        motivo: "token inválido",
        code: body.code ?? null,
        produto: body.product?.code ?? null,
        email: body.customer?.email ?? body.customer_email ?? null,
        status: body.sale_status_enum_key ?? body.sale_status ?? null,
        tinhaToken: Boolean(body.token ?? tokenUrl),
      });
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

    // A TAXA REAL DO GATEWAY, que o webhook sempre mandou e a gente ignorava.
    // Numa venda de R$ 37 a Perfect Pay fica com R$ 4,29 (11,6%). Mandar zero
    // pra Utmify inflava o lucro do relatório em R$ 4,29 por venda — a 30
    // vendas/dia, R$ 128/dia de lucro que não existe, sempre pra cima.
    const taxaGateway = (body.commission ?? [])
      .filter((c) => c.affiliation_type_enum === 0 || c.affiliation_type_enum_key === "gateway")
      .reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);
    const taxaCentavos = Number.isFinite(taxaGateway) ? Math.round(taxaGateway * 100) : 0;
    const moedaVenda =
      String(body.currency_enum_key ?? "BRL").toUpperCase() === "USD" ? ("USD" as const) : ("BRL" as const);

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
          moeda: moedaVenda,
          taxaCentavos,
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
              // O telefone é o ativo mais valioso de um Pix abandonado: é por
              // ele que a recuperação acontece. Fica no PEDIDO e não no lead
              // porque quem paga nem sempre é quem fez o quiz.
              telefone,
              // O NOME de quem paga. "Oi, Maria!" contra "Oi!" é a diferença
              // entre conversa e cobrança numa recuperação por WhatsApp — e
              // decide se a pessoa responde ou bloqueia.
              nome_pagador: nomeCliente,
              // O COPIA-E-COLA. Vem como `billet_number` — nome de boleto, e
              // foi por isso que eu não o encontrei procurando por "pix".
              // Com ele o operador manda o código no WhatsApp e a pessoa paga
              // em 15 segundos; sem ele, só dá pra devolvê-la ao checkout pra
              // refazer tudo. `billet_expiration` mostra até quando vale — na
              // prática 3 dias, não os minutos que eu supunha.
              pix_codigo: (body as Record<string, unknown>).billet_number ?? null,
              pix_url: (body as Record<string, unknown>).billet_url ?? null,
              pix_expira: (body as Record<string, unknown>).billet_expiration ?? null,
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

    // ── 5b. É UM UPSELL? ─────────────────────────────────────
    //
    // Música extra, três músicas e quadro chegam pelo MESMO webhook, com outro
    // `plan.code`. Eles não têm música pra casar nem presente pra entregar: o
    // que compram é CRÉDITO, e o crédito só vira música quando a pessoa entra
    // na plataforma e responde outro quiz.
    //
    // Por isso este bloco sai cedo, antes de tudo que existe pra entregar o
    // produto principal. Deixar seguir faria o webhook procurar uma música que
    // não existe e disparar o alerta de "pago sem música casada" em toda venda
    // de crédito.
    // A chave é `product.code`: os três upsells foram criados como PRODUTOS
    // separados na Perfect Pay, não como planos do principal.
    const produtoCode = body.product?.code ?? null;
    const planCode = body.plan?.code ?? null;
    const upsell = reconhecerOferta(produtoCode, Number.isFinite(reais) ? reais : null);

    if (upsell) {
      const { oferta, via } = upsell;
      if (!email) {
        // Sem e-mail não há a quem creditar, e inventar um dono é pior que
        // falhar. Alerta e para.
        await auditar("perfectpay_upsell_sem_email", { code: paymentId, produto: produtoCode });
        await alertarDono(
          "Upsell pago SEM e-mail",
          `<p>Chegou <b>${oferta.id}</b> (R$ ${oferta.precoBrl}) sem e-mail do comprador.` +
            ` payment_id ${escaparHtml(paymentId)}. Crédito NÃO foi lançado.</p>`,
        );
        return res.status(200).json({ ok: true, alerta: "upsell sem e-mail" });
      }

      // O pedido é gravado igual, pra aparecer no painel e na ficha do cliente.
      const { data: pedidoUpsell } = await sb
        .from("pedidos")
        .upsert(
          {
            payment_id: paymentId,
            gateway: "perfectpay",
            status: "pago",
            status_gateway: rawStatus || null,
            email,
            telefone,
            nome_pagador: nomeCliente,
            valor_centavos: Number.isFinite(reais) ? Math.round(reais * 100) : null,
            paid_at: new Date().toISOString(),
          },
          { onConflict: "payment_id" },
        )
        .select("id")
        .maybeSingle();

      if (oferta.creditos > 0) {
        // O índice único por pedido é quem garante que reenvio não credita de
        // novo. Aqui só ignoramos o conflito.
        const { error: erroCredito } = await sb.from("creditos").insert({
          email,
          quantidade: oferta.creditos,
          origem: "compra",
          pedido_id: pedidoUpsell?.id ?? null,
          nota: { oferta: oferta.id, produto: produtoCode, plan: planCode, via },
        });
        if (erroCredito && erroCredito.code !== "23505") {
          await alertarDono(
            "Crédito NÃO lançado",
            `<p>Pagamento de <b>${oferta.id}</b> confirmado mas o crédito falhou:` +
              ` ${escaparHtml(erroCredito.message)}<br>${escaparHtml(email)} · ${escaparHtml(paymentId)}</p>`,
          );
        }
      }

      // O QUADRO NÃO É CRÉDITO: é uma peça amarrada a UMA música, e por isso
      // nasce como uma linha própria em `quadros`, com `musica_id` nulo. O
      // nulo é o direito: ela ainda vai escolher de qual música o quadro é.
      //
      // Antes disto o direito era deduzido do preço (`valor_centavos = 2490`),
      // que some no dia de uma promoção e não conta a segunda compra. O índice
      // único por pedido é quem segura o reenvio do mesmo evento.
      if (oferta.id === "quadro") {
        const { error: erroQuadro } = await sb.from("quadros").insert({
          email,
          pedido_id: pedidoUpsell?.id ?? null,
        });
        if (erroQuadro && erroQuadro.code !== "23505") {
          await alertarDono(
            "Quadro pago e NÃO liberado",
            `<p>O pagamento do quadro entrou mas o direito não foi criado:` +
              ` ${escaparHtml(erroQuadro.message)}<br>${escaparHtml(email)} · ${escaparHtml(paymentId)}</p>` +
              `<p>Ela pagou e o painel não vai mostrar o quadro pra montar.</p>`,
          );
        }
      }

      await auditar("perfectpay_upsell", {
        code: paymentId,
        email,
        oferta: oferta.id,
        creditos: oferta.creditos,
        via,
        produto: produtoCode,
        plan: planCode,
      });

      // RECONHECIDO PELO VALOR = o código ainda não está cadastrado. Funciona,
      // mas é frágil: no dia de uma promoção o valor muda e o reconhecimento
      // some. O alerta entrega o código pronto pra colar em creditos.ts.
      if (via === "valor" && produtoCode) {
        await alertarDono(
          `Cadastre o plan.code de "${oferta.id}"`,
          `<p>Uma compra de <b>${oferta.id}</b> foi reconhecida pelo VALOR, porque o código` +
            ` ainda não está em <code>src/lib/creditos.ts</code>.</p>` +
            `<p>Cole isto no campo <code>planCode</code> da oferta <b>${oferta.id}</b>:</p>` +
            `<p style="font-size:20px"><code>${escaparHtml(produtoCode)}</code></p>` +
            `<p>Enquanto isso continua funcionando pelo valor.</p>`,
        );
      }

      return res.status(200).json({ ok: true, upsell: oferta.id, creditos: oferta.creditos });
    }

    // NÃO É O PRINCIPAL NEM UPSELL CONHECIDO. Alerta e segue o fluxo normal:
    // pode ser um produto novo que alguém criou sem avisar, e engolir calado é
    // como "pagou e não recebeu" nasce.
    if (produtoCode && produtoCode !== PRODUTO_PRINCIPAL) {
      await alertarDono(
        "Produto desconhecido no webhook",
        `<p>Chegou uma venda com <code>product.code = ${escaparHtml(produtoCode)}</code>` +
          ` (${escaparHtml(body.plan?.name ?? "sem nome")}), R$ ${escaparHtml(String(reais))}.</p>` +
          `<p>Não é o produto principal nem um upsell cadastrado. O webhook seguiu o fluxo` +
          ` normal de entrega. Se era pra creditar algo, cadastre em` +
          ` <code>src/lib/creditos.ts</code>.</p>`,
      );
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
          .select("id, token, token_edicao, titulo, quiz_response_id, status, audio_path")
          .eq("quiz_response_id", quiz.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    // PAGOU E A MÚSICA NÃO FICOU PRONTA: refaz AGORA.
    //
    // Aconteceu em 12/08 às 23:46. A música falhou às 23:39, a pessoa pagou
    // sete minutos depois, e o webhook entregou o e-mail com os links de uma
    // música que não existia. Ninguém refez — só foi consertado porque alguém
    // foi olhar o banco de madrugada.
    //
    // É a regra mais importante do projeto invertida: a gente cobrou por algo
    // que não foi produzido. Quando isso acontecer, produzir é a única saída
    // aceitável, e tem que ser automático.
    if (musica && (musica.status !== "pronta" || !musica.audio_path)) {
      try {
        await sb.from("musicas").update({ status: "gerando", erro: null }).eq("id", musica.id);
        const chaveEvento = process.env.INNGEST_EVENT_KEY;
        if (chaveEvento) {
          await fetch(`https://inn.gs/e/${chaveEvento}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "musica/gerar", data: { musicaId: musica.id } }),
          });
        }
        await auditar("compra_sem_musica_refeita", {
          musica: musica.id,
          email,
          statusAnterior: musica.status,
        });
      } catch (err) {
        console.error("[perfectpay] refazer música falhou:", err);
      }
    }

    // ── 7. GRAVA O PEDIDO ────────────────────────────────────
    // sale_amount vem em REAIS; guardamos em centavos.
    const { data: pedidoPrincipal, error: erroPedido } = await sb.from("pedidos").upsert(
      {
        payment_id: paymentId,
        gateway: "perfectpay",
        status: "pago",
        // Sobrescreve o status cru do pendente: a linha é a mesma (upsert por
        // payment_id), e deixar o texto antigo faria o painel mostrar "pix
        // aguardando" numa venda já paga.
        status_gateway: rawStatus || null,
        email,
        // Também no aprovado, e não só no pendente. Quando entrou a coluna eu
        // só cobri o caminho do Pix abandonado, e as compras pagas passaram a
        // gravar telefone nulo — dado bom sendo jogado fora. Serve pra
        // suporte: quando o e-mail cai no spam, o telefone é o único caminho
        // que sobra até quem já pagou.
        telefone,
        nome_pagador: nomeCliente,
        valor_centavos: Number.isFinite(reais) ? Math.round(reais * 100) : null,
        quiz_response_id: quiz?.id ?? null,
        musica_id: musica?.id ?? null,
        paid_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" },
    )
      // O ID É PRA O ORDER BUMP: os índices únicos que impedem crédito
      // duplicado são por `pedido_id`, então sem ele o reenvio do mesmo evento
      // creditaria de novo.
      .select("id")
      .maybeSingle();
    if (erroPedido) {
      await auditar("perfectpay_pedido_falhou", { paymentId, erro: erroPedido.message });
      console.error("[perfectpay] gravar pedido falhou:", erroPedido.message);
      return res.status(500).json({ error: "falha ao gravar pedido" });
    }

    // ── COBRANÇA REPETIDA PELA MESMA MÚSICA ──────────────────
    // Em 15/08 um comprador pagou TRÊS vezes a mesma música em 78 minutos
    // (R$ 114 por um produto de R$ 38), da mesma sessão, e o sistema aceitou
    // e mandou o e-mail de entrega três vezes sem piscar. Cada `payment_id` é
    // único, então nada disso conta como duplicata pro upsert.
    //
    // Não dá pra recusar o pagamento aqui (a Perfect Pay já cobrou; devolver
    // é lá, e é decisão do dono). O que dá é não deixar isso passar calado:
    // três cobranças da mesma pessoa pelo mesmo item é chargeback esperando
    // acontecer, e chargeback é o que derruba conta de gateway.
    if (quiz?.id) {
      try {
        const { data: anteriores } = await sb
          .from("pedidos")
          .select("payment_id, valor_centavos, paid_at")
          .eq("quiz_response_id", quiz.id)
          .eq("status", "pago")
          .neq("payment_id", paymentId);
        if (anteriores?.length) {
          const total =
            anteriores.reduce((s, p) => s + (p.valor_centavos ?? 0), 0) +
            (Number.isFinite(reais) ? Math.round(reais * 100) : 0);
          await auditar("perfectpay_cobranca_repetida", {
            paymentId,
            email,
            quiz: quiz.id,
            vezes: anteriores.length + 1,
            totalCentavos: total,
          });
          await alertarDono(
            `🔴 COBRADO ${anteriores.length + 1}x PELA MESMA MÚSICA: ${email ?? "sem e-mail"}`,
            `<p><strong>A mesma pessoa pagou ${anteriores.length + 1} vezes pela mesma música.</strong> ` +
              `Total cobrado: R$ ${(total / 100).toFixed(2)} por um produto de R$ ${((Number.isFinite(reais) ? reais : 0)).toFixed(2)}.</p>` +
              `<p>E-mail: ${email ?? "-"}<br>Telefone: ${telefone ?? "-"}<br>` +
              `Pagamentos: ${[...anteriores.map((p) => p.payment_id), paymentId].join(", ")}</p>` +
              `<p>Devolva o excedente na Perfect Pay antes que vire chargeback.</p>`,
          );
        }
      } catch (err) {
        console.error("[perfectpay] checagem de cobrança repetida falhou:", err);
      }
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

    // ── 7b. O ORDER BUMP DA VENDA PRINCIPAL ──────────────────
    //
    // O bump não é um pagamento separado: vem dentro da MESMA venda, e por
    // isso não passa pelo bloco de upsell lá em cima, que só olha
    // `product.code` — e aqui esse código é o do produto principal.
    //
    // Sem isto a pessoa marca a caixinha, paga os R$ 24,90 a mais e não recebe
    // nada. É o defeito exato que este webhook inteiro existe pra impedir.
    //
    // A VARREDURA É POR TEXTO, não por caminho de campo. A gente nunca viu um
    // payload COM bump (`plan_itens` vem `[]` nas 381 vendas guardadas), então
    // navegar até `plan_itens[0].plan.code` seria chutar o formato e falhar em
    // silêncio no dia da primeira venda. Procurar os códigos conhecidos dentro
    // do JSON inteiro acerta em qualquer formato, e um código de 8 letras não
    // aparece por acaso.
    const cruDoBump = JSON.stringify(body.plan_itens ?? "");
    const bumps = OFERTAS.filter((o) => o.productCode && cruDoBump.includes(o.productCode));
    if (bumps.length && email) {
      await auditar("perfectpay_bump", {
        code: paymentId,
        email,
        ofertas: bumps.map((b) => b.id),
      });
      for (const bump of bumps) {
        if (bump.creditos > 0) {
          const { error } = await sb.from("creditos").insert({
            email,
            quantidade: bump.creditos,
            origem: "compra",
            pedido_id: pedidoPrincipal?.id ?? null,
            nota: { oferta: bump.id, via: "order_bump", produto: produtoCode },
          });
          if (error && error.code !== "23505") {
            await alertarDono(
              "Order bump pago e NÃO creditado",
              `<p>Veio <b>${bump.id}</b> como order bump e o crédito falhou:` +
                ` ${escaparHtml(error.message)}<br>${escaparHtml(email)} · ${escaparHtml(paymentId)}</p>`,
            );
          }
        }
        if (bump.id === "quadro") {
          const { error } = await sb.from("quadros").insert({
            email,
            pedido_id: pedidoPrincipal?.id ?? null,
          });
          if (error && error.code !== "23505") {
            await alertarDono(
              "Quadro pago no bump e NÃO liberado",
              `<p>O quadro veio como order bump e o direito não foi criado:` +
                ` ${escaparHtml(error.message)}<br>${escaparHtml(email)} · ${escaparHtml(paymentId)}</p>`,
            );
          }
        }
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
      await alertarDono(
        `🔴 PAGOU E NÃO TEM O QUE ENTREGAR: ${email ?? "sem e-mail"}`,
        `<p><strong>Entrou dinheiro e não há música casada com a sessão.</strong> ` +
          `Ninguém recebeu e-mail de entrega, porque não existe link pra mandar.</p>` +
          `<p>E-mail: ${email ?? "-"}<br>Telefone: ${telefone ?? "-"}<br>` +
          `Pagamento: ${paymentId}<br>Sessão: ${src ?? "não veio"}</p>` +
          `<p>Procure a pessoa por <strong>${telefone ?? "e-mail"}</strong> e trate em /recuperar.</p>`,
      );
      return res.status(200).json({ ok: true, alerta: "pago sem música casada" });
    }

    // ── E-MAIL QUE JÁ NASCE CONDENADO ────────────────────────
    // `pareceTypo` já rodava nos crons de lead, mas não aqui, que é onde tem
    // dinheiro em cima. Em 14/08 uma compra de R$ 38 saiu pra
    // `...@gmail.com.br`, domínio que não existe: o e-mail foi enviado, voltou,
    // e a pessoa ficou sem o presente.
    //
    // O alerta de bounce (webhook/resend.ts) pega isso, mas depende do provedor
    // responder, e "quando voltar" pode ser hora nenhuma. Aqui dá pra saber no
    // instante do pagamento, então o aviso sai junto com o telefone.
    //
    // O e-mail é enviado assim mesmo: `pareceTypo` é heurística, e recusar
    // entrega baseado em palpite seria pior que tentar e falhar.
    if (email && pareceTypo(email)) {
      await auditar("perfectpay_email_suspeito", { paymentId, email, telefone });
      await alertarDono(
        `🔴 COMPROU COM E-MAIL QUE NÃO EXISTE: ${email}`,
        `<p><strong>O e-mail da compra tem cara de erro de digitação</strong> ` +
          `(${escaparHtml(email)}), então a entrega provavelmente vai voltar.</p>` +
          `<p>Sugestão: <strong>${escaparHtml(sugerirEmail(email) ?? "sem sugestão")}</strong><br>` +
          `Telefone: ${telefone ?? "NÃO TEMOS"}<br>Pagamento: ${paymentId}</p>` +
          `<p>Fale com a pessoa e corrija o e-mail na ficha em /recuperar.</p>`,
      );
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
        const { data: enviado, error } = await new Resend(chave).emails.send({
          // A ETIQUETA DO ENVIO, que o Resend devolve em todo evento. E o
          // unico jeito de medir DEPOIS qual e-mail performou: o assunto
          // carrega o nome da pessoa e nem sempre vem no evento.
          tags: [{ name: "template", value: "entrega" }],
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
        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "entrega",
          para: email,
          quizResponseId: musica.quiz_response_id ?? null,
        });
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
      moeda: moedaVenda,
      taxaCentavos,
      aprovadoEm: new Date(),
    });

    console.log("[perfectpay] liberado:", { paymentId, musica: musica.id });
    return res.status(200).json({ ok: true, liberado: true });
  } catch (err) {
    console.error("[perfectpay] erro:", err);
    return res.status(500).json({ error: "interno" });
  }
}
