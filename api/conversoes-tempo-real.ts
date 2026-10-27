// A VENDA VAI PRO GOOGLE NO MINUTO EM QUE É PAGA (27/10).
//
// Vercel Cron a cada minuto, nas duas marcas, falando direto com o banco e com
// a Data Manager API (`api/lib/google-dm.ts`). Por que um vigia e não uma
// chamada dentro de cada webhook: a venda vira `pago` por oito portas (Asaas,
// Woovi, Stripe, dLocal, Perfect Pay, Cakto, vigia de pagamento, crédito na
// hora do upsell) e qualquer uma esquecida seria venda que o lance nunca vê.
// Aqui a regra é uma só: pedido pago que ainda não subiu, sobe.
//
// Por que fora do Inngest: é o mesmo motivo do vigia externo. Duas quedas do
// Inngest em cinco semanas; a venda continua acontecendo nelas.
//
// ── O ESTADO MORA NO PEDIDO ──────────────────────────────────────
//
// `pedidos.google_conversao`:
//   null         ainda não olhado
//   enviado      o Google recebeu, resultado em processamento (`_req`)
//   confirmado   o Google processou o envio sem erro
//   recusado     o envio inteiro falhou do lado deles
//   parcial      parte do envio falhou (o detalhe vai no aviso)
//   sem_clique   não veio de clique do Google (TikTok, orgânico, e-mail…)
//   sem_valor    sem valor ou sem data de pagamento
//
// ── A LISTA DA MADRUGADA CONTINUA ────────────────────────────────
//
// Na Serenata a mesma ação recebe a lista diária (`api/conversoes.ts`). As
// duas mandam o id do pedido (`transactionId` aqui, `Order ID` lá) e o Google
// deduplica por ele: a lista vira reserva do que falhar aqui.
//
// `?seco=1` (com o CRON_SECRET) mostra o que faria sem mandar nada.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { segredoConfere } from "./lib/segredo.js";
import { configDm, enviarEventos, statusDoEnvio } from "./lib/google-dm.js";
import { emailNormalizado, eventoDoPedido, type EventoGoogle } from "../src/lib/conversao-servidor.js";
import { avisarDonos } from "../src/lib/avisar-donos.js";
import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";

/** Venda paga há mais que isto não é mais "tempo real": a lista (ou ninguém) cuida. */
const JANELA_H = 72;
/** Pedidos por volta. Uma volta por minuto dá folga de sobra pro pico. */
const POR_VOLTA = 500;
/** Antes disto o Google ainda está processando o envio. */
const CONFERIR_DEPOIS_MIN = 5;

type Linha = {
  id: string;
  paid_at: string | null;
  valor_centavos: number | null;
  gateway: string | null;
  email: string | null;
  quiz_responses: { attribution: Record<string, unknown> | null } | null;
};

function db(): SupabaseClient {
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

function hashEmail(email: string | null): string | null {
  const e = emailNormalizado(email);
  return e ? createHash("sha256").update(e).digest("hex") : null;
}

/** Aviso aos donos no máximo 1x por hora por motivo. */
async function avisarUmaVez(sb: SupabaseClient, motivo: string, assunto: string, html: string) {
  try {
    const hora = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 13);
    const { data: cabe } = await sb.rpc("consumir_limite", {
      p_chave: `conversao-google:${motivo}:${hora}`,
      p_janela_s: 3600,
      p_teto: 1,
    });
    if (cabe === false) return;
    await avisarDonos({ assunto: `${MARCA_ATIVA.nome}: ${assunto}`, html });
  } catch (err) {
    console.error("[conversoes-tempo-real] aviso falhou:", (err as Error).message);
  }
}

async function marcar(sb: SupabaseClient, ids: string[], campos: Record<string, unknown>, deEstado: string | null) {
  for (let i = 0; i < ids.length; i += 100) {
    let q = sb.from("pedidos").update(campos).in("id", ids.slice(i, i + 100));
    q = deEstado === null ? q.is("google_conversao", null) : q.eq("google_conversao", deEstado);
    const { error } = await q;
    if (error) throw new Error(`gravar ${String(campos.google_conversao)}: ${error.message}`);
  }
}

