// O GERADOR RESERVA: a música nasce mesmo com o Inngest fora do ar.
//
// ── O QUE ACONTECEU ──────────────────────────────────────────────
//
// 09/10/2026, 18h06: o Inngest entrou de novo em "Degraded Function
// Execution" (a mesma falha de 04/09). Aceitava o evento `musica/gerar` com
// 200 e não executava nada. Até ~18h47 nenhuma música ficou pronta; 60+ leads
// olhavam uma prévia que não vinha, e o pagamento só libera com a música
// pronta. O vigia externo gritou às 18h30, mas gritar não gera música: os dois
// compradores parados saíram pelo plantão manual (`scratch/plantao-musica.mjs`).
//
// Duas quedas em cinco semanas: a geração não pode ter um ponto único de
// falha num fornecedor de orquestração.
//
// ── O QUE ISTO FAZ ───────────────────────────────────────────────
//
// Vercel Cron, a cada minuto, fala direto com o banco e com o provedor. Não
// importa nada do Inngest. Para cada música `aguardando`/`gerando` que
// ninguém está tocando (regra em `src/lib/reserva-decisao.ts`):
//   - nunca começou: assume a posse (`reserva_em`), confere o disjuntor e
//     dispara no provedor;
//   - tem task em andamento (do job ou nossa): pergunta ao provedor, grava a
//     prévia e, pronta, guarda e entrega com o MESMO código do job
//     (`inngest/lib/guardar-musica.ts`). Task do job que terminou sem o job
//     ver é terminada daqui, sem pagar outra gravação.
//
// Com o Inngest de pé, nada passa pela regra e esta rota não faz nada.
//
// ── PAGAR DUAS VEZES ─────────────────────────────────────────────
//
// Quando o Inngest volta, ele despeja a fila. O job pula música `pronta` e
// música com `reserva_em` recente (`RESERVA_SEGURA_MIN`), e confere de novo
// antes de cada disparo. Posse se toma com UPDATE condicional no
// `updated_at` lido: se alguém mexeu entre a leitura e a escrita, ninguém
// assume e a próxima volta decide de novo.
//
// ── O QUE NÃO FAZ ────────────────────────────────────────────────
//
// Não redispara evento do Inngest (o vigia externo explica por quê) e não
// mexe em `falhou`: isso é da repescagem. Desistindo, deixa a linha `falhou`
// com o motivo, igual ao job, e avisa os donos se a pessoa já pagou.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { segredoConfere } from "./lib/segredo.js";
import { iniciarGeracao, consultarGeracao, type FaixaGerada } from "../inngest/lib/kie.js";
import { podeGerar } from "../inngest/lib/disjuntor.js";
import { restaurarSeAjusteFalhou } from "../inngest/lib/restaurar-ajuste.js";
import {
  CREDITOS,
  registrarCusto,
  principalEAlternativa,
  guardarFaixas,
  timestampsDaFaixa,
  marcarPronta,
  entregarSeJaPagou,
} from "../inngest/lib/guardar-musica.js";
import { acharGenero, estiloParaSuno } from "../src/lib/generos.js";
import { semOTermo, termoBarrado } from "../src/lib/recusa-provedor.js";
import { avisarDonos } from "../src/lib/avisar-donos.js";
import {
  oQueFazer,
  depoisDaConsulta,
  PARADA_MIN,
  MAX_TENTATIVAS,
  type EstadoDaTask,
} from "../src/lib/reserva-decisao.js";

/** Tempo de trabalho por volta. A função tem 60s e a próxima volta é daqui a um minuto. */
const ORCAMENTO_MS = 45_000;
/** Gerações NOVAS por volta: a fila de uma queda não pode virar rajada no provedor. */
const NOVAS_POR_VOLTA = 15;
/** Só olha o que andou nas últimas 48h: música parada há dias é caso de suporte, não de cron. */
const JANELA_H = 48;

const COLUNAS =
  "id, status, letra, titulo, estilo_suno, genero, quiz_response_id, erro, updated_at, gerada_em, previa_url, task_atual, task_em, reserva_em, reserva_tentativas";

