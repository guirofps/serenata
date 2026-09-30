import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { donosMais } from "../../src/lib/donos.js";
import { avisarDonos } from "../../src/lib/avisar-donos.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { FOLGA_STRIPE_MIN, stripeMudo } from "../../src/lib/sinais-stripe.js";
import { lerSessao } from "../../api/lib/stripe.js";

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

// ── NA BALLAD GIFT, O VIGIADO É O STRIPE (29/09) ─────────────────
//
// Lá não existe Woovi nem Perfect Pay: o único gateway é o Stripe, e o
// webhook dele é a porta que entrega a música pra quem paga e fecha a aba
// antes da `/obrigado` carregar. A leitura do sinal mora em
// `src/lib/sinais-stripe.ts` (pura, testada), e o porquê dele ser diferente
// do da Woovi está lá.
//
// Dois sinais, um aviso por incidente cada:
//
//   1. WEBHOOK MUDO: venda confirmada pela `/obrigado` há mais de 20 minutos
//      e nenhum `stripe_webhook` desde ela. O Stripe sabe que foi pago e não
//      contou pra gente.
//   2. PAGO LÁ, PENDENTE AQUI: sessão que o Stripe diz estar paga e o nosso
//      pedido continua pendente. É pior que o 1: as DUAS portas falharam, e
//      é alguém que pagou e não recebeu nada. Este sinal só LÊ o Stripe
//      (GET da sessão), não entrega nem cobra: vigia grita, não conserta.
const VIGIA_STRIPE = {
  gateway: "stripe",
  endpoint: `${MARCA_ATIVA.url}/api/webhook/stripe`,
  ondeReenviar:
    "no painel do Stripe, em Developers > Webhooks > o endpoint da Ballad > eventos com falha, botão \"Resend\"",
} as const;
/** Até quantas horas pra trás uma venda sem voz ainda conta como incidente aberto. */
const JANELA_STRIPE_H = 24;
/** Pendentes conferidos na API do Stripe por rodada (cada um é um GET). */
const MAX_PENDENTES_CONFERIDOS = 20;
/** Até quantas horas um pendente ainda é conferido: sessão velha já expirou. */
const PENDENTE_ATE_H = 6;

