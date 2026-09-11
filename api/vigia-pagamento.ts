// O VIGIA DO PAGAMENTO QUE O WEBHOOK PERDEU.
//
// ── O DIA QUE ESCREVEU ESTE ARQUIVO ──────────────────────────────
//
// 06/09/2026. Uma cliente escreveu indignada: "A letra é gratuita! Paguei
// R$ 38,00? E aí, não entendi!", com o comprovante anexado. O nosso banco
// dizia `pendente`. A reconsulta na Woovi devolveu COMPLETED, pago 54 horas
// antes. O webhook dela se perdeu.
//
// A varredura dos outros 558 pendentes achou mais uma: uma compradora de
// 02/09 esperando havia CINCO DIAS, que nunca reclamou e ia virar contestação
// sem ninguém entender o motivo.
//
// Pior que a espera: as duas continuaram recebendo o e-mail automático de
// "o seu pagamento não entrou". A gente cobrou de novo quem já tinha pago.
//
// ── POR QUE ELE CONSERTA, E NÃO SÓ AVISA ─────────────────────────
//
// O vigia da geração (`vigia-externo.ts`) só grita, de propósito: lá o
// conserto é redisparar um evento, e durante uma queda isso só empilha
// trabalho. Aqui é o contrário. O conserto é determinístico e a prova é a
// mesma que o webhook exige — o gateway dizendo COMPLETED, com o valor
// batendo. Deixar pra alguém acordar é deixar comprador sem produto.
//
// A regra de ouro do projeto continua de pé: nunca liberar sem confirmação.
// A confirmação aqui existe, e vem da Woovi na hora.
//
// ── POR QUE FORA DO INNGEST ──────────────────────────────────────
//
// Mesmo motivo do outro vigia: em 04/09 o Inngest ficou 58 minutos sem
// executar nada e o alarme que existia pra isso era um cron dele. Um vigia
// de dinheiro não pode compartilhar destino com o orquestrador.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { segredoConfere } from "./lib/segredo.js";
import { musicaDoQuiz, refazerSeFaltou, mandarEmailDeEntrega } from "./lib/entrega.js";
import { woovi } from "../src/lib/woovi.js";

const PARA = ["guilhermerojasiqueira@gmail.com", "agenciarocketfy@gmail.com"];

/**
 * Quanto tempo pra trás olhar, e quantos por rodada.
 *
 * 24 horas com teto de 80 cabe folgado no `maxDuration` e cobre o caso real:
 * quem paga, paga em minutos. A janela maior serve pro caso raro de o
 * postback falhar E a pessoa demorar — e como a rodada é de 30 em 30 minutos,
 * o mesmo pedido é reconferido várias vezes antes de sair da janela.
 */
const JANELA_H = 24;
const MAX_POR_RODADA = 80;
/** Recém-criado ainda pode estar no caminho normal do webhook. */
const IDADE_MIN_MIN = 12;

/**
 * ── A SEGUNDA VARREDURA: PAGOU, A MÚSICA FICOU PRONTA DEPOIS ─────
 *
 * A varredura de cima pega o pagamento que o webhook PERDEU. Esta pega o
 * oposto: o webhook chegou certinho, mas naquele instante a música ainda não
 * existia. Ele registra `entrega: "sem-musica"` e segue (woovi.ts:414). A
 * música fica pronta minutos depois e NINGUÉM avisa o comprador.
 *
 * Nenhum dos dois vigias existentes cobria isso:
 *
 *   este mesmo arquivo, acima, só olha pedido `pendente`. O caso aqui já
 *   está `pago`, então passava direto.
 *
 *   `repescarFalhadas` recoloca a música na fila, mas quem entrega é o
 *   fluxo do pagamento, que já passou.
 *
 * Aconteceu em 09/09/2026: a kie.ai devolveu 500 por uma hora, 37 músicas
 * falharam e duas eram de comprador. Uma delas ficou pronta e o dono só
 * soube porque alguém foi olhar na mão. É o mesmo desenho de falha que virou
 * contestação em 04/09.
 *
 * A janela é maior que a de cima porque aqui o dinheiro JÁ entrou: enquanto
 * houver comprador sem entrega, vale continuar procurando.
 */
const ENTREGA_JANELA_H = 72;
const ENTREGA_MAX_POR_RODADA = 40;
/**
 * Dá tempo do caminho normal acontecer antes de a gente entrar por cima.
 * Geração leva ~2 minutos; 15 cobre a fila cheia sem pisar no webhook.
 */
