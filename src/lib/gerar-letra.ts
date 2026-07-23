import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { registrarCustoLetra, type UsoClaude } from "@/lib/custos";
import {
  LETRA_SYSTEM,
  buildUserMessage,
  sanitizeNome,
  type LetraGerada,
} from "@/lib/letra-prompt";

// Geração da letra via Claude Sonnet 5. Roda no servidor (createServerFn):
// a chave nunca vai pro cliente. Custo medido ~R$ 0,06/letra numa tacada.
//
// Chamada por fetch na forma que já validamos (medir-custo-letra.mjs), pra
// não depender de detalhes de versão do SDK. Pede JSON no prompt e parseia —
// robusto e sob nosso controle.

const MODEL = "claude-sonnet-5";

// A letra vem acompanhada do id da música, pra o reveal saber o que acompanhar.
export type LetraComMusica = LetraGerada & {
  musicaId: string | null;
  statusMusica: string;
};

// Geração crua (sem persistência). Uso interno — o funil chama
// `obterOuGerarLetra`, que salva, reaproveita e registra o custo.
// Devolve o `uso` de tokens junto: sem isso o painel não sabe o custo real.
const gerarLetra = createServerFn({ method: "POST" })
  .validator((data: { respostas: Record<string, unknown> }) => data)
  .handler(async ({ data }): Promise<LetraGerada & { uso: UsoClaude }> => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY ausente no servidor");

    // Sanitiza o nome no CÓDIGO também, não só no prompt (bug da Cantoria).
    const nome = sanitizeNome(data.respostas.nome);
    const respostas = { ...data.respostas, nome: nome || "essa pessoa" };
    const userMsg = buildUserMessage(respostas);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        // 2000 cortava a letra no meio da última linha (bug visto em produção:
        // a música terminava em "tá tudo d"). Uma letra completa em JSON gasta
        // ~1.400 tokens; 4000 dá folga sem custo relevante (só paga o que usa).
        max_tokens: 4000,
        output_config: { effort: "medium" },
        // System cacheável (prefixo estável).
        system: [{ type: "text", text: LETRA_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `${userMsg}

Escreva a letra completa no formato do sistema. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, com as chaves: "titulo", "letra", "estilo_suno" (prompt de estilo pro gerador de música), "verso_destaque" (as duas linhas mais fortes).`,
          },
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Anthropic ${r.status}: ${txt.slice(0, 300)}`);
    }
    const j = await r.json();
    const text: string = j.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";

    // Truncou por limite de tokens: falhe alto em vez de entregar uma música
    // cortada no meio da última linha (foi o que aconteceu em produção).
    if (j.stop_reason === "max_tokens") {
      throw new Error("Letra truncada pelo limite de tokens");
    }

    // Extrai o primeiro objeto JSON da resposta.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("Resposta do modelo não continha JSON");
    }
    const parsed = JSON.parse(text.slice(start, end + 1)) as LetraGerada;
    return {
      titulo: String(parsed.titulo ?? "Sua música"),
      letra: String(parsed.letra ?? ""),
      estilo_suno: String(parsed.estilo_suno ?? ""),
      verso_destaque: String(parsed.verso_destaque ?? ""),
      uso: (j.usage ?? {}) as UsoClaude,
    };
  });

// ─────────────────────────────────────────────────────────────────
// Obtém a letra da sessão: devolve a JÁ SALVA se existir, gera e salva
// se não existir.
//
// Por que isso é crítico: a geração é não-determinística — duas chamadas com
// a mesma história produzem letras DIFERENTES. Sem persistir, a pessoa lia a
// letra A e a música seria gerada da letra B (aconteceu num teste real, e é
// exatamente a promessa quebrada que mata a confiança no produto).
//
// A letra salva é a fonte de verdade daqui pra frente: é ela que vira música.
export const obterOuGerarLetra = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionId: string;
      respostas: Record<string, unknown>;
      refazer?: boolean;
    }) => data,
  )
  .handler(async ({ data }): Promise<LetraComMusica> => {
    const db = supabaseAdmin();

    // Acha o lead desta sessão (criado pela captura parcial do quiz).
    const { data: qr } = await db
      .from("quiz_responses")
      .select("id")
      .eq("session_id", data.sessionId)
      .maybeSingle();

    // Já existe letra pra esta sessão? Devolve a mesma (a não ser que a
    // pessoa tenha pedido explicitamente pra refazer).
    if (qr?.id && !data.refazer) {
      const { data: existente } = await db
        .from("musicas")
        .select("id, status, titulo, letra, estilo_suno, verso_destaque")
        .eq("quiz_response_id", qr.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existente?.letra) {
        return {
          titulo: existente.titulo ?? "Sua música",
          letra: existente.letra,
          estilo_suno: existente.estilo_suno ?? "",
          verso_destaque: existente.verso_destaque ?? "",
          musicaId: existente.id,
          statusMusica: existente.status ?? "aguardando",
        };
      }
    }

    // `uso` fica só no servidor (vai pra tabela de custos, não pro cliente).
    const { uso, ...nova } = await gerarLetra({ data: { respostas: data.respostas } });

    // Persiste. Sem lead gravado (caso raro), entrega a letra mesmo assim:
    // melhor uma letra não salva do que erro na cara da pessoa.
    if (qr?.id) {
      const registro = {
        quiz_response_id: qr.id,
        token: crypto.randomUUID().replace(/-/g, "").slice(0, 22),
        status: "aguardando" as const,
        titulo: nova.titulo,
        letra: nova.letra,
        estilo_suno: nova.estilo_suno,
        verso_destaque: nova.verso_destaque,
        genero: String(data.respostas.estilo ?? ""),
      };
      const { data: inserida, error } = await db
        .from("musicas")
        .insert(registro)
        .select("id")
        .single();
      if (error) {
        console.error("[letra] falha ao salvar musica:", error);
      } else {
        await registrarCustoLetra({
          quizResponseId: qr.id,
          musicaId: inserida.id,
          modelo: MODEL,
          uso,
        });
        // GATILHO: a música começa a gerar AGORA, enquanto a pessoa lê a
        // letra — não no pagamento. É a mudança arquitetural do PLANO.
        await dispararGeracaoMusica(inserida.id);
        return { ...nova, musicaId: inserida.id, statusMusica: "aguardando" };
      }
    } else {
      console.error("[letra] sessão sem quiz_response; letra não persistida", data.sessionId);
    }

    return { ...nova, musicaId: null, statusMusica: "aguardando" };
  });

// Envia o evento pro Inngest por HTTP, em vez de importar o SDK: assim o
// pacote `inngest` não é arrastado para o bundle do cliente.
async function dispararGeracaoMusica(musicaId: string): Promise<void> {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  if (!eventKey) {
    console.error("[musica] INNGEST_EVENT_KEY ausente; geração não disparada");
    return;
  }
  try {
    const r = await fetch(`https://inn.gs/e/${eventKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "musica/gerar", data: { musicaId } }),
    });
    if (!r.ok) console.error("[musica] evento recusado:", r.status, await r.text());
  } catch (err) {
    // Falha aqui não pode derrubar a entrega da letra.
    console.error("[musica] falha ao disparar geração:", err);
  }
}

