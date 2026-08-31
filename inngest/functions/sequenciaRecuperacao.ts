import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  emailSequencia,
  assuntoSequencia,
  type NumeroDaSequencia,
} from "../../emails/sequencia.js";
import {
  assuntoEscada,
  emailEscada,
  linkDeCompra,
  temDesconto,
  ESPERA_H as ESPERA_ESCADA,
  type DegrauEscada,
} from "../../emails/escada.js";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { pareceTypo } from "../../src/lib/email-typo.js";
import { cupomAtivo } from "../../src/lib/cupom.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";

// A SEQUENCIA DE RECUPERACAO: hoje so o e-mail 2 (ver ULTIMO_EMAIL).
//
// O e-mail 1 (a letra) já roda em `mandarLetra` e é uma fila FINITA: pega quem
// passou pelo funil e nunca recebeu nada. Ela secou — 117 envios em 08/08, 76
// em 09/08, 23 em 10/08. E como 5 das 8 vendas de 09/08 vieram dela, o funil
// perdeu junto uma parte grande do que estava vendendo.
//
// Esta função é o motor que substitui aquela fila: recorrente por natureza,
// porque todo dia entra gente nova no topo.
//
// O que autorizou escrever isto: 216 envios do e-mail 1 produziram 7 compras,
// 18 cliques em comprar e UM descadastro. A caixa de entrada aguenta.

const SITE = "https://www.serenatagift.com";

// Espaçamento, contado a partir do e-mail ANTERIOR de cada pessoa.
//
// Não é intervalo fixo desde o quiz: quem recebeu o 1 atrasado (a fila drena a
// 10 por rodada) receberia o 2 quase junto, e dois e-mails no mesmo dia é o
// tipo de coisa que faz a pessoa marcar spam mesmo gostando do produto.
const ESPERA_H: Record<number, number> = {
  2: 24, // no dia seguinte: a gravação ficou pronta depois que ela saiu
  3: 72, // três dias depois do 2
  4: 120, // cinco dias depois do 3 — e aí para
};

/**
 * Quanto esperar antes do próximo e-mail desta pessoa.
 *
 * O PORTUGUÊS roda a escada de dez degraus (`emails/escada.ts`); o ESPANHOL
 * continua na régua curta daqui. Não é esquecimento: são 507 leads e uma venda
 * em três dias naquele funil, volume que não sustenta dez disparos, e a copy da
 * escada é escrita em português — traduzir seria outro trabalho, não uma
 * passada de tradutor.
 */
function esperaDe(numero: number, locale: "pt" | "es"): number {
  if (locale === "pt" && numero in ESPERA_ESCADA) {
    return ESPERA_ESCADA[numero as DegrauEscada];
  }
  return ESPERA_H[numero] ?? 24;
}