const ENTREGA_IDADE_MIN_MIN = 15;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function autorizado(req: IncomingMessage): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const cru = String(req.headers.authorization ?? "");
  return segredoConfere(cru.startsWith("Bearer ") ? cru.slice(7) : cru, esperado);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!autorizado(req)) {
    res.statusCode = 401;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ erro: "nao autorizado" }));
    return;
  }

  const sb = db();
  const agora = Date.now();
  const consertados: Array<{ email: string; pedido: string; horas: number; entregue: boolean }> = [];
  const semResposta: string[] = [];
  /** Pagou, música ficou pronta depois, e-mail de entrega nunca saiu. */
  const semEntrega: Array<{ email: string; horas: number; entregue: boolean }> = [];

  try {
    const { data: pendentes } = await sb
      .from("pedidos")
      .select("payment_id, email, quiz_response_id, valor_centavos, created_at")
      .eq("status", "pendente")
      .eq("gateway", "woovi")
      .gte("created_at", new Date(agora - JANELA_H * 3600000).toISOString())
      .lte("created_at", new Date(agora - IDADE_MIN_MIN * 60000).toISOString())
      // DO MAIS NOVO PRO MAIS VELHO, e isto é o conserto de 11/09/2026.
      //
      // Ascendente com teto era um ponto cego que se abria sozinho: naquele
      // dia havia 107 pendentes na janela e o teto é 80, então os 27 mais
      // RECENTES nunca eram conferidos. Um comprador ficou 4h18 sem entrega
      // na posição 88 da fila, com o vigia rodando de 30 em 30 minutos e
      // devolvendo `consertados: []` em todas.
      //
      // E a fila só passa de 80 em dia de muito PIX não pago — ou seja, o
      // vigia cegava exatamente no dia em que ele é necessário.
      //
      // Descendente inverte o risco pro lado certo: quem acabou de pagar é
      // conferido na hora, e um pedido continua sendo reconferido até 80
      // mais novos aparecerem na frente (~10h no volume de hoje). Quem paga,
      // paga em minutos — 10h é folga de sobra.
      .order("created_at", { ascending: false })
      .limit(MAX_POR_RODADA);

    for (const p of pendentes ?? []) {
      const idExterno = String(p.payment_id).replace(/^woovi:/, "");
      let st;
      try {
        st = await woovi.consultar(idExterno);
      } catch {
        // Falha de rede não vira silêncio: entra no relatório e a próxima
        // rodada tenta de novo. Foi um `catch` vazio que fez a primeira
        // varredura PERDER justamente o caso que a motivou.
        semResposta.push(p.payment_id);
        continue;
      }
      if (!st.pago) continue;

      // ── AS TRAVAS ANTES DE LIBERAR ────────────────────────────
      //
      // Valor divergente é o sinal de que estou olhando a cobrança errada, e
      // liberar produto em cima disso é pior que não liberar.
      if (st.valorCentavos != null && st.valorCentavos !== p.valor_centavos) {
        console.error(`[vigia-pagamento] valor divergente em ${p.payment_id}: ${st.valorCentavos} vs ${p.valor_centavos}`);
        continue;
      }

      const { error: erroUp } = await sb
        .from("pedidos")
        .update({
          status: "pago",
          // A data DELES, não a de agora: um conserto de cinco dias depois
          // não pode virar receita de hoje no painel financeiro.
          paid_at: st.pagoEm ?? new Date().toISOString(),
          status_gateway: st.statusCru,
          taxa_centavos: st.taxaCentavos,
          titular_pix: st.titularPix,
        })
        .eq("payment_id", p.payment_id)
        // Só sai de `pendente`: se o webhook chegou entre a consulta e agora,
        // esta escrita não pisa em cima dele.
        .eq("status", "pendente");
      if (erroUp) {
        console.error(`[vigia-pagamento] falha ao marcar ${p.payment_id}:`, erroUp.message);
        continue;
      }

      // ── A ENTREGA, PELO MESMO CAMINHO DO WEBHOOK ──────────────
      let entregue = false;
      try {
        const musica = p.quiz_response_id ? await musicaDoQuiz(sb, p.quiz_response_id) : null;
        if (musica) {
          await refazerSeFaltou(sb, musica);
          const r = await mandarEmailDeEntrega(sb, { email: p.email, musica });
          entregue = r.ok;
        }
      } catch (err) {
        console.error(`[vigia-pagamento] entrega falhou em ${p.payment_id}:`, err);
      }

      consertados.push({
        email: p.email,
        pedido: p.payment_id,
        horas: Math.round((agora - Date.parse(p.created_at)) / 3600000),
        entregue,
      });
    }

    // ── SEGUNDA VARREDURA: PAGO, SEM E-MAIL DE ENTREGA ───────────
    //
    // Ver o bloco de constantes lá em cima pro caso que motivou isto.
    for (const p of await (async () => {
      const { data } = await sb
        .from("pedidos")
        .select("payment_id, email, quiz_response_id, paid_at")
        .eq("status", "pago")
        .not("dinheiro_entrou", "is", false)
        .not("quiz_response_id", "is", null)
        .gte("paid_at", new Date(agora - ENTREGA_JANELA_H * 3600000).toISOString())
        .lte("paid_at", new Date(agora - ENTREGA_IDADE_MIN_MIN * 60000).toISOString())
        // DESCENDENTE, e aqui era pior que ponto cego: era morte total.
        //
        // Ascendente com teto de 40 numa janela de 72h pegava os 40
        // pagamentos mais VELHOS de três dias atrás — todos já entregues há
        // muito. O filtro de "quem já recebeu" logo abaixo zerava a lista, e
        // esta varredura devolvia vazio em TODA rodada desde que subiu
        // (commit bd3554e). Ela nunca entregou nada a ninguém.
        //
        // Descoberto em 11/09/2026 com um comprador de 4h18 sem entrega: a
        // varredura rodou duas vezes na frente dele e não o viu.
        .order("paid_at", { ascending: false })
        .limit(ENTREGA_MAX_POR_RODADA);
      if (!data?.length) return [];

      // Quem JÁ recebeu, numa consulta só. Um `select` por pedido dentro do
      // laço estouraria o tempo da função em dia de volume.
      const { data: enviados } = await sb
        .from("emails_enviados")
        .select("quiz_response_id")
        .eq("template", "entrega")
        .in("quiz_response_id", data.map((x) => x.quiz_response_id));
      const jaFoi = new Set((enviados ?? []).map((e) => e.quiz_response_id));
      return data.filter((x) => !jaFoi.has(x.quiz_response_id));
    })()) {
      try {
        const musica = await musicaDoQuiz(sb, p.quiz_response_id as string);
        // Sem música pronta ainda não é o nosso caso: é geração em curso, e
        // o caminho normal ainda vai entregar. Entrar aqui mandaria o
        // "em produção" por cima de quem já recebeu esse mesmo aviso.
        if (!musica || musica.status !== "pronta") continue;

        await refazerSeFaltou(sb, musica);
        const r = await mandarEmailDeEntrega(sb, { email: p.email, musica });
        semEntrega.push({
          email: p.email,
          horas: Math.round((agora - Date.parse(p.paid_at as string)) / 3600000),
          entregue: r.ok,
        });
      } catch (err) {
        console.error(`[vigia-pagamento] entrega atrasada falhou em ${p.payment_id}:`, err);
      }
    }

    if (semEntrega.length && process.env.RESEND_API_KEY) {
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Serenata <contato@serenatagift.com>",
        to: PARA,
        subject: `📦 ${semEntrega.length} comprador(es) pagaram e ficaram sem o e-mail de entrega`,
        html:
          `<p><strong>Estes pagaram, a música ficou pronta DEPOIS, e ninguém avisou.</strong> ` +
          `Acabei de mandar a entrega.</p>` +
          `<ul>${semEntrega.map((c) =>
            `<li>${c.email} — esperando há ${c.horas}h — ${c.entregue ? "entregue agora" : "FALHOU, olhe este"}</li>`).join("")}</ul>` +
          `<p>Quase sempre a causa é o provedor de música ter recusado no instante do pagamento. ` +
          `Vale conferir <code>scratch/falhas-24h.mjs</code> pra ver se foi uma janela ruim do provedor ` +
          `ou algo nosso.</p>`,
      });
    }

    // ── O AVISO ──────────────────────────────────────────────────
    //
    // Conserto silencioso esconde a causa. Cada linha aqui é um webhook que
    // se perdeu, e é isso que precisa ser investigado — não o conserto.
    if (consertados.length && process.env.RESEND_API_KEY) {
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Serenata <contato@serenatagift.com>",
        to: PARA,
        subject: `💸 ${consertados.length} pagamento(s) que o webhook perdeu — já liberados`,
        html:
          `<p><strong>Achei ${consertados.length} pessoa(s) que pagaram e o nosso banco não sabia.</strong> ` +
          `Já marquei como pago e disparei a entrega.</p>` +
          `<ul>${consertados.map((c) =>
            `<li>${c.email} — esperando há ${c.horas}h — entrega ${c.entregue ? "enviada" : "FALHOU, olhe este"}</li>`).join("")}</ul>` +
          `<p>O conserto é automático; a <strong>causa não é</strong>. Cada linha acima é um postback da Woovi ` +
          `que não chegou ou que o nosso lado recusou. Vale olhar o log da Vercel no horário de cada uma.</p>` +
          (semResposta.length
            ? `<p>${semResposta.length} cobrança(s) não responderam nesta rodada; a próxima tenta de novo.</p>`
            : ""),
      });
    }

    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, conferidos: (pendentes ?? []).length, consertados, semResposta: semResposta.length, entregasAtrasadas: semEntrega }));
  } catch (err) {
    console.error("[vigia-pagamento] falhou:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ erro: String((err as Error)?.message ?? err) }));
  }
}
