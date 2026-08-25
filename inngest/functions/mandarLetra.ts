import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailLetraPronta, assuntoLetraPronta } from "../../emails/letra-pronta.js";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { pareceTypo } from "../../src/lib/email-typo.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

// MANDA A LETRA por e-mail — a promessa que o quiz faz e que nunca foi
// cumprida ("o e-mail é só pra você não perder").
//
// Por que CRON e não disparo no `finalizarLetra`: o mesmo motivo do lembrete.
// Cron pega TODO mundo, inclusive as 94 pessoas que já passaram pelo funil
// antes disto existir, e não some se um evento falhar em silêncio.
//
// Por que 20 MINUTOS de espera e não na hora: quem ainda está na tela lendo a
// letra não precisa de e-mail; chegar enquanto ela está ali é ruído. Vinte
// minutos é depois de a maioria ter saído e antes de esquecer.

const SITE = "https://www.serenatagift.com";
const ESPERAR_MIN = 20;
const OLHAR_ATE_DIAS = 30;
// Teto por rodada. Não é sobre custo: `envio.serenatagift.com` é um domínio
// RECÉM-CRIADO, com zero histórico. Provedor não distingue "remetente novo"
// de "remetente comprometido" — os dois aparecem do nada mandando volume. A
// única forma de construir reputação é subir devagar.
// A 10 por rodada (de 20 em 20 min), 100 pendentes drenam em ~3,5h. Dá pra
// subir depois de ver a taxa de entrega estabilizar.
const MAX_POR_RODADA = 10;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Já mandamos a letra desta sessão? Registro em `funnel_events`, mesma
 *  trilha do lembrete — evita migration só pra um booleano. */
async function jaMandou(sb: ReturnType<typeof db>, quizId: string) {
  const { data } = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "email_letra_enviado")
    .contains("event_data", { quiz_response_id: quizId })
    .limit(1);
  return (data ?? []).length > 0;
}

