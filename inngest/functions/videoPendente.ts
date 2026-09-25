import { inngest } from "../client.js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_TRANSACIONAL } from "../../emails/remetentes.js";
import {
  assuntoVideoEsperando,
  emailVideoEsperando,
  textoVideoEsperando,
} from "../../emails/video-esperando.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

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

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";
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

    // ── 24h: um lembrete ───────────────────────────────────────────
    const lembrados = await step.run("lembrar", async () => {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) return 0;
      const sb = db();
      const { data: esperando } = await sb
        .from("videos")
        .select("id, email, musica_id")
        .eq("status", "aguardando_fotos")
        .not("musica_id", "is", null)
        .lt("created_at", antes(LEMBRETE_H))
        .gt("created_at", antes(AUTOMATICO_H))
        .limit(20);
      let enviados = 0;
      for (const v of esperando ?? []) {
        const { data: ja } = await sb
          .from("funnel_events")
          .select("id")
          .eq("event_name", "video_esperando_lembrado")
          .contains("event_data", { video_id: v.id })
          .limit(1);
        if (ja?.length) continue;
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
          continue;
        }
        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "video_esperando",
          para: v.email as string,
        });
        await sb.from("funnel_events").insert({
          event_name: "video_esperando_lembrado",
          event_data: { video_id: v.id },
        });
        enviados += 1;
      }
      return enviados;
    });

    return { gerados, repedidos, lembrados };
  },
);