// Status da música desta sessão — o reveal faz polling nisto pra trocar a
// espera pelo player quando ficar pronta.
export const statusMusica = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<{
      status: string;
      audioUrl: string | null;
      timestamps: Array<{ word: string; start: number; end: number }> | null;
      titulo: string | null;
    }> => {
      const db = supabaseAdmin();
      const { data: qr } = await db
        .from("quiz_responses")
        .select("id")
        .eq("session_id", data.sessionId)
        .maybeSingle();
      if (!qr?.id) return { status: "aguardando", audioUrl: null, timestamps: null, titulo: null };

      const { data: m } = await db
        .from("musicas")
        .select("status, audio_path, timestamps, titulo")
        .eq("quiz_response_id", qr.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!m) return { status: "aguardando", audioUrl: null, timestamps: null, titulo: null };

      // Bucket é privado: a URL é assinada e temporária, gerada no servidor.
      let audioUrl: string | null = null;
      if (m.status === "pronta" && m.audio_path) {
        const { data: assinada } = await db.storage
          .from("musicas")
          .createSignedUrl(m.audio_path, 60 * 60);
        audioUrl = assinada?.signedUrl ?? null;
      }
      return {
        status: m.status,
        audioUrl,
        timestamps: (m.timestamps as Array<{ word: string; start: number; end: number }>) ?? null,
        titulo: m.titulo,
      };
    },
  );
