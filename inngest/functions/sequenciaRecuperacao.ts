import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  emailSequencia,
  assuntoSequencia,
  type NumeroDaSequencia,
} from "../../emails/sequencia.js";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { pareceTypo } from "../../src/lib/email-typo.js";

// A SEQUÊNCIA DE RECUPERAÇÃO: e-mails 2, 3 e 4.
//
// O e-mail 1 (a letra) já roda em `mandarLetra` e é uma fila FINITA: pega quem
// passou pelo funil e nunca recebeu nada. Ela secou — 117 envios em 08/08, 76
// em 09/08, 23 em 10/08. E como 5 das 8 vendas de 09/08 vieram dela, o funil
// perdeu junto uma parte grande do que estava vendendo.
//
// Esta função é o motor que substitui aquela fila: recorrente por natureza,
// porque todo dia entra gente nova no topo.
//
// O que autorizou escrever isto: 216 envios do e-mail 1 produziram 7 compras,
// 18 cliques em comprar e UM descadastro. A caixa de entrada aguenta.

const SITE = "https://www.serenatagift.com";

// Espaçamento, contado a partir do e-mail ANTERIOR de cada pessoa.
//
// Não é intervalo fixo desde o quiz: quem recebeu o 1 atrasado (a fila drena a
// 10 por rodada) receberia o 2 quase junto, e dois e-mails no mesmo dia é o
// tipo de coisa que faz a pessoa marcar spam mesmo gostando do produto.
const ESPERA_H: Record<NumeroDaSequencia, number> = {
  2: 24, // no dia seguinte: a gravação ficou pronta depois que ela saiu
  3: 72, // três dias depois do 2
  4: 120, // cinco dias depois do 3 — e aí para
};

// Janela de entrada. Mais velho que isso não entra na sequência: e-mail sobre
// uma letra de mês passado chega como cobrança, não como lembrança.
const OLHAR_ATE_DIAS = 30;

// Teto por rodada, pelo mesmo motivo do `mandarLetra`: `envio.serenatagift.com`
// é domínio novo, e pico de volume em remetente sem histórico é a assinatura
// de lista comprada.
const MAX_POR_RODADA = 10;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Lê tudo, paginado. `funnel_events` passa de 1000 linhas e o PostgREST corta
 * em silêncio — bug que já custou uma leitura errada neste projeto.
 *
 * `chave` existe porque paginar EXIGE uma ordenação estável, e nem toda tabela
 * daqui tem `id`: `excluidos_email` e `descadastros` são chaveadas por e-mail.
 * Fixar "id" derrubava a função inteira com "column does not exist" — e como
 * ela roda em cron, o erro não aparecia em lugar nenhum: só não saía e-mail.
 */
