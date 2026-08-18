import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { QUIZ_FLOW } from "@/lib/quiz-flow";
import { isQuestion } from "@/lib/flow-engine";
import { PRECOS } from "@/lib/custos";

// 12 créditos por geração (2 versões). Da tabela pública do kie.ai.
const CREDITO_POR_MUSICA = 12;

// Agregações do painel. TODAS exigem admin antes de tocar no banco — nenhuma
// consulta roda para quem não está autenticado.
//
// O painel responde três perguntas de negócio, nessa ordem:
//   1. Está entrando dinheiro? (vendas, receita, margem, CAC)
//   2. De ONDE vem? (atribuição por campanha/origem)
//   3. Onde a pessoa DESISTE? (o funil passo a passo, do clique à venda)

/** Qual funil o painel está olhando. */
export type FunilFiltro = "todos" | "pt" | "es";

export type Painel = {
  /** Qual funil este recorte está olhando. */
  filtro: FunilFiltro;
  periodoDias: number;
  /** Início e fim reais do recorte (ISO), pra o painel exibir. */
  de: string;
  ate: string;
  geradoEm: string;

  topo: {
    visitantes: number;
    quizIniciados: number;
    leads: number; // deixou e-mail
    letrasGeradas: number;
    cliquesCheckout: number;
    vendas: number;
    // As duas receitas NUNCA são somadas. O funil brasileiro cobra em real,
    // o espanhol cobra em dólar na Perfect Pay, e juntar os dois num total
    // só produz um número que não existe em lugar nenhum.
    receitaBrl: number;
    receitaUsd: number;
    /** Receita convertida pra real ao câmbio de `cambioUsdBrl`, pra margem. */
    receitaConvertidaBrl: number;
    ticketMedioBrl: number;
    custoTotalBrl: number;
    margemBrl: number;
    // ── mídia (digitada em `gastos_ads`) ──
    /** Gasto de anúncio no período. 0 quando não foi lançado. */
    gastoAdsBrl: number;
    /** Quanto custa trazer UMA venda. É a conta que decide se a operação vive. */
    cpaBrl: number;
    /** Receita dividida pelo gasto. Abaixo de 1 é prejuízo. */
    roas: number;
    /** Receita menos produção menos mídia. O que sobra de verdade. */
    lucroBrl: number;
    // conversões-chave
    taxaVisitaQuiz: number; // visitante -> começou o quiz
    taxaQuizLetra: number; // começou -> recebeu a letra
    taxaLetraCheckout: number; // letra -> clicou em comprar
    taxaCheckoutVenda: number; // clicou -> pagou
    taxaGeral: number; // visitante -> venda
    custoPorVendaBrl: number;
  };

  /**
   * O MESMO RECORTE, UM PERÍODO ATRÁS. É o que alimenta a variação ao lado de
   * cada número ("↓ 24%"), no espírito do painel da Shopify.
   *
   * Guarda VALORES, não porcentagens: a conta é feita na tela, onde se sabe
   * qual número é bom subir. Guardar a % aqui obrigaria a decidir o sinal de
   * cada métrica no servidor, e "custo caiu 20%" e "vendas caiu 20%" não são
   * a mesma notícia.
   *
   * `null` quando a janela anterior falhou. A tela some com as setinhas e o
   * resto do painel continua de pé.
   */
  comparativo?: {
    /** A janela comparada, pra tela poder dizer contra o que está comparando. */
    de: string;
    ate: string;
    topo: Painel["topo"];
    /** id do degrau -> quantos chegaram nele. */
    funil: Record<string, number>;
  } | null;

  /** O funil inteiro, do clique à venda. É o mapa de onde fura. */
  funil: Array<{
    id: string;
    rotulo: string;
    alcancaram: number;
    // % de quem chegou aqui em relação ao passo ANTERIOR
    conversao: number;
    // quantos desistiram neste passo
    perdidos: number;
    quedaPct: number;
    etapa: "topo" | "quiz" | "entrega" | "venda";
  }>;

  /** Atribuição: de onde vêm os leads e as VENDAS. */
  porOrigem: Array<{
    origem: string;
    campanha: string | null;
    leads: number;
    letras: number;
    vendas: number;
    receitaBrl: number;
    conversaoPct: number;
  }>;

  /**
   * POR PÁGINA DE ENTRADA. Qual porta converte melhor.
   *
   * Agrupa pela primeira página da sessão (`is_landing`), não por qualquer
   * page_view: quem entra pela home e depois abre o quiz tem que contar UMA
   * vez, na home. Sem isso toda sessão apareceria em todas as páginas que
   * visitou e a comparação não significaria nada.
   */
  porEntrada: Array<{
    caminho: string;
    visitantes: number;
    quiz: number;
    letras: number;
    vendas: number;
    conversaoPct: number;
  }>;

  /** O que já foi lançado de gasto, pro painel listar e deixar editar. */
  gastos: Array<{ dia: string; origem: string; brl: number }>;

  producao: {
    porStatus: Record<string, number>;
    tempoMedioS: number | null;
    tempoP95S: number | null;
    falhas: number;
    travadas: number; // gerando há mais de 15 min
    /**
     * Crédito restante no kie.ai, e quantas músicas ainda cabem.
     *
     * Em 08/08 o saldo zerou e o pipeline parou por 13 HORAS em silêncio: 38
     * músicas presas em "gerando", 7 delas já pagas, a mais antiga esperando
     * 4h20. Nada falhou de forma visível — o job simplesmente não produzia, e
     * o painel mostrava "gerando" como se fosse normal.
     */
    creditoKie: number | null;
    musicasQueCabem: number | null;
  };

  custos: {
    porTipo: Array<{ tipo: string; brl: number; n: number }>;
    porDia: Array<{ dia: string; brl: number; receitaBrl: number; vendas: number }>;
  };

  /**
   * O ECOSSISTEMA DE E-MAIL. Conta PESSOA, não evento: o Resend dispara
   * `opened`/`clicked` a cada reabertura, e taxa por evento cru passa de 100%.
   *
   * Clique PODE ser maior que abertura, e não é bug: quem bloqueia imagem não
   * registra abertura (o pixel não carrega), mas o clique no link registra.
   */
  emails: {
    enviadosLetra: number;
    enviadosSequencia: number;
    entregues: number;
    abriram: number;
    clicaram: number;
    voltaram: number;
    porModelo: Array<{
      modelo: string;
      entregues: number;
      abriram: number;
      clicaram: number;
      voltaram: number;
    }>;
  };

  qualidade: {
    refacoes: number;
    aprimorou: number;
    usouAudio: number;
    karaokePlay: number;
    previewFim: number;
    presentesMontados: number;
  };

  /** Preferências: o que o público escolhe (ajuda a mirar anúncio). */
  preferencias: {
    porRelacao: Array<{ valor: string; n: number }>;
    porEstilo: Array<{ valor: string; n: number }>;
    porOcasiao: Array<{ valor: string; n: number }>;
  };

  vendas: Array<{
    quando: string;
    email: string | null;
    valorBrl: number;
    gateway: string | null;
    musica: string | null;
    origem: string | null;
    status: string;
  }>;

  recentes: Array<{
    nome: string | null;
    relacao: string | null;
    estilo: string | null;
    passo: number | null;
    passoRotulo: string;
    email: string | null;
    musica: string | null;
    status: string | null;
    origem: string | null;
    comprou: boolean;
    quando: string;
  }>;
};

