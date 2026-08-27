import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailPixNaoPago, assuntoPixNaoPago } from "../../emails/pix-nao-pago.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

// O PIX GERADO QUE NÃO FOI PAGO.
//
// ── O BURACO QUE ISTO FECHA ──────────────────────────────────────
//
// Medido em 26/08: 550 pessoas em 14 dias geraram código PIX e não pagaram,
// umas 39 por dia. Nenhuma delas tinha tratamento próprio — caíam na mesma
// régua de quem só leu a letra e foi embora.
//
// Não é a mesma pessoa. Quem gerou PIX clicou em comprar, escolheu o meio de
// pagamento e parou no último centímetro. É o lead mais quente do funil, e era
// o único sem e-mail dedicado.
//
// ── POR QUE 20 MINUTOS, E NÃO 40 NEM 10 ──────────────────────────
//
// Medido em 27/08, sobre os PIX pendentes que VIRARAM pagamento — a curva de
// quanto tempo depois o dinheiro cai:
//
//   até 5 min    34,5%   (acumulado 34,5%)
//   5 a 10 min   23,6%   (58,2%)
//   10 a 20 min   7,3%   (65,5%)
//   20 a 40 min  10,9%   (76,4%)
//   40 a 60 min   3,6%   (80,0%)
//   depois        20,0%
//
// A intenção decai rápido, então esperar 40 minutos é esperar demais. Mas
// disparar aos 10 alcançaria 42% de quem AINDA VAI PAGAR, muitos com o app do
// banco aberto naquele instante.
//
// Aos 20 minutos, dois terços de quem paga já pagou. Quem sobra é quase todo
// gente que não volta sozinha, que é exatamente o alvo.
//
// ── E O CÓDIGO NÃO VENCEU ────────────────────────────────────────
//
// O primeiro texto deste e-mail dizia "o código anterior pode ter vencido".
// Era falso: medido, o PIX da Perfect Pay vale ~55 HORAS (mínimo 45, máximo
// 71). O código que a pessoa gerou continua bom por dois dias.
//
// Isso muda o e-mail de "gere um novo" para "ele está te esperando", que é
// uma promessa melhor e verdadeira. E muda o link: em vez de mandar pro
// checkout começar de novo, manda pro `pix_url`, a tela do PIX que ela já
// abriu, com o código dela. Um toque, sem redigitar nada, e o pagamento cai
// no MESMO pedido — o webhook já sabe o que fazer com ele.
//
// ── PREÇO CHEIO, SEM EXCEÇÃO ─────────────────────────────────────
//
// A tentação é descontar aqui. Descontar 40 minutos depois ensina que basta
// abrir o PIX e esperar, e quem aprende isso não paga o preço cheio nunca
// mais — inclusive quem ainda nem abandonou, porque as pessoas conversam.
// A escada (`escada.ts`) desce o preço DIAS depois, que é onde desconto é
// resposta e não reflexo.
//
// O link é o do MESMO valor que a pessoa ia pagar, lido da config viva
// (tabela `experimentos`) e não de `preco.ts`: importar aquele módulo aqui
// traria `experimentos.ts` inteiro, que é isomórfico e lê `window`. A tabela
// é a fonte de verdade dos dois jeitos.
//
// ── PORTUGUÊS SÓ ─────────────────────────────────────────────────
//
// O espanhol fica de fora pelo mesmo motivo da escada: volume pequeno demais
// pra sustentar régua própria, e o checkout de lá é outro gateway com outra
// moeda. Quando o volume justificar, é uma variante a mais aqui.

const MIN_MIN = 20;
// Janela de 24h: PIX de ontem ainda é intenção; de anteontem é cobrança.
const MAX_H = 24;
// Teto por rodada, pelo mesmo motivo do `volteCriar`: `serenatagift.com` é
// domínio novo, e pico de volume em remetente sem histórico é a assinatura de
// lista comprada. A 12 por rodada de meia hora, a fila de ~39/dia se esvazia
// no mesmo dia sem nenhum pico.
const MAX_POR_RODADA = 12;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Já mandamos pra esta sessão?
 *
 * O registro vive em `funnel_events`, como o do lembrete e o da recompra: um
 * booleano em `pedidos` exigiria migration e não deixaria histórico. A chave é
 * o `quiz_response_id` e não o pedido: quem tenta pagar três vezes gera três
 * pedidos pendentes e não pode receber três e-mails.
 */
async function jaAvisado(sb: ReturnType<typeof db>, quizId: string) {
  const { data } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "pix_nao_pago_enviado")
    .contains("event_data", { quiz_response_id: quizId })
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * O checkout do valor que a pessoa ia pagar, lido da config viva.
 *
 * Devolve `null` quando nenhuma variante bate: preferir não mandar a mandar
 * link de preço diferente do que ela viu. Cobrar mais caro do que o combinado
 * é o pior desfecho possível deste e-mail.
 */
async function checkoutDoValor(
  sb: ReturnType<typeof db>,
  valorReais: number,
): Promise<string | null> {
  const { data } = await sb.from("experimentos").select("variantes").eq("id", "preco").maybeSingle();
  const variantes = (data?.variantes ?? []) as Array<{
    plano?: { valor?: number; checkout?: string };
  }>;
  const achado = variantes.find(
    (v) => typeof v.plano?.valor === "number" && Math.abs(v.plano.valor - valorReais) < 0.011,
  );
  return achado?.plano?.checkout ?? null;
}