// ATÉ ONDE A RÉGUA VAI. Medido em 16/08, com a conversão de cada etapa:
//
//   1 · a letra        1.068 envios   63 compras   5,9%
//   2 · "ficou pronta"   827 envios    8 compras   1,0%
//   3 · "esperando"      330 envios    1 compra    0,3%
//   4                      0 envios      -           -
//
// O e-mail da letra é a recuperação inteira. O 2 ainda se paga. O 3 são 330
// disparos para UMA venda, e o 4 nunca chegou a sair (o primeiro só venceria
// agora).
//
// Não é o custo de enviar que pesa, é a reputação. 84% dos compradores estão
// no Gmail, e é o Gmail que decide se o e-mail de ENTREGA (o único que carrega
// produto pago) cai na caixa de entrada ou no spam. Gastar esse crédito com
// duas etapas que somam uma venda é trocar a entrega de quem pagou por quase
// nada.
//
// Fica em 2. Subir de novo é mudar este número, e os dados dos e-mails 3 e 4
// continuam no banco pra comparar se um dia isso for revisto.
// ── ATÉ ONDE A RÉGUA VAI ────────────────────────────────────────
//
// Era 2, travado pelo número acima. Foi pra 11 (a letra é o 1, mais dez
// degraus) por decisão do dono em 20/08, com aquele número à vista: a aposta é
// que o que faltava era PREÇO, e a régua antiga nunca ofereceu nenhum — ela
// mandava todo mundo de volta ao funil no valor cheio.
//
// O ESPANHOL FICA EM 2. A escada é copy em português e o volume de lá não
// sustenta dez disparos.
//
// COMO SABER SE FOI ERRO: o painel de e-mail quebra por `template`, e cada
// degrau sai como `recuperacao_<n>`. Se descadastro ou reclamação de spam
// subirem num degrau, baixe este número — não precisa deploy nenhum pra ler,
// e baixar é uma linha.
// ── CORTADA EM 3, POR MEDIÇÃO (27/08) ────────────────────────────
//
//   degrau 2   2.931 envios   27 compras   0,92%   R$ 928,81
//   degrau 3     966 envios    2 compras   0,21%   R$  64,11
//   degrau 4     218 envios    0 compras   0,00%   —
//   degrau 5      27 envios    0 compras   0,00%   —
//
// O 4 e o 5 somam 245 envios sem uma venda. Isso não é neutro: cada disparo
// inútil gasta reputação do domínio, e é o Gmail que decide se o e-mail de
// ENTREGA — o único que carrega produto pago — cai na caixa ou no spam. Era
// apostar o canal que funciona pra sustentar degraus que não funcionam.
//
// O QUE ISSO CUSTA, e o dono decidiu com o número à vista: a escada de preço
// (degraus 5 a 11, R$ 29 → R$ 19 → R$ 9) tinha acabado de começar a sair, com
// 27 envios. Cortar em 3 mata esse teste antes de ele rodar. Voltar é trocar
// o 3 por 6 aqui: são dois degraus de R$ 29 e nada mais.
function ultimoEmailDe(locale: "pt" | "es"): number {
  return locale === "es" ? 2 : 3;
}

// Janela de entrada. Mais velho que isso não entra na sequência: e-mail sobre
// uma letra de mês passado chega como cobrança, não como lembrança.
// Subiu de 30 pra 45 quando a escada entrou: os dez degraus somam 720h (30
// dias) e a fila é montada a partir dos leads desta janela. Com 30, a pessoa
// saía da lista no meio da régua e os últimos degraus simplesmente nunca
// saíam — sem erro, sem log, só silêncio.
const OLHAR_ATE_DIAS = 45;

// Teto por rodada, pelo mesmo motivo do `mandarLetra`: `envio.serenatagift.com`
// é domínio novo, e pico de volume em remetente sem histórico é a assinatura
// de lista comprada.
const MAX_POR_RODADA = 10;

/**
 * ESTA PESSOA ABRIU OU CLICOU ALGUM E-MAIL NOSSO?
 *
 * ── POR QUE ISTO DECIDE QUEM RECEBE DESCONTO ─────────────────────
 *
 * Medido em 31/08, no `letra_pronta` (14 dias):
 *
 *   nao abriu   898 pessoas    3,0% compraram
 *   abriu        55 pessoas   18,2% compraram
 *   clicou       81 pessoas   19,8% compraram
 *
 * Quem abre converte SEIS VEZES mais, e 87% nunca abrem. Sao esses 87% que
 * recebiam a escada inteira: 1.700 disparos do `escada_3` que produziram 5
 * vendas (0,6% de clique). Nao e so desperdicio — volume alto sem engajamento
 * e o que rebaixa remetente, e a conta cai no `letra_pronta`, que vende R$ 1,95
 * por envio e esta preso em 13,7% de abertura no mesmo dominio onde o
 * `quase_comprou` abre 37,4%.
 *
 * E resolve o incomodo do dono com desconto: mandar R$ 29 pra quem nunca abriu
 * um e-mail e prostituir o preco sem nem ter uma conversa. Quem abriu, clicou
 * e mesmo assim nao comprou e o unico caso em que preco e objecao plausivel.
 *
 * ── COMO ────────────────────────────────────────────────────────
 *
 * O evento do Resend guarda `event_data.email_id`, nao o quiz. Entao sao dois
 * saltos: quiz -> email_ids (`emails_enviados`) -> eventos. O indice parcial
 * `funnel_events_email_id_engajamento` existe pra isso caber nos 8s do
 * PostgREST.
 *
 * FALHA FECHADA de proposito: banco fora do ar devolve conjunto vazio, e
 * conjunto vazio significa "ninguem engajou", ou seja, NINGUEM recebe
 * desconto. Aqui o lado seguro e nao mandar — o oposto do `cobrarUso`, onde
 * falhar fechado barraria venda.
 */
