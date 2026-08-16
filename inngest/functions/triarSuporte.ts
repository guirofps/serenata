// TRIAGEM DIARIA DA CAIXA DE SUPORTE.
//
// A caixa de contato@serenatagift.com nao tinha dono. O atendimento trabalha o
// WhatsApp, e o e-mail acumulava: em 16/08 havia 18 mensagens de cliente sem
// resposta, a mais velha de mais de 24h, e uma delas era um comprador falando
// em "procurar meus direitos" com a musica dele pronta no servidor.
//
// A logica vive em `lib/suporte.ts`; aqui fica so o agendamento, o envio passo
// a passo e o relatorio. A divisao existe porque o mesmo codigo roda pela mao
// em `scripts/suporte-diario.mjs`, e um so lugar decide quem e respondido.
import { inngest } from "../client.js";
import { triar, responder, type Caso } from "../lib/suporte.js";
import { createClient } from "@supabase/supabase-js";

const DONO = "guilhermerojasiqueira@gmail.com";

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function bloco(c: Caso): string {
  return (
    `<div style="margin:0 0 20px;padding:14px 16px;background:#faf5ee;border-left:3px solid #7d2b3a;border-radius:6px;">` +
    `<p style="margin:0 0 6px;font-size:13px;color:#7d2b3a;"><strong>${esc(c.motivo ?? "revisar")}</strong> · ${esc(c.quando)}</p>` +
    `<p style="margin:0 0 6px;font-size:14px;"><strong>${esc(c.nome || c.de)}</strong> &lt;${esc(c.de)}&gt;` +
    (c.tel ? ` · ${esc(c.tel)}` : "") +
    `</p>` +
    `<p style="margin:0 0 6px;font-size:13px;color:#2a1518;"><em>${esc(c.assunto)}</em></p>` +
    `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">${esc(c.corpo.slice(0, 400))}</p>` +
    `<p style="margin:0;font-size:12px;color:rgba(42,21,24,0.6);">` +
    `${c.pagou ? "PAGOU" : "lead"} · música ${c.musica ? `"${esc(c.musica)}"` : "nenhuma"}` +
    (c.editor ? `<br><a href="${c.editor}">${c.editor}</a>` : "") +
    `</p></div>`
  );
}

export const triarSuporte = inngest.createFunction(
  {
    id: "triar-suporte-email",
    retries: 1,
    // 9h de Brasilia = 12h UTC. Uma vez por dia: a caixa nao enche mais rapido
    // que isso, e alerta demais vira alerta que ninguem le.
    triggers: [{ cron: "0 12 * * *" }],
  },
  async ({ step }) => {
    const token = process.env.HOSTINGER_MAIL_TOKEN;
    if (!token) {
      console.error("[suporte] HOSTINGER_MAIL_TOKEN ausente");
      return { pulou: "sem token" };
    }

    const { caixa, auto, paraVoce, mailbox } = await step.run("triar-a-caixa", () => triar(token));

    // UMA RESPOSTA POR PESSOA, nao por mensagem: quem escreveu tres vezes
    // porque estava aflito nao merece tres e-mails iguais de volta.
    const vistos = new Set<string>();
    const fila = auto.filter((c) => (vistos.has(c.de) ? false : (vistos.add(c.de), true)));
    const jaCobertos = auto.filter((c) => !fila.includes(c));

    const enviados: number[] = [];
    for (const c of fila) {
      // Um step por e-mail: se o quinto falhar, o retry nao reenvia os quatro
      // primeiros. Reenviar cliente e pior que nao enviar.
      const ok = await step.run(`responder-${c.uid}`, () => responder(token, mailbox, c));
      if (ok) enviados.push(c.uid);
    }

    // Registra os respondidos E os duplicados, senao o duplicado volta amanha.
    await step.run("marcar-respondidos", async () => {
      const sb = db();
      const linhas = [...enviados, ...jaCobertos.map((c) => c.uid)].map((uid) => ({
        event_name: "suporte_respondido",
        event_data: { uid, em: new Date().toISOString() },
      }));
      if (linhas.length) await sb.from("funnel_events").insert(linhas);
    });

    // So acorda o dono quando ha algo que SO ele resolve.
    if (paraVoce.length) {
      await step.run("avisar-dono", async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return;
        const { Resend } = await import("resend");
        await new Resend(chave).emails.send({
          from: "Serenata <contato@serenatagift.com>",
          to: [DONO],
          subject: `Suporte: ${paraVoce.length} ${paraVoce.length === 1 ? "e-mail precisa" : "e-mails precisam"} de você`,
          html:
            `<p style="font-family:Helvetica,Arial,sans-serif;">` +
            `Respondi <strong>${enviados.length}</strong> sozinho. ` +
            `Estes <strong>${paraVoce.length}</strong> eu não toco, porque envolvem dinheiro, ` +
            `reclamação ou pedido de ajuste na letra.</p>` +
            paraVoce.map(bloco).join(""),
        });
      });
    }

    return { caixa, respondidos: enviados.length, paraVoce: paraVoce.length };
  },
);
