import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailVolteCriar, assuntoVolteCriar } from "../../emails/volte-criar.js";

// RECOMPRA: convida quem já comprou a criar a próxima música.
//
// ── O NÚMERO QUE JUSTIFICA ISTO ──────────────────────────────────
//
// Medido em 18/08: 248 dos 294 compradores NUNCA entraram na conta. Todo o
// painel que a gente construiu (créditos, quadro, abas) não alcança 84% de
// quem compra. E-mail alcança: os de entrega têm 66% de abertura e 57% de
// clique, os melhores números do produto inteiro.
//
// E o comportamento existe sem a gente pedir: 11 dos 290 compradores voltaram
// e compraram a segunda por conta própria, no preço cheio, sem oferta nenhuma.
// Este e-mail é para os outros 279.
//
// ── POR QUE 5 DIAS ───────────────────────────────────────────────
//
// No dia da compra ela ainda não entregou o presente. Vender a segunda música
// antes de a primeira ter cumprido o papel é pedir antes de entregar. Depois
// de alguns dias ela já viu a reação de quem recebeu, e é essa memória que faz
// a segunda fazer sentido.
//
// A janela fecha em 30 dias pra não ressuscitar compra velha: e-mail de venda
// pra quem comprou há dois meses tem cara de spam, e bounce ou reclamação em
// domínio novo é o dano mais caro que existe.
//
// ── UM SÓ, PARA SEMPRE ───────────────────────────────────────────
//
// Não é sequência. Quem não quis não vai querer mais por insistência, e a
// diferença entre convite e perseguição é exatamente essa. O registro fica em
// `funnel_events`, por e-mail, então quem comprou duas vezes não recebe dois.

const SITE = "https://www.serenatagift.com";