export const pixNaoPago = inngest.createFunction(
  {
    id: "pix-nao-pago",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "*/30 * * * *" }], // de meia em meia hora
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-pix-abandonado", async () => {
      const sb = db();
      const agora = Date.now();

      const { data: pendentes } = await sb
        .from("pedidos")
        .select("id, email, quiz_response_id, valor_centavos, created_at, pix_url")
        .eq("status", "pendente")
        .gte("created_at", new Date(agora - MAX_H * 3600000).toISOString())
        .lte("created_at", new Date(agora - MIN_MIN * 60000).toISOString())
        .order("created_at", { ascending: false });

      const out: Array<{
        email: string; nome: string; titulo: string;
        linkCheckout: string; quizId: string; locale: "pt" | "es";
      }> = [];
      const vistos = new Set<string>();

      for (const p of pendentes ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if (!p.email || !p.quiz_response_id) continue;
        // Uma tentativa por pessoa nesta rodada: três pedidos pendentes da
        // mesma sessão são três tentativas do mesmo pagamento.
        if (vistos.has(p.quiz_response_id)) continue;
        vistos.add(p.quiz_response_id);

        // PAGOU DEPOIS? O pendente fica no banco pra sempre; o que decide é
        // existir um pago na mesma sessão. Mandar "seu pagamento não entrou"
        // pra quem pagou é o erro mais caro que este job pode cometer.
        const { data: pago } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", p.quiz_response_id)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle();
        if (pago?.id) continue;

        if (await jaAvisado(sb, p.quiz_response_id)) continue;

        // A MÚSICA PRECISA EXISTIR. O e-mail promete "está pronta esperando",
        // e prometer isso sem arquivo é a única mentira que este texto pode
        // contar. Sem música pronta, a pessoa não entra na fila.
        const { data: m } = await sb
          .from("musicas")
          .select("titulo, status")
          .eq("quiz_response_id", p.quiz_response_id)
          .maybeSingle();
        if (!m || m.status !== "pronta") continue;

        const { data: q } = await sb
          .from("quiz_responses")
          .select("respostas, locale")
          .eq("id", p.quiz_response_id)
          .maybeSingle();

        // O idioma vem do registro: cron não tem requisição de onde deduzir.
        // Ver a migration 20260807000000_locale.
        const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";
        if (locale === "es") continue; // ver o cabeçalho

        // ── O LINK: o PIX DELA primeiro ──────────────────────────
        //
        // `pix_url` é a tela do PIX que ela já abriu, com o código dela, válido
        // por ~55h. Um toque e ela paga, sem redigitar nada, e o dinheiro cai
        // no MESMO pedido — o webhook já sabe casar aquele `payment_id` com a
        // música. Voltar pro checkout seria fazê-la refazer tudo por nada.
        //
        // O checkout fica de RESERVA, pra pedido antigo que não guardou a URL.
        // Aí sim precisa do `src`, que é o session_id: é por ele que o webhook
        // casa o pagamento com a música já gerada. Sem ele a compra entra como
        // "pago sem música casada" e alguém entrega à mão.
        let link = p.pix_url as string | null;
        if (!link) {
          const checkout = await checkoutDoValor(sb, (p.valor_centavos ?? 0) / 100);
          if (!checkout) continue;
          const u = new URL(checkout);
          u.searchParams.set("src", p.quiz_response_id);
          u.searchParams.set("email", p.email);
          link = u.toString();
        }

        out.push({
          email: p.email,
          locale: locale as "pt" | "es",
          // `.trim()`: o nome do quiz vem com espaço sobrando ("Cardoso ") e o
          // assunto sairia com espaço duplo.
          nome: ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() || "quem você ama",
          titulo: m.titulo ?? "Sua música",
          linkCheckout: link,
          quizId: p.quiz_response_id,
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    // Um passo POR PESSOA: se um envio falhar, o Inngest reexecuta só aquele e
    // ninguém recebe o e-mail duas vezes.
    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`pix-${c.quizId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();

        // Recheca na hora do envio: a pessoa pode ter pago entre a busca e
        // agora, e nada é pior que cobrar quem já pagou.
        const { data: pago } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", c.quizId)
          .eq("status", "pago")
          .limit(1)
          .maybeSingle();
        if (pago?.id) return false;
        if (await jaAvisado(sb, c.quizId)) return false;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "pix_nao_pago" }],
          from: "Serenata <contato@serenatagift.com>",
          to: [c.email],
          subject: assuntoPixNaoPago(c.nome, c.locale),
          html: emailPixNaoPago({
            nome: c.nome,
            titulo: c.titulo,
            linkCheckout: c.linkCheckout,
            locale: c.locale,
          }),
          text:
            `A música de ${c.nome} ficou pronta, mas o pagamento não chegou a cair.\n\n` +
            `Nada se perdeu: a música está gravada e o seu código PIX continua valendo.\n\n` +
            `Pague com o seu PIX aqui:\n${c.linkCheckout}\n\n` +
            `Se preferir cartão, a opção aparece na mesma tela.`,
        });
        if (error) {
          console.error("[pix-nao-pago] envio falhou:", error.message);
          return false;
        }

        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "pix_nao_pago",
          para: c.email,
          quizResponseId: c.quizId,
        });
        await sb.from("funnel_events").insert({
          event_name: "pix_nao_pago_enviado",
          event_data: { quiz_response_id: c.quizId, email: c.email },
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
