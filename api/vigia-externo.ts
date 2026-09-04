// O VIGIA QUE SOBREVIVE À QUEDA DO ORQUESTRADOR.
//
// ── O DIA QUE ESCREVEU ESTE ARQUIVO ──────────────────────────────
//
// 04/09/2026, 15h11 BRT. O Inngest entrou em "Degraded Function Execution"
// (status page deles, incidente de impacto major) e ficou 58 minutos
// aceitando eventos com HTTP 200 sem criar UMA execução. Do nosso lado
// estava tudo de pé: créditos no provedor sobrando, `PUT /api/inngest`
// respondendo "Successfully registered", geração manual funcionando em 130s.
//
// 25 músicas pararam. A espera mediana pela música foi de 112s pra 1.412s,
// com pior caso de 48 minutos. As folhas de PIX abertas caíram de 10-23 por
// hora pra 4 e depois 3. Um comprador pagou às 15h29, ficou sem entrega e
// abriu contestação no mesmo dia.
//
// Existia um alerta pra exatamente isso: `vigiaGeracao`, cron de 10 em 10
// minutos. Ele não disparou, e não podia — ele é um cron DO INNGEST. Era
// detector de incêndio ligado na tomada que pegou fogo. O dono só ficou
// sabendo porque um cliente abriu disputa.
//
// ── POR QUE VERCEL CRON, E NÃO OUTRO JOB ─────────────────────────
//
// O requisito não é "mais um vigia", é um vigia que não compartilhe destino
// com o vigiado. Este roda no cron da Vercel e fala direto com o Supabase:
// pra ele calar a boca é preciso que a Vercel E o Supabase caiam juntos, e
// nesse caso o site inteiro já está fora e o dono descobre por outro caminho.
//
// ── O QUE ELE NÃO FAZ, DE PROPÓSITO ──────────────────────────────
//
// Ele NÃO redispara nada. O `vigiaGeracao` de dentro conserta, porque lá o
// redisparo é barato e o Inngest está vivo pra executar. Aqui, redisparar
// durante uma queda do orquestrador só empilharia evento que ninguém vai
// consumir — e quando o Inngest voltasse, despejaria a fila dobrada em cima
// do provedor. Este aqui só grita. Gritar é o que faltava.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { segredoConfere } from "./lib/segredo.js";
import { lerOsSinais, assuntoDoAlerta } from "../src/lib/sinais-geracao.js";

// DOIS ENDEREÇOS, igual ao vigia de dentro. Este alerta existe pra uma
// decisão com hora marcada (pausar as campanhas), e e-mail que empaca num
// filtro custa o dia inteiro de mídia.
const PARA = ["guilhermerojasiqueira@gmail.com", "agenciarocketfy@gmail.com"];

const JANELA_MIN = 20;
const PRESA_MIN = 15;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * A VERCEL SE IDENTIFICA COM `Authorization: Bearer $CRON_SECRET`.
 *
 * A rota é pública, e sem esta porta qualquer um a chamaria em laço pra
 * encher a caixa do dono de alerta — que é o jeito mais eficiente de fazer
 * um alerta parar de ser lido.
 *
 * FALHA FECHADA, ao contrário do teto de uso: aqui negar não custa venda,
 * custa um ciclo de 10 minutos. Se `CRON_SECRET` não estiver setada, ninguém
 * entra, e isso aparece no primeiro teste em vez de virar rota aberta.
 */