const ROTULOS: Record<string, string> = {
  relacao: "Pra quem é",
  nome: "Nome",
  ocasiao: "Ocasião",
  prova1: "Prova social",
  estilo: "Estilo musical",
  voz: "Voz",
  historia1: "Sobre a pessoa",
  historia2: "Uma memória",
  recado: "Recado",
  contato: "E-mail",
  revisao: "Revisão",
  reveal: "Letra revelada",
};

const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);

// Os dois nomes de evento que significam "quis pagar" (`checkout_click` e
// `desbloquear_click`) são nomes diferentes porque o botão mudou de lugar no
// funil ao longo do tempo. A pessoa é a mesma, então a contagem é a UNIÃO das
// sessões, nunca a soma. Essa regra mudou de casa: hoje vive dentro de
// `admin_eventos_resumo`, onde os eventos são somados.

// O PostgREST devolve no MÁXIMO 1000 linhas por requisição, em silêncio: sem
// erro, sem aviso, e a fatia que volta nem é previsível. Uma consulta sem
// paginação, num painel, não fica "um pouco desatualizada" — ela MENTE.
//
// Foi exatamente o que aconteceu: com 2.526 eventos no recorte, o painel lia
// 1.000 e mostrava 204 visitantes onde havia 513. E o erro CRESCE com o
// tráfego, ou seja, quanto mais a operação escala, mais errado fica o número
// usado pra decidir.
//
// Toda leitura de série do painel passa por aqui.
type Lead = {
  id: string;
  session_id: string | null;
  respostas: Record<string, unknown> | null;
  furthest_step: number | null;
  email: string | null;
  attribution: Record<string, unknown> | null;
  created_at: string;
  locale: string | null;
};
type Musica = {
  id: string;
  quiz_response_id: string | null;
  titulo: string | null;
  status: string;
  created_at: string;
  gerada_em: string | null;
  personalizada_em: string | null;
};
type Custo = { id: string; tipo: string; custo_brl: number | null; quiz_response_id: string | null; created_at: string };
/**
 * O que `admin_eventos_resumo` devolve (migration 20260817000000).
 *
 * Substituiu a leitura crua de funnel_events. Cada campo aqui era um `filter`
 * sobre 180 mil linhas no Node; agora é um `group by` no Postgres.
 */
type EventosResumo = {
  visitantes: number;
  /** Sessões que abriram /criar (migration 20260817100000). Ver o degrau da
   *  abertura mais abaixo. Opcional de propósito: se o painel subir antes da
   *  migration, o campo vem `undefined` e o degrau cai pra "Começou o quiz"
   *  em vez de zerar. */
  sessoes_abertura?: number;
  sessoes_oferta: number;
  sessoes_checkout: number;
  contagens: Record<string, number>;
  por_entrada: Array<{
    caminho: string;
    visitantes: number;
    quiz: number;
    letras: number;
    vendas: number;
  }>;
};
type Pedido = {
  id: string;
  quiz_response_id: string | null;
  musica_id: string | null;
  gateway: string | null;
  status: string;
  valor_centavos: number | null;
  email: string | null;
  paid_at: string | null;
  created_at: string;
  /** Só em liberação manual: se entrou grana mesmo. null na venda do gateway. */
  dinheiro_entrou?: boolean | null;
};

const PAGINA = 1000;

// Quantas páginas buscar AO MESMO TEMPO.
//
// Isto era um laço sequencial, e o custo disso não era teórico: em 17/08 o
// painel puxava 180 mil eventos, ou seja, 180 idas ao banco UMA DEPOIS DA
// OUTRA. Cada ida tem latência, então o tempo de abrir o painel crescia em
// linha reta com o tráfego, até passar do limite de tempo da função na
// Vercel. Passando do limite, `carregarPainel` lançava, e a tela de admin
// tratava QUALQUER falha como "não autorizado" e voltava pro login: senha
// certa, tela de login de novo. Foi assim que o bug se apresentou.
//
// Em paralelo, 180 páginas viram 15 rodadas em vez de 180. O desperdício é no
// máximo LOTE-1 requisições vazias no fim do intervalo, que é troco.
//
// Não subir muito: cada requisição é uma conexão no PostgREST, e afogá-lo
// derruba o site inteiro pra consertar uma tela interna.
const LOTE = 12;

/**
 * Lê uma série inteira do banco, contornando o teto de 1000 linhas do
 * PostgREST (documentado logo acima).
 *
 * Não trunca em silêncio. A versão anterior parava em 200 mil linhas e
 * devolvia o que tinha, o que transformaria o painel na mentira que ele
 * existe pra não ser. Aqui o limite LANÇA: número errado é pior que erro
 * visível, porque só o erro faz alguém consertar.
 */
