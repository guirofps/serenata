import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// O VIGIA DO WEBHOOK: avisa quando o gateway para de falar com a gente.
//
// ── POR QUE ISTO EXISTE ──────────────────────────────────────────
//
// Em 18/08 o webhook ficou 5h29 fora do ar. Um import sem a extensão `.js`
// derrubava o handler com 500 ANTES de conferir o token, então todo pagamento
// aprovado nesse período virou nada: sem pedido, sem conta, sem e-mail de
// entrega. Gente pagou e não recebeu.
//
// E a única forma de a gente descobrir foi um cliente reclamando no WhatsApp,
// cinco horas depois. Esse é o defeito mais caro que este projeto pode ter, e
// ele era invisível.
//
// ── COMO ELE SABE QUE É SILÊNCIO DE VERDADE ──────────────────────
//
// Silêncio do gateway sozinho não quer dizer nada: às 4 da manhã ninguém
// compra. O que denuncia problema é silêncio do GATEWAY enquanto o SITE está
// cheio: se tem gente chegando na tela de oferta e nenhum Pix sendo gerado, ou
// o gateway parou ou a gente parou de ouvir.
//
// Por isso o alarme exige as duas coisas ao mesmo tempo:
//   1. nenhum evento do gateway há mais de 90 minutos, E
//   2. movimento no site nos últimos 30 minutos.
//
// ── E POR QUE NÃO AVISA DE NOVO A CADA MEIA HORA ─────────────────
//
// Alarme que repete vira ruído, e ruído a gente ignora. Um por incidente: se
// já avisou e o silêncio continua, fica quieto até o gateway voltar a falar.

const SILENCIO_MIN = 90;
const MOVIMENTO_MIN = 30;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const vigiaWebhook = inngest.createFunction(
  { id: "vigia-webhook", retries: 1, triggers: [{ cron: "*/20 * * * *" }] },
  async ({ step }) => {
    return await step.run("conferir", async () => {
      const sb = db();
      const agora = Date.now();

      const [{ data: gateway }, { data: site }, { data: avisos }] = await Promise.all([
        sb
          .from("funnel_events")
          .select("created_at")
          .like("event_name", "perfectpay%")
          .order("created_at", { ascending: false })
          .limit(1),
        sb
          .from("funnel_events")
          .select("id", { count: "exact", head: false })
          .in("event_name", ["oferta_vista", "checkout_click", "quiz_step"])
          .gte("created_at", new Date(agora - MOVIMENTO_MIN * 60000).toISOString())
          .limit(1),
        sb
          .from("funnel_events")
          .select("created_at")
          .eq("event_name", "alerta_webhook_mudo")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const ultimoGateway = gateway?.[0]?.created_at
        ? new Date(gateway[0].created_at).getTime()
        : 0;
      const minutosMudo = Math.round((agora - ultimoGateway) / 60000);
      const temMovimento = (site ?? []).length > 0;

      if (minutosMudo < SILENCIO_MIN || !temMovimento) {
        return { ok: true, minutosMudo, temMovimento };
      }

      // UM AVISO POR INCIDENTE: se o último alerta é mais recente que o último
      // evento do gateway, o incidente já foi avisado e continua aberto.
      const ultimoAviso = avisos?.[0]?.created_at
        ? new Date(avisos[0].created_at).getTime()
        : 0;
      if (ultimoAviso > ultimoGateway) {
        return { ok: true, jaAvisado: true, minutosMudo };
      }

      const chave = process.env.RESEND_API_KEY;
      const dono = process.env.EMAIL_DONO ?? "agenciarocketfy@gmail.com";
      if (chave) {
        await new Resend(chave).emails.send({
          from: "Serenata <contato@serenatagift.com>",
          to: [dono],
          subject: `🔴 O webhook está mudo há ${minutosMudo} minutos`,
          html:
            `<p><strong>Nenhum evento da Perfect Pay há ${minutosMudo} minutos</strong>, ` +
            `e tem gente no site agora.</p>` +
            `<p>Enquanto isso, pagamento aprovado NÃO vira pedido: a pessoa paga e não ` +
            `recebe nada. Foi o que aconteceu em 18/08, por 5h29.</p>` +
            `<p>Confira nesta ordem:</p><ol>` +
            `<li><code>curl -X POST https://www.serenatagift.com/api/webhook/perfectpay</code> ` +
            `deve responder <strong>401</strong>. Se responder 500, o handler está quebrado ` +
            `(quase sempre import sem extensão <code>.js</code>).</li>` +
            `<li>Se responder 401, o problema é do lado do gateway: veja a fila de postback ` +
            `na Perfect Pay e reenvie os aprovados.</li>` +
            `</ol>`,
        });
      }

      await sb.from("funnel_events").insert({
        event_name: "alerta_webhook_mudo",
        event_data: { minutosMudo, ultimoGateway: gateway?.[0]?.created_at ?? null },
      });

      return { ok: false, alertou: true, minutosMudo };
    });
  },
);
