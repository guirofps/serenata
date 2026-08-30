import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { emailQuaseComprou, assuntoQuaseComprou } from "../../emails/quase-comprou.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { pareceTypo } from "../../src/lib/email-typo.js";

// CLICOU EM COMPRAR E NÃO GEROU PEDIDO NENHUM.
//
// ── O MAIOR VAZAMENTO SEM TRATAMENTO ─────────────────────────────
//
// Medido em 27/08, 7 dias: 2.577 clicaram em comprar e 1.509 (58,6%) nunca
// geraram pedido, nem PIX pendente. São ~215 por dia contra ~39 do PIX
// abandonado. Dessas, 1.486 têm música pronta e 1.504 deixaram e-mail.
//
// Elas caíam na escada genérica, junto de quem só leu a letra e foi embora —
// e a escada converte 0,92% no melhor degrau. Quem clicou em comprar é outra
// pessoa.
//
// ── POR QUE 30 MINUTOS ───────────────────────────────────────────
//
// O PIX abandonado dispara aos 10, porque lá a pessoa já escolheu como pagar
// e a janela de decisão é curta. Aqui ela parou ANTES, na tela do gateway:
// pode estar lendo, comparando, ou preenchendo o formulário devagar. Meia
// hora dá tempo dela concluir sozinha, e quem não concluiu em 30 minutos
// dificilmente conclui na hora seguinte.
//
// ── O CRUZAMENTO É COM `pedidos`, NÃO COM `checkout_click` ───────
//
// Quem GEROU pedido pendente é do `pixNaoPago`, que tem texto próprio e
// devolve o código dela. Este job só pega quem não tem NENHUMA linha em
// `pedidos` — senão os dois e-mails saem pra mesma pessoa no mesmo dia.
//
// ── O LINK CARREGA A SESSÃO ──────────────────────────────────────
//
// `src` é o session_id, e é por ele que o webhook casa o pagamento com a
// música JÁ GERADA. A pessoa não refaz o quiz, não gera outra música e não
// espera de novo: ela paga e recebe a que já é dela. Sem esse parâmetro a
// compra entraria como "pago sem música casada" e alguém entregaria à mão.

