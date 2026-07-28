import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { registrarCustoLetra, type UsoClaude } from "@/lib/custos";
import { dispararGeracaoMusica } from "@/lib/gerar-letra";
import {
  LETRA_SYSTEM,
  buildUserMessage,
  sanitizeNome,
  type LetraGerada,
} from "@/lib/letra-prompt";

// COAUTORIA DA LETRA — a pessoa constrói a letra junto, não recebe pronta.
//
// É a mecânica mais forte do LoveTune (o concorrente escalado): quando a
// pessoa escolhe e edita, a letra vira DELA também, e pagar é quase
// consequência. Validado com IA real em scratch/testar-coautoria.mjs: os
// dois refrões saem distintos, a letra respeita o refrão escolhido, e o
// aprimorar melhora de verdade. Custo das 3 etapas ~R$ 0,35 — irrelevante
// perto dos R$ 0,32 do Suno.
//
// Nossa versão é enxuta (2 etapas), não as 4 do LoveTune: escolher o REFRÃO
// (a parte que a pessoa canta e relê) + editar livremente com "melhorar com
// IA". Menos esperas, o essencial do que prende.
//
// MUDANÇA no gatilho da música: hoje ela dispara na geração da letra. Aqui
// dispara só no FINALIZAR, porque a letra não é final até a coautoria
// terminar. Continua ANTES do pagamento — a regra do CLAUDE.md se mantém.

const MODEL = "claude-sonnet-5";

type RespClaude = { texto: string; uso: UsoClaude; stopReason: string | null };

// Uma chamada ao Claude, no formato já validado (medir-custo-letra.mjs):
// system cacheável + pedido de JSON no fim. Devolve o texto cru; cada
// chamador parseia o que precisa.
async function chamarClaude(userMsg: string, maxTokens: number): Promise<RespClaude> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ausente no servidor");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { effort: "medium" },
      system: [{ type: "text", text: LETRA_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const texto: string = j.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
  return { texto, uso: (j.usage ?? {}) as UsoClaude, stopReason: j.stop_reason ?? null };
}

// Extrai o primeiro objeto JSON da resposta (o modelo às vezes embrulha em
// texto apesar da instrução).
function extrairJson<T>(texto: string): T {
  const s = texto.indexOf("{");
  const e = texto.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Resposta do modelo não continha JSON");
  return JSON.parse(texto.slice(s, e + 1)) as T;
}

// Acha o quiz_response da sessão pra chavear custo e persistência.
async function quizIdDaSessao(sessionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("quiz_responses")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  return data?.id ?? null;
}

function respostasSanitizadas(respostas: Record<string, unknown>) {
  const nome = sanitizeNome(respostas.nome);
  return { ...respostas, nome: nome || "essa pessoa" };
}

// ── ETAPA 1: dois refrões ────────────────────────────────────────
export type RefroesGerados = { titulo: string; estiloSuno: string; refroes: [string, string] };

export const gerarRefroes = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; respostas: Record<string, unknown> }) => data)
  .handler(async ({ data }): Promise<RefroesGerados> => {
    const userMsg = `${buildUserMessage(respostasSanitizadas(data.respostas))}

Gere DUAS opções de refrão bem diferentes entre si para esta música — uma mais direta e uma mais lírica, cada uma ancorada num detalhe concreto DIFERENTE da história. Cada refrão tem 4 linhas. Dê também um título e o estilo_suno (prompt de estilo pro gerador de música). Responda APENAS com JSON válido: {"titulo","estilo_suno","refroes":["refrão 1","refrão 2"]}`;

    const { texto, uso } = await chamarClaude(userMsg, 1500);
    const p = extrairJson<{ titulo: string; estilo_suno: string; refroes: string[] }>(texto);

    // Custo atribuído à sessão (musicaId ainda não existe).
    await registrarCustoLetra({ quizResponseId: await quizIdDaSessao(data.sessionId), modelo: MODEL, uso });

    const refroes = (p.refroes ?? []).map((s) => String(s).trim()).filter(Boolean);
    if (refroes.length < 2) throw new Error("modelo não devolveu dois refrões");
    return {
      titulo: String(p.titulo ?? "Sua música"),
      estiloSuno: String(p.estilo_suno ?? ""),
      refroes: [refroes[0], refroes[1]],
    };
  });

