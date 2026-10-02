// O CRON DO RESUMO DIÁRIO DO FUNIL (02/10/2026).
//
// De hora em hora, fecha os dias que faltam em `painel_eventos_dia` e refaz os
// recentes (`diasAFazer`). Depois do deploy, o histórico inteiro se completa
// sozinho em poucas horas, sem script e sem chave na máquina de ninguém.
//
// Roda nos DOIS projetos da Vercel (o `vercel.json` é um só), e cada um
// escreve no próprio banco.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { segredoConfere } from "./lib/segredo.js";
import { filtroCursor, lerJanela } from "../src/lib/ler-janela.js";
import {
  diaBr,
  diasAFazer,
  type EventosResumo,
  type LeadSessao,
  type LinhaResumoDia,
  type PedidoVenda,
} from "../src/lib/painel-resumo.js";
import { fecharDias } from "../src/lib/painel-fechar.js";

/** Depois disso não começa dia novo; a função tem 300s. */
const PRAZO_MS = 200_000;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function autorizado(req: IncomingMessage): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const cabecalho = String(req.headers.authorization ?? "");
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : cabecalho;
  return segredoConfere(token, esperado);
}

function responder(res: ServerResponse, status: number, corpo: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(corpo));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!autorizado(req)) return responder(res, 401, { erro: "nao autorizado" });

  try {
    const sb = db();

    // O primeiro dia com evento neste banco (Serenata: julho; Ballad: 29/09).
    const { data: primeiro, error: erroPrimeiro } = await sb
      .from("funnel_events")
      .select("created_at")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (erroPrimeiro) throw new Error(erroPrimeiro.message);
    if (!primeiro) return responder(res, 200, { feitos: 0, falhas: [], pendentes: 0 });

    // O que já existe. Mais de 1000 linhas depois de um ano: pagina.
    const linhas: LinhaResumoDia[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb
        .from("painel_eventos_dia")
        .select("dia, filtro, atualizado_em")
        .order("dia")
        .order("filtro")
        .range(de, de + 999);
      if (error) throw new Error(error.message);
      linhas.push(...((data ?? []) as LinhaResumoDia[]));
      if ((data ?? []).length < 1000) break;
    }

    const agora = Date.now();
    const dias = diasAFazer(linhas, diaBr(Date.parse(String(primeiro.created_at))), agora);

    const lerDaJanela =
      <T extends { id: string; created_at: string }>(tabela: string, colunas: string) =>
      (f: { inicio: Date; fim: Date }) =>
        lerJanela<T>(
          ({ desde, ate, cursor, limite }) => {
            const base = sb
              .from(tabela)
              .select(colunas)
              .gte("created_at", desde)
              .lt("created_at", ate);
            const comCursor = cursor ? base.or(filtroCursor(cursor)) : base;
            return comCursor.order("created_at").order("id").limit(limite) as never;
          },
          f.inicio,
          f.fim,
        );

    const relatorio = await fecharDias(
      {
        agora: () => Date.now(),
        lerLeads: lerDaJanela<LeadSessao & { created_at: string }>(
          "quiz_responses",
          "id, session_id, locale, created_at",
        ),
        lerPedidos: lerDaJanela<PedidoVenda & { id: string; created_at: string }>(
          "pedidos",
          "id, quiz_response_id, status, dinheiro_entrou, created_at",
        ),
        resumir: async (f, filtro, sessoesVenda) => {
          const { data, error } = await sb.rpc("admin_eventos_resumo", {
            p_desde: f.inicio.toISOString(),
            p_ate: f.fim.toISOString(),
            p_filtro: filtro,
            p_sessoes_venda: sessoesVenda,
          });
          if (error) throw new Error(error.message);
          return data as EventosResumo;
        },
        gravar: async (dia, filtro, resumo) => {
          const { error } = await sb
            .from("painel_eventos_dia")
            .upsert(
              { dia, filtro, resumo, atualizado_em: new Date().toISOString() },
              { onConflict: "dia,filtro" },
            );
          if (error) throw new Error(error.message);
        },
      },
      dias,
      PRAZO_MS,
    );

    for (const f of relatorio.falhas) console.error(`[painel-resumo] ${f.dia} falhou: ${f.erro}`);
    console.log(
      `[painel-resumo] feitos ${relatorio.feitos.length} · falhas ${relatorio.falhas.length} · pendentes ${relatorio.pendentes.length}`,
    );
    return responder(res, 200, {
      feitos: relatorio.feitos.length,
      falhas: relatorio.falhas,
      pendentes: relatorio.pendentes.length,
    });
  } catch (e) {
    console.error("[painel-resumo] falhou:", e);
    return responder(res, 500, { erro: e instanceof Error ? e.message : String(e) });
  }
}
