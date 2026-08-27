import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// O VIGIA DA GERAÇÃO — e ele CONSERTA antes de avisar.
//
// ── O QUE ELE EXISTE PRA IMPEDIR ─────────────────────────────────
//
// Em 26/08 às 21:00 um import quebrado derrubou o `/api/inngest` inteiro. O
// endpoint ficou QUATRO HORAS fora, 65 músicas pararam em `aguardando`, e
// nada avisou: a falha só apareceu quando alguém foi rodar outro comando.
//
// Já existia vigia pro webhook do gateway (`vigiaWebhook`), pro saldo do
// kie.ai (`vigiarSaldo`) e pra entrega de e-mail (`vigiaEntrega`). Não havia
// nenhum pro coração do produto, que é a música sair.
//
// ── POR QUE ELE CONSERTA, E NÃO SÓ GRITA ─────────────────────────
//
// Alerta que só avisa depende de alguém acordado pra virar conserto. Na
// madrugada de 26/08 esse alguém não existia, e as 65 ficaram paradas até de
// manhã.
//
// A maior parte desses casos se resolve sozinha reenfileirando: música em
// `aguardando` com letra pronta só precisa do evento que se perdeu. Então
// este job REDISPARA primeiro, e só chama o dono quando o conserto automático
// não deu conta — que é quando o problema é de verdade.
//
// A hierarquia é a mesma do disjuntor e da repescagem: quem PAGOU vai na
// frente da fila.
//
// ── POR QUE ELE NÃO SE ENGANA COM MADRUGADA VAZIA ────────────────
//
// "Nenhuma música em 20 minutos" às 4h da manhã é normal, não é falha. O
// gatilho é a COMPARAÇÃO: existe letra nova sendo escrita (ou seja, tem
// gente no funil) E nenhuma música ficou pronta no mesmo período. Sem
// tráfego, o vigia dorme junto.

const PARA = "guilhermerojasiqueira@gmail.com";

/** Quanto tempo sem música pronta, HAVENDO tráfego, já é suspeito. */
const JANELA_MIN = 20;
/** Presa há mais que isso é candidata a redisparo. */
const PRESA_MIN = 12;
/** Teto por rodada: numa queda longa a fila engorda, e despejar tudo de uma
 *  vez quando o provedor volta é a melhor forma de derrubá-lo de novo. */
const MAX_REDISPARO = 25;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const vigiaGeracao = inngest.createFunction(
  {
    id: "vigia-geracao",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "*/10 * * * *" }], // de 10 em 10 minutos
  },
  async ({ step }) => {
    const diagnostico = await step.run("medir", async () => {
      const sb = db();
      const agora = Date.now();
      const desde = new Date(agora - JANELA_MIN * 60000).toISOString();

      // TEM GENTE NO FUNIL? Letra escrita é a prova de tráfego vivo, e é o
      // que separa "quebrou" de "são quatro da manhã".
      const { count: letrasNovas } = await sb
        .from("musicas")
        .select("id", { count: "exact", head: true })
        .gte("created_at", desde)
        .not("letra", "is", null);

      // SAIU ALGUMA MÚSICA?
      const { count: prontasNaJanela } = await sb
        .from("musicas")
        .select("id", { count: "exact", head: true })
        .gte("gerada_em", desde);

      // O QUE ESTÁ PRESO, com quem pagou na frente.
      const { data: presas } = await sb
        .from("musicas")
        .select("id, titulo, quiz_response_id, created_at")
        .eq("status", "aguardando")
        .not("letra", "is", null)
        .lte("created_at", new Date(agora - PRESA_MIN * 60000).toISOString())
        .gte("created_at", new Date(agora - 12 * 3600000).toISOString())
        .order("created_at", { ascending: true })
        .limit(MAX_REDISPARO * 3);

      const lista: Array<{ id: string; titulo: string | null; pago: boolean }> = [];
      for (const m of presas ?? []) {
        if (lista.length >= MAX_REDISPARO) break;
        const { data: pago } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", m.quiz_response_id)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle();
        lista.push({ id: m.id, titulo: m.titulo, pago: Boolean(pago?.id) });
      }
      lista.sort((a, b) => Number(b.pago) - Number(a.pago));

      return {
        letrasNovas: letrasNovas ?? 0,
        prontasNaJanela: prontasNaJanela ?? 0,
        presas: lista,
        totalPresas: (presas ?? []).length,
      };
    });

    // Funil parado E ninguém entrando: madrugada. Não é falha.
    if (!diagnostico.presas.length && diagnostico.letrasNovas === 0) {
      return { ok: true, motivo: "sem tráfego" };
    }

    // ── 1. CONSERTA ────────────────────────────────────────────────
    const redisparadas = await step.run("redisparar-presas", async () => {
      const eventKey = process.env.INNGEST_EVENT_KEY;
      if (!eventKey || !diagnostico.presas.length) return 0;
      let n = 0;
      for (const m of diagnostico.presas) {
        const r = await fetch(`https://inn.gs/e/${eventKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "musica/gerar", data: { musicaId: m.id } }),
        });
        if (r.ok) n += 1;
      }
      if (n) {
        await db()
          .from("funnel_events")
          .insert({
            event_name: "vigia_geracao_redisparou",
            event_data: { quantas: n, pagos: diagnostico.presas.filter((m) => m.pago).length },
          });
      }
      return n;
    });

    // ── 2. SÓ AVISA SE O CONSERTO NÃO EXPLICA ──────────────────────
    //
    // Uma fila pequena que voltou pra fila é operação normal. O que merece
    // acordar alguém é o sinal de PARADA: tem gente escrevendo letra e não
    // saiu música nenhuma, ou a fila presa é grande demais pra ser soluço.
    const paradaReal =
      (diagnostico.letrasNovas >= 3 && diagnostico.prontasNaJanela === 0) ||
      diagnostico.totalPresas >= 15;

    if (!paradaReal) return { ok: true, redisparadas };

    await step.run("avisar-dono", async () => {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) return;
      const pagos = diagnostico.presas.filter((m) => m.pago).length;
      await new Resend(chave).emails.send({
        from: "Serenata <contato@serenatagift.com>",
        to: [PARA],
        subject: `🔴 A GERAÇÃO DE MÚSICA PAROU (${diagnostico.totalPresas} presas)`,
        html:
          `<p><strong>Nos últimos ${JANELA_MIN} minutos entraram ` +
          `${diagnostico.letrasNovas} letras novas e ficaram prontas ` +
          `${diagnostico.prontasNaJanela} músicas.</strong></p>` +
          `<p>Presas: <strong>${diagnostico.totalPresas}</strong>, sendo ` +
          `<strong>${pagos} de quem já pagou</strong>.<br>` +
          `Redisparei ${redisparadas} agora; se este e-mail se repetir na ` +
          `próxima rodada, o redisparo não está resolvendo.</p>` +
          `<p>Onde olhar, na ordem:<br>` +
          `1. <code>/api/inngest</code> responde? (500 ali derruba TODAS as ` +
          `funções — foi o que aconteceu em 26/08, quatro horas fora)<br>` +
          `2. Saldo do kie.ai<br>` +
          `3. O provedor está de pé?</p>`,
      });
    });

    return { ok: false, redisparadas, presas: diagnostico.totalPresas };
  },
);
