import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { emailOcasiao, assuntoOcasiao } from "../../emails/ocasiao.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import {
  OCASIAO_PROIBIDA,
  ocasiaoDeHoje,
  primeiroNome,
  templateDaOcasiao,
} from "../../src/lib/ocasioes.js";

// RECOMPRA POR DATA DO CALENDÁRIO.
//
// ── POR QUE NÃO É O `volteCriar` COM OUTRO TEXTO ─────────────────
//
// O `volteCriar` dispara 5 a 30 dias depois da compra, uma vez por pessoa
// para sempre. Medido no Raio-X de 07/09: 511 envios, ZERO vendas.
//
// Ele não pode ser consertado por dentro, porque o defeito é o gatilho.
// "Faz uns dias que você comprou" não é motivo pra presentear ninguém, e
// quem recebeu em agosto está travado para sempre — nunca vai ouvir da
// gente no Dia das Mães.
//
// Este dispara na DATA, para quem a data faz sentido, e uma vez por
// temporada (o template carrega o ano). São réguas diferentes e as duas
// podem existir; a trava lá embaixo impede que a mesma pessoa receba as
// duas na mesma semana.
//
// ── O QUE FAZ ELE VALER ──────────────────────────────────────────
//
// Medido em 08/09, sobre 2.313 compradores de 90 dias:
//
//   99%  nunca fizeram música para a MÃE
//   97%  nunca fizeram para um FILHO
//   606  (26,2%) escreveram o NOME do filho no quiz
//
// A base inteira fez música romântica pra parceira (63% esposa). O e-mail
// que diz "e o João, nunca teve a dele?" fala de alguém que existe, com o
// nome que a própria pessoa escreveu, numa data em que presente é esperado.
//
// ── QUEM NUNCA RECEBE ────────────────────────────────────────────
//
//   `ocasiao = memorial`  gente que perdeu alguém. Oferta alegre ali não é
//                         erro de marketing, é falta de leitura.
//   sem nome extraível    campo livre traz "-", "nao tenho", "1". Sem nome
//                         o e-mail vira genérico, que é exatamente o que
//                         já provou não funcionar.
//   quem já fez pra filho O e-mail perde o sentido: ele já tem a dele.
//   descadastrado / morto As mesmas listas do `volteCriar`. O domínio está
//                         em 96,6% de entrega e zero reclamação de spam.

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";

// Teto por rodada, pelo mesmo motivo dos outros disparos: pico de volume é
// o que assina lista comprada. A fila do Dia das Crianças tem ~590 pessoas
// e a janela é de 18 dias — a 12 por rodada, 10 rodadas por dia, são 120/dia
// e ela drena em cinco dias, sem encostar no teto do domínio.
const MAX_POR_RODADA = 12;

