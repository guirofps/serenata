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
// ── O SINAL MUDOU COM A MIGRAÇÃO (27/08) ─────────────────────────
//
// A versão anterior escutava só `perfectpay%` e usava "tem gente no site" como
// prova de movimento. Com o PIX inteiro na Woovi, isso ficou errado dos dois
// lados ao mesmo tempo:
//
//   - a Perfect Pay passou a ficar naturalmente calada (sobrou o cartão, ~7
//     vendas/dia, uma a cada três horas), então o alarme viraria ruído — e
//     alarme que grita à toa é alarme que se aprende a ignorar;
//   - a Woovi, que agora carrega 87% do faturamento, não era vigiada por
//     ninguém.
//
// O sinal novo é MUITO mais afiado que "tem gente no site": cobrança criada.
// Cada PIX gerado escreve uma linha em `pedidos` no ato, do NOSSO lado, antes
// de qualquer webhook. Então a pergunta vira direta e por gateway:
//
//   "Foram criadas cobranças neste gateway, e ele não disse UMA palavra?"
//
// Movimento no site podia ser gente lendo a letra e indo embora. Cobrança
// criada é gente com o app do banco aberto. Se N pessoas geraram PIX na
// última hora e meia e o webhook não falou nada, ou o gateway parou ou a
// gente parou de ouvir — e as duas custam a mesma coisa.
//
// ── O CARTÃO NÃO TEM COMO SER VIGIADO ASSIM ──────────────────────
//
// Pedido de cartão só nasce QUANDO o pagamento é confirmado, então "pedido
// criado sem webhook" é impossível por construção lá. Fica registrado como
// buraco conhecido: enquanto o cartão for hospedado na Perfect Pay, uma queda
// do webhook dela é invisível pra este vigia. Fecha quando o cartão migrar
// pro Asaas transparente, que também cria cobrança antes de cobrar.
//
// ── E POR QUE NÃO AVISA DE NOVO A CADA 20 MINUTOS ────────────────
//
// Alarme que repete vira ruído. Um por incidente, por gateway: se já avisou e
// o silêncio continua, fica quieto até o gateway voltar a falar.

const SILENCIO_MIN = 90;
/** Abaixo disso, silêncio não prova nada: pode ser só uma noite fraca. */
const MINIMO_COBRANCAS = 3;

/** Quem é vigiado, e como se reconhece a voz de cada um. */
const VIGIADOS = [
  {
    gateway: "woovi",
    nome: "Woovi",
    // Os eventos que o webhook escreve: `woovi_pago`, `woovi_completed`,
    // `woovi_email_enviado`, `woovi_consulta_falhou`...
    prefixo: "woovi",
    endpoint: "https://www.serenatagift.com/api/webhook/woovi",
    ondeReenviar: "no painel da Woovi, em Webhooks, botão \"Reenviar webhooks\"",
  },
  {
    gateway: "perfectpay",
    nome: "Perfect Pay",
    prefixo: "perfectpay",
    endpoint: "https://www.serenatagift.com/api/webhook/perfectpay",
    ondeReenviar: "na fila de postback da Perfect Pay",
  },
] as const;

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
      const desde = new Date(agora - SILENCIO_MIN * 60000).toISOString();
      const relatorio: Array<Record<string, unknown>> = [];

      for (const v of VIGIADOS) {
        // 1. TEVE MOVIMENTO NESTE GATEWAY? Cobrança criada é a prova.
        const { data: cobrancas } = await sb
          .from("pedidos")
          .select("id")
          .eq("gateway", v.gateway)
          .gte("created_at", desde)
          .limit(MINIMO_COBRANCAS);
        const quantas = (cobrancas ?? []).length;
        if (quantas < MINIMO_COBRANCAS) {
          relatorio.push({ gateway: v.gateway, ok: true, motivo: "sem movimento", quantas });
          continue;
        }

        // 2. E ELE FALOU ALGUMA COISA?
        //
        // `like` com prefixo fixo, escrito por nós — não entra nada de fora
        // aqui, então não é o caso do `literalLike`.
        const { data: falas } = await sb
          .from("funnel_events")
          .select("created_at")
          .like("event_name", `${v.prefixo}%`)
          .order("created_at", { ascending: false })
          .limit(1);
        const ultimaFala = falas?.[0]?.created_at
          ? new Date(falas[0].created_at as string).getTime()
          : 0;
        const minutosMudo = Math.round((agora - ultimaFala) / 60000);
        if (minutosMudo < SILENCIO_MIN) {
          relatorio.push({ gateway: v.gateway, ok: true, minutosMudo, quantas });
          continue;
        }

        // 3. UM AVISO POR INCIDENTE, por gateway: se o último alerta DESTE
        // gateway é mais recente que a última fala dele, o incidente já foi
        // avisado e continua aberto.
        const { data: avisos } = await sb
          .from("funnel_events")
          .select("created_at")
          .eq("event_name", "alerta_webhook_mudo")
          .contains("event_data", { gateway: v.gateway })
          .order("created_at", { ascending: false })
          .limit(1);
        const ultimoAviso = avisos?.[0]?.created_at
          ? new Date(avisos[0].created_at as string).getTime()
          : 0;
        if (ultimoAviso > ultimaFala) {
          relatorio.push({ gateway: v.gateway, ok: true, jaAvisado: true, minutosMudo });
          continue;
        }

        const chave = process.env.RESEND_API_KEY;
        const dono = process.env.EMAIL_DONO ?? "agenciarocketfy@gmail.com";
        if (chave) {
          await new Resend(chave).emails.send({
            from: "Serenata <contato@serenatagift.com>",
            to: [dono],
            subject: `🔴 ${v.nome}: webhook mudo há ${minutosMudo} minutos`,
            html:
              `<p><strong>${quantas}+ cobranças criadas na ${v.nome} nos últimos ` +
              `${SILENCIO_MIN} minutos, e nenhum evento do webhook dela em ` +
              `${minutosMudo} minutos.</strong></p>` +
              `<p>Enquanto isso, pagamento aprovado NÃO vira pedido: a pessoa paga e não ` +
              `recebe nada. Foi o que aconteceu em 18/08, por 5h29.</p>` +
              `<p>Confira nesta ordem:</p><ol>` +
              `<li><code>curl -X POST ${v.endpoint}</code> deve responder ` +
              `<strong>401</strong>. Se responder 500, o handler está quebrado ` +
              `(quase sempre import sem extensão <code>.js</code>). Se responder 404, ` +
              `o deploy não subiu.</li>` +
              `<li>Se responder 401, o problema é do lado do gateway: confira a URL ` +
              `cadastrada e reenvie os aprovados ${v.ondeReenviar}.</li>` +
              `</ol>`,
          });
        }

        await sb.from("funnel_events").insert({
          event_name: "alerta_webhook_mudo",
          event_data: {
            gateway: v.gateway,
            minutosMudo,
            cobrancasCriadas: quantas,
            ultimaFala: falas?.[0]?.created_at ?? null,
          },
        });
        relatorio.push({ gateway: v.gateway, ok: false, alertou: true, minutosMudo });
      }

      return { relatorio };
    });
  },
);