type Linha = {
  id: string;
  status: string;
  letra: string | null;
  titulo: string | null;
  estilo_suno: string | null;
  genero: string | null;
  quiz_response_id: string | null;
  erro: string | null;
  updated_at: string;
  gerada_em: string | null;
  previa_url: string | null;
  task_atual: string | null;
  task_em: string | null;
  reserva_em: string | null;
  reserva_tentativas: number | null;
};

function db(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Mesma porta do vigia externo: a Vercel manda `Authorization: Bearer $CRON_SECRET`. Falha fechada. */
function autorizado(req: IncomingMessage): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const cabecalho = String(req.headers.authorization ?? "");
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : cabecalho;
  return segredoConfere(token, esperado);
}

async function jaPagou(sb: SupabaseClient, quizId: string | null): Promise<boolean> {
  if (!quizId) return false;
  const { data } = await sb.from("pedidos").select("id").eq("quiz_response_id", quizId).eq("status", "pago").limit(1);
  return Boolean(data?.length);
}

/** Assume a posse e dispara uma gravação nova. Devolve o que aconteceu, pro relatório. */
async function gerar(sb: SupabaseClient, m: Linha): Promise<string> {
  if (!m.letra) return "sem letra";
  // Disparo que caiu antes de gravar a task também conta: sem este teto, um
  // provedor fora do ar viraria uma tentativa por minuto.
  if ((m.reserva_tentativas ?? 0) >= MAX_TENTATIVAS) return desistir(sb, m, "provedor não respondeu ao disparo");
  const tentativa = (m.reserva_tentativas ?? 0) + 1;

  // POSSE: só se ninguém mexeu na linha desde a leitura.
  const { data: tomou } = await sb
    .from("musicas")
    .update({ status: "gerando", reserva_em: new Date().toISOString(), reserva_tentativas: tentativa, task_atual: null, task_em: null })
    .eq("id", m.id)
    .eq("updated_at", m.updated_at)
    .in("status", ["aguardando", "gerando"])
    .select("id");
  if (!tomou?.length) return "outro mexeu antes";

  // O disjuntor vale aqui como vale no job: é por música, e quem pagou passa.
  const liberado = await podeGerar(sb, m.quiz_response_id, m.id);
  if (!liberado.ok) {
    await sb
      .from("musicas")
      .update({
        status: "falhou",
        erro: `teto diário de geração atingido (${liberado.teto}/dia) — não gerado antes do pagamento`,
        reserva_em: null,
      })
      .eq("id", m.id);
    return "teto do dia";
  }

  const { data: q } = await sb.from("quiz_responses").select("respostas").eq("id", m.quiz_response_id ?? "").maybeSingle();
  const voz = (q?.respostas as Record<string, string> | null)?.voz ?? "surpresa";

  // Mesmo estilo do job. Na 2ª tentativa, o texto curado do gênero puro e sem
  // o termo que o provedor barrou (o `erro` guarda o motivo da recusa).
  let estilo = estiloParaSuno({ genero: m.genero, estiloDoModelo: m.estilo_suno, voz });
  let letra = m.letra;
  if (tentativa > 1) {
    estilo = acharGenero(m.genero)?.estiloSuno ?? estilo;
    const barrado = termoBarrado(m.erro)?.toLowerCase();
    if (barrado) {
      letra = semOTermo(letra, barrado);
      estilo = semOTermo(estilo, barrado);
    }
  }

  const taskId = await iniciarGeracao({
    letra,
    titulo: m.titulo ?? "Sua música",
    estilo: estilo || m.genero || "música emotiva, arranjo acústico",
    voz,
  });
  await registrarCusto(sb, {
    quizResponseId: m.quiz_response_id,
    musicaId: m.id,
    tipo: "musica",
    creditos: CREDITOS.musica,
    modelo: "V4_5PLUS",
  });
  await sb.from("musicas").update({ task_atual: taskId, task_em: new Date().toISOString() }).eq("id", m.id);
  return `disparou (tentativa ${tentativa})`;
}