const MIN_MIN = 30;
// Janela de 48h: mais velho que isso a pessoa já esqueceu, e a escada assume.
const MAX_H = 48;
// Teto por rodada. A fila inicial é grande (1.509 em 7 dias) e o domínio tem
// 20 dias: 8 por rodada, de hora em hora, são ~190/dia, que é o mesmo patamar
// do `guardeOLink` e não dobra o volume diário do remetente.
const MAX_POR_RODADA = 8;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function jaAvisado(sb: ReturnType<typeof db>, quizId: string) {
  const { data } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "quase_comprou_enviado")
    .contains("event_data", { quiz_response_id: quizId })
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * O CHECKOUT DO FUNIL ESPANHOL, que cobra em DÓLAR.
 *
 * Ele existe aqui como constante, e não vindo da config de `preco`, porque o
 * teste de preço é BRASILEIRO de propósito (ver `preco.ts`: "O ESPANHOL FICA
 * DE FORA DO TESTE"). A config só tem link em reais, e era exatamente daí que
 * vinha o defeito abaixo.
 */
const CHECKOUT_ES = "https://go.centerpag.com/PPU38CQF4HJ";

/**
 * O checkout do braço em que a pessoa foi sorteada, lido da config viva.
 *
 * Não é o preço "atual" nem o padrão: é o que ELA VIU na tela de oferta. Mandar
 * outro valor seria trocar o preço depois de ela ter decidido, que é o jeito
 * mais rápido de transformar uma recuperação numa reclamação.
 *
 * ── O IDIOMA DECIDE ANTES DO BRAÇO (conserto de 30/08) ───────────
 *
 * A versão anterior lia o `locale` pra escolher o TEXTO e ignorava ele pro
 * LINK. O resultado era a pior combinação possível: e-mail em espanhol
 * perfeito levando a um checkout em REAIS. Parece certo e cobra na moeda
 * errada.
 *
 * Medido: 17 disparos pra 16 pessoas do funil espanhol entre 27 e 30/08, e
 * ZERO compras — contra 2,3% do mesmo e-mail no funil português. Um deles
 * escreveu pro suporte dizendo que o banco travava o pagamento.
 */
async function checkoutDoBraco(
  sb: ReturnType<typeof db>,
  braco: string | null,
  locale: "pt" | "es",
): Promise<string | null> {
  if (locale === "es") return CHECKOUT_ES;
  const { data } = await sb.from("experimentos").select("variantes").eq("id", "preco").maybeSingle();
  const variantes = (data?.variantes ?? []) as Array<{
    nome?: string;
    plano?: { checkout?: string };
  }>;
  const achado =
    variantes.find((v) => v.nome === braco) ?? variantes.find((v) => v.nome === "A");
  return achado?.plano?.checkout ?? null;
}

export const quaseComprou = inngest.createFunction(
  {
    id: "quase-comprou",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "50 * * * *" }], // de hora em hora, fora do minuto cheio
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-quem-clicou-e-sumiu", async () => {
      const sb = db();
      const agora = Date.now();

      // Os cliques da janela. `session_id` é a chave do funil inteiro.
      const { data: cliques } = await sb
        .from("funnel_events")
        .select("session_id, created_at")
        .eq("event_name", "checkout_click")
        .gte("created_at", new Date(agora - MAX_H * 3600000).toISOString())
        .lte("created_at", new Date(agora - MIN_MIN * 60000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1200);

      const out: Array<{
        email: string; nome: string; titulo: string;
        link: string; quizId: string; locale: "pt" | "es";
      }> = [];
      const vistos = new Set<string>();

      for (const c of cliques ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        const sid = c.session_id as string | null;
        if (!sid || vistos.has(sid)) continue;
        vistos.add(sid);

        const { data: q } = await sb
          .from("quiz_responses")
          .select("id, email, respostas, locale, attribution")
          .eq("session_id", sid)
          .maybeSingle();
        if (!q?.id || !q.email) continue;
        // ENDEREÇO QUEBRADO NÃO ENTRA. Saiu um disparo pra
        // `sp.paulista2020@wotlook.com` (outlook com typo) na primeira rodada:
        // bounce garantido, e bounce em domínio de 20 dias é o dano mais caro
        // que existe. Mesma trava do `mandarLetra` e da escada.
        if (pareceTypo(q.email as string)) continue;

        // TEM PEDIDO? Pago é venda feita; pendente é do `pixNaoPago`. Nos dois
        // casos esta mensagem seria a errada.
        const { data: pedido } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", q.id)
          .limit(1)
          .maybeSingle();
        if (pedido?.id) continue;

        if (await jaAvisado(sb, q.id)) continue;

        // A MÚSICA PRECISA ESTAR PRONTA. O e-mail diz "ela já existe, está
        // gravada": sem arquivo isso é mentira, e é a única que este texto
        // pode contar.
        const { data: m } = await sb
          .from("musicas")
          .select("titulo, status")
          .eq("quiz_response_id", q.id)
          .maybeSingle();
        if (!m || m.status !== "pronta") continue;

        // O idioma vem do registro: cron não tem requisição de onde deduzir.
        const locale = (q as { locale?: string }).locale === "es" ? "es" : "pt";

        const braco =
          ((q.attribution as { exp?: Record<string, string> } | null)?.exp?.preco as string) ?? null;
        const checkout = await checkoutDoBraco(sb, braco, locale);
        if (!checkout) continue;

        const u = new URL(checkout);
        u.searchParams.set("src", q.id);
        u.searchParams.set("email", q.email);

        out.push({
          email: q.email as string,
          locale: locale as "pt" | "es",
          // `.trim()`: o nome do quiz vem com espaço sobrando ("Cardoso ").
          nome:
            ((q.respostas ?? {}) as Record<string, string>).nome?.trim() ||
            (locale === "es" ? "quien vos querés" : "quem você ama"),
          titulo: m.titulo ?? "Sua música",
          link: u.toString(),
          quizId: q.id as string,
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`quase-${c.quizId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();

        // Recheca na hora: a pessoa pode ter comprado entre a busca e agora, e
        // "sua música está esperando" pra quem já pagou é o pior desfecho.
        const { data: pedido } = await sb
          .from("pedidos")
          .select("id")
          .eq("quiz_response_id", c.quizId)
          .limit(1)
          .maybeSingle();
        if (pedido?.id) return false;
        if (await jaAvisado(sb, c.quizId)) return false;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "quase_comprou" }],
          // REMETENTE DE RECUPERAÇÃO, não o transacional.
          //
          // A doutrina está em `emails/remetentes.ts`: o domínio raiz carrega
          // o que a pessoa PAGOU pra receber, o subdomínio carrega o que ela
          // não pediu. Este e-mail é oferta, não entrega — mandá-lo pelo raiz
          // aposta a caixa de entrada do comprador (o único e-mail que não
          // pode falhar) pra sustentar um disparo de marketing.
          //
          // `reply_to` é obrigatório: o subdomínio só manda, não recebe.
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: [c.email],
          subject: assuntoQuaseComprou(c.nome, c.locale),
          html: emailQuaseComprou({
            nome: c.nome,
            titulo: c.titulo,
            link: c.link,
            locale: c.locale,
          }),
          text:
            `A música de ${c.nome} já existe: foi gravada com a história que você contou.\n\n` +
            `Você recebe a música completa nas duas versões, a página presente com link e ` +
            `QR Code, e o MP3 pra guardar.\n\n` +
            `${c.link}\n\n` +
            `A letra continua sua de qualquer jeito, e o link não expira.`,
        });
        if (error) {
          console.error("[quase-comprou] envio falhou:", error.message);
          return false;
        }

        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "quase_comprou",
          para: c.email,
          quizResponseId: c.quizId,
        });
        await sb.from("funnel_events").insert({
          event_name: "quase_comprou_enviado",
          event_data: { quiz_response_id: c.quizId, email: c.email },
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
