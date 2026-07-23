import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { QUIZ_FLOW } from "@/lib/quiz-flow";
import { isQuestion } from "@/lib/flow-engine";

// Agregações do painel. TODAS exigem admin antes de tocar no banco —
// nenhuma consulta roda para quem não está autenticado.

export type Painel = {
  periodoDias: number;
  topo: {
    leads: number;
    completaram: number;
    chegaramNaLetra: number;
    letrasGeradas: number;
    musicasProntas: number;
    fakeDoorCliques: number;
    custoTotalBrl: number;
    custoPorLeadBrl: number;
    custoPorMusicaBrl: number;
  };
  funil: Array<{ id: string; rotulo: string; alcancaram: number; queda: number }>;
  producao: {
    porStatus: Record<string, number>;
    tempoMedioS: number | null;
    tempoP95S: number | null;
  };
  custos: {
    porTipo: Array<{ tipo: string; brl: number; n: number }>;
    porDia: Array<{ dia: string; brl: number }>;
  };
  qualidade: { refacoes: number; usouAudio: number; karaokePlay: number; previewFim: number };
  recentes: Array<{
    nome: string | null;
    relacao: string | null;
    estilo: string | null;
    passo: number | null;
    musica: string | null;
    status: string | null;
    quando: string;
  }>;
};

const ROTULOS: Record<string, string> = {
  relacao: "Pra quem",
  nome: "Nome",
  ocasiao: "Ocasião",
  prova1: "Prova social",
  estilo: "Estilo",
  voz: "Voz",
  historia1: "Sobre ela(e)",
  historia2: "Uma memória",
  recado: "Frase do refrão",
  contato: "E-mail",
  revisao: "Revisão",
  reveal: "Letra revelada",
};

export const carregarPainel = createServerFn({ method: "POST" })
  .validator((data: { dias?: number }) => data)
  .handler(async ({ data }): Promise<Painel> => {
    // Import dinâmico: mantém node:crypto fora do bundle do cliente.
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const db = supabaseAdmin();
    const dias = data.dias && data.dias > 0 ? data.dias : 30;
    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const [leadsR, musicasR, custosR, eventosR] = await Promise.all([
      db
        .from("quiz_responses")
        .select("id, session_id, respostas, furthest_step, email, created_at")
        .gte("created_at", desde)
        .order("created_at", { ascending: false }),
      db
        .from("musicas")
        .select("id, quiz_response_id, titulo, status, created_at, gerada_em")
        .gte("created_at", desde),
      db.from("custos").select("tipo, custo_brl, created_at").gte("created_at", desde),
      db.from("funnel_events").select("event_name, created_at").gte("created_at", desde),
    ]);

    const leads = leadsR.data ?? [];
    const musicas = musicasR.data ?? [];
    const custos = custosR.data ?? [];
    const eventos = eventosR.data ?? [];

    // ── Funil: quantos alcançaram cada passo (por furthest_step) ──
    const passos = QUIZ_FLOW.filter((s) => isQuestion(s) || s.kind === "contact");
    const funil = passos.map((s, i) => {
      const n = leads.filter((l) => (l.furthest_step ?? 0) >= i + 1).length;
      return { id: s.id, rotulo: ROTULOS[s.id] ?? s.id, alcancaram: n, queda: 0 };
    });
    for (let i = 1; i < funil.length; i++) {
      const ant = funil[i - 1].alcancaram;
      funil[i].queda = ant > 0 ? Math.round(((ant - funil[i].alcancaram) / ant) * 100) : 0;
    }

    // ── Produção ──
    const porStatus: Record<string, number> = {};
    const tempos: number[] = [];
    for (const m of musicas) {
      porStatus[m.status] = (porStatus[m.status] ?? 0) + 1;
      if (m.gerada_em && m.created_at) {
        const s = (new Date(m.gerada_em).getTime() - new Date(m.created_at).getTime()) / 1000;
        if (s > 0 && s < 3600) tempos.push(s);
      }
    }
    tempos.sort((a, b) => a - b);
    const p95 = tempos.length ? tempos[Math.min(tempos.length - 1, Math.floor(tempos.length * 0.95))] : null;
    const medio = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;

    // ── Custos ──
    const porTipoMap = new Map<string, { brl: number; n: number }>();
    const porDiaMap = new Map<string, number>();
    let custoTotal = 0;
    for (const c of custos) {
      const brl = Number(c.custo_brl ?? 0);
      custoTotal += brl;
      const t = porTipoMap.get(c.tipo) ?? { brl: 0, n: 0 };
      porTipoMap.set(c.tipo, { brl: t.brl + brl, n: t.n + 1 });
      const dia = String(c.created_at).slice(0, 10);
      porDiaMap.set(dia, (porDiaMap.get(dia) ?? 0) + brl);
    }

    const conta = (nome: string) => eventos.filter((e) => e.event_name === nome).length;
    // "Completou" = chegou ao passo de contato, que é o último antes da letra.
    // (O passo de contato reporta total_de_perguntas + 1 — ver criar.tsx.)
    const completaram = leads.filter((l) => (l.furthest_step ?? 0) >= passos.length).length;
    const chegaramNaLetra = musicas.length;
    const prontas = porStatus["pronta"] ?? 0;

    return {
      periodoDias: dias,
      topo: {
        leads: leads.length,
        completaram,
        letrasGeradas: musicas.length,
        musicasProntas: prontas,
        // Taxa de fake door é medida sobre quem VIU a letra (gerou música),
        // não sobre quem começou o quiz — é a intenção de compra real.
        chegaramNaLetra,
        fakeDoorCliques: conta("fake_door_click"),
        custoTotalBrl: custoTotal,
        custoPorLeadBrl: leads.length ? custoTotal / leads.length : 0,
        custoPorMusicaBrl: prontas ? custoTotal / prontas : 0,
      },
      funil,
      producao: { porStatus, tempoMedioS: medio, tempoP95S: p95 },
      custos: {
        porTipo: [...porTipoMap.entries()]
          .map(([tipo, v]) => ({ tipo, brl: v.brl, n: v.n }))
          .sort((a, b) => b.brl - a.brl),
        porDia: [...porDiaMap.entries()].map(([dia, brl]) => ({ dia, brl })).sort((a, b) => a.dia.localeCompare(b.dia)),
      },
      qualidade: {
        refacoes: conta("letra_refacao"),
        usouAudio: conta("audio_usado"),
        karaokePlay: conta("musica_play"),
        previewFim: conta("preview_limite"),
      },
      recentes: leads.slice(0, 25).map((l) => {
        const r = (l.respostas ?? {}) as Record<string, string>;
        const m = musicas.find((x) => x.quiz_response_id === l.id);
        return {
          nome: r.nome ?? null,
          relacao: r.relacao ?? null,
          estilo: r.estilo ?? null,
          passo: l.furthest_step,
          musica: m?.titulo ?? null,
          status: m?.status ?? null,
          quando: l.created_at,
        };
      }),
    };
  });