async function finalizar(sb: SupabaseClient, m: Linha, faixas: FaixaGerada[]): Promise<string> {
  const taskId = m.task_atual as string;
  // Task do job: toma a posse antes de terminar, pro job que acordar agora não
  // disparar outra. Condição: a mesma task ainda é a da linha.
  if (!m.reserva_em) {
    const { data: tomou } = await sb
      .from("musicas")
      .update({ reserva_em: new Date().toISOString() })
      .eq("id", m.id)
      .eq("task_atual", taskId)
      .neq("status", "pronta")
      .select("id");
    if (!tomou?.length) return "o job terminou antes";
  }
  const { principal, alternativa } = principalEAlternativa(faixas);
  const caminhos = await guardarFaixas(sb, m.id, [principal, alternativa].filter(Boolean) as FaixaGerada[]);
  const timestamps = await timestampsDaFaixa(sb, { taskId, audioId: principal.id, musicaId: m.id, quizResponseId: m.quiz_response_id });
  const timestampsV2 = alternativa
    ? await timestampsDaFaixa(sb, { taskId, audioId: alternativa.id, musicaId: m.id, quizResponseId: m.quiz_response_id })
    : null;
  await marcarPronta(sb, m.id, { caminhos, timestamps, timestampsV2, duracao: principal.duration ?? null, taskId });
  const e = await entregarSeJaPagou(sb, m.id, m.quiz_response_id);
  return e.entregue ? "pronta e entregue" : "pronta";
}

async function desistir(sb: SupabaseClient, m: Linha, motivo: string): Promise<string> {
  if (await restaurarSeAjusteFalhou(sb, m.id)) {
    await sb.from("musicas").update({ task_atual: null, task_em: null, reserva_em: null }).eq("id", m.id);
    return "ajuste restaurado";
  }
  await sb
    .from("musicas")
    .update({ status: "falhou", erro: `gerador reserva: ${motivo}`, task_atual: null, task_em: null, reserva_em: null })
    .eq("id", m.id);
  if (await jaPagou(sb, m.quiz_response_id)) {
    await avisarDonos({
      assunto: `🔴 COMPRADOR sem música: ${m.titulo ?? "sem título"}`,
      html:
        `<p><strong>Alguém pagou e a música não ficou pronta</strong> (gerador reserva, Inngest fora do ar?).</p>` +
        `<p>Título: ${m.titulo ?? "sem título"}<br>Motivo: ${motivo}<br>id: ${m.id}</p>` +
        `<p>Socorro manual: <code>node scratch/socorro-musica.mjs ${m.id}</code></p>`,
    }).catch((err) => console.error("[reserva] aviso falhou:", err));
  }
  return `desistiu: ${motivo}`;
}

