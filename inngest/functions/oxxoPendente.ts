import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { cabecalhosDescadastro } from "../lib/descadastro.js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { jaComprou } from "../lib/ja-comprou.js";
import { soltarTrava, travarEnvio } from "../lib/trava-envio.js";
import { comUtm } from "../../src/lib/utm-email.js";
import { REMETENTE_TRANSACIONAL, RESPONDER_PARA } from "../../emails/remetentes.js";
import { assuntoOxxoPendente, emailOxxoPendente, textoOxxoPendente } from "../../emails/oxxo-pendente.js";
import {
  LIGADO,
  bracoOxxoPendente,
  horaBoaNoMexico,
  quandoVence,
  toqueDevido,
  venceHojeOuAmanha,
  type Toque,
} from "../../src/lib/oxxo-pendente.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { caminhoDeVolta } from "../../src/lib/volta-ao-funil.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { paisDoQuiz } from "../../src/lib/pais-quiz.js";
import { formatarNaMoeda, mercadoDaMoeda, unidadeMenorDe } from "../../src/lib/mercados.js";
import { confirmarPagamentoDlocal, lerPagamentoDlocal, dlocalConfigurado } from "../../api/lib/dlocalgo.js";

// A FICHA DO OXXO QUE NÃO FOI PAGA (Ballad México, teste `oxxo_pendente`, 28/10).
// A regra e o porquê moram em `src/lib/oxxo-pendente.ts`, a copy em
// `emails/oxxo-pendente.ts`.
//
// A trava (`oxxo_pendente`) grava o pagamento, o toque e o braço nos DOIS
// braços, e é ela que diz qual toque já foi: no A ninguém recebe, mas o
// calendário anda igual, pra a leitura comparar as mesmas fichas.

const MAX_POR_RODADA = 20;
const EVENTO = "oxxo_pendente";

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

const SITE = process.env.VITE_APP_URL?.startsWith("http") ? process.env.VITE_APP_URL : MARCA_ATIVA.url;

/** Os toques já registrados desta ficha. Erro = trata como se tivesse os dois (não manda). */
async function toquesFeitos(
  sb: ReturnType<typeof db>,
  paymentId: string,
  desde: string,
): Promise<{ feitos: Set<Toque>; ultimoEm: number | null } | null> {
  const { data, error } = await sb
    .from("funnel_events")
    .select("event_data, created_at")
    .eq("event_name", EVENTO)
    .contains("event_data", { payment_id: paymentId })
    .gte("created_at", desde)
    .limit(10);
  if (error) return null;
  const feitos = new Set<Toque>();
  let ultimoEm: number | null = null;
  for (const e of data ?? []) {
    const t = Number((e.event_data as { toque?: number } | null)?.toque);
    if (t === 1 || t === 2) feitos.add(t);
    const em = Date.parse(e.created_at as string);
    if (!ultimoEm || em > ultimoEm) ultimoEm = em;
  }
  return { feitos, ultimoEm };
}

