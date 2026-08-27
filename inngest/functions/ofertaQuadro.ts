import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { emailQuadro, assuntoQuadro } from "../../emails/quadro-na-parede.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { literalLike } from "../../src/lib/sql-like.js";

// O QUADRO, sete dias depois da compra.
//
// ── O NÚMERO QUE JUSTIFICA ───────────────────────────────────────
//
// O quadro é o upsell que vende: 23 unidades contra 5 da música extra e 0 do
// pacote de três. E ele vende sendo apenas um bloco no rodapé do e-mail de
// entrega — nunca teve mensagem própria.
//
// Custo de produzir: praticamente zero (é a letra e a foto que já existem,
// montadas numa folha). A margem é quase inteira.
//
// ── POR QUE SETE DIAS, E POR QUE ISSO NÃO ATROPELA OS OUTROS ─────
//
// No dia 0 ela acabou de comprar e quer montar o presente, não comprar de
// novo. No dia 7 ela já entregou, já viu a reação, e é essa memória que
// vende um objeto pra parede.
//
// A régua pós-compra fica: entrega (dia 0) · lembrete se não montou (3h-96h)
// · guarde o link (dia 3) · QUADRO (dia 7) · volte a criar (dia 5-30).
//
// O `volteCriar` se sobrepõe de propósito e não é conflito: um convida a
// criar OUTRA música, este transforma a que ela já tem. Quem quer o quadro
// provavelmente não quer segunda música na mesma semana, e vice-versa.
//
// ── QUEM NÃO RECEBE ──────────────────────────────────────────────
//
// Quem JÁ COMPROU o quadro (tabela `quadros`), obviamente. E quem nunca
// montou o presente: o quadro usa a foto e a letra da página, e oferecer um
// objeto montado a partir de algo que a pessoa não montou é vender um
// trabalho que ela ainda não fez.

const CHECKOUT = "https://go.perfectpay.com.br/PPU38CQFE9O";

const MIN_DIAS = 7;
// Janela de 30 dias: mais velho vira e-mail de vendas pra quem esqueceu de
// nós, e bounce ou reclamação em domínio novo é o dano mais caro que existe.
const MAX_DIAS = 30;
// Teto por rodada, pelo mesmo motivo do `volteCriar` e do `guardeOLink`.
//
// Medido antes de ligar: a fila inicial tem 270 pessoas. A 6 por rodada, em
// 10 rodadas por dia, são 60/dia e ela drena em pouco mais de quatro dias.
// Foi 10 e desceu porque o `guardeOLink` já subiu ontem somando 192/dia: dois
// disparos novos na mesma semana, num domínio de 20 dias, é o tipo de pico que
// assina lista comprada. Passado o represamento, o regime permanente é de umas
// 20 por dia e o teto nunca mais encosta.
const MAX_POR_RODADA = 6;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Já ofereceu o quadro pra esta música? Por MÚSICA, não por pessoa: quem tem
 *  duas músicas pode querer dois quadros, um de cada. */
async function jaOfertado(sb: ReturnType<typeof db>, musicaId: string) {
  const { data } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "oferta_quadro_enviada")
    .contains("event_data", { musica_id: musicaId })
    .limit(1);
  return (data ?? []).length > 0;
}

