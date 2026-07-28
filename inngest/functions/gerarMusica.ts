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

// Preço do provedor (tabela pública do kie.ai) e câmbio, espelhando
// src/lib/custos.ts. O custo em BRL é congelado na linha: se o preço mudar,
// o histórico do painel não se reescreve.
// O Suno RECUSA gerar (GENERATE_AUDIO_FAILED) quando o estilo cita artista
// real — e a história do usuário naturalmente cita banda favorita. O prompt
// já proíbe, mas se escapar a música morreria em silêncio. Este fallback
// troca o estilo por um genérico do gênero e tenta de novo.
const ESTILO_GENERICO: Record<string, string> = {
  sertanejo: "sertanejo romântico brasileiro, viola e violão, batida moderada, clima emotivo",
  sertanejo_univ: "sertanejo universitário, violão e viola, produção pop, romântico",
  piseiro: "piseiro romântico brasileiro, teclado marcante, batida eletrônica dançante, vocal melódico, clima apaixonado",
  pagode: "pagode romântico, cavaquinho, pandeiro, banjo, clima alegre e caloroso",
  forro: "forró brasileiro, sanfona, zabumba e triângulo, clima nordestino",
  pop_romantico: "balada pop romântica, piano, cordas suaves, emocional e cinematográfica",
  mpb: "MPB intimista, violão acústico dedilhado, andamento lento, arranjo minimalista",
  bossa: "bossa nova, violão de nylon dedilhado, batida suave, vocal intimista e sussurrado, clima sofisticado",
  rock: "rock nacional romântico, guitarra com distorção suave, bateria marcada, vocal emotivo, clima de balada rock",
  reggae: "reggae romântico brasileiro, guitarra no contratempo, baixo marcante, batida cadenciada, vocal suave, clima praiano e apaixonado",
  gospel: "gospel brasileiro, piano e órgão, cordas, clima reverente e inspirador",
  rap: "rap/hip-hop melódico brasileiro, batida boom-bap suave, piano, vocal falado e cantado, clima intimista",
  infantil: "canção infantil suave, caixinha de música, ukulele, clima doce",
};

function estiloSemReferencias(estilo: string | null, genero: string | null): string {
  const limpo = String(estilo ?? "").replace(
    /,?\s*(refer[êe]ncias?|inspirad[oa]s?|no estilo)\s+(a|de|em|por)?[^,.]*/gi,
    "",
  ).trim();
  return limpo || ESTILO_GENERICO[genero ?? ""] || "música brasileira emotiva, arranjo acústico";
}

const USD_POR_CREDITO = 0.005;
const CAMBIO = 5.4;
const CREDITOS = { musica: 12, timestamps: 0.5 };