async function paginado<T extends { id: string }>(
  monta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const TETO = 500_000;
  const tudo: T[] = [];
  // DEDUPLICAÇÃO POR id, e ela não é zelo excessivo.
  //
  // Paginar por `range` numa tabela que RECEBE ESCRITA o tempo todo (e
  // funnel_events recebe ~2 mil por hora) tem um furo conhecido: uma linha
  // gravada durante a leitura empurra as seguintes, e uma linha que estava no
  // fim da página N reaparece no começo da N+1. Medido: 5 repetidas em 145 mil
  // numa leitura de 15 segundos.
  //
  // A maior parte do painel conta SESSÕES em Set, onde repetir é inofensivo.
  // Mas `conta(nome)` conta eventos crus, e ali a repetida vira número inflado.
  // Um Set de ids custa nada e fecha o furo, que aliás já existia na versão
  // sequencial, só que menos visível por ser mais lenta.
  const vistos = new Set<string>();
  for (let base = 0; ; base += PAGINA * LOTE) {
    const partidas = Array.from({ length: LOTE }, (_, i) => base + i * PAGINA);
    const lotes = await Promise.all(partidas.map((de) => monta(de, de + PAGINA - 1)));

    let acabou = false;
    for (const { data, error } of lotes) {
      if (error) throw new Error(error.message);
      const lote = data ?? [];
      for (const linha of lote) {
        if (vistos.has(linha.id)) continue;
        vistos.add(linha.id);
        tudo.push(linha);
      }
      // Página incompleta = fim da série. As seguintes já vieram vazias.
      if (lote.length < PAGINA) acabou = true;
    }
    if (acabou) return tudo;
    if (tudo.length >= TETO) {
      throw new Error(
        `recorte grande demais: mais de ${TETO} linhas. Diminua o período do painel.`,
      );
    }
  }
}

type ArgsPainel = { dias?: number; de?: string; ate?: string; funil?: FunilFiltro };
type Janela = { inicio: Date; fim: Date; dias: number };

/**
 * O recorte pedido, em instantes.
 *
 * Saiu de dentro do handler porque o COMPARATIVO precisa deslocar a mesma
 * janela sem repetir a regra do fuso — e regra de fuso duplicada é regra que
 * diverge.
 */
function janelaDo(data: ArgsPainel): Janela {
  // O Brasil é UTC-3: um dia "31/07" local vai de 03:00Z de 31/07 até
  // 03:00Z de 01/08. Sem esse deslocamento, o filtro de um dia pegaria as
  // horas erradas e o número não bateria com o que se vê no gateway.
  const OFFSET_BR = 3 * 3600000;
  const inicioDoDiaBr = (yyyymmdd: string) =>
    new Date(new Date(`${yyyymmdd}T00:00:00.000Z`).getTime() + OFFSET_BR);

  if (data.de) {
    const inicio = inicioDoDiaBr(data.de);
    // `ate` é inclusivo: somamos 1 dia pra pegar o dia inteiro.
    const fim = data.ate ? new Date(inicioDoDiaBr(data.ate).getTime() + 86400000) : new Date();
    return { inicio, fim, dias: Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000)) };
  }
  const dias = data.dias && data.dias > 0 ? data.dias : 30;
  return { inicio: new Date(Date.now() - dias * 86400000), fim: new Date(), dias };
}

/**
 * A MESMA JANELA, UM PERÍODO ATRÁS — e cortada na mesma hora do dia.
 *
 * O deslocamento é de DIAS INTEIROS (`dias * 24h`), nunca da duração medida.
 * É o que preserva a hora: "hoje das 00:00 às 14:32" tem que ser comparado com
 * "ontem das 00:00 às 14:32", e não com as 14h32m que antecedem a meia-noite.
 *
 * O CORTE EM `agora` é o que faz a comparação ser honesta. "Hoje" é pedido ao
 * banco como o dia inteiro (o `fim` é amanhã 00:00, no futuro) — dá no mesmo
 * pra contar, porque não existe linha no futuro. Mas se esse `fim` nominal
 * fosse deslocado, o dia de hoje pela metade apareceria comparado com o dia de
 * ontem INTEIRO, e o painel mostraria queda toda manhã, todo dia, por
 * construção. É o erro clássico deste tipo de cartão.
 *
 * Sempre devolve uma janela, inclusive anterior à existência do site: ali ela
 * dá zero, e zero vira "sem base" na tela em vez de uma alta de 100%.
 */
function janelaAnterior(j: Janela): Janela {
  const fimReal = Math.min(j.fim.getTime(), Date.now());
  const deslocamento = j.dias * 86400000;
  return {
    inicio: new Date(j.inicio.getTime() - deslocamento),
    fim: new Date(fimReal - deslocamento),
    dias: j.dias,
  };
}

/**
 * O painel de UMA janela. É chamado DUAS vezes por carregamento: a janela
 * pedida e a anterior, em paralelo.
 *
 * `enxuto` corta o que não entra em comparação nenhuma e custa caro: o saldo
 * do kie.ai (uma chamada HTTP externa, com timeout de 5s) e o resumo de
 * e-mail. Sem isso, ligar o comparativo dobraria as duas coisas à toa.
 */
