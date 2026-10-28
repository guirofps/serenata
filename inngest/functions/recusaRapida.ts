import { inngest } from "../client.js";
import { cabecalhosDescadastro } from "../lib/descadastro.js";
import { estaBloqueado } from "../lib/emails-mortos.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { comUtm } from "../../src/lib/utm-email.js";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { assuntoRecusaRapida, emailRecusaRapida, textoRecusaRapida } from "../../emails/recusa-rapida.js";
import { bracoRecusaRapida, grupoDoMotivo, naHoraDeAvisar, JANELA_MIN, type GrupoRecusa } from "../../src/lib/recusa-rapida.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { pareceTypo } from "../../src/lib/email-typo.js";
import { literalLike } from "../../src/lib/sql-like.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { normalizarLocale } from "../../src/lib/i18n.js";
import { caminhoDeVolta } from "../../src/lib/volta-ao-funil.js";
import { jaTravado, soltarTrava, travarEnvio } from "../lib/trava-envio.js";

// CARTÃO RECUSADO, AVISO EM 10 MINUTOS (Ballad, teste `recusa_rapida`, 28/10).
// A regra e os textos moram em `src/lib/recusa-rapida.ts`.
//
// Lê as recusas direto do Stripe (`/v1/charges`), sem webhook novo: a conta não
// precisa de configuração nenhuma pra isto funcionar, e o "quase comprou" de
// hora em hora continua de rede embaixo. A sessão do Checkout acha o quiz pelo
// `metadata.quiz_id` e diz se a pessoa pagou depois (ou tentou de novo: a
// espera conta da ÚLTIMA recusa).

const MAX_POR_RODADA = 20;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

const SITE = process.env.VITE_APP_URL?.startsWith("http") ? process.env.VITE_APP_URL : MARCA_ATIVA.url;