async function conferirStripe(sb: ReturnType<typeof db>) {
  const agora = Date.now();
  const relatorio: Record<string, unknown> = { gateway: VIGIA_STRIPE.gateway };
  const chave = process.env.RESEND_API_KEY;
  const dono = donosMais(process.env.EMAIL_DONO ?? "agenciarocketfy@gmail.com");

  // ── 1. WEBHOOK MUDO ──────────────────────────────────────────
  const { data: pagos } = await sb
    .from("pedidos")
    .select("paid_at")
    .eq("gateway", VIGIA_STRIPE.gateway)
    .eq("status", "pago")
    .gte("paid_at", new Date(agora - JANELA_STRIPE_H * 3600000).toISOString())
    .limit(500);
  const { data: falas } = await sb
    .from("funnel_events")
    .select("created_at")
    .eq("event_name", "stripe_webhook")
    .order("created_at", { ascending: false })
    .limit(1);
  const ultimaFala = falas?.[0]?.created_at ? new Date(falas[0].created_at as string).getTime() : null;
  const v = stripeMudo({
    vendas: (pagos ?? []).map((p) => new Date(p.paid_at as string).getTime()),
    ultimaFala,
    agora,
  });
  relatorio.mudo = v;

  if (v.avisar) {
    // Um aviso por incidente: se o último alerta do Stripe é mais novo que a
    // última fala do webhook, o incidente já foi avisado e continua aberto.
    const { data: avisos } = await sb
      .from("funnel_events")
      .select("created_at")
      .eq("event_name", "alerta_webhook_mudo")
      .contains("event_data", { gateway: VIGIA_STRIPE.gateway })
      .order("created_at", { ascending: false })
      .limit(1);
    const ultimoAviso = avisos?.[0]?.created_at ? new Date(avisos[0].created_at as string).getTime() : 0;
    if (ultimoAviso > (ultimaFala ?? 0)) {
      relatorio.jaAvisado = true;
    } else {
      if (chave) {
        const quanto = v.minutosMudo == null ? "desde sempre" : `há ${v.minutosMudo} minutos`;
        await avisarDonos({
          extras: dono,
          assunto: `🔴 [${MARCA_ATIVA.nome}] Stripe: webhook mudo ${quanto}`,
          html:
            `<p><strong>${v.semVoz} ${v.semVoz === 1 ? "venda confirmada" : "vendas confirmadas"} ` +
            `pela página de obrigado há mais de ${FOLGA_STRIPE_MIN} minutos, e nenhum evento do ` +
            `webhook do Stripe desde então.</strong></p>` +
            `<p>Enquanto isso, quem paga e fecha a aba antes da página de obrigado carregar NÃO ` +
            `recebe a música. Foi o que aconteceu na Serenata em 18/08, por 5h29.</p>` +
            `<p>Confira nesta ordem:</p><ol>` +
            `<li><code>curl -X POST ${VIGIA_STRIPE.endpoint}</code> deve responder ` +
            `<strong>401</strong>. Se responder 500, o handler está quebrado ou falta ` +
            `<code>STRIPE_WEBHOOK_SECRET</code> no projeto. Se responder 404, o deploy não subiu.</li>` +
            `<li>Se responder 401, o problema é do lado do Stripe: confira a URL cadastrada e ` +
            `reenvie os eventos ${VIGIA_STRIPE.ondeReenviar}.</li>` +
            `</ol>`,
        });
      }
      await sb.from("funnel_events").insert({
        event_name: "alerta_webhook_mudo",
        event_data: {
          gateway: VIGIA_STRIPE.gateway,
          minutosMudo: v.minutosMudo,
          vendasSemVoz: v.semVoz,
          ultimaFala: falas?.[0]?.created_at ?? null,
        },
      });
      relatorio.alertou = true;
    }
  }

  // ── 2. PAGO NO STRIPE, PENDENTE AQUI ─────────────────────────
  //
  // Sem a chave do Stripe, não há o que conferir: o sinal 1 continua valendo.
  if (!process.env.STRIPE_SECRET_KEY) return relatorio;
  const { data: pendentes } = await sb
    .from("pedidos")
    .select("payment_id, created_at")
    .eq("gateway", VIGIA_STRIPE.gateway)
    .eq("status", "pendente")
    .gte("created_at", new Date(agora - PENDENTE_ATE_H * 3600000).toISOString())
    .lte("created_at", new Date(agora - FOLGA_STRIPE_MIN * 60000).toISOString())
    .order("created_at", { ascending: false })
    .limit(MAX_PENDENTES_CONFERIDOS);

  const pagasSemBaixa: string[] = [];
  for (const p of pendentes ?? []) {
    const sessao = String(p.payment_id ?? "").replace(/^stripe:/, "");
    if (!sessao) continue;
    try {
      const s = await lerSessao(sessao);
      if (s.payment_status === "paid") pagasSemBaixa.push(sessao);
    } catch (err) {
      // Sessão de teste lida com a chave de produção devolve 404: não é
      // incidente, é só uma sessão que esta chave não enxerga.
      console.error("[vigia-webhook] stripe: sessão ilegível", sessao.slice(0, 16), (err as Error).message);
    }
  }
  relatorio.pendentesConferidos = (pendentes ?? []).length;

  const novas: string[] = [];
  for (const sessao of pagasSemBaixa) {
    const { data: ja } = await sb
      .from("funnel_events")
      .select("id")
      .eq("event_name", "alerta_stripe_pago_pendente")
      .contains("event_data", { sessao })
      .limit(1);
    if (!(ja ?? []).length) novas.push(sessao);
  }
  relatorio.pagasSemBaixa = pagasSemBaixa.length;
  if (!novas.length) return relatorio;

  if (chave) {
    await avisarDonos({
      extras: dono,
      assunto: `🔴 [${MARCA_ATIVA.nome}] Pago no Stripe e pendente aqui: ${novas.length}`,
      html:
        `<p><strong>${novas.length} ${novas.length === 1 ? "sessão paga" : "sessões pagas"} no Stripe ` +
        `com o pedido ainda pendente no nosso banco.</strong> Nem o webhook nem a página de ` +
        `obrigado confirmaram: é gente que pagou e não recebeu a música.</p>` +
        `<ul>${novas.map((s) => `<li><code>${s}</code></li>`).join("")}</ul>` +
        `<p>Reenvie os eventos ${VIGIA_STRIPE.ondeReenviar}: a confirmação é idempotente e ` +
        `entrega uma vez só. Se o reenvio falhar, confira <code>curl -X POST ` +
        `${VIGIA_STRIPE.endpoint}</code> (deve responder 401).</p>`,
    });
  }
  for (const sessao of novas) {
    await sb.from("funnel_events").insert({
      event_name: "alerta_stripe_pago_pendente",
      event_data: { gateway: VIGIA_STRIPE.gateway, sessao },
    });
  }
  relatorio.alertouPagas = novas.length;
  return relatorio;
}

export const vigiaWebhook = inngest.createFunction(
  { id: "vigia-webhook", retries: 1, triggers: [{ cron: "*/20 * * * *" }] },
  async ({ step }) => {
    // A Ballad vigia só o Stripe; a Serenata segue exatamente como era.
    if (MARCA_ATIVA.chave === "ballad") {
      return await step.run("conferir-stripe", async () => ({
        relatorio: [await conferirStripe(db())],
      }));
    }
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
        const dono = donosMais(process.env.EMAIL_DONO ?? "agenciarocketfy@gmail.com");
        if (chave) {
          await avisarDonos({
            extras: dono,
            assunto: `🔴 ${v.nome}: webhook mudo há ${minutosMudo} minutos`,
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
