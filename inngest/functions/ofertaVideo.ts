import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import {
  emailVideoOferta,
  assuntoVideoOferta,
  textoVideoOferta,
} from "../../emails/video-oferta.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

// O VÍDEO, no dia seguinte à compra, pra quem já subiu foto.
//
// ── POR QUE NO DIA SEGUINTE E NÃO NO SÉTIMO, COMO O QUADRO ──────
//
// O quadro é objeto de parede: vende depois da entrega, na memória da reação.
// O vídeo é o CONTRÁRIO: é jeito de entregar. Ele serve pra mandar no WhatsApp
// e postar no story, e isso acontece nos primeiros dias, não na semana
// seguinte. Oferecer no dia 7 é oferecer depois que o presente já foi dado.
//
// A régua pós-compra fica: entrega (dia 0) · lembrete se não montou (3h-96h)
// · VÍDEO (dia 1) · guarde o link (dia 3) · quadro (dia 7) · volte a criar.
//
// ── QUEM RECEBE ──────────────────────────────────────────────────
//
// Pagou há 1 a 14 dias, a música está pronta, subiu PELO MENOS UMA FOTO (o
// vídeo é feito delas; sem foto a prévia é o fundo da marca e o e-mail
// mentiria), ainda não tem vídeo, e comprou em português (o vídeo é pago no
// PIX). E só com o render configurado: vender o que a infraestrutura não
// sabe produzir é a regra que este projeto não quebra.
//
// ── O LINK LEVA PRA PRÉVIA TOCANDO, NÃO PRO CHECKOUT ─────────────
//
// `#video` rola o editor até o bloco do vídeo, onde a prévia com as fotos
// dela está pronta pra dar o play. O e-mail convida a ASSISTIR; a oferta
// mora embaixo do vídeo.

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";
const linkDoVideo = (tokenEdicao: string) => `${SITE}/editar/${tokenEdicao}?de=video#video`;

const MIN_DIAS = 1;
const MAX_DIAS = 14;
// Mesmo teto do quadro, pelo mesmo motivo: disparo novo num domínio novo
// sobe devagar. A fila inicial é a das últimas duas semanas com foto.
const MAX_POR_RODADA = 6;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Já ofereceu o vídeo pra esta música? Por MÚSICA: cada uma tem o seu vídeo. */
async function jaOfertado(sb: ReturnType<typeof db>, musicaId: string) {
  const { data } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "oferta_video_enviada")
    .contains("event_data", { musica_id: musicaId })
    .limit(1);
  return (data ?? []).length > 0;
}

export const ofertaVideo = inngest.createFunction(
  {
    id: "oferta-video",
    retries: 1,
    triggers: [{ cron: "50 13-22 * * *" }], // 10h50 às 19h50 de Brasília, fora do minuto cheio
  },
  async ({ step }) => {
    if (!process.env.REMOTION_SERVE_URL || !process.env.REMOTION_FUNCTION_NAME) {
      return { pulado: "render não configurado" };
    }

    const candidatos = await step.run("achar-quem-subiu-foto", async () => {
      const sb = db();
      const agora = Date.now();
      const { data: pedidos } = await sb
        .from("pedidos")
        .select("email, musica_id, quiz_response_id, paid_at")
        .eq("status", "pago")
        .not("musica_id", "is", null)
        .gte("paid_at", new Date(agora - MAX_DIAS * 86400000).toISOString())
        .lte("paid_at", new Date(agora - MIN_DIAS * 86400000).toISOString())
        .order("paid_at", { ascending: false });

      const out: Array<{
        email: string;
        nome: string;
        titulo: string;
        link: string;
        musicaId: string;
      }> = [];
      const vistos = new Set<string>();

      for (const p of pedidos ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if (!p.email || !p.musica_id || vistos.has(p.musica_id)) continue;
        vistos.add(p.musica_id);

        const { data: temVideo } = await sb
          .from("videos")
          .select("id")
          .eq("musica_id", p.musica_id)
          .limit(1)
          .maybeSingle();
        if (temVideo?.id) continue;
        if (await jaOfertado(sb, p.musica_id)) continue;

        const { data: m } = await sb
          .from("musicas")
          .select("id, titulo, status, token_edicao, foto_path, galeria")
          .eq("id", p.musica_id)
          .maybeSingle();
        if (!m || m.status !== "pronta") continue;
        const fotos = (m.foto_path ? 1 : 0) + ((m.galeria as string[] | null) ?? []).length;
        if (fotos === 0) continue;

        const { data: q } = p.quiz_response_id
          ? await sb
              .from("quiz_responses")
              .select("respostas, locale")
              .eq("id", p.quiz_response_id)
              .maybeSingle()
          : { data: null };
        if ((q as { locale?: string } | null)?.locale === "es") continue;

        out.push({
          email: p.email,
          nome: ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() || "quem você ama",
          titulo: m.titulo ?? "Sua música",
          link: linkDoVideo(m.token_edicao as string),
          musicaId: m.id,
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`video-${c.musicaId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        if (await jaOfertado(sb, c.musicaId)) return false;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "oferta_video" }],
          // Remetente de RECUPERAÇÃO: é oferta, não entrega (ver `emails/remetentes.ts`).
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: [c.email],
          subject: assuntoVideoOferta(c.nome),
          html: emailVideoOferta({ nome: c.nome, titulo: c.titulo, link: c.link }),
          text: textoVideoOferta({ nome: c.nome, link: c.link }),
        });
        if (error) {
          console.error("[oferta-video] envio falhou:", error.message);
          return false;
        }
        await registrarEnvio(sb, { emailId: enviado?.id, template: "oferta_video", para: c.email });
        await sb.from("funnel_events").insert({
          event_name: "oferta_video_enviada",
          event_data: { musica_id: c.musicaId, email: c.email },
        });
        return true;
      });
      if (ok) enviados += 1;
    }
    return { candidatos: candidatos.length, enviados };
  },
);
