import { inngest } from "../client.js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { jaTravado, soltarTrava, travarEnvio } from "../lib/trava-envio.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_TRANSACIONAL } from "../../emails/remetentes.js";
import {
  assuntoVideoEsperando,
  emailVideoEsperando,
  textoVideoEsperando,
} from "../../emails/video-esperando.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { podeResgatar, RESGATE_JANELA_H } from "../../src/lib/resgate-video.js";

// NINGUÉM PAGA PELO VÍDEO E FICA SEM ELE.
//
// O vídeo comprado no checkout (order bump) nasce `aguardando_fotos`: ela
// ainda não subiu foto nenhuma, e quem manda gerar é ela, no editor. Este job
// é a rede embaixo disso, de hora em hora:
//
//   24h sem gerar → um lembrete ("está esperando as fotos"), uma vez só.
//   72h sem gerar → gera sozinho com o que estiver na página. Pago e nunca
//                   entregue é exatamente o que a regra de ouro proíbe.
//
// E pega o caso vizinho: vídeo em `aguardando` há mais de 30 min sem render
// iniciado (evento que se perdeu no caminho). Pede de novo. O `creditar-upsell`
// promete que "o vigia pega do banco depois": o vigia é este.
//
// E desde 02/10 o terceiro: vídeo PAGO que falhou no render (cota da AWS, foto
// que não carregou) volta pra fila sozinho, até 3 vezes em 72h
// (`resgate-video.ts`). Antes ficava sem entrega até alguém ler o alerta.

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : MARCA_ATIVA.url;
const LEMBRETE_H = 24;
const AUTOMATICO_H = 72;
const PRESO_MIN = 30;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function pedirRender(videoId: string): Promise<boolean> {
  const chave = process.env.INNGEST_EVENT_KEY;
  if (!chave) return false;
  const r = await fetch(`https://inn.gs/e/${chave}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "video/renderizar", data: { videoId } }),
  }).catch(() => null);
  return !!r?.ok;
}

export const videoPendente = inngest.createFunction(
  { id: "video-pendente", retries: 1, triggers: [{ cron: "25 * * * *" }] },
  async ({ step }) => {
    const agora = Date.now();
    const antes = (h: number) => new Date(agora - h * 3600_000).toISOString();

    // ── 72h: gera sozinho ──────────────────────────────────────────
    const gerados = await step.run("gerar-os-esquecidos", async () => {
      const sb = db();
      const { data } = await sb
        .from("videos")
        .update({ status: "aguardando" })
        .eq("status", "aguardando_fotos")
        .not("musica_id", "is", null)
        .lt("created_at", antes(AUTOMATICO_H))
        .select("id");
      let ok = 0;
      for (const v of data ?? []) if (await pedirRender(v.id as string)) ok += 1;
      return { marcados: data?.length ?? 0, pedidos: ok };
    });

    // ── Presos em `aguardando` sem render ──────────────────────────
    const repedidos = await step.run("repedir-os-presos", async () => {
      const sb = db();
      const { data } = await sb
        .from("videos")
        .select("id")
        .eq("status", "aguardando")
        .is("render_id", null)
        .lt("created_at", new Date(agora - PRESO_MIN * 60_000).toISOString())
        .limit(10);
      let ok = 0;
      for (const v of data ?? []) if (await pedirRender(v.id as string)) ok += 1;
      return ok;
    });

    // ── Pagos que FALHARAM: de volta pra fila, com teto ────────────
    // Ver `resgate-video.ts`. O `tentativas` conta os resgates; `render_id`
    // volta a nulo pra o passo acima repedir se este evento se perder.
    const resgatados = await step.run("resgatar-os-falhos", async () => {
      const sb = db();
      const { data } = await sb
        .from("videos")
        .select("id, status, video_path, tentativas, created_at")
        .eq("status", "falhou")
        .is("video_path", null)
        .gt("created_at", antes(RESGATE_JANELA_H))
        .limit(10);
      let ok = 0;
      for (const v of data ?? []) {
        if (!podeResgatar(v as Parameters<typeof podeResgatar>[0], agora)) continue;
        const { data: marcado } = await sb
          .from("videos")
          .update({ status: "aguardando", erro: null, render_id: null, tentativas: ((v.tentativas as number | null) ?? 0) + 1 })
          .eq("id", v.id)
          .eq("status", "falhou")
          .select("id")
          .maybeSingle();
        if (marcado && (await pedirRender(v.id as string))) ok += 1;
      }
      return ok;
    });

    // ── 24h: um lembrete ───────────────────────────────────────────
    const lembrados = await step.run("lembrar", async () => {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) return 0;
      const sb = db();
      const { data: esperando } = await sb
        .from("videos")
        .select("id, email, musica_id, created_at")
        .eq("status", "aguardando_fotos")
        .not("musica_id", "is", null)
        .lt("created_at", antes(LEMBRETE_H))
        .gt("created_at", antes(AUTOMATICO_H))
        .limit(20);
      let enviados = 0;
      for (const v of esperando ?? []) {
        // Na dúvida, já mandou (04/10). A janela começa no nascimento do
        // vídeo (08/10): o lembrete não existe antes dele.
        if (await jaTravado(sb, "video_esperando_lembrado", { video_id: v.id }, v.created_at as string)) continue;
        if (await estaBloqueado(sb, v.email as string)) continue;

        const { data: m } = await sb
          .from("musicas")
          .select("titulo, token_edicao, quiz_response_id")
          .eq("id", v.musica_id)
          .maybeSingle();
        if (!m?.token_edicao) continue;
        const { data: q } = m.quiz_response_id
          ? await sb
              .from("quiz_responses")
              .select("respostas")
              .eq("id", m.quiz_response_id)
              .maybeSingle()
          : { data: null };
        const nome =
          String(((q?.respostas ?? {}) as Record<string, unknown>).nome ?? "").trim() ||
          "quem você ama";
        const link = `${SITE}/editar/${m.token_edicao}?de=video_esperando#video`;

        // A TRAVA ANTES DO ENVIO (08/10): ela era gravada depois do Resend e
        // sem ler o erro, e uma gravação perdida repetia o lembrete na rodada
        // seguinte. Não gravou, não manda.
        const trava = await travarEnvio(sb, {
          event_name: "video_esperando_lembrado",
          event_data: { video_id: v.id },
        });
        if (!trava) continue;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "video_esperando" }],
          from: REMETENTE_TRANSACIONAL,
          to: [v.email as string],
          subject: assuntoVideoEsperando(nome),
          html: emailVideoEsperando({
            nome,
            titulo: (m.titulo as string | null) ?? "Sua música",
            link,
          }),
          text: textoVideoEsperando({ nome, link }),
        });
        if (error) {
          console.error("[video-pendente] lembrete falhou:", error.message);
          await soltarTrava(sb, trava);
          continue;
        }
        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "video_esperando",
          para: v.email as string,
        });
        enviados += 1;
      }
      return enviados;
    });

    return { gerados, repedidos, resgatados, lembrados };
  },
);
