// O VIGIA DO VÍDEO: o vídeo pago chega mesmo com o Inngest fora do ar.
//
// 09/10/2026, 18h03: o vídeo do Odilon começou a renderizar na Lambda segundos
// antes de o Inngest cair (Rackspace, 18h05-18h49). O render TERMINOU na AWS,
// mas a execução do job que ia buscar o MP4 nunca voltou: o vídeo ficou
// "renderizando" por 19 horas, com o arquivo pronto no S3, até o cliente
// reclamar duas vezes por e-mail. Resgatado à mão (`scratch/_resgatar-video-10out.mjs`).
//
// A música já tinha o gerador reserva (`api/gerador-reserva.ts`). O vídeo era o
// último entregável PAGO que dependia só do Inngest.
//
// Vercel Cron a cada 5 min, falando direto com o banco e com a AWS:
//   - `renderizando` há mais de RENDER_ORFAO_MIN com `render_id`: pergunta à
//     Lambda. Pronto → baixa, sobe no bucket `videos`, marca `pronto` e avisa
//     o cliente (o mesmo fim do job, `renderizarVideo.ts`). Falhou na AWS →
//     marca `falhou`, e o `videoPendente` refaz quando o Inngest estiver vivo.
//   - `renderizando` sem `render_id` há mais de 30 min: o job morreu antes de
//     disparar; vira `falhou` pelo mesmo motivo.
// Não dispara render novo: montar as entradas do vídeo é do job, e um render
// a mais com o Inngest de pé disputaria com o dele.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getRenderProgress, presignUrl, type AwsRegion } from "@remotion/lambda/client";
import { segredoConfere } from "./lib/segredo.js";
import { comUtm } from "../src/lib/utm-email.js";
import { registrarEnvio } from "../src/lib/registro-email.js";
import { emailVideoPronto, assuntoVideoPronto } from "../emails/video-pronto.js";
import { assinaturaDoVideo, entradaDaMusica } from "../src/lib/assinatura-video.js";
import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";
import { avisarDonos } from "../src/lib/avisar-donos.js";

/** O job pergunta à Lambda por até 20 min; passou disso sem ele terminar, o job morreu. */
const RENDER_ORFAO_MIN = 25;
/** Sem render disparado: o job morreu antes da Lambda. */
const SEM_RENDER_MIN = 30;
const REGIAO = (process.env.REMOTION_AWS_REGION ?? "us-east-1") as AwsRegion;
const SITE = process.env.VITE_APP_URL?.startsWith("http") ? process.env.VITE_APP_URL : MARCA_ATIVA.url;

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

type Video = { id: string; email: string | null; musica_id: string | null; render_id: string | null; render_bucket: string | null; render_iniciado_em: string | null; created_at: string };