function autorizado(req: IncomingMessage): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const cabecalho = String(req.headers.authorization ?? "");
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : cabecalho;
  return segredoConfere(token, esperado);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!autorizado(req)) {
    res.statusCode = 401;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ erro: "nao autorizado" }));
    return;
  }

  try {
    const sb = db();
    const agora = Date.now();
    const desde = new Date(agora - JANELA_MIN * 60000).toISOString();
    const limitePresa = new Date(agora - PRESA_MIN * 60000).toISOString();

    // TEM GENTE NO FUNIL? Letra escrita é prova de tráfego vivo, e é o que
    // separa "quebrou" de "são quatro da manhã".
    const { count: letrasNovas } = await sb
      .from("musicas")
      .select("id", { count: "exact", head: true })
      .gte("created_at", desde)
      .not("letra", "is", null);

    const { count: prontasNaJanela } = await sb
      .from("musicas")
      .select("id", { count: "exact", head: true })
      .gte("gerada_em", desde);

    const { count: presas } = await sb
      .from("musicas")
      .select("id", { count: "exact", head: true })
      .in("status", ["aguardando", "gerando"])
      .lte("created_at", limitePresa);

    const { data: falhadas } = await sb
      .from("musicas")
      .select("erro")
      .eq("status", "falhou")
      .gte("created_at", desde);
    // Teto diário não é queda: é o disjuntor funcionando como projetado.
    const falhas = (falhadas ?? []).filter(
      (f) => !String(f.erro ?? "").toLowerCase().includes("teto diário"),
    ).length;

    // ── O RELÓGIO DA ÚLTIMA MÚSICA PRONTA ────────────────────────
    //
    // É o sinal que pega a queda do orquestrador, e o único que não depende
    // de a fila engordar nem de algo falhar. Numa queda do Inngest não há
    // erro em lugar nenhum: só o relógio que para.
    const { data: ultima } = await sb
      .from("musicas")
      .select("gerada_em")
      .not("gerada_em", "is", null)
      .order("gerada_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const minutosSemProntas = ultima?.gerada_em
      ? Math.round((agora - Date.parse(ultima.gerada_em)) / 60000)
      : null;

    const diagnostico = {
      letrasNovas: letrasNovas ?? 0,
      prontasNaJanela: prontasNaJanela ?? 0,
      totalPresas: presas ?? 0,
      falhas,
      minutosSemProntas,
    };
    const veredito = lerOsSinais(diagnostico);

    // ── QUEM JÁ PAGOU E ESTÁ SEM MÚSICA ──────────────────────────
    //
    // Vai no corpo do e-mail porque muda o que o dono faz nos próximos cinco
    // minutos: prévia parada é prejuízo de R$ 0,32; comprador parado é
    // contestação, e foi assim que a queda de 04/09 apareceu.
    let pagosParados = 0;
    if (veredito.avisar) {
      const { data: travadas } = await sb
        .from("musicas")
        .select("id")
        .in("status", ["aguardando", "gerando"]);
      const ids = (travadas ?? []).map((m) => m.id);
      if (ids.length) {
        const { count } = await sb
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("status", "pago")
          .in("musica_id", ids);
        pagosParados = count ?? 0;
      }
    }

    if (!veredito.avisar || !veredito.motivo) {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, alerta: false, ...diagnostico }));
      return;
    }

    // ── UM AVISO POR HORA, NO MÁXIMO ─────────────────────────────
    //
    // Uma queda dura mais que um ciclo de cron. Sem trava, uma pane de uma
    // hora rende seis e-mails idênticos, e o sétimo já não é lido. A trava é
    // o mesmo contador de uso do resto do sistema, com teto 1 na chave da
    // hora — e ela falha ABERTA: se o banco não responder, o alerta sai. Um
    // e-mail repetido é barato; o alerta que não chega é o caro.
    const chave = `alerta-externo:${new Date(agora - 3 * 3600000).toISOString().slice(0, 13)}`;
    let primeira = true;
    try {
      const { data } = await sb.rpc("consumir_limite", {
        p_chave: chave,
        p_janela_s: 7200,
        p_teto: 1,
      });
      primeira = data !== false;
    } catch {
      primeira = true;
    }

    if (primeira && process.env.RESEND_API_KEY) {
      const n =
        veredito.motivo === "orquestrador-mudo"
          ? (minutosSemProntas ?? 0)
          : veredito.motivo === "provedor-recusando"
            ? falhas
            : diagnostico.totalPresas;
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Serenata <contato@serenatagift.com>",
        to: PARA,
        subject: assuntoDoAlerta(veredito.motivo, n),
        html:
          `<p style="font-size:17px"><strong>Pause as campanhas do Google agora.</strong> ` +
          `Enquanto elas rodam, cada lead que entra vira música que não sai.</p>` +
          (pagosParados > 0
            ? `<p style="font-size:17px;color:#b00"><strong>${pagosParados} pessoa(s) JÁ PAGARAM e estão sem música.</strong> ` +
              `Essas não podem esperar: <code>node scratch/socorro-musica.mjs &lt;id&gt;</code> gera por fora do Inngest.</p>`
            : `<p>Ninguém que pagou está parado. O prejuízo até aqui é só de prévia.</p>`) +
          `<hr><p><strong>Quem falou:</strong> o vigia EXTERNO, que roda em Vercel Cron. ` +
          `Ele existe justamente porque o vigia de dentro é um cron do Inngest e fica mudo ` +
          `quando o Inngest cai (foi o que aconteceu em 04/09/2026, por 58 minutos).</p>` +
          `<p><strong>Primeira coisa a checar:</strong> <a href="https://status.inngest.com">status.inngest.com</a>. ` +
          `Se estiver com incidente aberto, não há o que consertar aqui: pause as campanhas, ` +
          `atenda quem pagou na mão e espere.</p>` +
          `<ul>` +
          `<li>sinal: <code>${veredito.motivo}</code></li>` +
          `<li>letras escritas nos últimos ${JANELA_MIN} min: ${diagnostico.letrasNovas}</li>` +
          `<li>músicas prontas no mesmo período: ${diagnostico.prontasNaJanela}</li>` +
          `<li>presas há mais de ${PRESA_MIN} min: ${diagnostico.totalPresas}</li>` +
          `<li>falhas reais: ${falhas}</li>` +
          `<li>última música pronta há: ${minutosSemProntas ?? "nunca"} min</li>` +
          `</ul>`,
      });
    }

    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, alerta: true, avisou: primeira, motivo: veredito.motivo, pagosParados, ...diagnostico }));
  } catch (err) {
    // Erro aqui é do PRÓPRIO vigia. Devolver 500 faz a Vercel registrar a
    // falha do cron, que é o único jeito de o vigia quebrado aparecer.
    console.error("[vigia-externo] falhou:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ erro: String((err as Error)?.message ?? err) }));
  }
}
