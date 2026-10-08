import { inngest } from "../client.js";
import { cabecalhosDescadastro, linkDescadastroUmClique } from "../lib/descadastro.js";
import { bloqueados, estaBloqueado } from "../lib/emails-mortos.js";
import { todasAsPaginas } from "../lib/paginar.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { emailOcasiao, assuntoOcasiao } from "../../emails/ocasiao.js";
import { ocasiaoDeHoje, templateDaOcasiao } from "../../src/lib/ocasioes.js";
import {
  alvoDaOcasiao,
  compraMaisRecentePorEmail,
  type PedidoDaOcasiao,
} from "../../src/lib/fila-ocasiao.js";
import { filtroCursor, lerJanela } from "../../src/lib/ler-janela.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";

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
  : MARCA_ATIVA.url;

// Teto por rodada, pelo mesmo motivo dos outros disparos: pico de volume é
// o que assina lista comprada. A fila do Dia das Crianças tem ~590 pessoas
// e a janela é de 18 dias — a 12 por rodada, 10 rodadas por dia, são 120/dia
// e ela drena em cinco dias, sem encostar no teto do domínio.
const MAX_POR_RODADA = 12;

/** Compradores dos últimos 180 dias. Mais velho que isso vira e-mail frio. */
const JANELA_DIAS = 180;

