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

// Os dois nomes de evento que significam "quis pagar". São nomes diferentes
// porque o botão mudou de lugar no funil ao longo do tempo; a pessoa é a
// mesma, então a contagem é a UNIÃO das sessões, nunca a soma.
const CLIQUE_COMPRA = new Set(["checkout_click", "desbloquear_click"]);

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
type Evento = {
  id: string;
  event_name: string;
  session_id: string | null;
  event_data: Record<string, unknown> | null;
  created_at: string;
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
};

const PAGINA = 1000;
async function paginado<T>(
  monta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await monta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = data ?? [];
    tudo.push(...lote);
    if (lote.length < PAGINA) return tudo;
    // Trava de segurança: um recorte absurdo não pode derrubar o painel.
    if (tudo.length >= 200_000) return tudo;
  }
}

export const carregarPainel = createServerFn({ method: "POST" })
  // `de`/`ate` em "YYYY-MM-DD" (hora local BR) têm prioridade sobre `dias`.
  // Com eles dá pra olhar UM dia específico ou qualquer intervalo.
  .validator((data: { dias?: number; de?: string; ate?: string; funil?: FunilFiltro }) => data)
  .handler(async ({ data }): Promise<Painel> => {
    // Import dinâmico: mantém node:crypto fora do bundle do cliente.
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const db = supabaseAdmin();

    // O Brasil é UTC-3: um dia "31/07" local vai de 03:00Z de 31/07 até
    // 03:00Z de 01/08. Sem esse deslocamento, o filtro de um dia pegaria as
    // horas erradas e o número não bateria com o que se vê no gateway.
    const OFFSET_BR = 3 * 3600000;
    const inicioDoDiaBr = (yyyymmdd: string) =>
      new Date(new Date(`${yyyymmdd}T00:00:00.000Z`).getTime() + OFFSET_BR);

    let inicio: Date;
    let fim: Date;
    let dias: number;

    if (data.de) {
      inicio = inicioDoDiaBr(data.de);
      // `ate` é inclusivo: somamos 1 dia pra pegar o dia inteiro.
      fim = data.ate ? new Date(inicioDoDiaBr(data.ate).getTime() + 86400000) : new Date();
      dias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
    } else {
      dias = data.dias && data.dias > 0 ? data.dias : 30;
      inicio = new Date(Date.now() - dias * 86400000);
      fim = new Date();
    }

    const desde = inicio.toISOString();
    const ateISO = fim.toISOString();

    // A ordenação por `id` não é enfeite: sem ORDER BY estável, duas páginas
    // do mesmo range podem repetir e pular linhas. A ordem de exibição é
    // reconstruída em JS depois.
    const janela = <T>(tabela: string, colunas: string) =>
      paginado<T>((de, ate) =>
        db
          .from(tabela)
          .select(colunas)
          .gte("created_at", desde)
          .lt("created_at", ateISO)
          .order("id")
          .range(de, ate) as never,
      );

    const [leadsCru, musicas, custos, eventos, pedidos] = await Promise.all([
      janela<Lead>("quiz_responses", "id, session_id, respostas, furthest_step, email, attribution, locale, created_at"),
      janela<Musica>("musicas", "id, quiz_response_id, titulo, status, created_at, gerada_em, personalizada_em"),
      janela<Custo>("custos", "id, tipo, custo_brl, quiz_response_id, created_at"),
      janela<Evento>("funnel_events", "id, event_name, session_id, event_data, created_at"),
      janela<Pedido>(
        "pedidos",
        "id, quiz_response_id, musica_id, gateway, status, valor_centavos, email, paid_at, created_at",
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

    const localeDaSessao = new Map<string, string>();
    for (const l of leadsCru) {
      if (l.session_id) localeDaSessao.set(l.session_id, l.locale === "es" ? "es" : "pt");
    }
    for (const e of eventos) {
      if (!e.session_id || localeDaSessao.has(e.session_id)) continue;
      if (e.event_name !== "page_view") continue;
      const caminho = String((e.event_data ?? {}).path ?? "");
      localeDaSessao.set(e.session_id, /^\/es(\/|$)/.test(caminho) ? "es" : "pt");
    }

    const bate = (locale: string | undefined) =>
      filtro === "todos" || (locale ?? "pt") === filtro;
    const porSessao = (sid: string | null) => bate(sid ? localeDaSessao.get(sid) : undefined);
    const quizBate = (qid: string | null) => bate(qid ? localeDoQuiz.get(qid) : undefined);

    // Mais recente primeiro, como a listagem do painel espera.
    const leads = leadsCru
      .filter((l) => bate(l.locale === "es" ? "es" : "pt"))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const eventosF = eventos.filter((e) => porSessao(e.session_id));
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

    const conta = (nome: string) => eventosF.filter((e) => e.event_name === nome).length;
    // Visitante único: sessões distintas com page_view. É o denominador honesto
    // do funil (o total de page_view contaria a mesma pessoa várias vezes).
    const sessoesComView = new Set(
      eventosF.filter((e) => e.event_name === "page_view" && e.session_id).map((e) => e.session_id),
    );
    const visitantes = sessoesComView.size;

    const pagos = pedidosF.filter((p) => p.status === "pago");

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
    const sessoesCheckout = new Set(
      eventos
        .filter((e) => CLIQUE_COMPRA.has(e.event_name) && e.session_id)
        .map((e) => e.session_id),
    );
    const cliquesCheckout = sessoesCheckout.size;

    // Quem chegou na TELA DE OFERTA (existe desde 02/08). Antes dela, o
    // clique em comprar levava direto pro gateway; por isso o degrau fica
    // vazio em qualquer recorte anterior, e não é bug.
    const sessoesOferta = new Set(
      eventosF.filter((e) => e.event_name === "oferta_vista" && e.session_id).map((e) => e.session_id),
    ).size;

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
    // A sessão conta UMA vez, na primeira página que ela abriu. Agrupar por
    // qualquer page_view faria toda sessão aparecer em toda página visitada,
    // e a comparação não significaria nada.
    const entradaDaSessao = new Map<string, string>();
    for (const e of [...eventosF].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))) {
      if (e.event_name !== "page_view" || !e.session_id) continue;
      if (!(e.event_data ?? {}).is_landing) continue;
      if (entradaDaSessao.has(e.session_id)) continue;
      let caminho = String((e.event_data ?? {}).path ?? "/");
      // Páginas de token viram um grupo só: `/p/abc123` e `/p/xyz789` são a
      // mesma PORTA (alguém abriu um presente compartilhado), e listadas uma a
      // uma virariam trinta linhas de uma visita cada.
      caminho = caminho
        .replace(/^\/p\/.+/, "/p/… (presente compartilhado)")
        .replace(/^\/editar\/.+/, "/editar/… (editor)");
      entradaDaSessao.set(e.session_id, caminho);
    }

    const sessoesQuiz = new Set(
      eventosF.filter((e) => e.event_name === "quiz_started" && e.session_id).map((e) => e.session_id),
    );
    const sessoesLetra = new Set(
      eventosF.filter((e) => e.event_name === "letra_finalizada" && e.session_id).map((e) => e.session_id),
    );
    const sessoesVenda = new Set(
      pagos.map((p) => leads.find((l) => l.id === p.quiz_response_id)?.session_id).filter(Boolean),
    );

    const entradaMap = new Map<string, { caminho: string; visitantes: number; quiz: number; letras: number; vendas: number }>();
    for (const [sid, caminho] of entradaDaSessao) {
      const v = entradaMap.get(caminho) ?? { caminho, visitantes: 0, quiz: 0, letras: 0, vendas: 0 };
      v.visitantes += 1;
      if (sessoesQuiz.has(sid)) v.quiz += 1;
      if (sessoesLetra.has(sid)) v.letras += 1;
      if (sessoesVenda.has(sid)) v.vendas += 1;
      entradaMap.set(caminho, v);
    }
    const porEntrada = [...entradaMap.values()]
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