/** Confere o resultado dos envios de 5+ minutos atrás. */
async function conferir(sb: SupabaseClient): Promise<Record<string, number>> {
  const ate = new Date(Date.now() - CONFERIR_DEPOIS_MIN * 60000).toISOString();
  const { data } = await sb
    .from("pedidos")
    .select("google_conversao_req")
    .eq("google_conversao", "enviado")
    .lte("google_conversao_em", ate)
    .gte("google_conversao_em", new Date(Date.now() - JANELA_H * 3600000).toISOString())
    .limit(300);
  const reqs = [...new Set((data ?? []).map((l) => l.google_conversao_req as string | null).filter(Boolean))].slice(0, 10) as string[];
  const conta: Record<string, number> = {};
  for (const req of reqs) {
    const s = await statusDoEnvio(req);
    conta[s.estado] = (conta[s.estado] ?? 0) + 1;
    const novo = s.estado === "SUCCESS" ? "confirmado" : s.estado === "PARTIAL_SUCCESS" ? "parcial" : /FAIL/.test(s.estado) ? "recusado" : null;
    if (!novo) continue;
    await sb.from("pedidos").update({ google_conversao: novo }).eq("google_conversao_req", req).eq("google_conversao", "enviado");
    if (novo !== "confirmado") {
      await avisarUmaVez(
        sb,
        "resultado",
        `o Google ${novo === "parcial" ? "recusou parte" : "recusou"} de um envio de vendas`,
        `<p>Envio <code>${req}</code>: ${s.estado}.</p><pre>${s.detalhe.replace(/</g, "&lt;")}</pre>` +
          `<p>A lista da madrugada continua mandando as mesmas vendas (Serenata). Conferir com <code>node scratch/_dm-status.mjs ${req}</code>.</p>`,
      );
    }
  }
  return conta;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  if (!autorizado(req)) {
    res.statusCode = 401;
    res.end(JSON.stringify({ ok: false }));
    return;
  }
  const cfg = configDm();
  if (!cfg) {
    res.end(JSON.stringify({ ok: true, desligado: true }));
    return;
  }
  const seco = new URL(req.url ?? "/", "http://x").searchParams.get("seco") === "1";
  const sb = db();
  const agora = Date.now();

  const { data, error } = await sb
    .from("pedidos")
    .select("id, paid_at, valor_centavos, gateway, email, quiz_responses(attribution)")
    .eq("status", "pago")
    // Crédito resgatado não é dinheiro novo (a mesma regra da lista).
    .not("dinheiro_entrou", "is", false)
    .is("google_conversao", null)
    .gte("paid_at", new Date(agora - JANELA_H * 3600000).toISOString())
    .order("paid_at", { ascending: true })
    .limit(POR_VOLTA);
  if (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, erro: error.message }));
    return;
  }

  const eventos: EventoGoogle[] = [];
  const pulados: Record<"sem_clique" | "sem_valor", string[]> = { sem_clique: [], sem_valor: [] };
  for (const p of (data ?? []) as unknown as Linha[]) {
    const r = eventoDoPedido(
      { id: p.id, paid_at: p.paid_at, valor_centavos: p.valor_centavos, gateway: p.gateway, attribution: p.quiz_responses?.attribution ?? null },
      agora,
      hashEmail(p.email),
    );
    if ("evento" in r) eventos.push(r.evento);
    else pulados[r.pula].push(p.id);
  }

  if (seco) {
    res.end(JSON.stringify({ ok: true, seco, sobe: eventos.length, sem_clique: pulados.sem_clique.length, sem_valor: pulados.sem_valor.length, amostra: eventos.slice(0, 3).map((e) => ({ ...e, userData: e.userData ? "hash" : undefined })) }));
    return;
  }

  let envio: { ok: boolean; requestId?: string; erro?: string } = { ok: true };
  if (eventos.length) {
    envio = await enviarEventos(cfg, eventos);
    if (envio.ok && envio.requestId) {
      await marcar(sb, eventos.map((e) => e.transactionId), { google_conversao: "enviado", google_conversao_em: new Date().toISOString(), google_conversao_req: envio.requestId }, null);
    } else {
      // Não marca: a próxima volta tenta de novo. Só avisa se está parado há um tempo.
      const maisVelha = Date.parse(eventos[0].eventTimestamp);
      if (agora - maisVelha > 20 * 60000) {
        await avisarUmaVez(
          sb,
          "envio",
          "as vendas não estão subindo pro Google",
          `<p>${eventos.length} venda(s) esperando, a mais antiga paga há ${Math.round((agora - maisVelha) / 60000)} min.</p><pre>${String(envio.erro).replace(/</g, "&lt;")}</pre>`,
        );
      }
    }
  }
  const agoraIso = new Date().toISOString();
  for (const motivo of ["sem_clique", "sem_valor"] as const) {
    if (pulados[motivo].length) await marcar(sb, pulados[motivo], { google_conversao: motivo, google_conversao_em: agoraIso }, null);
  }

  let resultados: Record<string, number> = {};
  try {
    resultados = await conferir(sb);
  } catch (err) {
    console.error("[conversoes-tempo-real] conferência falhou:", (err as Error).message);
  }

  const resumo = { ok: true, enviados: envio.ok ? eventos.length : 0, erro: envio.ok ? undefined : envio.erro, sem_clique: pulados.sem_clique.length, sem_valor: pulados.sem_valor.length, conferidos: resultados, ms: Date.now() - agora };
  if (eventos.length || !envio.ok) console.log("[conversoes-tempo-real]", JSON.stringify(resumo));
  res.end(JSON.stringify(resumo));
}