export const ofertaQuadro = inngest.createFunction(
  {
    id: "oferta-quadro",
    retries: 1,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    triggers: [{ cron: "40 13-22 * * *" }], // horário comercial, fora do minuto cheio
  },
  async ({ step }) => {
    const candidatos = await step.run("achar-quem-montou-ha-uma-semana", async () => {
      const sb = db();
      const agora = Date.now();

      const { data: pedidos } = await sb
        .from("pedidos")
        .select("email, musica_id, quiz_response_id, paid_at")
        .eq("status", "pago")
        .gte("paid_at", new Date(agora - MAX_DIAS * 86400000).toISOString())
        .lte("paid_at", new Date(agora - MIN_DIAS * 86400000).toISOString())
        .order("paid_at", { ascending: false });

      const out: Array<{
        email: string; nome: string; titulo: string;
        link: string; musicaId: string; locale: "pt" | "es";
      }> = [];
      const vistos = new Set<string>();

      for (const p of pedidos ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if (!p.email || !p.musica_id) continue;
        if (vistos.has(p.musica_id)) continue;
        vistos.add(p.musica_id);

        // JÁ TEM O QUADRO? Oferecer o que a pessoa comprou é o jeito mais
        // rápido de ela achar que a gente não sabe quem ela é.
        //
        // A busca é por E-MAIL e não por `musica_id`, e isso importa: o quadro
        // é comprado ANTES de escolher pra qual música, então a linha nasce com
        // `musica_id` nulo. Filtrar por música deixaria passar exatamente quem
        // acabou de comprar e ainda não escolheu — o pior caso possível.
        //
        // O preço disso é não oferecer um segundo quadro a quem tem duas
        // músicas e um quadro só. É uma venda a menos contra uma ofensa a
        // menos, e a ofensa custa mais.
        const { data: temQuadro } = await sb
          .from("quadros")
          .select("id")
          .ilike("email", literalLike(p.email))
          .limit(1)
          .maybeSingle();
        if (temQuadro?.id) continue;

        if (await jaOfertado(sb, p.musica_id)) continue;

        const { data: m } = await sb
          .from("musicas")
          .select("id, titulo, status, token_edicao, personalizada_em, foto_path")
          .eq("id", p.musica_id)
          .maybeSingle();
        if (!m || m.status !== "pronta") continue;

        // PRECISA TER FOTO. O quadro é a letra MAIS a foto: sem ela o
        // produto sai pela metade, e a peça do e-mail promete os dois.
        if (!m.foto_path) continue;

        const { data: q } = p.quiz_response_id
          ? await sb
              .from("quiz_responses")
              .select("respostas, locale")
              .eq("id", p.quiz_response_id)
              .maybeSingle()
          : { data: null };

        // O idioma vem do registro: cron não tem requisição de onde deduzir.
        const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";
        // O quadro só existe na Perfect Pay BR: oferecer em espanhol mostraria
        // preço em real pra quem comprou em dólar. Mesma regra do editor.
        if (locale === "es") continue;

        out.push({
          email: p.email,
          locale: locale as "pt" | "es",
          nome:
            ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() || "quem você ama",
          titulo: m.titulo ?? "Sua música",
          link: CHECKOUT,
          musicaId: m.id,
        });
      }
      return out;
    });

    if (!candidatos.length) return { enviados: 0 };

    let enviados = 0;
    for (const c of candidatos) {
      const ok = await step.run(`quadro-${c.musicaId}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();
        if (await jaOfertado(sb, c.musicaId)) return false;

        const { data: enviado, error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "oferta_quadro" }],
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
          subject: assuntoQuadro(c.nome, c.locale),
          html: emailQuadro({
            nome: c.nome,
            titulo: c.titulo,
            link: c.link,
            locale: c.locale,
          }),
          text:
            `E se a música de ${c.nome} ficasse na parede?\n\n` +
            `O quadro é a letra inteira e a foto de vocês numa folha A4, com um QR Code ` +
            `que toca a música. Você baixa o arquivo e manda imprimir onde quiser.\n\n` +
            `${c.link}\n\n` +
            `Pagamento único, sem assinatura.`,
        });
        if (error) {
          console.error("[oferta-quadro] envio falhou:", error.message);
          return false;
        }

        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "oferta_quadro",
          para: c.email,
        });
        await sb.from("funnel_events").insert({
          event_name: "oferta_quadro_enviada",
          event_data: { musica_id: c.musicaId, email: c.email },
        });
        return true;
      });
      if (ok) enviados += 1;
    }

    return { candidatos: candidatos.length, enviados };
  },
);