// ── ETAPA 2: letra inteira a partir do refrão escolhido ──────────
export const montarLetra = createServerFn({ method: "POST" })
  .validator(
    (data: { sessionId: string; respostas: Record<string, unknown>; refrao: string }) => data,
  )
  .handler(async ({ data }): Promise<LetraGerada> => {
    const userMsg = `${buildUserMessage(respostasSanitizadas(data.respostas))}

O REFRÃO já foi escolhido. Use EXATAMENTE este refrão, sem alterar nenhuma palavra, em todas as ocorrências de [Chorus]:

${data.refrao}

Escreva a letra completa ao redor dele (intro curta, versos, ponte, outro) usando as marcações [Short Intro - máx 8s] [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Chorus] [Outro]. Responda APENAS com JSON válido: {"titulo","letra","estilo_suno","verso_destaque"}`;

    const { texto, uso, stopReason } = await chamarClaude(userMsg, 4000);
    if (stopReason === "max_tokens") throw new Error("Letra truncada pelo limite de tokens");
    const p = extrairJson<LetraGerada>(texto);

    await registrarCustoLetra({ quizResponseId: await quizIdDaSessao(data.sessionId), modelo: MODEL, uso });

    return {
      titulo: String(p.titulo ?? "Sua música"),
      letra: String(p.letra ?? ""),
      estilo_suno: String(p.estilo_suno ?? ""),
      verso_destaque: String(p.verso_destaque ?? ""),
    };
  });

// ── ETAPA 2b (opcional): aprimorar a letra editada ───────────────
export const aprimorarLetra = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; letra: string }) => data)
  .handler(async ({ data }): Promise<{ letra: string }> => {
    const userMsg = `Aqui está uma letra de música. Melhore-a: deixe as imagens mais concretas, corte qualquer clichê, ajuste o ritmo das linhas. MANTENHA a estrutura (as marcações [Verse], [Chorus] etc) e o refrão exatamente como estão. Responda APENAS com JSON válido: {"letra"}

${data.letra}`;

    const { texto, uso, stopReason } = await chamarClaude(userMsg, 4000);
    if (stopReason === "max_tokens") throw new Error("Letra truncada pelo limite de tokens");
    const p = extrairJson<{ letra: string }>(texto);

    await registrarCustoLetra({ quizResponseId: await quizIdDaSessao(data.sessionId), modelo: MODEL, uso });

    const letra = String(p.letra ?? "").trim();
    if (!letra) throw new Error("aprimorar não devolveu letra");
    return { letra };
  });

// ── ETAPA 3: finalizar — persiste a letra FINAL e dispara a música ─
// A `letra` aqui é a versão definitiva (escolhida + editada). É a única que
// vira música, então é a fonte de verdade daqui pra frente.
export const finalizarLetra = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionId: string;
      respostas: Record<string, unknown>;
      letra: string;
      titulo: string;
      estiloSuno: string;
      versoDestaque: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<{ musicaId: string | null; statusMusica: string }> => {
    const db = supabaseAdmin();
    const quizId = await quizIdDaSessao(data.sessionId);
    if (!quizId) {
      console.error("[coautoria] sessão sem quiz_response; letra não persistida", data.sessionId);
      return { musicaId: null, statusMusica: "aguardando" };
    }

    // Idempotência: se já existe música pra esta sessão, NÃO dispara de novo
    // (cada geração custa R$ 0,32). Cobre o duplo-clique no "está pronta".
    const { data: existente } = await db
      .from("musicas")
      .select("id, status")
      .eq("quiz_response_id", quizId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente) {
      return { musicaId: existente.id, statusMusica: existente.status ?? "aguardando" };
    }

    const { data: inserida, error } = await db
      .from("musicas")
      .insert({
        quiz_response_id: quizId,
        token: crypto.randomUUID().replace(/-/g, "").slice(0, 22),
        status: "aguardando" as const,
        titulo: data.titulo,
        letra: data.letra,
        estilo_suno: data.estiloSuno,
        verso_destaque: data.versoDestaque,
        genero: String(data.respostas.estilo ?? ""),
      })
      .select("id")
      .single();
    if (error || !inserida) {
      console.error("[coautoria] falha ao salvar musica:", error);
      return { musicaId: null, statusMusica: "aguardando" };
    }

    // GATILHO: a música começa a gerar AGORA, com a letra final. Ainda antes
    // do pagamento.
    await dispararGeracaoMusica(inserida.id);
    return { musicaId: inserida.id, statusMusica: "aguardando" };
  });
