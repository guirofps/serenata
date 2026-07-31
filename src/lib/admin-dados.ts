import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { QUIZ_FLOW } from "@/lib/quiz-flow";
import { isQuestion } from "@/lib/flow-engine";

// Agregações do painel. TODAS exigem admin antes de tocar no banco — nenhuma
// consulta roda para quem não está autenticado.
//
// O painel responde três perguntas de negócio, nessa ordem:
//   1. Está entrando dinheiro? (vendas, receita, margem, CAC)
//   2. De ONDE vem? (atribuição por campanha/origem)
//   3. Onde a pessoa DESISTE? (o funil passo a passo, do clique à venda)

export type Painel = {
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
    receitaBrl: number;
    ticketMedioBrl: number;
    custoTotalBrl: number;
    margemBrl: number;
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

  producao: {
    porStatus: Record<string, number>;
    tempoMedioS: number | null;
    tempoP95S: number | null;
    falhas: number;
    travadas: number; // gerando há mais de 15 min
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

export const carregarPainel = createServerFn({ method: "POST" })
  // `de`/`ate` em "YYYY-MM-DD" (hora local BR) têm prioridade sobre `dias`.
  // Com eles dá pra olhar UM dia específico ou qualquer intervalo.
  .validator((data: { dias?: number; de?: string; ate?: string }) => data)
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

    const [leadsR, musicasR, custosR, eventosR, pedidosR] = await Promise.all([
      db
        .from("quiz_responses")
        .select("id, session_id, respostas, furthest_step, email, attribution, created_at")
        .gte("created_at", desde)
        .lt("created_at", ateISO)
        .order("created_at", { ascending: false }),
      db
        .from("musicas")
        .select("id, quiz_response_id, titulo, status, created_at, gerada_em, personalizada_em")
        .gte("created_at", desde)
        .lt("created_at", ateISO),
      db.from("custos").select("tipo, custo_brl, created_at").gte("created_at", desde).lt("created_at", ateISO),
      db
        .from("funnel_events")
        .select("event_name, session_id, created_at")
        .gte("created_at", desde)
        .lt("created_at", ateISO),
      db
        .from("pedidos")
        .select("id, quiz_response_id, musica_id, gateway, status, valor_centavos, email, paid_at, created_at")
        .gte("created_at", desde)
        .lt("created_at", ateISO),
    ]);

    const leads = leadsR.data ?? [];
    const musicas = musicasR.data ?? [];
    const custos = custosR.data ?? [];
    const eventos = eventosR.data ?? [];
    const pedidos = pedidosR.data ?? [];

    const conta = (nome: string) => eventos.filter((e) => e.event_name === nome).length;
    // Visitante único: sessões distintas com page_view. É o denominador honesto
    // do funil (o total de page_view contaria a mesma pessoa várias vezes).
    const sessoesComView = new Set(
      eventos.filter((e) => e.event_name === "page_view" && e.session_id).map((e) => e.session_id),
    );
    const visitantes = sessoesComView.size;

    const pagos = pedidos.filter((p) => p.status === "pago");
    const receita = pagos.reduce((s, p) => s + (p.valor_centavos ?? 0) / 100, 0);
    const custoTotal = custos.reduce((s, c) => s + Number(c.custo_brl ?? 0), 0);

    const quizIniciados = new Set(
      eventos.filter((e) => e.event_name === "quiz_started" && e.session_id).map((e) => e.session_id),
    ).size;
    const comEmail = leads.filter((l) => l.email).length;
    const cliquesCheckout = conta("checkout_click") + conta("desbloquear_click");

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
      { id: "letra", rotulo: "Recebeu a letra", alcancaram: musicas.length, etapa: "entrega" },
      {
        id: "musica",
        rotulo: "Música ficou pronta",
        alcancaram: musicas.filter((m) => m.status === "pronta").length,
        etapa: "entrega",
      },
      { id: "checkout", rotulo: "Clicou em comprar", alcancaram: cliquesCheckout, etapa: "venda" },
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
    const porQuiz = new Map(leads.map((l) => [l.id, l]));
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
    for (const p of pagos) {
      const l = p.quiz_response_id ? porQuiz.get(p.quiz_response_id) : null;
      const { origem, campanha } = chaveOrigem(l?.attribution);
      const k = `${origem}|${campanha ?? ""}`;
      const v = origemMap.get(k) ?? { origem, campanha, leads: 0, letras: 0, vendas: 0, receitaBrl: 0 };
      v.vendas++;
      v.receitaBrl += (p.valor_centavos ?? 0) / 100;
      origemMap.set(k, v);
    }
    const porOrigem = [...origemMap.values()]
      .map((v) => ({ ...v, conversaoPct: pct(v.vendas, v.leads) }))
      .sort((a, b) => b.receitaBrl - a.receitaBrl || b.leads - a.leads);

    // ── PRODUÇÃO ─────────────────────────────────────────────────
    const porStatus: Record<string, number> = {};
    const tempos: number[] = [];
    const agora = Date.now();
    let travadas = 0;
    for (const m of musicas) {
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
    for (const c of custos) {
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
      d.receitaBrl += (p.valor_centavos ?? 0) / 100;
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

    const musicaPorId = new Map(musicas.map((m) => [m.id, m]));
    const quizComprou = new Set(pagos.map((p) => p.quiz_response_id).filter(Boolean));

    return {
      periodoDias: dias,
      de: inicio.toISOString(),
      ate: fim.toISOString(),
      geradoEm: new Date().toISOString(),

      topo: {
        visitantes,
        quizIniciados,
        leads: comEmail,
        letrasGeradas: musicas.length,
        cliquesCheckout,
        vendas: pagos.length,
        receitaBrl: receita,
        ticketMedioBrl: pagos.length ? receita / pagos.length : 0,
        custoTotalBrl: custoTotal,
        margemBrl: receita - custoTotal,
        taxaVisitaQuiz: pct(quizIniciados, visitantes),
        taxaQuizLetra: pct(musicas.length, quizIniciados),
        taxaLetraCheckout: pct(cliquesCheckout, musicas.length),
        taxaCheckoutVenda: pct(pagos.length, cliquesCheckout),
        taxaGeral: pct(pagos.length, visitantes),
        custoPorVendaBrl: pagos.length ? custoTotal / pagos.length : 0,
      },

      funil,
      porOrigem,

      producao: {
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
        presentesMontados: musicas.filter((m) => m.personalizada_em).length,
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