async function registrarCusto(args: {
  quizResponseId: string | null;
  musicaId: string;
  tipo: "musica" | "timestamps";
  creditos: number;
  modelo?: string;
}) {
  try {
    const usd = args.creditos * USD_POR_CREDITO;
    await db().from("custos").insert({
      quiz_response_id: args.quizResponseId,
      musica_id: args.musicaId,
      tipo: args.tipo,
      provider: "kie.ai",
      modelo: args.modelo ?? null,
      creditos: args.creditos,
      custo_usd: usd,
      custo_brl: usd * CAMBIO,
      cambio: CAMBIO,
    });
  } catch (err) {
    // Custo nunca derruba a entrega.
    console.error("[custos] falha ao registrar:", err);
  }
}

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

    // ─── 2 e 3. Dispara e acompanha, com fallback de estilo ────────
    // Duas tentativas: a segunda com o estilo limpo de referências a
    // artista, que é a causa conhecida de recusa do provedor.
    type Faixa = { id: string; audioUrl: string; duration?: number };
    let faixas: Faixa[] = [];
    let taskId = "";
    let recusou = false;

    const estilos = [
      { rotulo: "original", valor: musica.estilo_suno ?? musica.genero ?? "" },
      { rotulo: "sem-referencias", valor: estiloSemReferencias(musica.estilo_suno, musica.genero) },
    ];

    for (const [n, estilo] of estilos.entries()) {
      // Se o primeiro estilo já era genérico, não gasta crédito repetindo.
      if (n > 0 && (!recusou || estilo.valor === estilos[0].valor)) break;

      taskId = await step.run(`iniciar-${estilo.rotulo}`, async () => {
        const id = await iniciarGeracao({
          letra: musica.letra,
          titulo: musica.titulo ?? "Sua música",
          estilo: estilo.valor,
          voz,
        });
        // Cobrado no disparo, independente do resultado.
        await registrarCusto({
          quizResponseId: musica.quiz_response_id,
          musicaId,
          tipo: "musica",
          creditos: CREDITOS.musica,
          modelo: "V4_5PLUS",
        });
        return id;
      });

      recusou = false;
      // Medido: 84s a 250s. Folga de 6 minutos antes de desistir.
      for (let tentativa = 0; tentativa < 36; tentativa++) {
        const r = await step.run(`consultar-${estilo.rotulo}-${tentativa}`, () =>
          consultarGeracao(taskId),
        );
        if (r.status === "SUCCESS" && r.faixas.length) {
          faixas = r.faixas;
          break;
        }
        if (/FAIL|ERROR/i.test(r.status)) {
          recusou = true;
          break;
        }
        await step.sleep(`espera-${estilo.rotulo}-${tentativa}`, "10s");
      }
      if (faixas.length) break;
    }

    if (!faixas.length) {
      await step.run("marcar-falha", async () => {
        await db()
          .from("musicas")
          .update({
            status: "falhou",
            erro: recusou ? "provedor recusou a geração" : "timeout no provedor",
          })
          .eq("id", musicaId);
      });
      throw new Error(recusou ? "provedor recusou" : "timeout esperando a música");
    }

    // ─── 4. Escolhe a PRINCIPAL e guarda no Storage ────────────────
    //
    // O Suno devolve 2 versões. Julgamento do dono, consistente nos testes:
    // a SEGUNDA costuma sair melhor. Então ela vira a principal (entregue e
    // tocada), e a primeira fica como alternativa — útil de dar de brinde
    // quando a pessoa pedir "uma outra versão", já pronta e sem custo novo.
    //
    // A ordem é trocada AQUI, na origem, e não na hora de servir: os
    // timestamps do karaokê são de UMA faixa específica, então principal e
    // timestamps precisam ser sempre a mesma — senão a letra acende fora
    // de sincronia.
    const principal = faixas.length > 1 ? faixas[1] : faixas[0];
    const alternativa = faixas.length > 1 ? faixas[0] : null;

    // As URLs do kie.ai são TEMPORÁRIAS: sem baixar, a música do cliente some.
    const caminhos = await step.run("guardar-audio", async () => {
      const sb = db();
      const salvos: string[] = [];
      const ordenadas = [principal, alternativa].filter(Boolean) as Faixa[];
      for (let i = 0; i < ordenadas.length; i++) {
        const resp = await fetch(ordenadas[i].audioUrl);
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

    // ─── 5. Timestamps (karaokê real) das DUAS gravações ───────────
    // Cada gravação tem timing próprio, então precisa dos seus timestamps:
    // usar os da v1 na v2 acenderia a letra fora do que se ouve. ~0,5 crédito
    // (R$ 0,013) cada. Tolerante a falha: sem timestamps a faixa ainda toca,
    // só sem destaque.
    const timestamps = await step.run("timestamps", async () => {
      try {
        const t = await obterTimestamps(taskId, principal.id);
        await registrarCusto({
          quizResponseId: musica.quiz_response_id,
          musicaId,
          tipo: "timestamps",
          creditos: CREDITOS.timestamps,
        });
        return t;
      } catch (err) {
        console.error("[musica] timestamps v1 falharam:", err);
        return null;
      }
    });

    // Timestamps da alternativa (v2). Só se ela existir.
    const timestampsV2 = alternativa
      ? await step.run("timestamps-v2", async () => {
          try {
            const t = await obterTimestamps(taskId, alternativa.id);
            await registrarCusto({
              quizResponseId: musica.quiz_response_id,
              musicaId,
              tipo: "timestamps",
              creditos: CREDITOS.timestamps,
            });
            return t;
          } catch (err) {
            console.error("[musica] timestamps v2 falharam:", err);
            return null;
          }
        })
      : null;

    // ─── 6. Fecha ──────────────────────────────────────────────────
    await step.run("marcar-pronta", async () => {
      const sb = db();
      const { error } = await sb
        .from("musicas")
        .update({
          status: "pronta",
          // audio_path é sempre a PRINCIPAL (a que toca e casa com os
          // timestamps); audio_path_v2 é a alternativa de brinde.
          audio_path: caminhos[0] ?? null,
          audio_path_v2: caminhos[1] ?? null,
          timestamps,
          timestamps_v2: timestampsV2,
          duracao_s: principal.duration ?? null,
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