async function quemEngajou(
  sb: ReturnType<typeof db>,
  quizIds: string[],
): Promise<Set<string>> {
  const engajou = new Set<string>();
  if (!quizIds.length) return engajou;
  try {
    const { data: enviados, error: e1 } = await sb
      .from("emails_enviados")
      .select("email_id, quiz_response_id")
      .in("quiz_response_id", quizIds);
    if (e1 || !enviados?.length) return engajou;

    const doEmail = new Map<string, string>();
    for (const e of enviados as Array<{ email_id: string; quiz_response_id: string }>) {
      if (e.email_id && e.quiz_response_id) doEmail.set(e.email_id, e.quiz_response_id);
    }
    const ids = [...doEmail.keys()];
    if (!ids.length) return engajou;

    const { data: eventos, error: e2 } = await sb
      .from("funnel_events")
      .select("event_data")
      .in("event_name", ["email_opened", "email_clicked"])
      .in("event_data->>email_id", ids);
    if (e2) {
      console.error("[escada] consulta de engajamento falhou:", e2.message);
      return engajou;
    }
    for (const ev of (eventos ?? []) as Array<{ event_data?: { email_id?: string } }>) {
      const q = doEmail.get(ev.event_data?.email_id ?? "");
      if (q) engajou.add(q);
    }
  } catch (err) {
    console.error("[escada] engajamento indisponivel:", err);
  }
  return engajou;
}

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Lê tudo, paginado. `funnel_events` passa de 1000 linhas e o PostgREST corta
 * em silêncio — bug que já custou uma leitura errada neste projeto.
 *
 * `chave` existe porque paginar EXIGE uma ordenação estável, e nem toda tabela
 * daqui tem `id`: `excluidos_email` e `descadastros` são chaveadas por e-mail.
 * Fixar "id" derrubava a função inteira com "column does not exist" — e como
 * ela roda em cron, o erro não aparecia em lugar nenhum: só não saía e-mail.
 */
