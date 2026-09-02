import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_TRANSACIONAL } from "../../emails/remetentes.js";
import { emailQuadroParado, assuntoQuadroParado } from "../../emails/quadro-parado.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

// QUEM PAGOU O QUADRO E NÃO MONTOU.
//
// ── O BURACO ─────────────────────────────────────────────────────
//
// Medido em 02/09: 34 quadros vendidos, 7 montados. 27 pessoas pagaram e não
// levaram nada. 79% do produto vendido não foi entregue, e ninguém reclamou:
// não existe ticket dizendo "paguei e esqueci".
//
// A causa é estrutural, não é desleixo do cliente. O quadro é o ÚNICO produto
// da casa que exige um passo DEPOIS do pagamento — escolher de qual música ele
// é. Todo o resto chega pronto. E o único aviso desse passo era um bloco no
// e-mail de entrega, lido no minuto em que a pessoa quer ouvir a música.
//
// ── POR QUE UM CRON E NÃO UM DISPARO ÚNICO ───────────────────────
//
// Um disparo único esvazia a fila de hoje e o buraco volta a encher amanhã,
// porque a causa continua lá. Este job é a rede: todo dia ele varre quem
// pagou, não montou, e ainda não foi avisado.
//
// A correção da CAUSA é outra e já subiu em 02/09: o cartão do quadro no
// editor agora leva à folha montada em vez de abrir o PIX direto, então a
// pessoa vê o produto antes de pagar e chega no fim do caminho já dentro da
// tela de montar.
//
// ── ISTO É ENTREGA, ENTÃO SAI PELO TRANSACIONAL ──────────────────
//
// Quem recebe já pagou. Ver a doutrina em `emails/remetentes.ts`: o raiz
// carrega o que a pessoa comprou. Mandar a entrega de um cliente pelo
// subdomínio de recuperação seria classificar o próprio produto como spam.

const SITE = process.env.VITE_APP_URL?.startsWith("http")
  ? process.env.VITE_APP_URL
  : "https://www.serenatagift.com";

// 20 HORAS DE CARÊNCIA. Quem comprou agora ainda está com a aba aberta; um
// e-mail dizendo "você esqueceu" cinco minutos depois da compra é ofensa, não
// socorro. Vinte horas cobrem quem comprou de noite e dorme.
const MIN_HORAS = 20;

// Sem teto de idade, de propósito, ao contrário das ofertas. Este e-mail não
// é campanha: é a entrega de um produto pago, e produto pago não vence.
const MAX_POR_RODADA = 8;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Já avisamos sobre este quadro, ou já falamos com esta pessoa esta semana?
 *
 * DUAS TRAVAS, e a segunda não é excesso de zelo. A chave natural é o
 * `quadro_id`, senão quem comprou dois quadros nunca é avisado do segundo.
 * Só que sem a trava por e-mail essa mesma pessoa recebe DUAS mensagens
 * idênticas dizendo "você esqueceu", com uma hora de diferença — existe um
 * comprador assim na base de hoje (dois quadros, nenhum montado).
 *
 * Sete dias de silêncio por pessoa resolve os dois lados: o segundo quadro é
 * lembrado na semana seguinte, e ninguém leva o mesmo recado duas vezes.
 */
const SILENCIO_DIAS = 7;

async function jaAvisado(sb: ReturnType<typeof db>, quadroId: string, email: string) {
  const { data: porQuadro } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "quadro_parado_avisado")
    .contains("event_data", { quadro_id: quadroId })
    .limit(1);
  if ((porQuadro ?? []).length > 0) return true;

  const { data: porPessoa } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "quadro_parado_avisado")
    .contains("event_data", { email })
    .gte("created_at", new Date(Date.now() - SILENCIO_DIAS * 86400000).toISOString())
    .limit(1);
  return (porPessoa ?? []).length > 0;
}

