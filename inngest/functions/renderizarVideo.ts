import { inngest } from "../client.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  renderMediaOnLambda,
  getRenderProgress,
  presignUrl,
  deleteRender,
  type AwsRegion,
} from "@remotion/lambda/client";
import { montarKaraoke } from "../../src/lib/karaoke-video.js";
import { assinaturaDoVideo, entradaDaMusica } from "../../src/lib/assinatura-video.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { emailVideoPronto, assuntoVideoPronto } from "../../emails/video-pronto.js";
import type { PropsPresente } from "../../video/src/props.js";

// O VÍDEO-PRESENTE, do pagamento ao MP4 no bucket.
//
// Dispara em `video/renderizar`, que o `creditar-upsell` manda quando o
// upsell do vídeo é pago. A composição mora em `video/` (Remotion) e roda na
// AWS Lambda: a Vercel não tem Chromium nem tempo de função pra renderizar
// uma música de 3 minutos.
//
// ── AQUI É O CAMINHO INVERSO DO FUNIL ────────────────────────────
//
// A música é gerada ANTES de cobrar ("nunca cobrar por algo que não foi
// produzido"). O vídeo não pode: ele depende das fotos que ela sobe DEPOIS
// de pagar a música. Então ele é pago e depois feito, igual ao crédito. O
// que segura a regra de ouro aqui é o `onFailure`: render que morre de vez
// vira `falhou` e alerta o dono. Pagou e não recebeu nunca fica calado.
//
// ── POR QUE O MP4 SAI DO S3 E VAI PRO SUPABASE ───────────────────
//
// O bucket do Remotion é da AWS e tem regra de ciclo de vida própria. O
// vídeo da pessoa mora onde moram a música e as fotos dela (bucket `videos`,
// privado, URL assinada pelo servidor), e o render do S3 é apagado depois.

const REGIAO = (process.env.REMOTION_AWS_REGION ?? "us-east-1") as AwsRegion;
const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";
// A URL assinada precisa viver o render inteiro (minutos). Um dia sobra.
const VALIDADE_URL_S = 60 * 60 * 24;
// 720x1280: no celular não se distingue do 1080 e o arquivo fica ~7x menor.
const ESCALA = 2 / 3;
const FECHAMENTO_S = 5;
// Lambdas renderizando em paralelo num render (fora a orquestradora). A conta
// nova tem cota de 10, e 8 + 1 já deu "Rate Exceeded" na prática (24/09): 6
// deixa folga. Com a cota maior, subir aqui encurta o render na mesma proporção.
const LAMBDAS_POR_RENDER = 6;

function db(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function configLambda(): { funcao: string; serveUrl: string } {
  const funcao = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  if (!funcao || !serveUrl || !process.env.REMOTION_AWS_ACCESS_KEY_ID) {
    // Falha ALTA de propósito: sem isto configurado o render nunca vai sair,
    // e esperar em silêncio seria pior do que o alerta do onFailure.
    throw new Error(
      "Remotion Lambda não configurado (REMOTION_FUNCTION_NAME / REMOTION_SERVE_URL / chaves AWS)",
    );
  }
  return { funcao, serveUrl };
}

async function alertarDono(assunto: string, html: string) {
  try {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) return;
    await new Resend(chave).emails.send({
      from: "Serenata <contato@serenatagift.com>",
      to: ["guilhermerojasiqueira@gmail.com"],
      subject: assunto,
      html,
    });
  } catch (err) {
    console.error("[video] alerta falhou:", err);
  }
}

async function assinar(
  sb: SupabaseClient,
  bucket: string,
  caminho: string,
): Promise<string | null> {
  const { data } = await sb.storage.from(bucket).createSignedUrl(caminho, VALIDADE_URL_S);
  return data?.signedUrl ?? null;
}

type Preparo =
  | { pular: true; motivo: string }
  | {
      pular: false;
      musicaId: string;
      email: string;
      titulo: string;
      tokenEdicao: string;
      locale: "pt" | "es";
      quizId: string | null;
      props: PropsPresente;
      assinatura: string;
      /** > 0 = é "atualizar meu vídeo": ela está no editor, não precisa de e-mail. */
      atualizacoes: number;
      caminhoAntigo: string | null;
    };

