import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";

// A REPESCAGEM: música que falhou por TIMEOUT volta pra fila sozinha.
//
// ── O QUE ISTO CONSERTA ──────────────────────────────────────────
//
// Em 24/08 a kie.ai caiu. 41 músicas falharam naquele dia, 13 no seguinte, e
// elas ficaram paradas: a letra no banco, o áudio nunca. Dois dias depois,
// quando alguém foi olhar, 58 continuavam lá — inclusive as de DOIS
// compradores que já tinham pago e montado a página, e a de um terceiro que
// abriu ticket dizendo "quero pagar e não está indo" (o funil trava o checkout
// sem música pra entregar, que é a regra de ouro funcionando ao contrário).
//
// O `retries: 2` do `gerarMusica` não cobre isso: ele tenta de novo em
// segundos, e uma queda de provedor dura horas. Depois que os retries do job
// acabam, ninguém nunca mais volta naquela linha.
//
// ── POR QUE SÓ TIMEOUT ───────────────────────────────────────────
//
// As recusas do provedor ("Your lyrics contain producer tag", "Your tags
// contain artist name") vão falhar de novo do mesmo jeito: o problema está na
// LETRA, não na infra. Reenfileirar essas é queimar crédito com resultado
// conhecido, e ainda esconde o defeito real, que é o prompt deixando passar
// nome de artista.
//
// ── POR QUE ESPERAR 30 MINUTOS ───────────────────────────────────
//
// Repescar no minuto seguinte é insistir no provedor que acabou de cair, e
// duas tentativas afogadas gastam o dobro pra falhar igual. Meia hora dá tempo
// da queda passar. E o teto por rodada existe pelo mesmo motivo do disjuntor:
// numa queda longa a fila engorda, e despejar 200 gerações de uma vez quando o
// provedor voltar é a melhor maneira de derrubá-lo outra vez.

const ESPERAR_MIN = 30;
// Janela de 2 dias: mais velho que isso a pessoa já desistiu, e gerar música
// pra quem sumiu é gastar sem chance de venda.
const JANELA_DIAS = 2;
const MAX_POR_RODADA = 20;
// Teto de tentativas por música: sem isso, uma música que falha por um motivo
// que se DISFARÇA de timeout volta pra fila a cada meia hora, para sempre.
const MAX_TENTATIVAS = 3;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Quantas vezes já repescamos esta música. */
async function tentativas(sb: ReturnType<typeof db>, musicaId: string): Promise<number> {
  const { count } = await sb
    .from("funnel_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "musica_repescada")
    .contains("event_data", { musica_id: musicaId });
  return count ?? 0;
}

export const repescarFalhadas = inngest.createFunction(
  {
    id: "repescar-falhadas",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "*/30 * * * *" }],
  },
  async ({ step }) => {
    const alvos = await step.run("achar-falhadas", async () => {
      const sb = db();
      const agora = Date.now();

      const { data } = await sb
        .from("musicas")
        .select("id, titulo, quiz_response_id, created_at")
        .eq("status", "falhou")
        .not("letra", "is", null)
        .like("erro", "timeout%")
        .gte("created_at", new Date(agora - JANELA_DIAS * 864e5).toISOString())
        .lte("updated_at", new Date(agora - ESPERAR_MIN * 60000).toISOString())
        .order("created_at", { ascending: true })
        .limit(MAX_POR_RODADA * 3);

      const out: Array<{ id: string; titulo: string | null; pago: boolean }> = [];
      for (const m of data ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if ((await tentativas(sb, m.id)) >= MAX_TENTATIVAS) continue;

        // QUEM PAGOU VAI NA FRENTE. É a mesma hierarquia do disjuntor: um
        // comprador sem música é reembolso e reputação; um lead sem música é
        // R$ 0,32 que não voltou.
        const { data: pago } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", m.quiz_response_id)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle();

        out.push({ id: m.id, titulo: m.titulo, pago: Boolean(pago?.id) });
      }
      out.sort((a, b) => Number(b.pago) - Number(a.pago));
      return out;
    });

    if (!alvos.length) return { repescadas: 0 };

    let repescadas = 0;
    for (const a of alvos) {
      const ok = await step.run(`repescar-${a.id}`, async () => {
        const eventKey = process.env.INNGEST_EVENT_KEY;
        if (!eventKey) return false;
        const sb = db();

        // Recheca o status: entre a busca e agora alguém pode ter redisparado
        // à mão, e duas gerações concorrentes pra mesma música gastam dobrado.
        const { data: m } = await sb.from("musicas").select("status").eq("id", a.id).maybeSingle();
        if (m?.status !== "falhou") return false;

        const r = await fetch(`https://inn.gs/e/${eventKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "musica/gerar", data: { musicaId: a.id } }),
        });
        if (!r.ok) {
          console.error("[repescar] evento recusado:", r.status, await r.text());
          return false;
        }

        // O registro é o CONTADOR de tentativas: sem ele o teto acima não
        // existe e uma música problemática volta pra fila pra sempre.
        await sb.from("funnel_events").insert({
          event_name: "musica_repescada",
          event_data: { musica_id: a.id, pago: a.pago },
        });
        return true;
      });
      if (ok) repescadas += 1;
    }

    return { candidatas: alvos.length, repescadas };
  },
);
