import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_TRANSACIONAL } from "../../emails/remetentes.js";
import { emailCreditoParado, assuntoCreditoParado } from "../../emails/credito-parado.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

// QUEM COMPROU CRÉDITO E NÃO USOU.
//
// ── A MESMA CLASSE DE DEFEITO DO QUADRO ──────────────────────────
//
// Crédito é a segunda coisa que a pessoa paga e não recebe sozinha: ela
// precisa voltar e fazer outro quiz. Enquanto o pacote de R$ 28 só existia no
// painel, quem comprava já estava logado e resgatava (14 comprados, 11 usados,
// 78,6%). Em 02/09 ele passou pra `/obrigado` e pro e-mail de entrega, ou seja,
// pra quem NÃO tem login. O buraco não é grande hoje (3 créditos parados), mas
// ele foi aberto hoje e vai crescer com o volume.
//
// É a mesma lição do quadro, e ela custou R$ 672 pra ser aprendida: produto
// que exige um passo depois do pagamento precisa de rede, senão ele acumula em
// silêncio. Ninguém abre ticket dizendo "paguei e esqueci".
//
// ── O LINK CARREGA A CREDENCIAL ──────────────────────────────────
//
// `/credito/<token_edicao>` guarda a prova de posse no navegador e sai pro
// funil. Sem isso a pessoa faria o quiz inteiro e a tela de oferta cobraria de
// novo, porque a sessão nova não sabe quem ela é. Ver `credito-no-navegador.ts`
// e `dono-por-token.ts`.

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";

// 48 HORAS de carência, o dobro do quadro. Montar o quadro é um clique; usar
// o crédito é contar outra história inteira, e isso ninguém faz na mesma noite
// em que comprou. Cobrar antes disso é atropelar quem está só esperando a
// ocasião.
const MIN_HORAS = 48;

// Sete dias de silêncio por pessoa, como no quadro: quem tem três créditos não
// pode levar três recados.
const SILENCIO_DIAS = 7;

const MAX_POR_RODADA = 6;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Já falamos com esta pessoa sobre algo parado nesta semana?
 *
 * A pergunta é sobre O RECADO, não sobre o produto. Quem tem um quadro e um
 * crédito parados tem dois problemas, mas recebe UM e-mail: dois "você
 * esqueceu" na mesma semana, do mesmo remetente, é o que faz a pessoa marcar
 * como spam — e o remetente aqui é o transacional, o que carrega a entrega de
 * quem pagou.
 *
 * Achado na hora de ligar este cron: o comprador de 18/08 tinha acabado de
 * receber o aviso do quadro e levaria o do crédito no mesmo dia.
 *
 * O que fica de fora é lembrado na semana seguinte, e não se perde: os dois
 * crons rodam todo dia.
 */
const RECADOS_DE_COISA_PARADA = ["credito_parado_avisado", "quadro_parado_avisado"];

async function jaAvisado(sb: ReturnType<typeof db>, email: string) {
  const { data } = await sb
    .from("funnel_events")
    .select("id")
    .in("event_name", RECADOS_DE_COISA_PARADA)
    .contains("event_data", { email })
    .gte("created_at", new Date(Date.now() - SILENCIO_DIAS * 86400000).toISOString())
    .limit(1);
  return (data ?? []).length > 0;
}

export const creditoParado = inngest.createFunction(
  {
    id: "credito-parado",
    retries: 1,
    triggers: [{ cron: "50 14-23 * * *" }],
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-credito-parado", async () => {
      const sb = db();
      const limite = new Date(Date.now() - MIN_HORAS * 3600000).toISOString();

      // O SALDO SAI DO RAZÃO, não de um número guardado. `creditos` tem uma
      // linha por compra e uma por uso, e somar as duas é a única leitura que
      // não fica velha. Mesma regra do painel.
      const { data: linhas } = await sb
        .from("creditos")
        .select("email, quantidade, origem, created_at")
        .order("created_at", { ascending: true });

      const saldo = new Map<string, number>();
      const compradoEm = new Map<string, string>();
      for (const l of linhas ?? []) {
        const e = String(l.email ?? "").trim().toLowerCase();
        if (!e) continue;
        const q = Number(l.quantidade ?? 0);
        // `uso` vem como quantidade positiva no razão; o sinal é a origem.
        saldo.set(e, (saldo.get(e) ?? 0) + (l.origem === "uso" ? -Math.abs(q || 1) : q));
        if (l.origem === "compra") compradoEm.set(e, l.created_at);
      }

      const out: Array<{ email: string; saldo: number; link: string; locale: "pt" | "es" }> = [];

      for (const [email, n] of saldo) {
        if (out.length >= MAX_POR_RODADA) break;
        if (n <= 0) continue;
        // Carência contada da COMPRA, não de agora.
        const quando = compradoEm.get(email);
        if (!quando || quando > limite) continue;
        if (await jaAvisado(sb, email)) continue;

        // ── DOIS CAMINHOS ATÉ O TOKEN, o mesmo do quadro ────
        //
        // `pedidos.musica_id` é nulo em pedido de upsell, e o pacote de
        // crédito É um upsell: por esse caminho sozinho, quem só comprou
        // pacote nunca teria token. A conta (`user_id`) é o segundo caminho, e
        // foi ele que salvou o caso de 18/08.
        let token: string | null = null;
        let locale: string | null = null;

        const { data: pedidos } = await sb
          .from("pedidos")
          .select("musica_id")
          .eq("email", email)
          .eq("status", "pago")
          .not("musica_id", "is", null)
          .order("paid_at", { ascending: false })
          .limit(5);
        for (const p of pedidos ?? []) {
          const { data: m } = await sb
            .from("musicas")
            .select("token_edicao, status, locale")
            .eq("id", p.musica_id as string)
            .maybeSingle();
          if (m?.status === "pronta" && m.token_edicao) {
            token = m.token_edicao;
            locale = m.locale;
            break;
          }
        }
        if (!token) {
          const { data: conta } = await sb.from("users").select("id").eq("email", email).maybeSingle();
          if (conta?.id) {
            const { data: m } = await sb
              .from("musicas")
              .select("token_edicao, locale")
              .eq("user_id", conta.id)
              .eq("status", "pronta")
              .not("token_edicao", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (m?.token_edicao) {
              token = m.token_edicao;
              locale = m.locale;
            }
          }
        }
        // Sem token não há como provar posse no fim do quiz, e o e-mail
        // mandaria a pessoa pra uma cobrança. Caso de suporte, não de cron.
        if (!token) continue;

        out.push({
          email,
          saldo: n,
          link: `${SITE}/credito/${token}`,
          locale: locale === "es" ? "es" : "pt",
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`credito-parado-${c.email}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        if (await jaAvisado(sb, c.email)) return false;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "credito_parado" }],
          from: REMETENTE_TRANSACIONAL,
          to: [c.email],
          subject: assuntoCreditoParado(c.locale),
          html: emailCreditoParado({ link: c.link, saldo: c.saldo, locale: c.locale }),
          text:
            `Falta você dizer pra quem é.\n\n` +
            `Você comprou uma música a mais e ela ficou guardada. Não precisa pagar nada de novo.\n\n` +
            `${c.link}\n\nSe alguma coisa não abrir, é só responder este e-mail.`,
        });
        if (error) {
          console.error("[credito-parado] envio falhou:", error.message);
          return false;
        }

        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "credito_parado",
          para: c.email,
        });
        await sb.from("funnel_events").insert({
          event_name: "credito_parado_avisado",
          event_data: { email: c.email, saldo: c.saldo },
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
