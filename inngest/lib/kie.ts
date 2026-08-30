// Cliente do provedor de música (Suno via kie.ai).
//
// Isolado de propósito: o PLANO exige DOIS provedores com failover testado.
// Quando entrar o segundo (sunoapi.org ou Apiframe), ele implementa esta
// mesma interface e o job não muda.

const BASE = "https://api.kie.ai";

function chave(): string {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error("KIE_API_KEY ausente");
  return k;
}

async function api<T = unknown>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${chave()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const j = (await r.json()) as { code?: number; msg?: string; data?: T };
  if (!r.ok || (j.code && j.code !== 200)) {
    throw new Error(`kie ${j.code ?? r.status}: ${j.msg ?? "erro"}`);
  }
  return j.data as T;
}

export type FaixaGerada = {
  id: string;
  audioUrl: string;
  duration?: number;
  /** Stream tocável, disponível ~30s ANTES do `audioUrl`. Ver `consultarGeracao`. */
  streamUrl?: string | null;
};

/** Dispara a geração. Devolve o taskId pra fazer polling. */
export async function iniciarGeracao(args: {
  letra: string;
  titulo: string;
  estilo: string;
  voz?: "feminina" | "masculina" | "surpresa" | string;
}): Promise<string> {
  const vocalGender =
    args.voz === "feminina" ? "f" : args.voz === "masculina" ? "m" : undefined;
  const data = await api<{ taskId: string }>("/api/v1/generate", {
    method: "POST",
    body: JSON.stringify({
      prompt: args.letra,
      customMode: true,
      instrumental: false,
      model: "V4_5PLUS",
      title: args.titulo.slice(0, 80),
      style: args.estilo.slice(0, 190),
      ...(vocalGender ? { vocalGender } : {}),
      // O kie exige o campo; usamos polling, então não precisa ser real.
      callBackUrl: "https://example.com/ignorado",
    }),
  });
  return data.taskId;
}

/**
 * Consulta o estado da task. `pronta` só quando há faixa com áudio.
 *
 * O MOTIVO da recusa vem junto (`errorCode`/`errorMessage`) e estava sendo
 * descartado: quando cinco músicas morreram numa noite, tudo que sobrava no
 * banco era "provedor recusou a geração", que não diz se foi letra barrada
 * por moderação, limite de fila ou crédito. Sem o motivo, todo diagnóstico
 * vira chute — e foi exatamente o que aconteceu.
 */
export async function consultarGeracao(
  taskId: string,
): Promise<{ status: string; faixas: FaixaGerada[]; motivo: string | null }> {
  const data = await api<{
    status: string;
    errorCode?: number | string | null;
    errorMessage?: string | null;
    response?: {
      sunoData?: Array<{
        id: string;
        audioUrl: string;
        duration?: number;
        // ── A URL QUE CHEGA PRIMEIRO ─────────────────────────────
        //
        // Medido em 30/08: `streamAudioUrl` aparece aos 22-32s e JÁ serve
        // áudio tocável (118s de música baixados no instante); `audioUrl`, o
        // MP3 final, só aos 57-74s. Ignorar este campo era o motivo de a
        // nossa espera ser 4x a do concorrente.
        streamAudioUrl?: string;
        sourceStreamAudioUrl?: string;
      }>;
    };
  }>(`/api/v1/generate/record-info?taskId=${taskId}`);
  const faixas = (data.response?.sunoData ?? []).map((f) => ({
    id: f.id,
    audioUrl: f.audioUrl,
    duration: f.duration,
    // O da kie.ai primeiro: o do Suno (`sourceStreamAudioUrl`) às vezes
    // recusa requisição sem navegador, e os dois entregam o mesmo áudio.
    streamUrl: f.streamAudioUrl ?? f.sourceStreamAudioUrl ?? null,
  }));
  const motivo = [data.errorCode, data.errorMessage].filter(Boolean).join(" · ") || null;
  return { status: data.status, faixas, motivo };
}

/** Letra com timestamps — é o que torna o karaokê REAL (0,5 crédito). */
export async function obterTimestamps(
  taskId: string,
  audioId: string,
): Promise<Array<{ word: string; start: number; end: number }>> {
  const data = await api<{
    alignedWords?: Array<{ word: string; startS?: number; endS?: number }>;
  }>("/api/v1/generate/get-timestamped-lyrics", {
    method: "POST",
    body: JSON.stringify({ taskId, audioId }),
  });
  return (data.alignedWords ?? []).map((w) => ({
    word: w.word,
    start: w.startS ?? 0,
    end: w.endS ?? 0,
  }));
}
