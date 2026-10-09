import { inngest } from "../client.js";
import { cabecalhosDescadastro } from "../lib/descadastro.js";
import { createClient } from "@supabase/supabase-js";
import { bloqueados } from "../lib/emails-mortos.js";
import { jaComprou } from "../lib/ja-comprou.js";
import { soltarTrava, travarEnvio } from "../lib/trava-envio.js";
import { Resend } from "resend";
import { comUtm } from "../../src/lib/utm-email.js";
import { emailLetraPronta, assuntoLetraPronta } from "../../emails/letra-pronta.js";
import { REMETENTE_TRANSACIONAL } from "../../emails/remetentes.js";
import { pareceTypo } from "../../src/lib/email-typo.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";
import { normalizarLocale, type Locale } from "../../src/lib/i18n.js";
import { filtroCursor, lerJanela } from "../../src/lib/ler-janela.js";

// O nome de quem não disse o nome, por idioma. Mora aqui em cima porque o
// teste de assunto precisa reconhecer quando o nome é o genérico.
const NOME_GENERICO: Record<Locale, string> = {
  pt: "quem você ama",
  es: "esa persona",
  en: "someone you love",
};

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

const SITE = MARCA_ATIVA.url;
const ESPERAR_MIN = 20;
// ── 48 HORAS, LIDAS INTEIRAS (08/10) ─────────────────────────────
//
// Era "30 dias", mas a consulta não paginava e vinha ordenada da mais nova:
// o PostgREST devolvia só os 1.000 leads mais recentes, que no volume de
// outubro (447 vendas em 02/10) cobrem menos de um dia. Ninguém mais velho
// que isso era sequer olhado, e o número escrito aqui mentia.
//
// Ler 30 dias de verdade a cada 5 minutos seriam dezenas de milhares de
// linhas por rodada, e uma letra que chega semanas depois não é lembrança
// ("três horas depois é lixo", acima). 48h cobre o "dia seguinte" e cabe em
// poucas páginas leves (sem `respostas`), lidas por cursor (`lerJanela`). A
// fila continua andando da mais nova pra mais velha e para quando enche:
// lead fresco nunca espera por causa de lead velho.
const OLHAR_ATE_H = 48;
/** Candidatos conferidos em lote (já recebeu? já comprou?) antes da checagem por pessoa. */
const LOTE = 100;
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

/**
 * Já mandamos a letra deste quiz?
 *
 * ── NA DÚVIDA, JÁ MANDOU (04/10) ─────────────────────────────────
 *
 * Esta trava lia SÓ `funnel_events` e tratava erro como "não mandei". Com 5,2
 * milhões de linhas a busca levava 16-20s, o PostgREST cortava em 8s, o erro
 * virava lista vazia, e a letra saía DE NOVO a cada 5 minutos: até 32 vezes
 * pra mesma pessoa em 24h (330 pessoas repetidas num dia).
 *
 * Agora pergunta primeiro a `emails_enviados` (indexada por quiz, 40ms), e
 * qualquer erro conta como JÁ MANDOU: deixar de mandar uma letra custa uma
 * venda; mandar 30 vezes queima o domínio inteiro.
 */
async function jaMandou(sb: ReturnType<typeof db>, quizId: string, quizCriadoEm: string): Promise<boolean> {
  const porEnvio = await sb
    .from("emails_enviados")
    .select("email_id")
    .eq("quiz_response_id", quizId)
    .eq("template", "letra_pronta")
    .limit(1);
  if (porEnvio.error) {
    console.error("[letra] trava emails_enviados falhou, pulando por segurança:", quizId, porEnvio.error.message);
    return true;
  }
  if ((porEnvio.data ?? []).length > 0) return true;
  // A trilha antiga continua valendo pra envio de antes de `emails_enviados`
  // ganhar o quiz (05/09). Índice parcial GIN desde 04/10.
  const porEvento = await sb
    .from("funnel_events")
    .select("id")
    .eq("event_name", "email_letra_enviado")
    .contains("event_data", { quiz_response_id: quizId })
    // A letra não sai antes de o quiz existir: a janela é exata e usa o
    // índice de tempo (sem `created_at`, `funnel_events` é bug esperando).
    .gte("created_at", quizCriadoEm)
    .limit(1);
  if (porEvento.error) {
    console.error("[letra] trava funnel_events falhou, pulando por segurança:", quizId, porEvento.error.message);
    return true;
  }
  return (porEvento.data ?? []).length > 0;
}