/** Compradores dos últimos 180 dias. Mais velho que isso vira e-mail frio. */
const JANELA_DIAS = 180;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const ocasiaoCalendario = inngest.createFunction(
  {
    id: "ocasiao-calendario",
    retries: 1,
    // Cron do Inngest é UTC e o Brasil é UTC-3: 12h-23h UTC dá 9h-20h aqui.
    // E-mail de venda que chega às 3 da manhã é lido às 9 junto com outros
    // vinte, ou nunca. Os transacionais continuam saindo a qualquer hora.
    triggers: [{ cron: "50 12-23 * * *" }],
  },
  async ({ step }) => {
    const alvo = ocasiaoDeHoje();
    if (!alvo) return { pulado: "nenhuma ocasiao na janela" };

    const { ocasiao, ano } = alvo;
    const template = templateDaOcasiao(ocasiao.slug, ano);
    const [mes, dia] = ocasiao.dia.split("-").map(Number);
    const diasQueFaltam = Math.max(
      1,
      Math.round((Date.UTC(ano, mes - 1, dia) - Date.now() + 3 * 3600000) / 86400000),
    );

    const fila = await step.run(`achar-quem-recebe-${ocasiao.slug}`, async () => {
      const sb = db();
      const desde = new Date(Date.now() - JANELA_DIAS * 86400000).toISOString();

      const [{ data: pedidos }, { data: jaMandados }, { data: descadastrados }, { data: mortos }] =
        await Promise.all([
          sb
            .from("pedidos")
            .select("email, quiz_response_id, paid_at, dinheiro_entrou")
            .eq("status", "pago")
            .gte("paid_at", desde),
          // A trava é por TEMPLATE, e o template tem o ano dentro: quem
          // recebeu o Dia das Crianças de 2026 pode receber o de 2027.
          sb.from("emails_enviados").select("para").eq("template", template).limit(5000),
          sb.from("excluidos_email").select("email"),
          sb.from("emails_mortos").select("email"),
        ]);

      const bloqueado = new Set<string>([
        ...(jaMandados ?? []).map((x) => String(x.para ?? "").toLowerCase()).filter(Boolean),
        ...(descadastrados ?? []).map((x) => x.email.toLowerCase()),
        ...(mortos ?? []).map((x) => x.email.toLowerCase()),
      ]);

      // Todas as relações que cada e-mail já homenageou, pra pular quem já
      // fez música pro filho — o e-mail perderia o sentido.
      const jaFezPara = new Map<string, Set<string>>();
      const porEmail = new Map<string, { quizId: string; paidAt: string }>();
      for (const p of pedidos ?? []) {
        const email = (p.email ?? "").trim().toLowerCase();
        // Resgate de crédito não é compra nova.
        if (!email || !p.quiz_response_id || p.dinheiro_entrou === false) continue;
        // A compra MAIS RECENTE de cada pessoa: é a história mais fresca, e
        // é o nome que ela vai reconhecer no e-mail.
        const atual = porEmail.get(email);
        if (!atual || p.paid_at > atual.paidAt) {
          porEmail.set(email, { quizId: p.quiz_response_id, paidAt: p.paid_at });
        }
      }

      const out: Array<{
        email: string; filho: string; nomeMusica: string; locale: "pt" | "es"; quizId: string;
      }> = [];

      for (const [email, { quizId }] of porEmail) {
        if (out.length >= MAX_POR_RODADA) break;
        if (bloqueado.has(email)) continue;

        const { data: q } = await sb
          .from("quiz_responses")
          .select("respostas, locale")
          .eq("id", quizId)
          .maybeSingle();
        const respostas = (q?.respostas ?? {}) as Record<string, unknown>;

        // Memorial nunca recebe oferta alegre. Regra dura, vale sempre.
        if (String(respostas.ocasiao ?? "").toLowerCase().includes(OCASIAO_PROIBIDA)) continue;

        // Já fez pra essa relação? O e-mail não faz sentido pra ela.
        const relacao = String(respostas.relacao ?? "").toLowerCase();
        if (ocasiao.pulaSeJaFezPara.some((r) => relacao.includes(r))) continue;

        // O campo que a ocasião exige, se exigir.
        if (ocasiao.exigeCampo && !String(respostas[ocasiao.exigeCampo] ?? "").trim()) continue;
        const filho = ocasiao.exigeCampo
          ? primeiroNome(respostas[ocasiao.exigeCampo])
          : String(respostas.nome ?? "").trim() || null;
        // Sem nome limpo, fora: assunto genérico é o que já falhou.
        if (!filho) continue;

        const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";
        out.push({
          email,
          filho,
          nomeMusica: String(respostas.nome ?? "").trim() || (locale === "es" ? "esa persona" : "essa pessoa"),
          locale,
          quizId,
        });
      }
      return out;
    });

    if (!fila.length) return { ocasiao: ocasiao.slug, enviados: 0 };

    // Um passo POR PESSOA: se um envio falhar, o Inngest reexecuta só aquele
    // e ninguém recebe duas vezes.
    let enviados = 0;
    for (const p of fila) {
      await step.run(`mandar-${ocasiao.slug}-${p.email}`, async () => {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const linkCriar = `${SITE}${p.locale === "es" ? "/es/criar" : "/criar"}?de=ocasiao&o=${ocasiao.slug}`;
        const linkDescadastro = `${SITE}/descadastrar?email=${encodeURIComponent(p.email)}`;

        const r = await resend.emails.send({
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: p.email,
          subject: assuntoOcasiao(p.filho, p.locale),
          html: emailOcasiao({
            filho: p.filho,
            nomeMusica: p.nomeMusica,
            ocasiao: ocasiao.nome,
            diasQueFaltam,
            linkCriar,
            linkDescadastro,
            locale: p.locale,
          }),
        });

        // O registro é a trava: sem ele a pessoa recebe de novo na próxima
        // rodada, daqui a uma hora.
        await registrarEnvio(db(), {
          emailId: r.data?.id,
          template,
          para: p.email,
          quizResponseId: p.quizId,
        });
        enviados += 1;
      });
    }

    return { ocasiao: ocasiao.slug, ano, diasQueFaltam, enviados };
  },
);