async function paginado<T>(
  sb: ReturnType<typeof db>,
  tabela: string,
  colunas: string,
  montar?: (q: any) => any,
  chave = "id",
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from(tabela).select(colunas).order(chave, { ascending: true }).range(de, de + 999);
    if (montar) q = montar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

export const sequenciaRecuperacao = inngest.createFunction(
  { id: "sequencia-recuperacao", retries: 1, triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    const fila = await step.run("montar-fila", async () => {
      const sb = db();
      const agora = Date.now();

      // Quem recebeu o e-mail 1. É o único jeito de entrar na sequência: sem
      // ele a pessoa receberia o "a música ficou pronta" sem nunca ter recebido
      // a letra, e a conversa começaria pelo meio.
      type Ev = { event_name: string; event_data: Record<string, unknown> | null; created_at: string };
      // ── OS DISPAROS DIRIGIDOS CONTAM COMO DEGRAU ─────────────────
      //
      // `quase_comprou` (30 min depois de clicar em comprar sem gerar pedido)
      // e `pix_nao_pago` (10 min depois do PIX) são OFERTA, escritos pra uma
      // pessoa específica num momento específico. A escada é oferta genérica.
      //
      // Enquanto eles não entravam nesta conta, quem clicava em comprar e
      // sumia recebia três e-mails em 24 horas: a letra aos 20 min, o
      // `quase_comprou` aos 30 min e o degrau 2 no dia seguinte — os dois
      // últimos dizendo a mesma coisa com palavras diferentes.
      //
      // Contando como degrau 2, a escada retoma no 3, no prazo do 3. A pessoa
      // recebe a oferta BOA no lugar da genérica, e uma só.
      const enviados = await paginado<Ev>(sb, "funnel_events", "id, event_name, event_data, created_at", (q) =>
        q.in("event_name", [
          "email_letra_enviado",
          "email_sequencia_enviado",
          "quase_comprou_enviado",
          "pix_nao_pago_enviado",
        ]),
      );

      // Última correspondência de cada pessoa, e até onde ela já foi na régua.
      const ultimo = new Map<string, { quando: number; numero: number }>();
      for (const e of enviados) {
        const id = String(e.event_data?.quiz_response_id ?? "");
        if (!id) continue;
        // O degrau sai do NOME do evento, não de adivinhação sobre o formato
        // do `event_data`: a escada carimba `numero`, a letra é o 1, e os dois
        // disparos dirigidos valem 2 — o degrau que eles substituem.
        const numero =
          e.event_data?.numero !== undefined
            ? Number(e.event_data.numero)
            : e.event_name === "quase_comprou_enviado" ||
                e.event_name === "pix_nao_pago_enviado"
              ? 2
              : 1;
        const quando = new Date(e.created_at).getTime();
        const atual = ultimo.get(id);
        if (!atual || numero > atual.numero) ultimo.set(id, { quando, numero });
      }
      if (!ultimo.size) return [];

      const [fora, excl, mortos, pagos, leads] = await Promise.all([
        // Chaveadas por e-mail: não têm coluna `id`.
        paginado<{ email: string }>(sb, "descadastros", "email", undefined, "email"),
        paginado<{ email: string }>(sb, "excluidos_email", "email", undefined, "email"),
        // Endereços cujo e-mail voltou. Esta sequência é 870 disparos em 14
        // dias, o maior volume que sai daqui, e é ela que mais insistia em
        // endereço morto: das repetições medidas, a maioria era "está
        // esperando você" indo pra quem já tinha devolvido a entrega.
        paginado<{ email: string }>(sb, "emails_mortos", "email", (q) => q.is("liberado_em", null), "email"),
        paginado<{ quiz_response_id: string | null; email: string | null }>(
          sb,
          "pedidos",
          "id, quiz_response_id, email",
          (q) => q.eq("status", "pago"),
        ),
        paginado<{
          id: string;
          session_id: string | null;
          email: string | null;
          respostas: Record<string, string> | null;
          locale: string | null;
          created_at: string;
        }>(sb, "quiz_responses", "id, session_id, email, respostas, locale, created_at", (q) =>
          q.gte("created_at", new Date(agora - OLHAR_ATE_DIAS * 86400000).toISOString()),
        ),
      ]);

      const bloqueado = new Set<string>([
        ...fora.map((x) => x.email.toLowerCase()),
        ...excl.map((x) => x.email.toLowerCase()),
        ...mortos.map((x) => x.email.toLowerCase()),
        ...pagos.map((x) => (x.email ?? "").toLowerCase()).filter(Boolean),
      ]);
      const comprou = new Set(pagos.map((x) => x.quiz_response_id).filter(Boolean));
      const porId = new Map(leads.map((l) => [l.id, l]));

      let out: Array<{
        quizId: string;
        sessao: string;
        email: string;
        nome: string;
        /** Degrau da régua. Até 4 no espanhol, até 11 no português. */
        numero: number;
        locale: "pt" | "es";
        /** Um trecho da letra QUE ELA ESCREVEU, pra ir dentro do e-mail. */
        verso: string | null;
        /** Tocou a prévia? Decide qual das duas versões do degrau 2 sai. */
        ouviu: boolean;
      }> = [];

      for (const [quizId, { quando, numero }] of ultimo) {
        // JUNTA MAIS DO QUE VAI MANDAR, de proposito.
        //
        // O gate de engajamento roda DEPOIS deste laco (precisa de consulta em
        // lote), e ele derruba ~87% dos candidatos a degrau com desconto. Com
        // o corte em MAX_POR_RODADA aqui, quase toda rodada sairia vazia e a
        // fila de quem PODE receber nunca andaria.
        if (out.length >= MAX_POR_RODADA * 6) break;

        const l = porId.get(quizId);
        if (!l?.email) continue;
        if (bloqueado.has(l.email.toLowerCase())) continue;
        // Por e-mail E por quiz: a compra pode ter sido feita com outro
        // endereço, e aí só o vínculo do pedido pega.
        if (comprou.has(quizId)) continue;
        // Endereço quebrado não entra: bounce em domínio novo é o dano mais
        // caro que existe, e a trava é a mesma do `mandarLetra`.
        if (pareceTypo(l.email)) continue;

        // O IDIOMA SOBE PRA CÁ porque agora ele DECIDE os dois portões abaixo:
        // o português vai até o degrau 11 com a espera da escada, o espanhol
        // para no 2 com a espera antiga. Enquanto ele era lido depois, os dois
        // funis eram medidos pela mesma régua.
        const locale = l.locale === "es" ? "es" : "pt";
        if (numero >= ultimoEmailDe(locale)) continue; // a régua acabou
        const proximo = numero + 1;

        const horas = (agora - quando) / 3600000;
        if (horas < esperaDe(proximo, locale)) continue;
        const r = (l.respostas ?? {}) as Record<string, string>;
        out.push({
          quizId,
          sessao: l.session_id ?? "",
          email: l.email,
          nome: r.nome?.trim() || (locale === "es" ? "esa persona" : "quem você ama"),
          numero: proximo,
          locale,
          verso: null,
          ouviu: false,
        });
      }
      // ── O GATE DE ENGAJAMENTO ─────────────────────────────
      //
      // Degrau de preco CHEIO vai pra qualquer nao-comprador: e lembrete, e a
      // pessoa pediu a letra. Degrau com DESCONTO so vai pra quem abriu ou
      // clicou algum e-mail nosso.
      //
      // Nao e refinamento, e o conserto do maior desperdicio da recuperacao:
      // 1.700 disparos do `escada_3` produziram 5 vendas, enquanto quem abre
      // converte a 18-20% e quem nao abre a 3%. E o volume morto que rebaixa o
      // dominio inteiro, e quem paga a conta e o `letra_pronta`.
      //
      // Tambem responde ao que o dono pediu: parar de descontar no automatico.
      // Preco menor deixa de ser reflexo e passa a ser resposta a alguem que
      // demonstrou interesse e mesmo assim nao comprou.
      const comDesconto = out.filter((o) => temDesconto(o.numero as DegrauEscada));
      if (comDesconto.length) {
        const engajou = await quemEngajou(sb, comDesconto.map((o) => o.quizId));
        const antes = out.length;
        out = out.filter(
          (o) => !temDesconto(o.numero as DegrauEscada) || engajou.has(o.quizId),
        );
        console.log(
          `[escada] gate: ${comDesconto.length} candidatos a desconto, ${engajou.size} engajaram, ${antes - out.length} barrados`,
        );
      }
      // So agora corta no teto da rodada: o teto existe pra proteger a
      // reputacao do remetente, e o que conta pra isso e o que SAI.
      if (out.length > MAX_POR_RODADA) out.length = MAX_POR_RODADA;

      // ── A LETRA DELA, DENTRO DO E-MAIL ────────────────────
      //
      // O cupom saiu daqui e isto entrou no lugar. Motivo medido em 18/08:
      // ZERO cupons usados em 383 vendas. Desconto não era o obstáculo, e
      // dar 26% pra quem ia comprar de qualquer jeito é margem jogada fora.
      //
      // O que a gente tem e ninguém mais tem é a letra que ELA escreveu. Um
      // e-mail que diz "sua letra está lá" é uma afirmação; um e-mail que
      // MOSTRA duas linhas dela é a coisa em si. E foi isso que ela veio
      // buscar.
      //
      // Uma consulta só pra fila inteira, não uma por pessoa.
      if (out.length) {
        const { data: musicas } = await sb
          .from("musicas")
          .select("quiz_response_id, verso_destaque, letra")
          .in("quiz_response_id", out.map((o) => o.quizId));
        const porQuiz = new Map((musicas ?? []).map((m) => [m.quiz_response_id, m]));
        for (const item of out) {
          const m = porQuiz.get(item.quizId);
          // O verso de destaque é o que ELA escolheu na revelação. Sem ele,
          // as duas primeiras linhas da letra, que é onde o nome aparece.
          const bruto = (m?.verso_destaque ?? m?.letra ?? "").toString();
          const linhas = bruto
            .split(String.fromCharCode(10))
            .map((l: string) => l.trim())
            .filter((l: string) => l && !/^\[.*\]$/.test(l))
            .slice(0, 2);
          item.verso = linhas.length ? linhas.join(String.fromCharCode(10)) : null;
        }
      }

      // ── QUEM OUVIU, E POR QUE ISSO MUDA O TEXTO ──────────
      //
      // O degrau 2 padrão conta que a gravação ficou pronta DEPOIS que a
      // pessoa saiu. Pra quem tocou a prévia isso é falso — e é falso pra 81%
      // deles (7 dias: 4.858 chegaram na letra, 3.947 tocaram a música).
      //
      // Com este sinal, quem ouviu recebe `PASSO_2_OUVIU`, que fala do corte
      // no refrão e da segunda gravação; quem não ouviu continua recebendo o
      // texto de sempre, que pra ele é verdadeiro.
      //
      // Uma consulta só pra fila inteira, e só pra quem vai receber o 2:
      // fora dele o sinal não muda nada e não vale a ida ao banco.
      const doDois = out.filter((o) => o.numero === 2 && o.sessao);
      if (doDois.length) {
        const { data: tocaram } = await sb
          .from("funnel_events")
          .select("session_id")
          .in("event_name", ["musica_play", "preview_limite"])
          .in("session_id", doDois.map((o) => o.sessao));
        const ouviram = new Set((tocaram ?? []).map((t) => t.session_id));
        for (const item of doDois) item.ouviu = ouviram.has(item.sessao);
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

      // RECHECA QUEM COMPROU, agora, no instante do envio.
      //
      // A trava da fila já existia, mas era avaliada na MONTAGEM. Entre montar
      // e enviar passam segundos ou minutos, e nessa fresta cabe uma compra.
      // Aconteceu em 11/08 com uma compradora mexicana: comprou às 22:05,
      // recebeu a música inteira, e logo depois recebeu "você foi embora antes
      // da gravação terminar, vem ouvir um trecho". Ela abriu ticket.
      //
      // Uma consulta a mais por rodada é barata; tratar comprador como
      // abandonador é o tipo de erro que a pessoa conta pros outros.
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
          console.log("[sequencia] comprou entre a fila e o envio, pulando:", p.email);
          continue;
        }
        // `/retomar` e não o funil cru: aquela rota busca a letra no servidor
        // pelo session_id, reidrata o navegador e ADOTA a sessão — o que faz
        // uma compra vinda deste e-mail casar com o quiz pelo mesmo `src`.
        // O CUPOM só no último e-mail, e só enquanto estiver valendo. Ele viaja
        // no link e sobrevive até o checkout: `/retomar` guarda o código, o
        // funil carrega, e `?ppc=` aplica sozinho na tela do gateway. Sem essa
        // corrente, o e-mail prometeria um preço e o checkout mostraria outro.
        //
        // ATENÇÃO: com `ULTIMO_EMAIL = 2`, o número 4 nunca acontece, então
        // ESTE CUPOM NUNCA É ENVIADO. E olhando pra trás, ele nunca foi: o
        // e-mail 4 exigia 120h depois do 3, e o 3 só começou a sair em 13/08.
        // Nenhum cliente recebeu SRN27 ou SRN7 até hoje.
        //
        // Deixei a condição amarrada ao 4 de propósito, em vez de mover pro 2.
        // Pôr desconto no e-mail que ainda converte (1,0%) é decisão de
        // margem, não de código: são R$ 10 de um ticket de R$ 38, e o dono
        // precisa escolher se quer pagar isso pra recuperar quem já ia voltar.
        // O CUPOM SAIU. Zero usos em 383 vendas (medido em 18/08): ele não
        // era o obstáculo, e mantê-lo era pagar 26% pra quem compraria do
        // mesmo jeito. O que entra no lugar é a letra dela, logo acima.

        const linkDescadastro = `${SITE}/descadastrar?s=${encodeURIComponent(p.sessao)}&lang=${p.locale}`;

        // ── PARA ONDE O BOTÃO LEVA, e a diferença importa ──
        //
        // A régua antiga (e o espanhol) manda pro `/retomar`, que restaura a
        // sessão e devolve a pessoa ao funil no preço da variante dela.
        //
        // A escada manda DIRETO pro checkout do degrau, porque o preço é o
        // argumento do e-mail: passar pelo funil primeiro mostraria de novo o
        // valor cheio e desmentiria o assunto que a pessoa acabou de abrir.
        // `linkDeCompra` carrega o `src` — é ele que casa o pagamento com a
        // música já gravada no webhook, e sem ele a compra vira "pago sem
        // música casada".
        const naEscada = p.locale === "pt" && p.numero >= 2 && p.numero <= 11;
        const link = naEscada
          ? linkDeCompra(p.numero as DegrauEscada, p.sessao, p.email)
          : `${SITE}/retomar?s=${encodeURIComponent(p.sessao)}`;

        const { data: enviado, error } = await resend.emails.send({
          // A ETIQUETA DO ENVIO. O Resend devolve isto em todo evento
          // (entregue, aberto, clicado, devolvido), e e o unico jeito de
          // saber DEPOIS qual e-mail performou: o assunto carrega o nome da
          // pessoa e nem sempre vem no evento.
          // ETIQUETA SEPARADA PRAS DUAS VERSÕES DO 2.
          //
          // Sem isso os dois textos somariam no mesmo `recuperacao_2` e não
          // haveria como saber qual converte — que é a única razão de existir
          // um segundo texto. `recuperacao_2ouviu` aparece sozinho no painel.
          tags: [
            {
              name: "template",
              value: p.numero === 2 && p.ouviu ? "recuperacao_2ouviu" : `recuperacao_${p.numero}`,
            },
          ],
          from: REMETENTE_RECUPERACAO,
          replyTo: RESPONDER_PARA,
          to: [p.email],
          subject: naEscada
            ? assuntoEscada(p.numero as DegrauEscada, p.nome, p.ouviu)
            : assuntoSequencia(p.numero as NumeroDaSequencia, p.nome, p.locale),
          html: naEscada
            ? emailEscada({
                numero: p.numero as DegrauEscada,
                nome: p.nome,
                link,
                linkDescadastro,
                verso: p.verso,
                ouviu: p.ouviu,
              })
            : emailSequencia({
                numero: p.numero as NumeroDaSequencia,
                nome: p.nome,
                link,
                linkDescadastro,
                locale: p.locale,
                verso: p.verso,
              }),
          headers: {
            "List-Unsubscribe": `<${linkDescadastro}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (error) {
          console.error("[sequencia] envio falhou:", p.email, p.numero, error.message);
          continue;
        }
        // A PONTE PRA MEDIÇÃO. O Resend não devolve as tags nos eventos, então
        // o par (id, template) é gravado aqui e o webhook resolve por ele.
        // Ver src/lib/registro-email.ts.
        await registrarEnvio(sb, {
          emailId: enviado?.id,
          // Mesma separação da etiqueta do Resend: os dois textos do degrau
          // 2 têm que aparecer em linhas diferentes do painel, senão o teste
          // não existe.
          template: p.numero === 2 && p.ouviu ? "escada_2ouviu" : `escada_${p.numero}`,
          para: p.email,
          quizResponseId: p.quizId ?? null,
        });
        n++;
        // O `numero` aqui é o que faz a régua andar: a próxima rodada lê este
        // evento pra saber em que degrau a pessoa está. Sem ele, todo mundo
        // receberia o 2 pra sempre.
        await sb.from("funnel_events").insert({
          session_id: p.sessao || null,
          event_name: "email_sequencia_enviado",
          event_data: {
            numero: p.numero,
            quiz_response_id: p.quizId,
            email: p.email,
            locale: p.locale,
          },
        });
      }
      return n;
    });

    return { enviados, naFila: fila.length };
  },
);