async function acompanhar(sb: SupabaseClient, m: Linha, agora: number, novas: { n: number }): Promise<string> {
  const r = await consultarGeracao(m.task_atual as string);
  const prontas = r.faixas.filter((f) => f.audioUrl);
  const estado: EstadoDaTask =
    r.status === "SUCCESS" && prontas.length ? "sucesso" : /FAIL|ERROR/i.test(r.status) ? "falhou" : "andando";

  // A prévia, como no job: a SEGUNDA gravação, que é a que a pessoa recebe.
  const preferida = r.faixas.length > 1 ? r.faixas[1] : r.faixas[0];
  if (preferida?.streamUrl && m.previa_url !== preferida.streamUrl && estado !== "falhou") {
    await sb.from("musicas").update({ previa_url: preferida.streamUrl, previa_em: new Date().toISOString() }).eq("id", m.id);
  }

  const passo = depoisDaConsulta(m, estado, agora);
  if (passo === "finalizar") return finalizar(sb, m, prontas);
  if (passo === "desistir") return desistir(sb, m, estado === "falhou" ? `provedor recusou: ${r.motivo ?? r.status}` : "timeout no provedor");
  if (passo === "gerar") {
    if (novas.n >= NOVAS_POR_VOLTA) return "fila (próxima volta)";
    novas.n++;
    // O motivo da recusa vai no `erro`, que a próxima tentativa lê pra tirar o termo barrado.
    if (estado === "falhou" && r.motivo) await sb.from("musicas").update({ erro: r.motivo }).eq("id", m.id);
    const { data: relida } = await sb.from("musicas").select(COLUNAS).eq("id", m.id).single();
    return gerar(sb, relida as Linha);
  }
  return `esperando (${r.status})`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!autorizado(req)) {
    res.statusCode = 401;
    res.end("nao autorizado");
    return;
  }
  const inicio = Date.now();
  const seco = new URL(req.url ?? "/", "http://x").searchParams.get("seco") === "1";
  const sb = db();

  // UMA volta por minuto: duas voltas sobrepostas disputariam as mesmas linhas.
  if (!seco) {
    const { data: cabe, error } = await sb.rpc("consumir_limite", {
      p_chave: `gerador-reserva:${new Date().toISOString().slice(0, 16)}`,
      p_janela_s: 90,
      p_teto: 1,
    });
    if (!error && cabe === false) {
      res.end(JSON.stringify({ ok: true, pulou: "outra volta rodando" }));
      return;
    }
  }

  const agora = Date.now();
  const desde = new Date(agora - JANELA_H * 3600000).toISOString();
  const parada = new Date(agora - PARADA_MIN * 60000).toISOString();
  const [minhas, paradas] = await Promise.all([
    sb.from("musicas").select(COLUNAS).in("status", ["aguardando", "gerando"]).not("reserva_em", "is", null).limit(200),
    sb
      .from("musicas")
      .select(COLUNAS)
      .in("status", ["aguardando", "gerando"])
      .is("reserva_em", null)
      .gte("updated_at", desde)
      .lte("updated_at", parada)
      .order("updated_at", { ascending: true })
      .limit(200),
  ]);
  if (minhas.error || paradas.error) {
    console.error("[reserva] leitura falhou:", minhas.error?.message ?? paradas.error?.message);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, erro: minhas.error?.message ?? paradas.error?.message }));
    return;
  }

  const linhas = [...(minhas.data ?? []), ...(paradas.data ?? [])] as Linha[];
  const relatorio: Array<{ id: string; decisao: string; resultado?: string }> = [];
  const novas = { n: 0 };
  for (const m of linhas) {
    const decisao = oQueFazer(m, agora);
    if (decisao === "nada") continue;
    if (seco) {
      relatorio.push({ id: m.id, decisao });
      continue;
    }
    if (Date.now() - inicio > ORCAMENTO_MS) {
      relatorio.push({ id: m.id, decisao, resultado: "sem tempo (próxima volta)" });
      continue;
    }
    try {
      let resultado: string;
      if (decisao === "acompanhar") resultado = await acompanhar(sb, m, agora, novas);
      else if (novas.n >= NOVAS_POR_VOLTA) resultado = "fila (próxima volta)";
      else {
        novas.n++;
        resultado = await gerar(sb, m);
      }
      relatorio.push({ id: m.id, decisao, resultado });
    } catch (err) {
      // Uma música que dá erro não para as outras. A próxima volta tenta de novo.
      relatorio.push({ id: m.id, decisao, resultado: `erro: ${(err as Error).message}` });
    }
  }

  // Avisa UMA vez por hora que o reserva está trabalhando: é o sinal de que o
  // Inngest parou, e o dono precisa saber que a fila está sendo atendida.
  const assumidas = relatorio.filter((r) => r.resultado?.startsWith("disparou") || r.resultado?.startsWith("pronta")).length;
  if (!seco && assumidas > 0 && process.env.RESEND_API_KEY) {
    const { data: cabe } = await sb.rpc("consumir_limite", {
      p_chave: `alerta-reserva:${new Date(agora - 3 * 3600000).toISOString().slice(0, 13)}`,
      p_janela_s: 3600,
      p_teto: 1,
    });
    if (cabe !== false) {
      await avisarDonos({
        assunto: `🛟 Gerador reserva assumiu ${assumidas} música(s): o Inngest parou de gerar`,
        html:
          `<p>O gerador reserva (Vercel Cron, fora do Inngest) começou a gerar as músicas que estavam paradas. ` +
          `A fila está sendo atendida; nada a fazer agora. Confira status.inngest.com.</p>` +
          `<pre>${relatorio.map((r) => `${r.id.slice(0, 8)} ${r.decisao} → ${r.resultado}`).join("\n")}</pre>`,
      }).catch((err) => console.error("[reserva] aviso falhou:", err));
    }
  }

  if (relatorio.length) console.log("[reserva]", JSON.stringify(relatorio));
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, seco, olhadas: linhas.length, agiu: relatorio, ms: Date.now() - inicio }));
}