async function paginado<T>(
  sb: ReturnType<typeof db>,
  tabela: string,
  colunas: string,
  montar?: (q: any) => any,
  chave = "id",
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from(tabela).select(colunas).order(chave, { ascending: true }).range(de, de + 999);
    if (montar) q = montar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

export const sequenciaRecuperacao = inngest.createFunction(
  { id: "sequencia-recuperacao", retries: 1, triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    const fila = await step.run("montar-fila", async () => {
      const sb = db();
      const agora = Date.now();

      // Quem recebeu o e-mail 1. É o único jeito de entrar na sequência: sem
      // ele a pessoa receberia o "a música ficou pronta" sem nunca ter recebido
      // a letra, e a conversa começaria pelo meio.
      type Ev = { event_data: Record<string, unknown> | null; created_at: string };
      const enviados = await paginado<Ev>(sb, "funnel_events", "id, event_data, created_at", (q) =>
        q.in("event_name", ["email_letra_enviado", "email_sequencia_enviado"]),
      );

      // Última correspondência de cada pessoa, e até onde ela já foi na régua.
      const ultimo = new Map<string, { quando: number; numero: number }>();
      for (const e of enviados) {
        const id = String(e.event_data?.quiz_response_id ?? "");
        if (!id) continue;
        const numero = Number(e.event_data?.numero ?? 1);
        const quando = new Date(e.created_at).getTime();
        const atual = ultimo.get(id);
        if (!atual || numero > atual.numero) ultimo.set(id, { quando, numero });
      }
      if (!ultimo.size) return [];

      const [fora, excl, pagos, leads] = await Promise.all([
        // Chaveadas por e-mail: não têm coluna `id`.
        paginado<{ email: string }>(sb, "descadastros", "email", undefined, "email"),
        paginado<{ email: string }>(sb, "excluidos_email", "email", undefined, "email"),
        paginado<{ quiz_response_id: string | null; email: string | null }>(
          sb,
          "pedidos",
          "id, quiz_response_id, email",
          (q) => q.eq("status", "pago"),
        ),
        paginado<{
          id: string;
          session_id: string | null;
          email: string | null;
          respostas: Record<string, string> | null;
          locale: string | null;
          created_at: string;
        }>(sb, "quiz_responses", "id, session_id, email, respostas, locale, created_at", (q) =>
          q.gte("created_at", new Date(agora - OLHAR_ATE_DIAS * 86400000).toISOString()),
        ),
      ]);

      const bloqueado = new Set<string>([
        ...fora.map((x) => x.email.toLowerCase()),
        ...excl.map((x) => x.email.toLowerCase()),
        ...pagos.map((x) => (x.email ?? "").toLowerCase()).filter(Boolean),
      ]);
      const comprou = new Set(pagos.map((x) => x.quiz_response_id).filter(Boolean));
      const porId = new Map(leads.map((l) => [l.id, l]));

      const out: Array<{
        quizId: string;
        sessao: string;
        email: string;
        nome: string;
        numero: NumeroDaSequencia;
        locale: "pt" | "es";
      }> = [];

      for (const [quizId, { quando, numero }] of ultimo) {
        if (out.length >= MAX_POR_RODADA) break;
        if (numero >= 4) continue; // a régua acabou; o 4 é o último de propósito
        const proximo = (numero + 1) as NumeroDaSequencia;

        const l = porId.get(quizId);
        if (!l?.email) continue;
        if (bloqueado.has(l.email.toLowerCase())) continue;
        // Por e-mail E por quiz: a compra pode ter sido feita com outro
        // endereço, e aí só o vínculo do pedido pega.
        if (comprou.has(quizId)) continue;
        // Endereço quebrado não entra: bounce em domínio novo é o dano mais
        // caro que existe, e a trava é a mesma do `mandarLetra`.
        if (pareceTypo(l.email)) continue;

        const horas = (agora - quando) / 3600000;
        if (horas < ESPERA_H[proximo]) continue;

        const locale = l.locale === "es" ? "es" : "pt";
        const r = (l.respostas ?? {}) as Record<string, string>;
        out.push({
          quizId,
          sessao: l.session_id ?? "",
          email: l.email,
          nome: r.nome?.trim() || (locale === "es" ? "esa persona" : "quem você ama"),
          numero: proximo,
          locale,
        });
      }
      return out;
    });

    if (!fila.length) return { enviados: 0 };

    const enviados = await step.run("enviar", async () => {
      const sb = db();
      const chave = process.env.RESEND_API_KEY;
      if (!chave) throw new Error("RESEND_API_KEY ausente");
      const resend = new Resend(chave);
      let n = 0;

      for (const p of fila) {
        // `/retomar` e não o funil cru: aquela rota busca a letra no servidor
        // pelo session_id, reidrata o navegador e ADOTA a sessão — o que faz
        // uma compra vinda deste e-mail casar com o quiz pelo mesmo `src`.
        const link = `${SITE}/retomar?s=${encodeURIComponent(p.sessao)}`;
        const linkDescadastro = `${SITE}/descadastrar?s=${encodeURIComponent(p.sessao)}&lang=${p.locale}`;

        const { error } = await resend.emails.send({
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: [p.email],
          subject: assuntoSequencia(p.numero, p.nome, p.locale),
          html: emailSequencia({
            numero: p.numero,
            nome: p.nome,
            link,
            linkDescadastro,
            locale: p.locale,
          }),
          headers: {
            "List-Unsubscribe": `<${linkDescadastro}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (error) {
          console.error("[sequencia] envio falhou:", p.email, p.numero, error.message);
          continue;
        }
        n++;
        // O `numero` aqui é o que faz a régua andar: a próxima rodada lê este
        // evento pra saber em que degrau a pessoa está. Sem ele, todo mundo
        // receberia o 2 pra sempre.
        await sb.from("funnel_events").insert({
          session_id: p.sessao || null,
          event_name: "email_sequencia_enviado",
          event_data: {
            numero: p.numero,
            quiz_response_id: p.quizId,
            email: p.email,
            locale: p.locale,
          },
        });
      }
      return n;
    });

    return { enviados, naFila: fila.length };
  },
);