async function stripeGet<T>(caminho: string): Promise<T | null> {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) return null;
  try {
    const r = await fetch(`https://api.stripe.com/v1/${caminho}`, { headers: { Authorization: `Bearer ${chave}` } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

type Cobranca = { id: string; status: string; created: number; payment_intent: string | null; failure_code: string | null; outcome?: { reason?: string | null } | null };
type Sessao = { id: string; status: string; payment_status: string; currency: string; metadata?: { quiz_id?: string } };

/** O quiz já tem pedido PAGO? Na dúvida, sim (consulta que falha não vira e-mail). */
async function quizPago(sb: ReturnType<typeof db>, quizId: string): Promise<boolean> {
  const { data, error } = await sb.from("pedidos").select("id").eq("quiz_response_id", quizId).eq("status", "pago").limit(1);
  return error ? true : (data ?? []).length > 0;
}

/** A pessoa (por e-mail, qualquer quiz) comprou nos últimos 14 dias? Na dúvida, sim. */
async function pessoaJaComprou(sb: ReturnType<typeof db>, email: string): Promise<boolean> {
  const { data, error } = await sb
    .from("pedidos")
    .select("email")
    .ilike("email", literalLike(email))
    .eq("status", "pago")
    .gte("paid_at", new Date(Date.now() - 14 * 86400000).toISOString())
    .limit(5);
  if (error) return true;
  return (data ?? []).some((x) => String(x.email ?? "").trim().toLowerCase() === email.trim().toLowerCase());
}

export const recusaRapida = inngest.createFunction(
  {
    id: "recusa-rapida",
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    if (MARCA_ATIVA.chave !== "ballad") return { pulado: "so-ballad" };

    const candidatos = await step.run("achar-recusas", async () => {
      const sb = db();
      const agora = Date.now();
      const desde = Math.floor((agora - (JANELA_MIN + 10) * 60000) / 1000);
      const cobrancas: Cobranca[] = [];
      let depois: string | null = null;
      for (let i = 0; i < 5; i++) {
        const pg: { data: Cobranca[]; has_more: boolean } | null = await stripeGet<{ data: Cobranca[]; has_more: boolean }>(
          `charges?limit=100&created[gte]=${desde}${depois ? `&starting_after=${depois}` : ""}`,
        );
        if (!pg) break;
        cobrancas.push(...pg.data);
        if (!pg.has_more || !pg.data.length) break;
        depois = pg.data[pg.data.length - 1].id;
      }

      // Por PaymentIntent: a ÚLTIMA recusa decide a hora e o motivo; uma
      // cobrança aprovada no mesmo PI tira ele da lista.
      const porPi = new Map<string, { ultima: Cobranca; aprovada: boolean }>();
      for (const c of cobrancas) {
        if (!c.payment_intent) continue;
        const atual = porPi.get(c.payment_intent) ?? { ultima: c, aprovada: false };
        if (c.status === "succeeded") atual.aprovada = true;
        if (c.status === "failed" && c.created >= atual.ultima.created) atual.ultima = c;
        porPi.set(c.payment_intent, atual);
      }

      const out: Array<{
        quizId: string; quizCriadoEm: string; email: string; nome: string; titulo: string; link: string;
        locale: "es" | "en"; grupo: GrupoRecusa; motivo: string; mexico: boolean;
      }> = [];
      const vistos = new Set<string>();
      for (const [pi, { ultima, aprovada }] of porPi) {
        if (out.length >= MAX_POR_RODADA) break;
        if (aprovada || ultima.status !== "failed") continue;
        if (!naHoraDeAvisar(ultima.created * 1000, agora)) continue;
        const motivo = ultima.outcome?.reason || ultima.failure_code || "";
        const grupo = grupoDoMotivo(motivo);
        if (!grupo) continue;

        const lista = await stripeGet<{ data: Sessao[] }>(`checkout/sessions?payment_intent=${encodeURIComponent(pi)}&limit=1`);
        const sessao = lista?.data?.[0];
        const quizId = sessao?.metadata?.quiz_id;
        if (!sessao || !quizId || vistos.has(quizId)) continue;
        vistos.add(quizId);
        if (sessao.payment_status === "paid" || sessao.status === "complete") continue;

        const { data: q } = await sb
          .from("quiz_responses")
          .select("id, session_id, email, respostas, locale, created_at")
          .eq("id", quizId)
          .maybeSingle();
        if (!q?.id || !q.email || pareceTypo(q.email as string)) continue;
        if (await quizPago(sb, q.id as string)) continue;
        if (await pessoaJaComprou(sb, q.email as string)) continue;
        if (await jaTravado(sb, "recusa_rapida", { quiz_response_id: q.id }, q.created_at as string)) continue;

        const { data: m } = await sb.from("musicas").select("titulo, status").eq("quiz_response_id", q.id).maybeSingle();
        if (!m || m.status !== "pronta") continue;

        const volta = caminhoDeVolta(q.session_id as string | null);
        if (!volta.startsWith("/retomar")) continue;
        const locale = normalizarLocale((q as { locale?: string }).locale) === "es" ? "es" : "en";
        out.push({
          quizId: q.id as string,
          quizCriadoEm: q.created_at as string,
          email: q.email as string,
          nome: ((q.respostas ?? {}) as Record<string, string>).nome?.trim() || (locale === "es" ? "esa persona" : "someone you love"),
          titulo: m.titulo ?? (locale === "es" ? "Tu canción" : "Your song"),
          link: `${SITE}${volta}&de=recusa`,
          locale,
          grupo,
          motivo,
          // O caixa em peso é só pra quem está no México (`preco-mxn.ts`).
          mexico: String(sessao.currency).toLowerCase() === "mxn",
        });
      }
      return out;
    });

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`recusa-${c.quizId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        if (await quizPago(sb, c.quizId)) return false;
        if (await jaTravado(sb, "recusa_rapida", { quiz_response_id: c.quizId }, c.quizCriadoEm)) return false;
        if (await estaBloqueado(sb, c.email, { incluirExcluidos: true })) return false;

        // A trava vale pros DOIS braços: no A ela é o registro de quem teve
        // recusa (a leitura), no B é o "já mandei" e o sinal pro "quase
        // comprou" não mandar outro por cima.
        const braco = bracoRecusaRapida(c.quizId);
        const trava = await travarEnvio(sb, {
          event_name: "recusa_rapida",
          event_data: { quiz_response_id: c.quizId, email: c.email, braco, motivo: c.motivo, grupo: c.grupo, mexico: c.mexico },
        });
        if (!trava || braco !== "B") return false;

        const args = { nome: c.nome, titulo: c.titulo, link: c.link, locale: c.locale, grupo: c.grupo, mexico: c.mexico };
        const { data: enviado, error } = await comUtm(new Resend(chave)).emails.send({
          tags: [{ name: "template", value: "recusa_rapida" }],
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: [c.email],
          headers: cabecalhosDescadastro(c.email),
          subject: assuntoRecusaRapida(args),
          html: emailRecusaRapida(args),
          text: textoRecusaRapida(args),
        });
        if (error) {
          console.error("[recusa-rapida] envio falhou:", error.message);
          await soltarTrava(sb, trava);
          return false;
        }
        await registrarEnvio(sb, { emailId: enviado?.id, template: "recusa_rapida", para: c.email, quizResponseId: c.quizId });
        return true;
      });
      if (ok) enviados += 1;
    }
    return { candidatos: candidatos.length, enviados };
  },
);
