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
//
// ── O TETO CONTINUA 10. O QUE MUDA É A FREQUÊNCIA ────────────────
//
// De 20 em 20 minutos, 10 por rodada é um teto de 720 por dia — e a demanda
// real é MAIOR que isso: 6.262 pessoas terminaram o quiz em 7 dias, ~895 por
// dia. A fila nunca drenava, ela só crescia, e o efeito estava medido em
// 27/08 (4 dias):
//
//   mediana 19,9 min · p90 189 min (3h09) · pior caso 23,2h
//   16% de quem terminou a letra NUNCA recebeu o e-mail
//
// Um e-mail chamado "A letra que você escreveu pra Fulana" que chega três
// horas depois não é lembrança, é lixo — e o número que sobra disso é a taxa
// de abertura de 10,5%, a pior de todos os templates (o de entrega faz 49,3%
// com o mesmo domínio e o mesmo desenho).
//
// A RODADA NÃO CRESCEU, o INTERVALO ENCOLHEU: 10 por rodada de 5 em 5 minutos.
// O que assusta provedor é o TAMANHO do pico, e o pico continua idêntico; o
// que muda é que a fila drena 4x mais rápido e o volume diário passa a ser
// ditado pela demanda real em vez de por um estrangulamento nosso.
//
// Se a entrega piorar, o conserto é uma linha: volte o cron pra `*/10`.
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
  { id: "mandar-letra", retries: 1, triggers: [{ cron: "*/5 * * * *" }] },
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
      const [{ data: fora }, { data: excl }, { data: mortos }] = await Promise.all([
        sb.from("descadastros").select("email"),
        sb.from("excluidos_email").select("email"),
        // JÁ VOLTOU UMA VEZ, NÃO TENTA DE NOVO. O `pareceTypo` logo abaixo pega
        // o endereço errado pela cara; este pega o que o provedor já RECUSOU na
        // prática, que é informação melhor que qualquer heurística.
        sb.from("emails_mortos").select("email").is("liberado_em", null),
      ]);
      const bloqueado = new Set([
        ...(fora ?? []).map((x) => x.email.toLowerCase()),
        ...(excl ?? []).map((x) => x.email.toLowerCase()),
        ...(mortos ?? []).map((x) => x.email.toLowerCase()),
      ]);

      // ── QUEM COMPROU: PERGUNTA POR PESSOA, NÃO LISTA INTEIRA ──────
      //
      // Aqui havia `.from("pedidos").select(...).eq("status","pago")` sem
      // paginação, e o PostgREST corta em 1000 linhas. Em 27/08 existiam
      // 1.151 pedidos pagos: 151 compradores (13%) eram INVISÍVEIS pra esta
      // trava, e a fatia invisível cresce todo dia.
      //
      // A conta apareceu na caixa de entrada. Paulo pagou R$ 38 às 10:36,
      // recebeu a entrega às 10:36, e às 10:45 recebeu "A letra que você
      // escreveu está pronta" — o e-mail de quem NÃO comprou. Ele escreveu
      // dizendo que a música não tinha chegado.
      //
      // Paginar consertaria o corte, mas continuaria carregando a tabela
      // inteira de vendas a cada rodada pra usar 10 nomes. A pergunta certa
      // é por candidato: são no máximo `MAX_POR_RODADA` consultas, as duas
      // por índice, e a resposta não depende do tamanho da tabela — hoje nem
      // no dia em que forem 100 mil pedidos.
      async function jaComprou(quizId: string, email: string): Promise<boolean> {
        const [porQuiz, porEmail] = await Promise.all([
          sb.from("pedidos").select("id").eq("quiz_response_id", quizId).eq("status", "pago").limit(1),
          // Por E-MAIL também: a compra pode ter sido feita com outro
          // endereço de cadastro, e aí só este vínculo pega. `eq` e não
          // `ilike`: `%` e `_` são curingas do LIKE e são caracteres válidos
          // em endereço de e-mail.
          sb.from("pedidos").select("id").eq("email", email).eq("status", "pago").limit(1),
        ]);
        return (porQuiz.data ?? []).length > 0 || (porEmail.data ?? []).length > 0;
      }

      const out: Array<{
        quizId: string; sessao: string; email: string; nome: string;
        titulo: string; letra: string; locale: "pt" | "es";
      }> = [];

      for (const l of leads ?? []) {
        if (out.length >= MAX_POR_RODADA) break;
        if (!l.email || bloqueado.has(l.email.toLowerCase())) continue;
        if (await jaComprou(l.id, l.email)) continue;

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
          // O ID DO QUIZ, que faltava. Sem ele a linha de `emails_enviados`
          // grava QUE saiu e não PRA QUEM, e nenhuma pergunta sobre receita
          // por e-mail tem resposta — era o caso dos 978 `letra_pronta`
          // registrados em dois dias, todos com `quiz_response_id` nulo.
          quizResponseId: p.quizId,
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