export const quadroParado = inngest.createFunction(
  {
    id: "quadro-parado",
    retries: 1,
    triggers: [{ cron: "20 14-23 * * *" }],
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-quadros-parados", async () => {
      const sb = db();
      const limite = new Date(Date.now() - MIN_HORAS * 3600000).toISOString();

      const { data: quadros } = await sb
        .from("quadros")
        .select("id, email, created_at, confirmado_em")
        .is("confirmado_em", null)
        .lt("created_at", limite)
        .order("created_at", { ascending: false })
        .limit(200);

      const out: Array<{
        quadroId: string; email: string; link: string;
        titulo: string | null; locale: "pt" | "es";
      }> = [];

      for (const q of quadros ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if (!q.email) continue;
        if (await jaAvisado(sb, q.id, q.email)) continue;

        // ── DO E-MAIL ATÉ O TOKEN ────────────────────────────
        //
        // `musicas` não guarda e-mail. Quem guarda é `pedidos`, e é por ela
        // que se chega no `token_edicao` — a credencial que abre a folha sem
        // login, que é o ponto inteiro deste e-mail.
        //
        // A busca é por igualdade, NÃO por `ilike`: e-mail com `%` ou `_` é
        // endereço válido e curinga de LIKE ao mesmo tempo, e aqui a consulta
        // decide pra quem vai o token de alguém. Ver `src/lib/sql-like.ts`.
        // ── DOIS CAMINHOS ATÉ A MÚSICA, e o segundo não é luxo ──
        //
        // O caminho natural é `pedidos.musica_id`. Só que ele é NULO em pedido
        // de upsell: quadro e pacote de crédito não compram música nenhuma.
        //
        // Quem comprou o quadro num pedido avulso, e cuja música veio de outra
        // compra ou de um crédito, some por esse caminho. Foi o caso do
        // comprador de 18/08 que pagou R$ 52,90 (pacote + quadro), tem QUATRO
        // músicas prontas na conta, e mesmo assim o disparo de 02/09 o
        // classificou como "sem música pronta" e pulou. Ele ficaria de fora
        // pra sempre, porque o cron repetiria o mesmo julgamento todo dia.
        //
        // Então: tenta pelo pedido, e caindo fora, pela CONTA (`user_id`), que
        // é o que amarra música a dono no resto do sistema.
        let escolhida: { token_edicao: string; titulo: string | null; locale: string | null } | null = null;

        const { data: pedidos } = await sb
          .from("pedidos")
          .select("musica_id, paid_at")
          .eq("email", q.email)
          .eq("status", "pago")
          .not("musica_id", "is", null)
          .order("paid_at", { ascending: false })
          .limit(10);

        for (const p of pedidos ?? []) {
          const { data: m } = await sb
            .from("musicas")
            .select("token_edicao, titulo, status, locale")
            .eq("id", p.musica_id as string)
            .maybeSingle();
          if (m?.status === "pronta" && m.token_edicao) {
            escolhida = { token_edicao: m.token_edicao, titulo: m.titulo, locale: m.locale };
            break;
          }
        }

        if (!escolhida) {
          const { data: conta } = await sb.from("users").select("id").eq("email", q.email).maybeSingle();
          if (conta?.id) {
            const { data: m } = await sb
              .from("musicas")
              .select("token_edicao, titulo, status, locale")
              .eq("user_id", conta.id)
              .eq("status", "pronta")
              .not("token_edicao", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (m?.token_edicao) {
              escolhida = { token_edicao: m.token_edicao, titulo: m.titulo, locale: m.locale };
            }
          }
        }

        // Sem música pronta por nenhum dos dois caminhos não há folha pra
        // montar. Isso é caso de suporte, não de e-mail automático: avisar
        // "monte o seu quadro" quem não tem música é mandar pra uma tela vazia.
        if (!escolhida) continue;

        out.push({
          quadroId: q.id,
          email: q.email,
          // `?de=montar` faz o botão de voltar de lá apontar pro `/meu-quadro`,
          // que é onde ela escolhe de qual música o quadro é.
          link: `${SITE}/quadro/${escolhida.token_edicao}?de=montar`,
          titulo: escolhida.titulo,
          locale: escolhida.locale === "es" ? "es" : "pt",
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`quadro-parado-${c.quadroId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        // Confere de novo dentro do passo: o `step.run` pode reexecutar, e
        // mandar duas vezes "você esqueceu" é pior que não mandar.
        if (await jaAvisado(sb, c.quadroId, c.email)) return false;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "quadro_parado" }],
          from: REMETENTE_TRANSACIONAL,
          to: [c.email],
          subject: assuntoQuadroParado(c.locale),
          html: emailQuadroParado({ link: c.link, titulo: c.titulo, locale: c.locale }),
          text:
            `Seu quadro está pronto. Falta um clique.\n\n` +
            `Você comprou o quadro e ele ficou esperando você dizer de qual música ele é. ` +
            `Não precisa pagar nada de novo.\n\n${c.link}\n\n` +
            `Se alguma coisa não abrir, é só responder este e-mail.`,
        });
        if (error) {
          console.error("[quadro-parado] envio falhou:", error.message);
          return false;
        }

        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "quadro_parado",
          para: c.email,
        });
        await sb.from("funnel_events").insert({
          event_name: "quadro_parado_avisado",
          event_data: { quadro_id: c.quadroId, email: c.email },
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