async function entregar(sb: SupabaseClient, v: Video, bucket: string, key: string): Promise<string> {
  const url = await presignUrl({ region: REGIAO, bucketName: bucket, objectKey: key, expiresInSeconds: 900, checkIfObjectExists: true });
  if (!url) throw new Error("MP4 não está mais no S3");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download do S3 falhou: ${resp.status}`);
  const bytes = new Uint8Array(await resp.arrayBuffer());

  const { data: m } = await sb
    .from("musicas")
    .select("id, titulo, dedicatoria, foto_path, galeria, audio_path, audio_path_v2, timestamps, timestamps_v2, versao_preferida, duracao_s, token_edicao, quiz_response_id, locale")
    .eq("id", v.musica_id ?? "")
    .single();
  if (!m) throw new Error("música do vídeo não existe");

  const destino = `${m.id}/${v.id}-vigia.mp4`;
  const { error } = await sb.storage.from("videos").upload(destino, bytes, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`upload falhou: ${error.message}`);
  // A assinatura das entradas, como o job grava: sem ela, o "atualizar meu vídeo" acharia a página mudada.
  await sb
    .from("videos")
    .update({ status: "pronto", video_path: destino, assinatura: assinaturaDoVideo(entradaDaMusica(m as never)), pronto_em: new Date().toISOString(), erro: null })
    .eq("id", v.id)
    .eq("status", "renderizando");

  const chave = process.env.RESEND_API_KEY;
  if (chave && v.email) {
    const locale = (m.locale as string | null) ?? "pt";
    const linkVideo = `${SITE}/editar/${m.token_edicao}#video`;
    const { data: enviado, error: e } = await comUtm(new Resend(chave)).emails.send({
      tags: [{ name: "template", value: "video_pronto" }],
      from: MARCA_ATIVA.remetenteTransacional,
      to: [v.email],
      subject: assuntoVideoPronto(m.titulo as string, locale as never),
      html: emailVideoPronto({ titulo: m.titulo as string, linkVideo, locale: locale as never }),
      text: `${locale === "es" ? "Tu video está listo" : locale === "en" ? "Your video is ready" : "O vídeo de vocês está pronto"}:\n${linkVideo}`,
    });
    if (e) console.error("[vigia-video] e-mail recusado:", e.message);
    await registrarEnvio(sb, { emailId: enviado?.id, template: "video_pronto", para: v.email, quizResponseId: (m.quiz_response_id as string | null) ?? undefined });
  }
  return `entregue (${Math.round(bytes.length / 1e6)} MB)`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!autorizado(req)) {
    res.statusCode = 401;
    res.end("nao autorizado");
    return;
  }
  const sb = db();
  const agora = Date.now();
  const { data, error } = await sb
    .from("videos")
    .select("id, email, musica_id, render_id, render_bucket, render_iniciado_em, created_at")
    .eq("status", "renderizando")
    .gte("created_at", new Date(agora - 7 * 86400000).toISOString())
    .limit(50);
  if (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, erro: error.message }));
    return;
  }
  const relatorio: Array<{ id: string; resultado: string }> = [];
  for (const v of (data ?? []) as Video[]) {
    const desde = Date.parse(v.render_iniciado_em ?? v.created_at);
    try {
      if (!v.render_id || !v.render_bucket) {
        if (agora - desde < SEM_RENDER_MIN * 60000) continue;
        await sb.from("videos").update({ status: "falhou", erro: "vigia: job morreu antes de disparar o render" }).eq("id", v.id).eq("status", "renderizando");
        relatorio.push({ id: v.id, resultado: "falhou (sem render)" });
        continue;
      }
      if (agora - desde < RENDER_ORFAO_MIN * 60000) continue;
      const funcao = process.env.REMOTION_FUNCTION_NAME;
      if (!funcao) throw new Error("REMOTION_FUNCTION_NAME ausente");
      const p = await getRenderProgress({ region: REGIAO, functionName: funcao, bucketName: v.render_bucket, renderId: v.render_id });
      if (p.done && p.outBucket && p.outKey) relatorio.push({ id: v.id, resultado: await entregar(sb, v, p.outBucket, p.outKey) });
      else if (p.fatalErrorEncountered) {
        const msg = `vigia: render falhou na AWS: ${p.errors?.[0]?.message?.slice(0, 200) ?? "sem detalhe"}`;
        await sb.from("videos").update({ status: "falhou", erro: msg }).eq("id", v.id).eq("status", "renderizando");
        relatorio.push({ id: v.id, resultado: "falhou (AWS)" });
      } else relatorio.push({ id: v.id, resultado: `ainda renderizando (${Math.round((p.overallProgress ?? 0) * 100)}%)` });
    } catch (err) {
      relatorio.push({ id: v.id, resultado: `erro: ${(err as Error).message}` });
    }
  }
  const entregues = relatorio.filter((r) => r.resultado.startsWith("entregue"));
  if (entregues.length && process.env.RESEND_API_KEY) {
    await avisarDonos({
      assunto: `🎬 Vigia do vídeo entregou ${entregues.length} vídeo(s) que o Inngest largou no meio`,
      html: `<p>O render terminou na AWS e o job do Inngest não voltou pra buscar (queda dele?). O vigia baixou, entregou e avisou o cliente.</p><pre>${relatorio.map((r) => `${r.id.slice(0, 8)} → ${r.resultado}`).join("\n")}</pre>`,
    }).catch((e) => console.error("[vigia-video] aviso falhou:", e));
  }
  if (relatorio.length) console.log("[vigia-video]", JSON.stringify(relatorio));
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, olhados: (data ?? []).length, agiu: relatorio }));
}