export const mandarLetra = inngest.createFunction(
  { id: "mandar-letra", retries: 1, triggers: [{ cron: "*/20 * * * *" }] },
  async ({ step }) => {
    const fila = await step.run("montar-fila", async () => {
      const sb = db();
      const agora = Date.now();

      // Quem tem LETRA e e-mail, na janela.
      const { data: leads } = await sb
        .from("quiz_responses")
        .select("id, session_id, email, respostas, locale, created_at")
        .not("email", "is", null)
        .gte("created_at", new Date(agora - OLHAR_ATE_DIAS * 86400000).toISOString())
        .lte("created_at", new Date(agora - ESPERAR_MIN * 60000).toISOString())
        .order("created_at", { ascending: false });

      // As quatro travas, nesta ordem: descadastrados, excluídos, endereços
      // que já voltaram, e quem já comprou. Nenhuma é opcional.
      const [{ data: fora }, { data: excl }, { data: mortos }, { data: pagos }] = await Promise.all([
        sb.from("descadastros").select("email"),
        sb.from("excluidos_email").select("email"),
        // JÁ VOLTOU UMA VEZ, NÃO TENTA DE NOVO. O `pareceTypo` logo abaixo pega
        // o endereço errado pela cara; este pega o que o provedor já RECUSOU na
        // prática, que é informação melhor que qualquer heurística.
        sb.from("emails_mortos").select("email").is("liberado_em", null),
        sb.from("pedidos").select("quiz_response_id, email").eq("status", "pago"),
      ]);
      const bloqueado = new Set([
        ...(fora ?? []).map((x) => x.email.toLowerCase()),
        ...(excl ?? []).map((x) => x.email.toLowerCase()),
        ...(mortos ?? []).map((x) => x.email.toLowerCase()),
        // QUEM COMPROU. Recebe a música inteira pelo e-mail de entrega;
        // mandar "ouça um trecho" depois disso é ofensivo de tão errado.
        // Por e-mail E por quiz_response: a compra pode ter sido feita com
        // outro endereço, e aí só o vínculo do pedido pega.
        ...(pagos ?? []).map((x) => (x.email ?? "").toLowerCase()).filter(Boolean),
      ]);
      const quizComprou = new Set((pagos ?? []).map((x) => x.quiz_response_id).filter(Boolean));

      const out: Array<{
        quizId: string; sessao: string; email: string; nome: string;
        titulo: string; letra: string; locale: "pt" | "es";
      }> = [];

      for (const l of leads ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if (!l.email || bloqueado.has(l.email.toLowerCase())) continue;
        if (quizComprou.has(l.id)) continue;

        // E-MAIL DIGITADO ERRADO. `gmail.comm` bateu de volta no primeiro
        // disparo pelo subdomínio, e bounce é o dano mais caro que existe num
        // domínio sem histórico: o provedor não sabe se você é remetente novo
        // ou lista comprada, e endereço inexistente é a assinatura da lista
        // comprada. 9,2% da base tem endereço assim.
        //
        // SKIP e não conserto automático, mesmo tendo o palpite certo em mãos.
        // Corrigir `gmail.comm` pra `gmail.com` é mandar a história pessoal de
        // alguém pra um endereço que essa pessoa nunca nos deu. Se o palpite
        // errar uma vez, vazou a letra de um desconhecido pra outro. Sugerir na
        // tela, onde ela confirma, é diferente de decidir por ela no servidor.
        if (pareceTypo(l.email)) continue;

        // A letra tem que existir: sem ela o e-mail não tem conteúdo.
        const { data: m } = await sb
          .from("musicas")
          .select("titulo, letra")
          .eq("quiz_response_id", l.id)
          .not("letra", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!m?.letra) continue;

        if (await jaMandou(sb, l.id)) continue;

        const locale = l.locale === "es" ? "es" : "pt";
        const r = (l.respostas ?? {}) as Record<string, string>;
        out.push({
          quizId: l.id,
          sessao: l.session_id ?? "",
          email: l.email,
          nome: r.nome?.trim() || (locale === "es" ? "esa persona" : "quem você ama"),
          titulo: m.titulo ?? (locale === "es" ? "Tu canción" : "Sua música"),
          letra: m.letra,
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

      // Mesma recheca do `sequenciaRecuperacao`: a trava da fila é avaliada na
      // MONTAGEM, e entre montar e enviar cabe uma compra. Quem comprou nessa
      // fresta receberia "ouça um trecho" tendo a música inteira.
      const { data: comprasAgora } = await sb
        .from("pedidos")
        .select("quiz_response_id, email")
        .eq("status", "pago");
      const jaComprou = new Set(
        (comprasAgora ?? []).map((x) => x.quiz_response_id).filter(Boolean),
      );
      const emailComprou = new Set(
        (comprasAgora ?? []).map((x) => (x.email ?? "").toLowerCase()).filter(Boolean),
      );

      for (const p of fila) {
        if (jaComprou.has(p.quizId) || emailComprou.has(p.email.toLowerCase())) {
          console.log("[letra] comprou entre a fila e o envio, pulando:", p.email);
          continue;
        }
        // O `src` é o que faz a compra vinda deste e-mail casar com o quiz —
        // mesmo mecanismo do funil, sem adivinhar por e-mail.
        // `/retomar` e não `/criar?step=reveal`: aquela tela lê a letra do
        // localStorage, então abrir o e-mail noutro aparelho mostraria
        // "faltou a parte mais importante". O /retomar busca no servidor,
        // reidrata o navegador e só então manda pro reveal.
        const linkPrevia = `${SITE}/retomar?s=${encodeURIComponent(p.sessao)}`;
        const linkDescadastro = `${SITE}/descadastrar?s=${encodeURIComponent(p.sessao)}&lang=${p.locale}`;

        const { data: enviado, error } = await resend.emails.send({
      // A ETIQUETA DO ENVIO. O Resend devolve isto em todo evento
      // (entregue, aberto, clicado, devolvido), e e o unico jeito de
      // saber DEPOIS qual e-mail performou: o assunto carrega o nome da
      // pessoa e nem sempre vem no evento.
      tags: [{ name: "template", value: "letra_pronta" }],
          // Subdomínio, não o domínio raiz. Este e-mail vai pra quem NÃO
          // comprou, e é o tipo que junta reclamação de spam por natureza.
          // Se ele queimar reputação, queima a do `envio.` — a ENTREGA de
          // quem pagou continua saindo de `contato@serenatagift.com`, limpa.
          from: REMETENTE_RECUPERACAO,
          // O subdomínio só manda, não tem caixa. Sem isto, quem responde
          // escreve pro vazio — e resposta de cliente é o retorno mais
          // valioso que um disparo produz.
          replyTo: RESPONDER_PARA,
          to: [p.email],
          subject: assuntoLetraPronta(p.nome, p.locale),
          html: emailLetraPronta({ ...p, linkPrevia, linkDescadastro }),
          // Cabeçalho que o Gmail lê pra oferecer o "cancelar inscrição"
          // nativo. Sem ele, quem quer sair usa o botão de spam.
          headers: {
            "List-Unsubscribe": `<${linkDescadastro}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (error) {
          console.error("[letra] envio falhou:", p.email, error.message);
          continue;
        }
        await registrarEnvio(sb, {
          emailId: enviado?.id,
          template: "letra_pronta",
          para: p.email,
        });
        n++;
        await sb.from("funnel_events").insert({
          session_id: p.sessao || null,
          event_name: "email_letra_enviado",
          event_data: { quiz_response_id: p.quizId, email: p.email, locale: p.locale },
        });
      }
      return n;
    });

    return { enviados, naFila: fila.length };
  },
);