export const mandarLetra = inngest.createFunction(
  { id: "mandar-letra", retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const fila = await step.run("montar-fila", async () => {
      const sb = db();
      const agora = Date.now();

      // Quem tem e-mail, na janela, mais novo primeiro. `lerJanela` lança se
      // qualquer página falhar: lista pela metade não vira fila.
      type Lead = {
        id: string;
        session_id: string | null;
        email: string | null;
        locale: string | null;
        created_at: string;
        nome: string | null;
      };
      const leads = await lerJanela<Lead>(
        ({ desde, ate, cursor, limite }) => {
          const base = sb
            .from("quiz_responses")
            .select("id, session_id, email, locale, created_at, nome:respostas->>nome")
            .not("email", "is", null)
            .gte("created_at", desde)
            .lt("created_at", ate);
          const comCursor = cursor ? base.or(filtroCursor(cursor)) : base;
          return comCursor.order("created_at").order("id").limit(limite) as never;
        },
        new Date(agora - OLHAR_ATE_H * 3600000),
        new Date(agora - ESPERAR_MIN * 60000),
      );
      leads.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

      const out: Array<{
        quizId: string; criadoEm: string; sessao: string; email: string; nome: string;
        titulo: string; letra: string; locale: Locale;
      }> = [];

      for (let i = 0; i < leads.length && out.length < MAX_POR_RODADA; i += LOTE) {
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
        const lote = leads
          .slice(i, i + LOTE)
          .filter((l): l is Lead & { email: string } => Boolean(l.email) && !pareceTypo(l.email as string));
        if (!lote.length) continue;

        // ── O GROSSO SAI EM LOTE (08/10) ─────────────────────────
        //
        // Quase todo lead da janela já recebeu a letra ou já comprou. Antes,
        // cada um desses passava por ~6 consultas individuais a cada 5 min.
        // Duas perguntas por lote de 100 tiram a maioria; as checagens por
        // pessoa, exatas, ficam pra quem sobra. Erro LANÇA: na dúvida, a
        // rodada não manda nada.
        const ids = lote.map((l) => l.id);
        const [recebeu, pagou] = await Promise.all([
          sb
            .from("emails_enviados")
            .select("quiz_response_id")
            .eq("template", "letra_pronta")
            .in("quiz_response_id", ids),
          sb.from("pedidos").select("quiz_response_id").eq("status", "pago").in("quiz_response_id", ids),
        ]);
        if (recebeu.error || pagou.error) {
          throw new Error(`[letra] triagem em lote falhou: ${recebeu.error?.message ?? pagou.error?.message}`);
        }
        const fora = new Set(
          [...(recebeu.data ?? []), ...(pagou.data ?? [])].map((x) => String(x.quiz_response_id)),
        );
        const restantes = lote.filter((l) => !fora.has(l.id));
        if (!restantes.length) continue;

        // As três listas de bloqueio, POR ENDEREÇO: descadastrados, excluídos
        // e endereços que já voltaram. Antes eram lidas inteiras e o PostgREST
        // as cortava em 1000 linhas (os mortos eram 2.540 em 04/10: 1.540
        // seguiam recebendo, 4,8% de bounce em 03/10). Lança se não ler.
        const bloq = await bloqueados(sb, restantes.map((l) => l.email), { incluirExcluidos: true });

        for (const l of restantes) {
          if (out.length >= MAX_POR_RODADA) break;
          if (bloq.has(l.email.trim().toLowerCase())) continue;
          // Por quiz E por e-mail (a compra pode ter sido noutro quiz), e erro
          // conta como comprou. Ver `inngest/lib/ja-comprou.ts`.
          if (await jaComprou(sb, l.id, l.email)) continue;

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

          if (await jaMandou(sb, l.id, l.created_at)) continue;

          // Sem idioma gravado, cai no padrão da marca (pt na Serenata, en na
          // Ballad Gift).
          const locale = normalizarLocale(l.locale);
          out.push({
            quizId: l.id,
            criadoEm: l.created_at,
            sessao: l.session_id ?? "",
            email: l.email,
            nome: l.nome?.trim() || NOME_GENERICO[locale],
            titulo: m.titulo ?? (locale === "es" ? "Tu canción" : locale === "en" ? "Your song" : "Sua música"),
            letra: m.letra,
            locale,
          });
        }
      }
      return out;
    });

    if (!fila.length) return { enviados: 0 };

    const enviados = await step.run("enviar", async () => {
      const sb = db();
      const chave = process.env.RESEND_API_KEY;
      if (!chave) throw new Error("RESEND_API_KEY ausente");
      const resend = comUtm(new Resend(chave));
      let n = 0;

      // Mesma recheca do `sequenciaRecuperacao`: a trava da fila é avaliada na
      // MONTAGEM, e entre montar e enviar cabe uma compra. Quem comprou nessa
      // fresta receberia "ouça um trecho" tendo a música inteira.
      //
      // POR PESSOA (08/10). Aqui havia a tabela de pedidos pagos inteira numa
      // consulta só, cortada em 1.000 das ~9.300 linhas: a recheca via um em
      // cada nove compradores, e de 1 a 13 por dia de "a sua letra está
      // pronta" chegavam pra quem já tinha pago (8 em 07/10).
      for (const p of fila) {
        if (await jaComprou(sb, p.quizId, p.email)) {
          console.log("[letra] comprou entre a fila e o envio, pulando:", p.email);
          continue;
        }
        // Este passo manda a fila inteira; se cair no meio, o Inngest repete
        // o passo com a mesma fila, inclusive quem já recebeu.
        if (await jaMandou(sb, p.quizId, p.criadoEm)) continue;
        // O `src` é o que faz a compra vinda deste e-mail casar com o quiz —
        // mesmo mecanismo do funil, sem adivinhar por e-mail.
        // `/retomar` e não `/criar?step=reveal`: aquela tela lê a letra do
        // localStorage, então abrir o e-mail noutro aparelho mostraria
        // "faltou a parte mais importante". O /retomar busca no servidor,
        // reidrata o navegador e só então manda pro reveal.
        const linkPrevia = `${SITE}/retomar?s=${encodeURIComponent(p.sessao)}`;
        const linkDescadastro = `${SITE}/descadastrar?s=${encodeURIComponent(p.sessao)}&lang=${p.locale}`;

        // TESTE DE ASSUNTO (28/09): metade A, metade B, pelo último caractere
        // do id do quiz (estável: a mesma pessoa cai sempre no mesmo lado).
        // O B cita o nome no começo, então sem nome real fica no A: "quem você
        // ama ganhou uma música" não é frase. O teste é só em português: o
        // espanhol e o inglês saem sempre no A.
        const nomeReal = !Object.values(NOME_GENERICO).includes(p.nome);
        const variante: "a" | "b" =
          p.locale === "pt" && nomeReal && parseInt(p.quizId.slice(-1), 16) % 2 === 1 ? "b" : "a";

        // A TRAVA ANTES DO ENVIO (08/10). Este evento é a trava (`jaMandou`)
        // e a porta da escada; ele era gravado DEPOIS do Resend e sem ler o
        // erro, e uma gravação perdida fazia a letra sair de novo 5 minutos
        // depois. Não gravou, não manda.
        const trava = await travarEnvio(sb, {
          session_id: p.sessao || null,
          event_name: "email_letra_enviado",
          event_data: { quiz_response_id: p.quizId, email: p.email, locale: p.locale, variante_assunto: variante },
        });
        if (!trava) continue;

        const { data: enviado, error } = await resend.emails.send({
      // A ETIQUETA DO ENVIO. O Resend devolve isto em todo evento
      // (entregue, aberto, clicado, devolvido), e e o unico jeito de
      // saber DEPOIS qual e-mail performou: o assunto carrega o nome da
      // pessoa e nem sempre vem no evento.
      tags: [{ name: "template", value: "letra_pronta" }, { name: "variante", value: variante }],
          // ── DOMÍNIO RAIZ, desde 02/09 ────────────────────────
          //
          // Ele saía pelo subdomínio de recuperação porque vai pra quem ainda
          // não comprou. A régua estava errada: a pessoa PEDIU esta letra,
          // digitando o próprio e-mail pra recebê-la. Não é conteúdo não
          // solicitado, é a entrega de um produto grátis.
          //
          // O que a classificação errada custava, medido em 14 dias: 3.014
          // entregues abrindo 14,2%, contra 34,6% do domínio raiz. Metade da
          // abertura do e-mail de maior volume e de maior consequência da
          // operação, porque é ele que sustenta toda a recuperação.
          //
          // E o motivo que justificava o subdomínio não apareceu: ZERO
          // reclamações de spam em 16 mil entregas, com o webhook conferido
          // escutando `email.complained`.
          //
          // A escada de descontos continua no subdomínio. Ela é oferta, e
          // oferta é o que junta reclamação quando junta. Ver `remetentes.ts`.
          from: REMETENTE_TRANSACIONAL,
          to: [p.email],
          // Cabeçalho que o Gmail e o Outlook leem pra oferecer o "cancelar
          // inscrição" nativo. Sem ele, quem quer sair usa o botão de spam.
          // Desde 25/09 aponta pra `/api/descadastro`, que aceita o toque
          // único (POST) do provedor; a página `/descadastrar` não aceitava.
          headers: cabecalhosDescadastro(p.email),
          subject: assuntoLetraPronta(p.nome, p.locale, variante),
          html: emailLetraPronta({ ...p, linkPrevia, linkDescadastro }),
        });
        if (error) {
          console.error("[letra] envio falhou:", p.email, error.message);
          await soltarTrava(sb, trava);
          // ENDEREÇO QUE O RESEND RECUSA NÃO VOLTA PRA FILA (08/10). Sem isto,
          // o mesmo endereço inválido era tentado a cada 5 min pra sempre (três
          // deles ~200 vezes em 20h), ocupando vaga da rodada de quem tinha
          // e-mail bom. Vai pra `emails_mortos`, que a fila já confere.
          if (/invalid `?to`?|validation/i.test(`${error.name ?? ""} ${error.message ?? ""}`)) {
            await sb.from("emails_mortos").upsert(
              {
                email: p.email.toLowerCase(),
                motivo: "invalido",
                detalhe: String(error.message ?? "").slice(0, 400),
                assunto: "letra_pronta",
                ultimo_em: new Date().toISOString(),
              },
              { onConflict: "email" },
            );
          }
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
      }
      return n;
    });

    return { enviados, naFila: fila.length };
  },
);