export const oxxoPendente = inngest.createFunction(
  {
    id: "oxxo-pendente",
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ cron: "*/20 * * * *" }],
  },
  async ({ step }) => {
    if (MARCA_ATIVA.chave !== "ballad" || !LIGADO || !dlocalConfigurado()) return { pulado: "fora" };
    if (!horaBoaNoMexico(Date.now())) return { pulado: "fora-do-horario" };

    const candidatos = await step.run("achar-fichas", async () => {
      const sb = db();
      const agora = Date.now();
      const { data: pedidos, error } = await sb
        .from("pedidos")
        .select("payment_id, quiz_response_id, email, pix_url, pix_expira, created_at")
        .eq("gateway", "dlocalgo")
        .eq("status", "pendente")
        .gte("created_at", new Date(agora - 4 * 86400e3).toISOString())
        .gt("pix_expira", new Date(agora).toISOString())
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);

      const out: Array<{
        paymentId: string;
        quizId: string;
        sessao: string | null;
        email: string;
        nome: string;
        linkFicha: string;
        criadaEm: string;
        venceEm: number;
        toque: Toque;
      }> = [];
      const vistos = new Set<string>();
      for (const p of pedidos ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        const quizId = p.quiz_response_id as string | null;
        const link = String(p.pix_url ?? "");
        if (!quizId || !link.startsWith("https://") || vistos.has(quizId)) continue;
        const venceEm = Date.parse(p.pix_expira as string);
        const r = await toquesFeitos(sb, p.payment_id as string, p.created_at as string);
        if (!r) continue;
        const toque = toqueDevido({ criadaEm: Date.parse(p.created_at as string), venceEm, agora, ...r });
        if (!toque) continue;

        const { data: q } = await sb
          .from("quiz_responses")
          .select("id, session_id, email, respostas, locale")
          .eq("id", quizId)
          .maybeSingle();
        const email = String(q?.email ?? p.email ?? "").trim();
        if (!q || q.locale !== "es" || !email) continue;
        // A COPY FALA DE OXXO (29/10). Hoje a dLocal só existe no México
        // (`temDlocal`), mas no dia em que ligar em outro país a ficha de lá
        // não é OXXO: até esse e-mail ganhar texto próprio, quiz com país
        // gravado fora do México não recebe. Quiz sem país (antigo) segue.
        const pais = await paisDoQuiz(sb, { id: quizId });
        if (pais && pais !== "MX") continue;
        // Pagou de outro jeito (cartão), ou comprou outra música: não é com ela.
        const { data: pago } = await sb.from("pedidos").select("id").eq("quiz_response_id", quizId).eq("status", "pago").limit(1);
        if (pago?.length) continue;
        if (await jaComprou(sb, quizId, email)) continue;

        vistos.add(quizId);
        out.push({
          paymentId: p.payment_id as string,
          quizId,
          sessao: (q.session_id as string | null) ?? null,
          email,
          nome: ((q.respostas ?? {}) as Record<string, string>).nome?.trim() || "esa persona",
          linkFicha: link,
          criadaEm: p.created_at as string,
          venceEm,
          toque,
        });
      }
      return out;
    });

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`ficha-${c.paymentId}-${c.toque}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        const r = await toquesFeitos(sb, c.paymentId, c.criadaEm);
        if (!r || r.feitos.has(c.toque)) return false;

        // A FONTE DIZ SE PAGOU. O webhook pode ter perdido o aviso: pago aqui
        // vira entrega (a mesma confirmação do webhook, com a trava dele), e
        // ninguém recebe "a sua ficha continua valendo" depois de pagar.
        const id = c.paymentId.slice("dlocalgo:".length);
        let valor: string | null = null;
        try {
          const pg = await lerPagamentoDlocal(id);
          if (pg.status === "PAID") {
            await confirmarPagamentoDlocal(sb, id);
            return false;
          }
          if (pg.status !== "PENDING") return false;
          // O valor da ficha escrito como a página escreve (`mercados.ts`).
          const mercado = mercadoDaMoeda(pg.currency);
          if (mercado && mercado.moeda !== "usd" && Number(pg.amount) > 0) {
            valor = formatarNaMoeda(mercado, unidadeMenorDe(mercado, Number(pg.amount)));
          }
        } catch (err) {
          console.error("[oxxo-pendente] dLocal ilegível, sem envio:", c.paymentId, err);
          return false;
        }
        if (await estaBloqueado(sb, c.email, { incluirExcluidos: true })) return false;

        const braco = bracoOxxoPendente(c.quizId);
        const trava = await travarEnvio(sb, {
          event_name: EVENTO,
          event_data: { payment_id: c.paymentId, quiz_response_id: c.quizId, email: c.email, toque: c.toque, braco },
        });
        if (!trava || braco !== "B") return false;

        const volta = caminhoDeVolta(c.sessao);
        const agora = Date.now();
        const args = {
          nome: c.nome,
          toque: c.toque,
          linkFicha: c.linkFicha,
          linkCartao: volta.startsWith("/retomar") ? `${SITE}${volta}&de=oxxo` : null,
          vence: quandoVence(c.venceEm),
          quando: venceHojeOuAmanha(c.venceEm, agora),
          valor,
        };
        const { data: enviado, error } = await comUtm(new Resend(chave)).emails.send({
          tags: [{ name: "template", value: `oxxo_pendente_${c.toque}` }],
          from: REMETENTE_TRANSACIONAL,
          replyTo: RESPONDER_PARA,
          to: [c.email],
          headers: cabecalhosDescadastro(c.email),
          subject: assuntoOxxoPendente(args),
          html: emailOxxoPendente(args),
          text: textoOxxoPendente(args),
        });
        if (error) {
          console.error("[oxxo-pendente] envio falhou:", error.message);
          await soltarTrava(sb, trava);
          return false;
        }
        await registrarEnvio(sb, { emailId: enviado?.id, template: `oxxo_pendente_${c.toque}`, para: c.email, quizResponseId: c.quizId });
        return true;
      });
      if (ok) enviados += 1;
    }
    return { candidatos: candidatos.length, enviados };
  },
);