export const renderizarVideo = inngest.createFunction(
  {
    id: "renderizar-video",
    // A conta nova da AWS nasce com cota de 10 Lambdas simultâneas, e um render
    // usa 1 orquestradora + LAMBDAS_POR_RENDER. Dois renders juntos estouram a
    // cota e a AWS recusa (throttle). Subir junto com a cota, quando ela subir.
    concurrency: { limit: 1 },
    retries: 2,
    triggers: [{ event: "video/renderizar" }],
    onFailure: async ({ event, error }) => {
      const videoId = (event.data as { event?: { data?: { videoId?: string } } })?.event?.data
        ?.videoId;
      if (!videoId) return;
      const sb = db();
      const msg = (error as Error)?.message?.slice(0, 500) ?? "erro desconhecido";
      const { data: v } = await sb
        .from("videos")
        .select("email, musica_id, video_path")
        .eq("id", videoId)
        .maybeSingle();
      // Uma ATUALIZAÇÃO que falhou não tira o vídeo que ela já tinha: volta
      // pra `pronto` com o arquivo anterior (a assinatura velha continua lá,
      // então o editor segue oferecendo atualizar).
      if (v?.video_path) {
        await sb.from("videos").update({ status: "pronto", erro: msg }).eq("id", videoId);
        await alertarDono(
          "Atualização de vídeo falhou (cliente segue com o anterior)",
          `<p>vídeo: ${videoId}<br>música: ${v.musica_id ?? "?"}<br>cliente: ${v.email ?? "?"}</p><p>erro: ${msg}</p>`,
        );
        return;
      }
      await sb.from("videos").update({ status: "falhou", erro: msg }).eq("id", videoId);
      await alertarDono(
        "VÍDEO PAGO E NÃO ENTREGUE",
        `<p>O render do vídeo falhou depois das tentativas.</p>` +
          `<p>vídeo: ${videoId}<br>música: ${v?.musica_id ?? "?"}<br>cliente: ${v?.email ?? "?"}</p>` +
          `<p>erro: ${msg}</p><p>Pra refazer: mandar o evento video/renderizar com esse videoId.</p>`,
      );
    },
  },
  async ({ event, step }) => {
    const videoId = event.data?.videoId as string;
    if (!videoId) return { ok: false, motivo: "sem videoId" };

    // ── 1. JUNTA O QUE O VÍDEO PRECISA ─────────────────────────────
    // O `as Preparo` desfaz o alargamento do Inngest (Jsonify transforma o
    // literal `pular: true` em `boolean` e perde o discriminante da união).
    const preparo = (await step.run("preparar", async (): Promise<Preparo> => {
      const sb = db();
      const { data: v } = await sb
        .from("videos")
        .select("id, email, musica_id, status, assinatura, atualizacoes, video_path")
        .eq("id", videoId)
        .maybeSingle();
      if (!v) return { pular: true, motivo: "vídeo não existe" };
      if (!v.musica_id) return { pular: true, motivo: "sem música escolhida" };

      const { data: m } = await sb
        .from("musicas")
        .select(
          "id, titulo, dedicatoria, foto_path, galeria, audio_path, audio_path_v2, timestamps, timestamps_v2, versao_preferida, duracao_s, token_edicao, quiz_response_id, locale, status",
        )
        .eq("id", v.musica_id)
        .maybeSingle();
      if (!m) throw new Error(`música ${v.musica_id} não existe`);
      if (m.status !== "pronta" || !m.audio_path) throw new Error(`música ${m.id} não está pronta`);

      // Pronto e com a página igual à do render: evento repetido, nada a
      // fazer. Pronto com a página MUDADA é o "atualizar meu vídeo".
      const assinatura = assinaturaDoVideo(entradaDaMusica(m));
      if (v.status === "pronto" && v.assinatura === assinatura) {
        return { pular: true, motivo: "já pronto e igual à página" };
      }

      // A versão que ela escolheu no editor, com o timestamp DA MESMA versão:
      // karaokê de uma gravação em cima do áudio da outra sai fora de tempo.
      const v2 = m.versao_preferida === 2 && !!m.audio_path_v2;
      const audioUrl = await assinar(
        sb,
        "musicas",
        (v2 ? m.audio_path_v2 : m.audio_path) as string,
      );
      if (!audioUrl) throw new Error("não assinou o áudio");
      const karaoke = montarKaraoke(v2 ? m.timestamps_v2 : m.timestamps);

      const caminhos = [m.foto_path, ...((m.galeria as string[] | null) ?? [])].filter(
        Boolean,
      ) as string[];
      const fotos = (await Promise.all(caminhos.map((c) => assinar(sb, "fotos", c)))).filter(
        Boolean,
      ) as string[];

      // Duração de reserva. A de verdade a composição mede no próprio MP3
      // (`calculateMetadata`); esta só vale se a medição falhar.
      // Quem ganha o presente: abre o vídeo e sai em itálico dourado na letra.
      const { data: q } = m.quiz_response_id
        ? await sb
            .from("quiz_responses")
            .select("respostas")
            .eq("id", m.quiz_response_id)
            .maybeSingle()
        : { data: null };
      const para = String(((q?.respostas ?? {}) as Record<string, unknown>).nome ?? "").trim();

      const ultimaPalavra = karaoke.length ? karaoke[karaoke.length - 1].end : 0;
      const duracaoS = Math.max(Number(m.duracao_s) || 0, ultimaPalavra + FECHAMENTO_S + 2, 20);

      return {
        pular: false,
        musicaId: m.id as string,
        email: v.email as string,
        titulo: (m.titulo as string | null) ?? "Sua música",
        tokenEdicao: m.token_edicao as string,
        locale: m.locale === "es" ? "es" : "pt",
        quizId: (m.quiz_response_id as string | null) ?? null,
        props: {
          audioUrl,
          fotos,
          karaoke,
          titulo: (m.titulo as string | null) ?? "",
          dedicatoria: (m.dedicatoria as string | null) ?? "",
          duracaoS,
          locale: m.locale === "es" ? "es" : "pt",
          para: para || undefined,
        },
        assinatura,
        atualizacoes: Number(v.atualizacoes) || 0,
        caminhoAntigo: (v.video_path as string | null) ?? null,
      };
    })) as Preparo;
    if (preparo.pular) return { ok: false, motivo: preparo.motivo };

    // ── 2. DISPARA NA LAMBDA ───────────────────────────────────────
    const render = await step.run("iniciar-render", async () => {
      const { funcao, serveUrl } = configLambda();
      const r = await renderMediaOnLambda({
        region: REGIAO,
        functionName: funcao,
        serveUrl,
        composition: "Presente",
        inputProps: preparo.props,
        codec: "h264",
        crf: 26,
        scale: ESCALA,
        imageFormat: "jpeg",
        privacy: "private",
        maxRetries: 2,
        concurrency: LAMBDAS_POR_RENDER,
        outName: `${videoId}.mp4`,
        downloadBehavior: { type: "download", fileName: "video-serenata.mp4" },
      });
      await db()
        .from("videos")
        .update({
          status: "renderizando",
          render_id: r.renderId,
          render_bucket: r.bucketName,
          erro: null,
        })
        .eq("id", videoId);
      return { renderId: r.renderId, bucketName: r.bucketName };
    });

    // ── 3. ESPERA TERMINAR ─────────────────────────────────────────
    // Cada Lambda faz ~3,4 quadros/s: com 6 delas, uma música de 3,5 min leva
    // ~6 min (medido 24/09). 40 voltas de 30s = 20 min de teto, abaixo dos
    // 900s + folga da Lambda: passou disso, algo travou e é melhor falhar alto.
    let saida: { bucket: string; key: string } | null = null;
    for (let i = 0; i < 40 && !saida; i++) {
      await step.sleep(`espera-${i}`, "30s");
      const p = await step.run(`progresso-${i}`, async () => {
        const { funcao } = configLambda();
        const prog = await getRenderProgress({
          region: REGIAO,
          functionName: funcao,
          bucketName: render.bucketName,
          renderId: render.renderId,
        });
        if (prog.fatalErrorEncountered) {
          throw new Error(
            `render falhou: ${prog.errors?.[0]?.message?.slice(0, 300) ?? "sem detalhe"}`,
          );
        }
        return prog.done && prog.outKey && prog.outBucket
          ? { bucket: prog.outBucket, key: prog.outKey }
          : null;
      });
      saida = p;
    }
    if (!saida) throw new Error("render passou de 10 minutos");
    const arquivo = saida;

    // ── 4. TRAZ PRO SUPABASE ───────────────────────────────────────
    const caminho = await step.run("guardar", async () => {
      const sb = db();
      const url = await presignUrl({
        region: REGIAO,
        bucketName: arquivo.bucket,
        objectKey: arquivo.key,
        expiresInSeconds: 900,
        checkIfObjectExists: true,
      });
      if (!url) throw new Error("MP4 não encontrado no S3");
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`download do S3 falhou: ${resp.status}`);
      const bytes = new Uint8Array(await resp.arrayBuffer());

      // Nome novo a cada render, não o mesmo sobrescrito: com o mesmo caminho,
      // o CDN do Storage pode servir o vídeo ANTIGO depois de um "atualizar".
      const destino = `${preparo.musicaId}/${videoId}-${preparo.assinatura}.mp4`;
      const { error } = await sb.storage
        .from("videos")
        .upload(destino, bytes, { contentType: "video/mp4", upsert: true });
      if (error) throw new Error(`upload no bucket videos falhou: ${error.message}`);

      await sb
        .from("videos")
        .update({
          status: "pronto",
          video_path: destino,
          assinatura: preparo.assinatura,
          pronto_em: new Date().toISOString(),
          erro: null,
        })
        .eq("id", videoId);

      // O anterior só sai DEPOIS de o novo estar gravado e apontado: ela
      // nunca fica sem vídeo no meio de uma atualização.
      if (preparo.caminhoAntigo && preparo.caminhoAntigo !== destino) {
        await sb.storage.from("videos").remove([preparo.caminhoAntigo]);
      }

      // Limpa o S3. Se falhar, o ciclo de vida do bucket do Remotion apaga
      // depois; não é motivo pra refazer a entrega.
      try {
        await deleteRender({
          region: REGIAO,
          bucketName: render.bucketName,
          renderId: render.renderId,
        });
      } catch (err) {
        console.error("[video] deleteRender falhou (ignorado):", err);
      }
      return destino;
    });

    // ── 5. AVISA A CLIENTE ─────────────────────────────────────────
    await step.run("avisar-cliente", async () => {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) return;
      // Atualização ela pediu com o editor aberto, e a tela já se atualiza
      // sozinha. Um segundo "seu vídeo está pronto" seria só ruído.
      if (preparo.atualizacoes > 0) return;
      const linkVideo = `${SITE}/editar/${preparo.tokenEdicao}#video`;
      const { data: enviado, error } = await new Resend(chave).emails.send({
        tags: [{ name: "template", value: "video_pronto" }],
        from: "Serenata <contato@serenatagift.com>",
        to: [preparo.email],
        subject: assuntoVideoPronto(preparo.titulo, preparo.locale),
        html: emailVideoPronto({ titulo: preparo.titulo, linkVideo, locale: preparo.locale }),
        text: `${preparo.locale === "es" ? "Tu video está listo" : "O vídeo de vocês está pronto"}:\n${linkVideo}`,
      });
      if (error) console.error("[video] e-mail recusado pelo Resend:", error.message);
      await registrarEnvio(db(), {
        emailId: enviado?.id,
        template: "video_pronto",
        para: preparo.email,
        quizResponseId: preparo.quizId ?? undefined,
      });
    });

    return { ok: true, videoId, caminho };
  },
);