/** Candidatos por consulta de respostas e de bloqueio. */
const LOTE = 100;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const ocasiaoCalendario = inngest.createFunction(
  {
    id: "ocasiao-calendario",
    // Uma rodada por vez: duas sobrepostas montam a mesma fila e mandam em dobro.
    concurrency: { limit: 1 },
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
      const agora = Date.now();
      const desde = new Date(agora - JANELA_DIAS * 86400000).toISOString();

      // ── TUDO, POR CURSOR (08/10) ───────────────────────────────
      //
      // Estas três leituras eram consultas únicas, e o PostgREST devolve no
      // máximo 1.000 linhas:
      //   - os pedidos pagos de 180 dias (~9.300) chegavam como uma amostra
      //     arbitrária de ~1.000, sem ordem: o Dia das Crianças de 2026 foi
      //     pra só 261 compradores;
      //   - a lista de "já recebeu" (`.limit(5000)` não levanta o teto)
      //     ficaria cega a partir do envio 1.001, e a pessoa entraria na fila
      //     de novo;
      //   - a variável `descadastrados` lia `excluidos_email`, e a tabela
      //     `descadastros` de verdade nunca era lida aqui.
      // Agora os pedidos vêm por `lerJanela` (fatias de um dia, cursor por
      // `created_at, id`: pedido pago nesta janela nasceu nela ou um dia
      // antes), o "já recebeu" vem paginado, e o bloqueio é por endereço.
      // Qualquer erro LANÇA: lista pela metade não vira disparo.
      type Pedido = PedidoDaOcasiao & { id: string; created_at: string };
      const [pedidos, jaMandados] = await Promise.all([
        lerJanela<Pedido>(
          ({ desde: de, ate, cursor, limite }) => {
            const base = sb
              .from("pedidos")
              .select("id, email, quiz_response_id, paid_at, dinheiro_entrou, created_at")
              .eq("status", "pago")
              .gte("created_at", de)
              .lt("created_at", ate);
            const comCursor = cursor ? base.or(filtroCursor(cursor)) : base;
            return comCursor.order("created_at").order("id").limit(limite) as never;
          },
          new Date(agora - (JANELA_DIAS + 1) * 86400000),
          new Date(agora + 60000),
        ),
        // A trava é por TEMPLATE, e o template tem o ano dentro: quem
        // recebeu o Dia das Crianças de 2026 pode receber o de 2027.
        todasAsPaginas<{ para: string | null }>((de, ate) =>
          sb
            .from("emails_enviados")
            .select("para")
            .eq("template", template)
            .order("email_id", { ascending: true })
            .range(de, ate),
        ),
      ]);
      const jaRecebeu = new Set(
        jaMandados.map((x) => String(x.para ?? "").trim().toLowerCase()).filter(Boolean),
      );

      const candidatos = compraMaisRecentePorEmail(pedidos, desde).filter((c) => !jaRecebeu.has(c.email));

      const out: Array<{
        email: string; filho: string; nomeMusica: string; locale: "pt" | "es"; quizId: string;
      }> = [];

      // Em lotes: as respostas vêm só com os campos que a regra lê (a
      // `historia` inteira de 100 pessoas por consulta pesaria à toa), e o
      // bloqueio é conferido só pra quem passou na regra.
      for (let i = 0; i < candidatos.length && out.length < MAX_POR_RODADA; i += LOTE) {
        const lote = candidatos.slice(i, i + LOTE);
        const { data: quizzes, error } = await sb
          .from("quiz_responses")
          .select(
            "id, locale, ocasiao:respostas->>ocasiao, relacao:respostas->>relacao, nome:respostas->>nome, filhos:respostas->>filhos",
          )
          .in("id", lote.map((c) => c.quizId));
        if (error) throw new Error(`[ocasiao] quiz_responses: ${error.message}`);
        const porId = new Map(
          ((quizzes ?? []) as Array<Record<string, unknown> & { id: string; locale: string | null }>).map((q) => [q.id, q]),
        );

        const passaram: Array<(typeof out)[number]> = [];
        for (const c of lote) {
          const q = porId.get(c.quizId);
          if (!q) continue;
          const alvo = alvoDaOcasiao(q, q.locale, ocasiao);
          if (alvo) passaram.push({ email: c.email, quizId: c.quizId, ...alvo });
        }
        if (!passaram.length) continue;

        const fora = await bloqueados(sb, passaram.map((p) => p.email), { incluirExcluidos: true });
        for (const p of passaram) {
          if (out.length >= MAX_POR_RODADA) break;
          if (!fora.has(p.email)) out.push(p);
        }
      }
      return out;
    });

    if (!fila.length) return { ocasiao: ocasiao.slug, enviados: 0 };

    // Um passo POR PESSOA: se um envio falhar, o Inngest reexecuta só aquele
    // e ninguém recebe duas vezes.
    let enviados = 0;
    for (const p of fila) {
      await step.run(`mandar-${ocasiao.slug}-${p.email}`, async () => {
        // Rechecagem NA HORA do envio (auditoria 30/09), por pessoa: as três
        // listas de bloqueio, e erro conta como bloqueado.
        const sbEnvio = db();
        if (await estaBloqueado(sbEnvio, p.email, { incluirExcluidos: true })) return;

        // ── A TRAVA É UMA LINHA, GRAVADA ANTES (08/10) ───────────
        //
        // A trava era o `registrarEnvio` DEPOIS do Resend, e ele engole o
        // próprio erro de propósito (existe pra medir, não pra decidir). Uma
        // gravação perdida virava o mesmo e-mail uma hora depois.
        //
        // Agora a linha de `emails_enviados` nasce ANTES, com uma chave que
        // é o próprio par (template, pessoa): a chave primária garante que
        // ela só existe uma vez, então duas rodadas, um passo repetido ou
        // uma gravação concorrente não mandam dois. Não gravou, não manda.
        // Depois do envio a chave vira o id do Resend, como as outras linhas.
        const chaveTrava = `trava:${template}:${p.email}`;
        const { data: ja, error: jaErr } = await sbEnvio
          .from("emails_enviados")
          .select("email_id")
          .eq("template", template)
          .eq("para", p.email)
          .limit(1);
        if (jaErr || (ja ?? []).length > 0) return; // Na dúvida, já mandou (04/10).
        const { error: travaErr } = await sbEnvio.from("emails_enviados").insert({
          email_id: chaveTrava,
          template,
          para: p.email,
          quiz_response_id: p.quizId,
        });
        if (travaErr) {
          console.error("[ocasiao] trava não gravou, sem envio:", p.email, travaErr.message);
          return;
        }

        const resend = new Resend(process.env.RESEND_API_KEY);
        const linkCriar = `${SITE}${p.locale === "es" ? "/es/criar" : "/criar"}?de=ocasiao&o=${ocasiao.slug}`;
        // `/descadastrar?email=` não existia (a rota só aceita `?s=`): o link
        // caía na tela de erro. O um-clique assinado é o mesmo do cabeçalho.
        const linkDescadastro = linkDescadastroUmClique(p.email) ?? `${SITE}/descadastrar`;

        const r = await resend.emails.send({
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: p.email,
          headers: cabecalhosDescadastro(p.email),
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

        if (r.error) {
          // Não saiu: a trava sai junto e a próxima rodada tenta de novo.
          // Lançar derrubaria o resto da fila. Se nem apagar der, a pessoa
          // fica sem este e-mail, nunca com dois.
          console.error("[ocasiao] resend recusou:", r.error.message);
          const { error: soltarErr } = await sbEnvio.from("emails_enviados").delete().eq("email_id", chaveTrava);
          if (soltarErr) console.error("[ocasiao] trava não saiu, fica sem este e-mail:", p.email, soltarErr.message);
          return;
        }

        // A trava vira o registro de medição: o webhook do Resend resolve o
        // template pelo id dele. Se a troca falhar, a trava continua valendo
        // e só a medição deste envio se perde.
        if (r.data?.id) {
          const { error: idErr } = await sbEnvio
            .from("emails_enviados")
            .update({ email_id: r.data.id })
            .eq("email_id", chaveTrava);
          if (idErr) console.error("[ocasiao] id do Resend não gravado:", p.email, idErr.message);
        }
        enviados += 1;
      });
    }

    return { ocasiao: ocasiao.slug, ano, diasQueFaltam, enviados };
  },
);
