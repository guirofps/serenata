import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { iniciarGeracao, consultarGeracao, obterTimestamps } from "../lib/kie.js";

// Job de geração da música. Portado de scratch/pipeline-completo.mjs, que já
// rodou de ponta a ponta na mão (3 músicas aprovadas).
//
// MUDANÇA ARQUITETURAL (do PLANO): dispara na CONCLUSÃO DO QUIZ, não no
// webhook de pagamento. Assim nunca se cobra por algo que não existe: se o
// provedor falhar, o prejuízo é R$ 0,32 pré-venda em vez de reembolso.
//
// Passos separados de propósito: o Inngest reexecuta só o que falhou.

const bucket = "musicas";

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente no job");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const gerarMusica = inngest.createFunction(
  {
    id: "gerar-musica",
    // Teto do plano atual do Inngest é 5 — subir aqui faz o registro do app
    // ser recusado inteiro (visto no deploy). Aumentar junto com o plano.
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: "musica/gerar" }],
  },
  async ({ event, step }) => {
    const musicaId = event.data?.musicaId as string;
    if (!musicaId) throw new Error("evento sem musicaId");

    // ─── 1. Carrega a letra JÁ SALVA e marca como gerando ──────────
    // A letra salva é a fonte de verdade: é a que a pessoa leu.
    const musica = await step.run("carregar-letra", async () => {
      const sb = db();
      const { data, error } = await sb
        .from("musicas")
        .select("id, status, letra, titulo, estilo_suno, genero, quiz_response_id")
        .eq("id", musicaId)
        .single();
      if (error) throw new Error(`musica não encontrada: ${error.message}`);
      if (!data.letra) throw new Error("musica sem letra");
      // Idempotência: se já está pronta, não gera de novo (não queima crédito).
      if (data.status === "pronta") return { ...data, jaPronta: true };
      await sb.from("musicas").update({ status: "gerando" }).eq("id", musicaId);
      return { ...data, jaPronta: false };
    });

    if (musica.jaPronta) return { pulado: "já estava pronta" };

    // Voz escolhida no quiz (fica nas respostas do lead).
    const voz = await step.run("ler-voz", async () => {
      const sb = db();
      const { data } = await sb
        .from("quiz_responses")
        .select("respostas")
        .eq("id", musica.quiz_response_id)
        .maybeSingle();
      return (data?.respostas as Record<string, string> | null)?.voz ?? "surpresa";
    });

    // ─── 2. Dispara no provedor ────────────────────────────────────
    const taskId = await step.run("iniciar-geracao", () =>
      iniciarGeracao({
        letra: musica.letra,
        titulo: musica.titulo ?? "Sua música",
        estilo: musica.estilo_suno ?? musica.genero ?? "",
        voz,
      }),
    );

    // ─── 3. Polling ────────────────────────────────────────────────
    // Medido: 84s a 163s. Damos folga de 6 minutos antes de desistir.
    let faixas: Array<{ id: string; audioUrl: string; duration?: number }> = [];
    for (let tentativa = 0; tentativa < 36; tentativa++) {
      const r = await step.run(`consultar-${tentativa}`, () => consultarGeracao(taskId));
      if (r.status === "SUCCESS" && r.faixas.length) {
        faixas = r.faixas;
        break;
      }
      if (/FAIL|ERROR/i.test(r.status)) throw new Error(`provedor falhou: ${r.status}`);
      await step.sleep(`espera-${tentativa}`, "10s");
    }

    if (!faixas.length) {
      await step.run("marcar-timeout", async () => {
        await db()
          .from("musicas")
          .update({ status: "falhou", erro: "timeout no provedor" })
          .eq("id", musicaId);
      });
      throw new Error("timeout esperando a música");
    }

    // ─── 4. Baixa e guarda no Storage ──────────────────────────────
    // As URLs do kie.ai são TEMPORÁRIAS: sem isso, a música do cliente some.
    const caminhos = await step.run("guardar-audio", async () => {
      const sb = db();
      const salvos: string[] = [];
      for (let i = 0; i < Math.min(2, faixas.length); i++) {
        const resp = await fetch(faixas[i].audioUrl);
        if (!resp.ok) throw new Error(`download falhou: ${resp.status}`);
        const buf = new Uint8Array(await resp.arrayBuffer());
        const caminho = `${musicaId}/v${i + 1}.mp3`;
        const { error } = await sb.storage
          .from(bucket)
          .upload(caminho, buf, { contentType: "audio/mpeg", upsert: true });
        if (error) throw new Error(`upload falhou: ${error.message}`);
        salvos.push(caminho);
      }
      return salvos;
    });

    // ─── 5. Timestamps (karaokê real) ──────────────────────────────
    // Tolerante a falha: sem timestamps a música ainda toca, só sem destaque.
    const timestamps = await step.run("timestamps", async () => {
      try {
        return await obterTimestamps(taskId, faixas[0].id);
      } catch (err) {
        console.error("[musica] timestamps falharam:", err);
        return null;
      }
    });

    // ─── 6. Fecha ──────────────────────────────────────────────────
    await step.run("marcar-pronta", async () => {
      const sb = db();
      const { error } = await sb
        .from("musicas")
        .update({
          status: "pronta",
          audio_path: caminhos[0] ?? null,
          audio_path_v2: caminhos[1] ?? null,
          timestamps,
          duracao_s: faixas[0].duration ?? null,
          provider: "kie.ai",
          provider_job_id: taskId,
          gerada_em: new Date().toISOString(),
          erro: null,
        })
        .eq("id", musicaId);
      if (error) throw new Error(`update final falhou: ${error.message}`);
    });

    return { musicaId, taskId, versoes: caminhos.length, palavras: timestamps?.length ?? 0 };
  },
);