async function montarPainel(
  data: ArgsPainel,
  { inicio, fim, dias }: Janela,
  opts: { enxuto?: boolean } = {},
): Promise<Painel> {
    const db = supabaseAdmin();
    const desde = inicio.toISOString();
    const ateISO = fim.toISOString();

    // A ordenação por `id` não é enfeite: sem ORDER BY estável, duas páginas
    // do mesmo range podem repetir e pular linhas. A ordem de exibição é
    // reconstruída em JS depois.
    const janela = <T extends { id: string }>(tabela: string, colunas: string) =>
      paginado<T>((de, ate) =>
        db
          .from(tabela)
          .select(colunas)
          .gte("created_at", desde)
          .lt("created_at", ateISO)
          .order("id")
          .range(de, ate) as never,
      );

    // FUNNEL_EVENTS NÃO ENTRA AQUI, e essa ausência é o conserto.
    //
    // Até 17/08 esta lista tinha uma sexta entrada puxando funnel_events
    // inteiro: 180 mil linhas numa janela de 30 dias, contra 24 mil das
    // outras quatro somadas. Vinham pro Node só pra virar meia dúzia de
    // contadores, e o tempo disso crescia junto com o tráfego até estourar o
    // limite da função na Vercel.
    //
    // Agora essa conta é feita no banco, por `admin_eventos_resumo`, e volta
    // como ~30 linhas de resumo. Chamada mais abaixo, porque ela precisa
    // saber quais sessões compraram, e isso sai de `pedidos`.
    const [leadsCru, musicas, custos, pedidos] = await Promise.all([
      janela<Lead>("quiz_responses", "id, session_id, respostas, furthest_step, email, attribution, locale, created_at"),
      janela<Musica>("musicas", "id, quiz_response_id, titulo, status, created_at, gerada_em, personalizada_em"),
      janela<Custo>("custos", "id, tipo, custo_brl, quiz_response_id, created_at"),
      janela<Pedido>(
        "pedidos",
        "id, quiz_response_id, musica_id, gateway, status, valor_centavos, email, paid_at, created_at, dinheiro_entrou",
      ),
    ]);


    // ── SEPARAÇÃO DOS DOIS FUNIS ──────────────────────────────────
    //
    // Sem isto o painel soma R$ com US$ e produz um faturamento que não
    // existe em lugar nenhum.
    //
    // De onde sai o idioma de cada linha, em ordem de confiança:
    //
    //   1. `quiz_responses.locale` — gravado no passo 1 do quiz. É a
    //      verdade pra lead, música, custo e pedido (todos referenciam o
    //      quiz_response).
    //   2. O CAMINHO do page_view, pra quem visitou e nunca começou o quiz.
    //      Essa gente não tem linha em quiz_responses, e é justamente o topo
    //      do funil — sem isto, "visitantes" seria sempre o total dos dois.
    //
    // Sessão sem nenhum dos dois (evento antigo, sem path gravado) cai em
    // "pt": todo o histórico é brasileiro, então errar pro lado do português
    // é errar pro lado certo.
    const filtro: FunilFiltro = data.funil ?? "todos";

    const localeDoQuiz = new Map<string, string>();
    for (const l of leadsCru) localeDoQuiz.set(l.id, l.locale === "es" ? "es" : "pt");

    // A regra 2 (idioma pelo caminho do page_view) agora vive dentro de
    // `admin_eventos_resumo`, junto dos eventos que ela filtra. O mapa que
    // existia aqui só servia pra isso.
    const bate = (locale: string | undefined) =>
      filtro === "todos" || (locale ?? "pt") === filtro;
    const quizBate = (qid: string | null) => bate(qid ? localeDoQuiz.get(qid) : undefined);

    // Mais recente primeiro, como a listagem do painel espera.
    const leads = leadsCru
      .filter((l) => bate(l.locale === "es" ? "es" : "pt"))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const musicasF = musicas.filter((m) => quizBate(m.quiz_response_id));
    const custosF = custos.filter((c) => quizBate(c.quiz_response_id));
    const pedidosF = pedidos.filter((p) => quizBate(p.quiz_response_id));

    // GASTO DE MÍDIA do período, digitado no painel. O recorte é por DIA
    // (a tabela guarda data, não timestamp), então usa o intervalo em datas.
    const { data: gastosCru } = await db
      .from("gastos_ads")
      .select("dia, origem, valor_brl")
      .gte("dia", desde.slice(0, 10))
      .lte("dia", ateISO.slice(0, 10))
      .order("dia", { ascending: false });
    const gastos = (gastosCru ?? []).map((g) => ({
      dia: String(g.dia),
      origem: String(g.origem),
      brl: Number(g.valor_brl ?? 0),
    }));
    // O gasto NÃO é filtrado por funil: o painel do Google não separa por
    // idioma, e inventar um rateio daria um CPA que parece preciso e não é.
    // Com o filtro em BR ou MX o número fica igual, e isso é honesto.
    const gastoAds = gastos.reduce((s, g) => s + g.brl, 0);

    // Liberação manual sem dinheiro (cortesia, acesso interno, teste) NÃO é
    // venda. O pedido precisa ficar `pago` pra música chegar no cliente, mas
    // contar isso como faturamento infla o painel: em 12/08 foram R$ 111 de
    // receita que nunca entraram em conta nenhuma. `dinheiro_entrou` é null
    // na venda normal do gateway, e só é `false` quando alguém disse que foi
    // cortesia — por isso a comparação é explícita contra `false`.
    const pagos = pedidosF.filter(
      (p) => p.status === "pago" && p.dinheiro_entrou !== false,
    );
    // Cobrança gerada e não paga: o Pix que a pessoa mandou criar e abandonou.
    // Passou a existir em 10/08, quando o webhook parou de descartar o aviso de
    // "aguardando pagamento" — antes disso esta lista é vazia por falta de
    // registro, não por não ter acontecido.
    const pendentes = pedidosF.filter((p) => p.status === "pendente");
    const gerouCobranca = pagos.length + pendentes.length;

    // A MOEDA de cada pedido vem do idioma da venda: o produto brasileiro da
    // Perfect Pay cobra em real, o internacional em dólar. Não há coluna de
    // moeda em `pedidos`, e não precisa haver — o vínculo já existe.
    const valorDe = (p: Pedido) => (p.valor_centavos ?? 0) / 100;
    const ehEs = (p: Pedido) => localeDoQuiz.get(p.quiz_response_id ?? "") === "es";
    /** O valor em real, convertendo dólar ao câmbio dos custos. */
    const valorEmBrl = (p: Pedido) => valorDe(p) * (ehEs(p) ? PRECOS.cambioUsdBrl : 1);
    const receitaBrl = pagos.filter((p) => !ehEs(p)).reduce((s, p) => s + valorDe(p), 0);
    const receitaUsd = pagos.filter(ehEs).reduce((s, p) => s + valorDe(p), 0);
    // Só pra margem, e com o câmbio na tela: os nossos custos são todos em
    // real (Claude e kie.ai cobram em dólar mas já entram convertidos).
    const receita = receitaBrl + receitaUsd * PRECOS.cambioUsdBrl;
    const custoTotal = custosF.reduce((s, c) => s + Number(c.custo_brl ?? 0), 0);

    // "Começou o quiz" vem da LINHA em quiz_responses, não do evento
    // `quiz_started`. Medido: 76 sessões tinham linha e só 52 tinham evento —
    // 27 pessoas somem quando se confia no evento.
    //
    // A razão é estrutural: o evento é best-effort (bloqueador de anúncio,
    // aba fechada antes do envio, rede caindo), enquanto a linha é escrita
    // pela RPC no mesmo caminho que já grava as respostas. Num funil, a fonte
    // tem que ser a mais confiável das duas, senão o primeiro degrau inventa
    // uma desistência que não existiu.
    const quizIniciados = new Set(leads.map((l) => l.session_id ?? l.id)).size;
    const comEmail = leads.filter((l) => l.email).length;

    // ── OS EVENTOS, SOMADOS NO BANCO ─────────────────────────────
    //
    // Uma chamada, ~30 linhas de volta, no lugar das 180 mil que vinham antes.
    // As sessões que compraram vão JUNTO no pedido, porque a regra de o que
    // conta como venda (cortesia não conta) mora aqui em cima e duplicá-la no
    // SQL criaria uma segunda verdade sobre faturamento.
    const sessoesVenda = [
      ...new Set(
        pagos
          .map((p) => leads.find((l) => l.id === p.quiz_response_id)?.session_id)
          .filter((s): s is string => Boolean(s)),
      ),
    ];

    const { data: resumoCru, error: erroResumo } = await db.rpc("admin_eventos_resumo", {
      p_desde: desde,
      p_ate: ateISO,
      p_filtro: filtro,
      p_sessoes_venda: sessoesVenda,
    });
    // Falhar alto. Resumo vazio aqui pintaria um painel de zeros com cara de
    // "não vendeu nada hoje", que é pior que erro na tela.
    if (erroResumo) throw new Error(`resumo de eventos: ${erroResumo.message}`);
    const resumo = (resumoCru ?? {}) as EventosResumo;

    // O e-mail é agregado à parte porque não compartilha nada com o funil: ele
    // é por DESTINATÁRIO, não por sessão, e mistura eventos que vêm do Resend
    // com os nossos. Falha aqui NÃO derruba o painel: não saber a taxa de
    // abertura é ruim, não ver o faturamento é pior.
    let emails: Painel["emails"] = {
      enviadosLetra: 0, enviadosSequencia: 0, entregues: 0,
      abriram: 0, clicaram: 0, voltaram: 0, porModelo: [],
    };
    // `enxuto`: o comparativo não mostra e-mail, então nem pede.
    if (!opts.enxuto) {
      try {
        const { data: e, error } = await db.rpc("admin_emails_resumo", {
          p_desde: desde,
          p_ate: ateISO,
        });
        if (error) throw new Error(error.message);
        if (e) emails = e as Painel["emails"];
      } catch (err) {
        console.error("[admin] resumo de e-mail não lido:", err);
      }
    }

    // Visitante único: sessões distintas com page_view. É o denominador honesto
    // do funil (o total de page_view contaria a mesma pessoa várias vezes).
    const visitantes = resumo.visitantes ?? 0;
    const conta = (nome: string) => resumo.contagens?.[nome] ?? 0;

    // QUEM ABRIU O QUIZ, que desde 17/08 não é mais quem começou a responder.
    //
    // A tela de ABERTURA entrou antes da primeira pergunta. Quem cai do
    // anúncio em /criar vê ela primeiro e só vira linha em `quiz_responses`
    // quando clica no botão — de propósito, pra não mexer na numeração de
    // `furthest_step` (ver o comentário no `Quiz.tsx`). O efeito colateral é
    // no PAINEL: sem este degrau, quem desiste na abertura some dentro de
    // "Visitou o site → Começou o quiz" e vira queda do site, não da tela.
    //
    // O `Math.max` é o piso, e cobre o buraco que a união do SQL não alcança:
    // lead SEM session_id entra em `quizIniciados` pelo `?? l.id`, mas não
    // existe pro resumo, que só enxerga sessão. Os dois números são pisos do
    // mesmo conjunto, então o maior é o mais próximo da verdade — e garante
    // que o degrau nunca fique abaixo do de baixo.
    const abriramQuiz = Math.max(resumo.sessoes_abertura ?? 0, quizIniciados);

    // PESSOAS que clicaram em comprar, não CLIQUES.
    //
    // Antes isto era `conta("checkout_click") + conta("desbloquear_click")`, e
    // dava dois erros ao mesmo tempo:
    //   1. Somava evento bruto: quem clicou 41 vezes (aconteceu) virava 41.
    //   2. Somava os dois nomes: a mesma pessoa que clica em desbloquear e
    //      depois em comprar era contada duas vezes.
    // Resultado medido: 86 no painel para 13 pessoas reais — um degrau MAIOR
    // que o de visitantes, num funil onde ele só pode encolher.
    //
    // Todo passo do funil conta gente distinta; este passou a contar também.
    // (Este degrau NÃO é separado por idioma, e nunca foi. Ver o comentário na
    //  migration: manter idêntico foi decisão, não descuido.)
    const cliquesCheckout = resumo.sessoes_checkout ?? 0;

    // Quem chegou na TELA DE OFERTA (existe desde 02/08). Antes dela, o
    // clique em comprar levava direto pro gateway; por isso o degrau fica
    // vazio em qualquer recorte anterior, e não é bug.
    const sessoesOferta = resumo.sessoes_oferta ?? 0;

    // Músicas que realmente vieram do funil. As de EXEMPLO (as da landing, as
    // dos testes) nascem de um quiz_response criado por script, com
    // furthest_step 0 — ninguém respondeu nada. Contá-las fazia "Recebeu a
    // letra" ficar MAIOR que o passo anterior, e um funil que sobe não é
    // funil.
    //
    // A regra exclui só o que é comprovadamente interno: lead conhecido E
    // furthest_step 0. Música cujo lead está fora da janela (a pessoa
    // respondeu ontem, a letra saiu hoje) continua contando.
    const passoDoLead = new Map(leads.map((l) => [l.id, l.furthest_step ?? 0]));
    const doFunil = musicasF.filter((m) => {
      const passo = m.quiz_response_id ? passoDoLead.get(m.quiz_response_id) : undefined;
      return passo === undefined || passo > 0;
    });

    // ── FUNIL COMPLETO: do clique à venda ────────────────────────
    const passosQuiz = QUIZ_FLOW.filter((s) => isQuestion(s) || s.kind === "contact");
    const bruto: Array<{ id: string; rotulo: string; alcancaram: number; etapa: Painel["funil"][0]["etapa"] }> = [
      { id: "visita", rotulo: "Visitou o site", alcancaram: visitantes, etapa: "topo" },
      // Abriu ≠ começou desde 17/08: entre os dois está a tela de abertura.
      // Em recorte anterior a ela os dois degraus dão igual, e isso é o certo
      // — a tela não existia, ninguém podia desistir nela.
      { id: "abertura", rotulo: "Abriu o quiz", alcancaram: abriramQuiz, etapa: "topo" },
      { id: "quiz_started", rotulo: "Começou o quiz", alcancaram: quizIniciados, etapa: "topo" },
      ...passosQuiz.map((s, i) => ({
        id: s.id,
        rotulo: ROTULOS[s.id] ?? s.id,
        alcancaram: leads.filter((l) => (l.furthest_step ?? 0) >= i + 1).length,
        etapa: "quiz" as const,
      })),
      { id: "letra", rotulo: "Recebeu a letra", alcancaram: doFunil.length, etapa: "entrega" },
      {
        id: "musica",
        rotulo: "Música ficou pronta",
        alcancaram: doFunil.filter((m) => m.status === "pronta").length,
        etapa: "entrega",
      },
      // Dois degraus onde antes havia um. "Viu a oferta" x "foi pro
      // checkout" separa quem desiste ao ver o preço de quem desiste no
      // formulário de cartão da Perfect Pay — problemas diferentes, e a
      // solução de um não serve pro outro.
      { id: "oferta", rotulo: "Viu a oferta", alcancaram: sessoesOferta, etapa: "venda" },
      { id: "checkout", rotulo: "Foi pro checkout", alcancaram: cliquesCheckout, etapa: "venda" },
      // O degrau que faltava, e que mudava o diagnóstico inteiro. "6 cliques e
      // 1 venda" parece atrito no formulário; "6 cliques, 3 cobranças geradas
      // e 1 paga" é abandono de Pix — a pessoa decidiu comprar, gerou o QR e
      // não terminou. São problemas diferentes com soluções diferentes, e a
      // gente ficou cego pra este até 10/08 porque o webhook descartava o
      // aviso de "aguardando pagamento".
      //
      // `gerouCobranca` conta pendentes MAIS pagos: quem pagou também gerou.
      // Sem somar, o degrau ficaria menor que o de baixo e o funil pareceria
      // crescer no fim.
      { id: "cobranca", rotulo: "Gerou cobrança", alcancaram: gerouCobranca, etapa: "venda" },
      { id: "venda", rotulo: "PAGOU", alcancaram: pagos.length, etapa: "venda" },
    ];

    const funil = bruto.map((p, i) => {
      const ant = i > 0 ? bruto[i - 1].alcancaram : p.alcancaram;
      const perdidos = Math.max(0, ant - p.alcancaram);
      return {
        ...p,
        conversao: i === 0 ? 100 : pct(p.alcancaram, ant),
        perdidos,
        quedaPct: i === 0 ? 0 : pct(perdidos, ant),
      };
    });

    // ── ATRIBUIÇÃO: de onde vem lead e venda ─────────────────────
    const chaveOrigem = (attr: unknown): { origem: string; campanha: string | null } => {
      const a = (attr ?? {}) as Record<string, string | undefined>;
      if (a.utm_source) return { origem: a.utm_source, campanha: a.utm_campaign ?? null };
      if (a.gclid) return { origem: "google (gclid)", campanha: a.utm_campaign ?? null };
      if (a.fbclid) return { origem: "meta (fbclid)", campanha: null };
      if (a.referrer && !String(a.referrer).includes("serenatagift")) {
        try {
          return { origem: new URL(String(a.referrer)).hostname, campanha: null };
        } catch {
          return { origem: "referência", campanha: null };
        }
      }
      return { origem: "direto / orgânico", campanha: null };
    };

    const origemMap = new Map<
      string,
      { origem: string; campanha: string | null; leads: number; letras: number; vendas: number; receitaBrl: number }
    >();
    for (const l of leads) {
      const { origem, campanha } = chaveOrigem(l.attribution);
      const k = `${origem}|${campanha ?? ""}`;
      const v = origemMap.get(k) ?? { origem, campanha, leads: 0, letras: 0, vendas: 0, receitaBrl: 0 };
      v.leads++;
      if (musicas.some((m) => m.quiz_response_id === l.id)) v.letras++;
      origemMap.set(k, v);
    }
    const porQuiz = new Map(leads.map((l) => [l.id, l]));
    for (const p of pagos) {
      const l = p.quiz_response_id ? porQuiz.get(p.quiz_response_id) : null;
      const { origem, campanha } = chaveOrigem(l?.attribution);
      const k = `${origem}|${campanha ?? ""}`;
      const v = origemMap.get(k) ?? { origem, campanha, leads: 0, letras: 0, vendas: 0, receitaBrl: 0 };
      v.vendas++;
      // CONVERTIDO, ao contrário do cartão de receita: aqui o número serve
      // pra COMPARAR campanhas entre si, e comparar exige unidade única. Uma
      // venda em dólar contada como real faria a campanha mexicana parecer
      // 5x pior do que é.
      v.receitaBrl += valorEmBrl(p);
      origemMap.set(k, v);
    }
    // ── POR PÁGINA DE ENTRADA ────────────────────────────────────
    // Agrupado no banco (a sessão conta UMA vez, na primeira página que ela
    // abriu). A taxa fica aqui porque é divisão, não agregação.
    const porEntrada = (resumo.por_entrada ?? [])
      .map((e) => ({ ...e, conversaoPct: pct(e.vendas, e.visitantes) }))
      .sort((a, b) => b.visitantes - a.visitantes);

    const porOrigem = [...origemMap.values()]
      .map((v) => ({ ...v, conversaoPct: pct(v.vendas, v.leads) }))
      .sort((a, b) => b.receitaBrl - a.receitaBrl || b.leads - a.leads);

    // ── PRODUÇÃO ─────────────────────────────────────────────────
    const porStatus: Record<string, number> = {};
    const tempos: number[] = [];
    const agora = Date.now();
    // O SALDO DO PROVEDOR. Falha aqui não derruba o painel: provedor fora do
    // ar não pode impedir de ver o resto da operação.
    let creditoKie: number | null = null;
    // `enxuto`: saldo é estado de AGORA, não do período — comparar não faz
    // sentido, e são 5s de timeout numa chamada externa.
    if (!opts.enxuto) {
      try {
        const rs = await fetch("https://api.kie.ai/api/v1/chat/credit", {
          headers: { Authorization: `Bearer ${process.env.KIE_API_KEY ?? ""}` },
          signal: AbortSignal.timeout(5000),
        });
        const j = await rs.json();
        if (typeof j?.data === "number") creditoKie = j.data;
      } catch (err) {
        console.error("[admin] saldo kie.ai não lido:", err);
      }
    }

    let travadas = 0;
    for (const m of musicasF) {
      porStatus[m.status] = (porStatus[m.status] ?? 0) + 1;
      if (m.gerada_em && m.created_at) {
        const s = (new Date(m.gerada_em).getTime() - new Date(m.created_at).getTime()) / 1000;
        if (s > 0 && s < 3600) tempos.push(s);
      }
      // "gerando" há muito tempo = provavelmente travou e ninguém viu.
      if (m.status === "gerando" && agora - new Date(m.created_at).getTime() > 15 * 60000) travadas++;
    }
    tempos.sort((a, b) => a - b);
    const p95 = tempos.length ? tempos[Math.min(tempos.length - 1, Math.floor(tempos.length * 0.95))] : null;
    const medio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;

    // ── CUSTOS x RECEITA por dia ─────────────────────────────────
    const porTipoMap = new Map<string, { brl: number; n: number }>();
    const porDiaMap = new Map<string, { brl: number; receitaBrl: number; vendas: number }>();
    for (const c of custosF) {
      const brl = Number(c.custo_brl ?? 0);
      const t = porTipoMap.get(c.tipo) ?? { brl: 0, n: 0 };
      porTipoMap.set(c.tipo, { brl: t.brl + brl, n: t.n + 1 });
      const dia = String(c.created_at).slice(0, 10);
      const d = porDiaMap.get(dia) ?? { brl: 0, receitaBrl: 0, vendas: 0 };
      d.brl += brl;
      porDiaMap.set(dia, d);
    }
    for (const p of pagos) {
      const dia = String(p.paid_at ?? p.created_at).slice(0, 10);
      const d = porDiaMap.get(dia) ?? { brl: 0, receitaBrl: 0, vendas: 0 };
      // Convertido: esta linha é comparada com o CUSTO do dia (que é sempre
      // em real) pra pintar a margem de vermelho ou verde.
      d.receitaBrl += valorEmBrl(p);
      d.vendas++;
      porDiaMap.set(dia, d);
    }

    // ── PREFERÊNCIAS (o que o público escolhe) ───────────────────
    const contarCampo = (campo: string) => {
      const m = new Map<string, number>();
      for (const l of leads) {
        const v = ((l.respostas ?? {}) as Record<string, string>)[campo];
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
      return [...m.entries()].map(([valor, n]) => ({ valor, n })).sort((a, b) => b.n - a.n);
    };

    const musicaPorId = new Map(musicasF.map((m) => [m.id, m]));
    const quizComprou = new Set(pagos.map((p) => p.quiz_response_id).filter(Boolean));

    return {
      filtro,
      periodoDias: dias,
      de: inicio.toISOString(),
      ate: fim.toISOString(),
      geradoEm: new Date().toISOString(),

      topo: {
        visitantes,
        quizIniciados,
        leads: comEmail,
        // Mesma base do funil: sem as letras de exemplo/teste.
        letrasGeradas: doFunil.length,
        cliquesCheckout,
        vendas: pagos.length,
        receitaBrl,
        receitaUsd,
        receitaConvertidaBrl: receita,
        ticketMedioBrl: pagos.length ? receita / pagos.length : 0,
        custoTotalBrl: custoTotal,
        margemBrl: receita - custoTotal,
        taxaVisitaQuiz: pct(quizIniciados, visitantes),
        taxaQuizLetra: pct(doFunil.length, quizIniciados),
        taxaLetraCheckout: pct(cliquesCheckout, doFunil.length),
        taxaCheckoutVenda: pct(pagos.length, cliquesCheckout),
        taxaGeral: pct(pagos.length, visitantes),
        custoPorVendaBrl: pagos.length ? custoTotal / pagos.length : 0,
        gastoAdsBrl: gastoAds,
        cpaBrl: pagos.length ? gastoAds / pagos.length : 0,
        roas: gastoAds > 0 ? receita / gastoAds : 0,
        lucroBrl: receita - custoTotal - gastoAds,
      },

      funil,
      porOrigem,
      porEntrada,
      gastos,

      producao: {
        creditoKie,
        musicasQueCabem: creditoKie === null ? null : Math.floor(creditoKie / CREDITO_POR_MUSICA),
        porStatus,
        tempoMedioS: medio,
        tempoP95S: p95,
        falhas: porStatus["falhou"] ?? 0,
        travadas,
      },

      custos: {
        porTipo: [...porTipoMap.entries()]
          .map(([tipo, v]) => ({ tipo, brl: v.brl, n: v.n }))
          .sort((a, b) => b.brl - a.brl),
        porDia: [...porDiaMap.entries()]
          .map(([dia, v]) => ({ dia, ...v }))
          .sort((a, b) => a.dia.localeCompare(b.dia)),
      },

      emails,

      qualidade: {
        refacoes: conta("letra_refacao"),
        aprimorou: conta("letra_aprimorada"),
        usouAudio: conta("audio_usado"),
        karaokePlay: conta("karaoke_play") + conta("musica_play"),
        previewFim: conta("preview_limite"),
        presentesMontados: musicasF.filter((m) => m.personalizada_em).length,
      },

      preferencias: {
        porRelacao: contarCampo("relacao"),
        porEstilo: contarCampo("estilo"),
        porOcasiao: contarCampo("ocasiao"),
      },

      vendas: pagos
        .sort((a, b) => String(b.paid_at ?? b.created_at).localeCompare(String(a.paid_at ?? a.created_at)))
        .slice(0, 30)
        .map((p) => {
          const l = p.quiz_response_id ? porQuiz.get(p.quiz_response_id) : null;
          return {
            quando: String(p.paid_at ?? p.created_at),
            email: p.email,
            valorBrl: (p.valor_centavos ?? 0) / 100,
            gateway: p.gateway,
            musica: p.musica_id ? (musicaPorId.get(p.musica_id)?.titulo ?? null) : null,
            origem: l ? chaveOrigem(l.attribution).origem : null,
            status: p.status,
          };
        }),

      recentes: leads.slice(0, 40).map((l) => {
        const r = (l.respostas ?? {}) as Record<string, string>;
        const m = musicas.find((x) => x.quiz_response_id === l.id);
        const idx = (l.furthest_step ?? 0) - 1;
        const passoStep = idx >= 0 && idx < passosQuiz.length ? passosQuiz[idx] : null;
        return {
          nome: r.nome ?? null,
          relacao: r.relacao ?? null,
          estilo: r.estilo ?? null,
          passo: l.furthest_step,
          passoRotulo: passoStep ? (ROTULOS[passoStep.id] ?? passoStep.id) : l.furthest_step ? "Concluiu" : "Só abriu",
          email: l.email,
          musica: m?.titulo ?? null,
          status: m?.status ?? null,
          origem: chaveOrigem(l.attribution).origem,
          comprou: quizComprou.has(l.id),
          quando: l.created_at,
        };
      }),
    };
  }

/**
 * O PAINEL, COM O PERÍODO ANTERIOR JUNTO.
 *
 * As duas janelas rodam em PARALELO de propósito. O trabalho de banco dobra —
 * não tem como comparar sem ler o período comparado —, mas o tempo de parede
 * fica no mais lento dos dois, não na soma. O painel já morreu uma vez por
 * lentidão (`admin_eventos_resumo`, 17/08); dobrar em série seria pedir de
 * novo.
 *
 * A janela anterior NÃO derruba o painel: se ela falhar, `comparativo` vem
 * `null` e a tela some com as setinhas. Número de ontem é bom de ter; número
 * de hoje é o que não pode faltar.
 */
export const carregarPainel = createServerFn({ method: "POST" })
  // `de`/`ate` em "YYYY-MM-DD" (hora local BR) têm prioridade sobre `dias`.
  // Com eles dá pra olhar UM dia específico ou qualquer intervalo.
  .validator((data: ArgsPainel) => data)
  .handler(async ({ data }): Promise<Painel> => {
    // Import dinâmico: mantém node:crypto fora do bundle do cliente.
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();

    const janela = janelaDo(data);
    const antes = janelaAnterior(janela);

    const [painel, anterior] = await Promise.all([
      montarPainel(data, janela),
      montarPainel(data, antes, { enxuto: true }).catch((err) => {
        console.error("[admin] periodo anterior nao lido:", err);
        return null;
      }),
    ]);

    return {
      ...painel,
      comparativo: anterior
        ? {
            de: antes.inicio.toISOString(),
            ate: antes.fim.toISOString(),
            topo: anterior.topo,
            // Só o alcance de cada degrau. As taxas do funil se recalculam
            // sozinhas a partir daí, e guardar as duas coisas abriria espaço
            // pra elas discordarem.
            funil: Object.fromEntries(anterior.funil.map((f) => [f.id, f.alcancaram])),
          }
        : null,
    };
  });

/**
 * Lança (ou corrige) o gasto de mídia de um dia.
 *
 * Sobrescreve por (dia, origem) de propósito: o Google ajusta o gasto
 * retroativamente, e o número certo é sempre o último. Valor 0 apaga a linha,
 * que é como se desfaz um lançamento errado sem precisar de outra tela.
 */
export const lancarGasto = createServerFn({ method: "POST" })
  .validator((data: { dia: string; origem: string; brl: number }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const db = supabaseAdmin();

    const dia = String(data.dia).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false };
    const origem = String(data.origem).trim().toLowerCase() || "google";
    const brl = Number(data.brl);
    if (!Number.isFinite(brl) || brl < 0) return { ok: false };

    if (brl === 0) {
      await db.from("gastos_ads").delete().eq("dia", dia).eq("origem", origem);
      return { ok: true };
    }

    const { error } = await db
      .from("gastos_ads")
      .upsert({ dia, origem, valor_brl: brl, updated_at: new Date().toISOString() }, { onConflict: "dia,origem" });
    if (error) {
      console.error("[admin] lancarGasto falhou:", error);
      return { ok: false };
    }
    return { ok: true };
  });
