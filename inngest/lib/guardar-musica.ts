import type { SupabaseClient } from "@supabase/supabase-js";
import { obterTimestamps, type FaixaGerada } from "./kie.js";
import { musicaDoQuiz, mandarEmailDeEntrega } from "../../api/lib/entrega.js";

// O FIM DA GERAÇÃO, em UM lugar só.
//
// Até 09/10 isto morava dentro do `gerarMusica`. Nesse dia o Inngest ficou 40
// minutos sem executar nada e nasceu o gerador reserva (`api/gerador-reserva.ts`),
// que faz o mesmo fim fora dele. Duas cópias de "qual faixa é a principal" e
// "como se entrega a quem já pagou" divergiriam no primeiro conserto, e a
// divergência aqui é karaokê fora de sincronia ou comprador sem e-mail.

const bucket = "musicas";

// Preço do provedor (tabela pública do kie.ai) e câmbio, espelhando
// src/lib/custos.ts. O custo em BRL é congelado na linha: se o preço mudar,
// o histórico do painel não se reescreve.
const USD_POR_CREDITO = 0.005;
const CAMBIO = 5.4;
export const CREDITOS = { musica: 12, timestamps: 0.5 };

export async function registrarCusto(
  sb: SupabaseClient,
  args: {
    quizResponseId: string | null;
    musicaId: string;
    tipo: "musica" | "timestamps";
    creditos: number;
    modelo?: string;
  },
) {
  try {
    const usd = args.creditos * USD_POR_CREDITO;
    await sb.from("custos").insert({
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

/**
 * Qual gravação é a PRINCIPAL.
 *
 * O Suno devolve 2 versões. Julgamento do dono, consistente nos testes: a
 * SEGUNDA costuma sair melhor. Então ela vira a principal (entregue e
 * tocada), e a primeira fica como alternativa — útil de dar de brinde quando
 * a pessoa pedir "uma outra versão", já pronta e sem custo novo.
 *
 * A ordem é trocada AQUI, na origem, e não na hora de servir: os timestamps
 * do karaokê são de UMA faixa específica, então principal e timestamps
 * precisam ser sempre a mesma — senão a letra acende fora de sincronia.
 */
export function principalEAlternativa<F>(faixas: F[]): { principal: F; alternativa: F | null } {
  return {
    principal: faixas.length > 1 ? faixas[1] : faixas[0],
    alternativa: faixas.length > 1 ? faixas[0] : null,
  };
}

/** Baixa as faixas e guarda no Storage. As URLs do kie.ai são TEMPORÁRIAS: sem baixar, a música some. */
export async function guardarFaixas(
  sb: SupabaseClient,
  musicaId: string,
  ordenadas: FaixaGerada[],
): Promise<string[]> {
  const salvos: string[] = [];
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
}

/**
 * Timestamps (karaokê real) de UMA gravação. ~0,5 crédito (R$ 0,013).
 * Tolerante a falha: sem timestamps a faixa ainda toca, só sem destaque.
 */
export async function timestampsDaFaixa(
  sb: SupabaseClient,
  args: { taskId: string; audioId: string; musicaId: string; quizResponseId: string | null },
): Promise<Array<{ word: string; start: number; end: number }> | null> {
  try {
    const t = await obterTimestamps(args.taskId, args.audioId);
    await registrarCusto(sb, {
      quizResponseId: args.quizResponseId,
      musicaId: args.musicaId,
      tipo: "timestamps",
      creditos: CREDITOS.timestamps,
    });
    return t;
  } catch (err) {
    console.error("[musica] timestamps falharam:", err);
    return null;
  }
}

/** Fecha a linha como `pronta`. Limpa a task em andamento e a posse do reserva. */
export async function marcarPronta(
  sb: SupabaseClient,
  musicaId: string,
  args: {
    caminhos: string[];
    timestamps: unknown;
    timestampsV2: unknown;
    duracao: number | null;
    taskId: string;
  },
) {
  const { error } = await sb
    .from("musicas")
    .update({
      status: "pronta",
      // audio_path é sempre a PRINCIPAL (a que toca e casa com os
      // timestamps); audio_path_v2 é a alternativa de brinde.
      audio_path: args.caminhos[0] ?? null,
      audio_path_v2: args.caminhos[1] ?? null,
      timestamps: args.timestamps,
      timestamps_v2: args.timestampsV2,
      duracao_s: args.duracao,
      provider: "kie.ai",
      provider_job_id: args.taskId,
      gerada_em: new Date().toISOString(),
      erro: null,
      // Uma task que já virou música não pode ser "adotada" de novo por um
      // ajuste futuro: o reserva entregaria a gravação velha com a letra nova.
      task_atual: null,
      task_em: null,
      reserva_em: null,
    })
    .eq("id", musicaId);
  if (error) throw new Error(`update final falhou: ${error.message}`);
}

/**
 * QUEM JÁ PAGOU E ESPEROU RECEBE AGORA.
 *
 * O caso normal é o inverso: a música fica pronta ANTES do pagamento, e o
 * webhook manda a entrega. Isto é pro comprador que pagou com a música ainda
 * em produção (o buraco de 04/09, quando o Inngest ficou 58 minutos fora).
 *
 * A TRAVA CONTRA E-MAIL DOBRADO é o registro de envio: se já existe uma linha
 * `entrega` pra este quiz, alguém já entregou (o webhook, o job ou o reserva)
 * e aqui não se faz nada.
 */
export async function entregarSeJaPagou(
  sb: SupabaseClient,
  musicaId: string,
  quizResponseId: string | null,
): Promise<{ entregue: boolean; motivo?: string; para?: string }> {
  const { data: pedido } = await sb
    .from("pedidos")
    .select("email")
    .eq("musica_id", musicaId)
    .eq("status", "pago")
    .limit(1)
    .maybeSingle();
  if (!pedido?.email) return { entregue: false, motivo: "ninguém pagou ainda" };

  if (quizResponseId) {
    const { data: jaFoi } = await sb
      .from("emails_enviados")
      .select("email_id")
      .eq("template", "entrega")
      .eq("quiz_response_id", quizResponseId)
      .limit(1);
    if (jaFoi?.length) return { entregue: false, motivo: "entrega já enviada" };
  }

  const pronta = await musicaDoQuiz(sb, quizResponseId ?? "");
  if (!pronta) return { entregue: false, motivo: "música não relida" };
  const r = await mandarEmailDeEntrega(sb, { email: pedido.email, musica: pronta });
  if (!r.ok) {
    // Não derruba quem chamou: a música ESTÁ pronta e o link do comprador já
    // funciona. E-mail que falha aqui é recuperável (o vigia de entrega e o
    // `guardeOLink` alcançam a mesma pessoa).
    console.error("[musica] entrega pós-geração falhou:", r.erro);
    return { entregue: false, motivo: r.erro };
  }
  return { entregue: true, para: pedido.email };
}