const MIN_DIAS = 5;
const MAX_DIAS = 30;
// Teto por rodada: mandar centenas de uma vez num domínio de 20 dias é o jeito
// mais rápido de queimar a reputação. Medido em 19/08: a fila inicial tem 81
// pessoas, então a 15 por hora ela se esvazia em pouco mais de meio dia de
// janela, sem pico nenhum.
const MAX_POR_RODADA = 15;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const volteCriar = inngest.createFunction(
  {
    id: "volte-criar",
    retries: 1,
    // ── SÓ EM HORÁRIO DECENTE ──────────────────────────────────
    //
    // Cron do Inngest é UTC, e o Brasil é UTC-3: 12h-23h UTC dá 9h-20h aqui.
    //
    // Não é frescura. Este é um e-mail de VENDA, e venda que chega às 3 da
    // manhã é lida às 9 com outras vinte, ou nunca. Os transacionais (entrega,
    // acesso) continuam saindo a qualquer hora, porque aqueles a pessoa está
    // esperando.
    triggers: [{ cron: "30 12-23 * * *" }],
  },
  async ({ step }) => {
    const fila = await step.run("achar-quem-pode-voltar", async () => {
      const sb = db();
      const agora = Date.now();

      const [{ data: pedidos }, { data: jaMandados }, { data: descadastrados }, { data: mortos }] =
        await Promise.all([
          sb
            .from("pedidos")
            .select("email, musica_id, quiz_response_id, paid_at, dinheiro_entrou")
            .eq("status", "pago")
            .gte("paid_at", new Date(agora - MAX_DIAS * 86400000).toISOString())
            .lte("paid_at", new Date(agora - MIN_DIAS * 86400000).toISOString()),
          sb
            .from("funnel_events")
            .select("event_data")
            .eq("event_name", "volte_criar_enviado")
            .limit(5000),
          sb.from("excluidos_email").select("email"),
          sb.from("emails_mortos").select("email"),
        ]);

      const bloqueado = new Set<string>([
        ...(jaMandados ?? [])
          .map((e) => String((e.event_data as { email?: string } | null)?.email ?? "").toLowerCase())
          .filter(Boolean),
        ...(descadastrados ?? []).map((x) => x.email.toLowerCase()),
        ...(mortos ?? []).map((x) => x.email.toLowerCase()),
      ]);

      // QUEM JÁ TEM CRÉDITO NÃO RECEBE OFERTA DE CRÉDITO. Ela comprou o pacote
      // e ainda não gastou: mandar "compre outra" pra quem tem saldo parado
      // faz a pessoa achar que a gente não sabe o que ela comprou, que é
      // exatamente a sensação que este e-mail não pode causar.
      const { data: comSaldo } = await sb.from("creditos").select("email, quantidade");
      const saldo = new Map<string, number>();
      for (const c of comSaldo ?? []) {
        const k = (c.email ?? "").toLowerCase();
        saldo.set(k, (saldo.get(k) ?? 0) + (c.quantidade ?? 0));
      }

      const vistos = new Set<string>();
      const out: Array<{ email: string; nome: string; locale: "pt" | "es"; sessao: string }> = [];

      for (const p of pedidos ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        const email = (p.email ?? "").trim().toLowerCase();
        if (!email || !p.quiz_response_id) continue;
        // Resgate de crédito não é compra nova: quem "comprou" com crédito não
        // deve entrar como se tivesse pagado de novo.
        if (p.dinheiro_entrou === false) continue;
        if (bloqueado.has(email) || vistos.has(email)) continue;
        if ((saldo.get(email) ?? 0) > 0) continue;
        vistos.add(email);

        const { data: q } = await sb
          .from("quiz_responses")
          .select("respostas, locale, session_id")
          .eq("id", p.quiz_response_id)
          .maybeSingle();
        // O idioma vem do REGISTRO: um cron não tem requisição de onde deduzir.
        const locale = (q as { locale?: string } | null)?.locale === "es" ? "es" : "pt";

        out.push({
          email,
          locale,
          // `.trim()`: o nome do quiz vem com espaço sobrando e o assunto sai
          // com espaço duplo.
          nome:
            ((q?.respostas ?? {}) as Record<string, string>).nome?.trim() ||
            (locale === "es" ? "quien tú quieres" : "quem você ama"),
          sessao: q?.session_id ?? "",
        });
      }
      return out;
    });

    if (!fila.length) return { enviados: 0 };

    // Um passo POR PESSOA: se um envio falhar, o Inngest reexecuta só aquele e
    // ninguém recebe duas vezes.
    let enviados = 0;
    for (const c of fila) {
      const ok = await step.run(`convidar-${c.email}`, async () => {
        const chave = process.env.RESEND_API_KEY;
        if (!chave) return false;
        const sb = db();

        // Recheca na hora do envio: entre a busca e agora a pessoa pode ter
        // comprado, ganhado crédito ou se descadastrado.
        const { data: jaFoi } = await sb
          .from("funnel_events")
          .select("id")
          .eq("event_name", "volte_criar_enviado")
          .contains("event_data", { email: c.email })
          .limit(1);
        if ((jaFoi ?? []).length) return false;

        const linkDescadastro = `${SITE}/descadastrar?s=${encodeURIComponent(c.sessao)}&lang=${c.locale}`;
        // Vai pro PAINEL, não direto pro funil: é lá que ela escolhe entre a
        // música avulsa, o pacote de três e o quadro, e é lá que o crédito
        // dela aparece se comprar. Mandar direto pro quiz pularia a oferta.
        const linkCriar = `${SITE}/dashboard`;

        const { error } = await new Resend(chave).emails.send({
          tags: [{ name: "template", value: "volte_criar" }],
          from: "Serenata <contato@serenatagift.com>",
          replyTo: "contato@serenatagift.com",
          to: [c.email],
          subject: assuntoVolteCriar(c.nome, c.locale),
          html: emailVolteCriar({
            nome: c.nome,
            linkCriar,
            linkDescadastro,
            locale: c.locale,
          }),
          headers: {
            "List-Unsubscribe": `<${linkDescadastro}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (error) {
          console.error("[volte-criar] envio falhou:", c.email, error.message);
          return false;
        }

        await sb.from("funnel_events").insert({
          event_name: "volte_criar_enviado",
          event_data: { email: c.email, locale: c.locale },
        });
        return true;
      });
      if (ok) enviados++;
    }

    return { enviados };
  },
);
