import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// A ENTREGA QUE SAI E NÃO CHEGA.
//
// ── O CASO QUE ISTO EXISTE PRA PEGAR ─────────────────────────────
//
// Sandro, 19/08: comprou duas vezes na mesma noite, R$ 54,90 cada. O e-mail
// de entrega da segunda saiu às 21:36:54 e foi entregue 3 segundos depois. O
// da PRIMEIRA saiu às 20:20:00 e NUNCA foi entregue — sem bounce, sem
// reclamação, sem nada. Só não chegou.
//
// Ele ficou 7 dias achando que tinha sido roubado, e a gente 7 dias achando
// que tinha entregue. Descobrimos porque ele escreveu; se não tivesse escrito,
// era reembolso ou avaliação ruim sem explicação.
//
// É o pior modo de falha do produto: invisível dos dois lados.
//
// ── COMO DÁ PRA VER AGORA, E NÃO DAVA ANTES ──────────────────────
//
// O Resend NÃO devolve as `tags` nos eventos de entrega (conferido em 25/08:
// 10.172 eventos seguidos com `template: null`), então até existir a tabela
// `emails_enviados` não havia como ligar "disparei" a "entregou". Agora o par
// (email_id, template) é gravado no envio e o webhook resolve por id — é esse
// par que torna esta função possível.
//
// ── POR QUE 90 MINUTOS ───────────────────────────────────────────
//
// Entrega normal chega em segundos (o do Sandro levou 3). Noventa minutos é
// uma ordem de grandeza acima de qualquer atraso legítimo de fila do Resend
// ou greylisting do destinatário, então o que sobrar aqui é problema de
// verdade e não impaciência nossa.
//
// ── SÓ O QUE CARREGA PRODUTO PAGO ────────────────────────────────
//
// `entrega` é o único template cuja falha deixa alguém que PAGOU sem nada. A
// letra, a escada e a recompra também podem não chegar, e a perda é de venda
// futura, não de produto já vendido. Alarme que dispara por tudo vira alarme
// que ninguém lê.

const PARA = "guilhermerojasiqueira@gmail.com";
const ESPERAR_MIN = 90;
// Janela de 24h: mais velho que isso já foi tratado ou já virou ticket, e
// realertar todo dia sobre o mesmo caso é o jeito de treinar o dono a ignorar.
const JANELA_H = 24;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const vigiaEntrega = inngest.createFunction(
  {
    id: "vigia-entrega",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "15 * * * *" }], // de hora em hora, fora do minuto cheio
  },
  async ({ step }) => {
    const orfaos = await step.run("achar-entrega-sem-confirmacao", async () => {
      const sb = db();
      const agora = Date.now();

      const { data: enviados } = await sb
        .from("emails_enviados")
        .select("email_id, para, created_at")
        .eq("template", "entrega")
        .gte("created_at", new Date(agora - JANELA_H * 3600000).toISOString())
        .lte("created_at", new Date(agora - ESPERAR_MIN * 60000).toISOString());

      if (!enviados?.length) return [];

      // Um SELECT só pros eventos da janela, e o cruzamento em memória: uma
      // consulta por e-mail seria dezenas de idas ao banco por rodada, e o
      // PostgREST corta em 8s (o `service_role` herda o timeout do
      // authenticator — ver o CLAUDE.md).
      const { data: eventos } = await sb
        .from("funnel_events")
        .select("event_data")
        .in("event_name", ["email_delivered", "email_bounced", "email_complained"])
        .gte("created_at", new Date(agora - (JANELA_H + 2) * 3600000).toISOString())
        .limit(20000);

      const confirmados = new Set(
        (eventos ?? []).map((e) => String((e.event_data as { email_id?: string })?.email_id)),
      );

      return (enviados ?? [])
        .filter((e) => e.email_id && !confirmados.has(e.email_id))
        .map((e) => ({
          emailId: e.email_id as string,
          para: (e.para as string | null) ?? "sem endereço",
          quando: e.created_at as string,
        }));
    });

    if (!orfaos.length) return { orfaos: 0 };

    await step.run("avisar-dono", async () => {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) return;
      const linhas = orfaos
        .slice(0, 25)
        .map(
          (o) =>
            `<li><strong>${esc(o.para)}</strong> — disparado ${esc(
              new Date(o.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
            )}<br><code style="font-size:11px;color:#888;">${esc(o.emailId)}</code></li>`,
        )
        .join("");

      await new Resend(chave).emails.send({
        from: "Serenata <contato@serenatagift.com>",
        to: [PARA],
        subject: `🔴 ${orfaos.length} entrega${orfaos.length > 1 ? "s" : ""} sem confirmação de recebimento`,
        html:
          `<p><strong>O e-mail de entrega saiu e o provedor nunca confirmou que chegou.</strong> ` +
          `Não é bounce nem reclamação: é silêncio, que foi o caso do Sandro em 19/08 — ` +
          `sete dias achando que tinha sido roubado, com a música pronta no servidor.</p>` +
          `<ul>${linhas}</ul>` +
          (orfaos.length > 25 ? `<p>…e mais ${orfaos.length - 25}.</p>` : "") +
          `<p>Procure a pessoa em <a href="https://www.serenatagift.com/recuperar">/recuperar</a> ` +
          `e reenvie os links à mão. Ela pagou e não recebeu nada.</p>`,
      });

      // Fica no rastro pra dar pra medir depois quantas entregas somem por
      // semana — número que hoje ninguém tem.
      await db()
        .from("funnel_events")
        .insert({
          event_name: "entrega_sem_confirmacao",
          event_data: { quantas: orfaos.length, ids: orfaos.slice(0, 25).map((o) => o.emailId) },
        });
    });

    return { orfaos: orfaos.length };
  },
);
