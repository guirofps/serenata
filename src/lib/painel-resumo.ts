// O RESUMO DIÁRIO DO FUNIL (02/10/2026).
//
// Agregar `funnel_events` é o que estoura o tempo do banco: 3,3s por dia
// medidos em 28/08, e a tabela só cresce. Um dia que já terminou não muda
// mais (ou quase), então ele é agregado UMA vez pelo cron
// (`api/painel-resumo.ts`) e guardado em `painel_eventos_dia`. O painel soma
// os dias prontos e calcula ao vivo só as pontas.
//
// O que vai na tabela é a saída de `admin_eventos_resumo` sem tirar nem pôr.
// A mesma função alimenta o vivo e o resumo: não existe segunda versão do que
// é visitante, abertura ou checkout.
//
// Puro e sem `@/`: o cron em `api/` importa daqui.
//
// DUAS COISAS MUDAM DE SIGNIFICADO, e estão escritas na tela:
//   1. Sessão que atravessa a meia-noite conta uma vez em CADA dia.
//   2. Venda por página de entrada só conta compra no mesmo dia da visita.

export type FiltroFunil = "todos" | "pt" | "es";
export const FILTROS: readonly FiltroFunil[] = ["todos", "pt", "es"];

/** O que `admin_eventos_resumo` devolve (migration 20260817000000). */
export type EventosResumo = {
  visitantes: number;
  /** Opcional: some se o painel subir antes da migration 20260817110000. */
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

export type Faixa = { inicio: Date; fim: Date };

const DIA_MS = 86_400_000;
/** Brasília, sem horário de verão. O mesmo `OFFSET_BR` de `admin-dados.ts`. */
const OFFSET_BR_MS = 3 * 3_600_000;

/** O dia do Brasil em que o instante cai, `YYYY-MM-DD`. */
export function diaBr(t: number): string {
  return new Date(t - OFFSET_BR_MS).toISOString().slice(0, 10);
}

/** Meia-noite a meia-noite, no Brasil. */
export function limitesDoDia(dia: string): Faixa {
  const inicio = new Date(Date.parse(`${dia}T00:00:00.000Z`) + OFFSET_BR_MS);
  return { inicio, fim: new Date(inicio.getTime() + DIA_MS) };
}

const meiaNoiteDe = (t: number) => limitesDoDia(diaBr(t)).inicio.getTime();

/**
 * Divide a janela em DIAS FECHADOS INTEIROS (que vêm da tabela) e até duas
 * FAIXAS VIVAS: a ponta inicial (a janela móvel de "7 dias" começa no meio de
 * um dia) e a ponta final (hoje até agora, ou o meio de um dia passado, no
 * comparativo).
 *
 * Hoje nunca é dia fechado, mesmo que a janela o cubra inteiro: ainda está
 * acontecendo.
 */
export function fatiarJanela(
  inicio: Date,
  fim: Date,
  agora: number,
): { dias: string[]; vivas: Faixa[] } {
  const ini = inicio.getTime();
  const fimT = fim.getTime();
  if (ini >= fimT) return { dias: [], vivas: [] };

  let primeiro = meiaNoiteDe(ini);
  if (primeiro < ini) primeiro += DIA_MS;
  const limite = Math.min(fimT, meiaNoiteDe(agora));

  const dias: string[] = [];
  let t = primeiro;
  while (t + DIA_MS <= limite) {
    dias.push(diaBr(t));
    t += DIA_MS;
  }
  if (!dias.length) return { dias: [], vivas: [{ inicio, fim }] };

  const vivas: Faixa[] = [];
  if (ini < primeiro) vivas.push({ inicio, fim: new Date(primeiro) });
  if (t < fimT) vivas.push({ inicio: new Date(t), fim });
  return { dias, vivas };
}

/**
 * O que vai ao banco ao vivo: as pontas, mais os dias que deveriam estar na
 * tabela e não estão (cron atrasado, migration não aplicada).
 *
 * Faixas que se tocam viram UMA chamada. No pior caso — tabela vazia — sai a
 * janela inteira numa faixa só, que é exatamente o painel de antes.
 */
export function faixasVivas(
  plano: { dias: string[]; vivas: Faixa[] },
  existentes: ReadonlySet<string>,
): { faixas: Faixa[]; faltando: string[] } {
  const faltando = plano.dias.filter((d) => !existentes.has(d));
  const todas = [...plano.vivas, ...faltando.map(limitesDoDia)].sort(
    (a, b) => a.inicio.getTime() - b.inicio.getTime(),
  );
  const faixas: Faixa[] = [];
  for (const f of todas) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && ultima.fim.getTime() >= f.inicio.getTime()) {
      if (f.fim.getTime() > ultima.fim.getTime()) ultima.fim = new Date(f.fim.getTime());
    } else {
      faixas.push({ inicio: new Date(f.inicio.getTime()), fim: new Date(f.fim.getTime()) });
    }
  }
  return { faixas, faltando };
}

export function resumoVazio(): EventosResumo {
  return {
    visitantes: 0,
    sessoes_abertura: 0,
    sessoes_oferta: 0,
    sessoes_checkout: 0,
    contagens: {},
    por_entrada: [],
  };
}

/**
 * Junta resumos de pedaços diferentes da janela num resumo só, no formato que
 * o resto de `montarPainel` já lê.
 */
export function somarResumos(partes: EventosResumo[]): EventosResumo {
  const total = resumoVazio();
  const entradas = new Map<string, EventosResumo["por_entrada"][number]>();
  for (const p of partes) {
    total.visitantes += Number(p.visitantes ?? 0);
    total.sessoes_abertura = (total.sessoes_abertura ?? 0) + Number(p.sessoes_abertura ?? 0);
    total.sessoes_oferta += Number(p.sessoes_oferta ?? 0);
    total.sessoes_checkout += Number(p.sessoes_checkout ?? 0);
    for (const [nome, n] of Object.entries(p.contagens ?? {})) {
      total.contagens[nome] = (total.contagens[nome] ?? 0) + Number(n);
    }
    for (const e of p.por_entrada ?? []) {
      const ja = entradas.get(e.caminho);
      if (ja) {
        ja.visitantes += e.visitantes;
        ja.quiz += e.quiz;
        ja.letras += e.letras;
        ja.vendas += e.vendas;
      } else {
        entradas.set(e.caminho, { ...e });
      }
    }
  }
  total.por_entrada = [...entradas.values()].sort(
    (x, y) => y.visitantes - x.visitantes || x.caminho.localeCompare(y.caminho),
  );
  return total;
}

// ── A REGRA DE VENDA, EM UM LUGAR SÓ ─────────────────────────────

export type PedidoVenda = {
  quiz_response_id: string | null;
  status: string;
  dinheiro_entrou?: boolean | null;
};
export type LeadSessao = { id: string; session_id: string | null; locale: string | null };

/**
 * O que conta como venda. Liberação manual sem dinheiro (cortesia, teste) fica
 * `pago` pra música chegar no cliente, mas não é faturamento: `dinheiro_entrou`
 * só é `false` quando alguém disse que foi cortesia.
 */
export function ehVenda(p: PedidoVenda): boolean {
  return p.status === "pago" && p.dinheiro_entrou !== false;
}

/**
 * As sessões que compraram, pro `p_sessoes_venda` de `admin_eventos_resumo`.
 *
 * Só conta pedido cujo lead está na mesma janela (é o lead que dá a sessão e o
 * idioma). `en` (Ballad) e `pt` caem no filtro "pt", como em `montarPainel`.
 */
export function sessoesQueCompraram(
  pedidos: PedidoVenda[],
  leads: LeadSessao[],
  filtro: FiltroFunil,
): string[] {
  const porId = new Map(leads.map((l) => [l.id, l]));
  const sessoes = new Set<string>();
  for (const p of pedidos) {
    if (!ehVenda(p)) continue;
    const lead = p.quiz_response_id ? porId.get(p.quiz_response_id) : undefined;
    if (!lead?.session_id) continue;
    const locale = lead.locale === "es" ? "es" : "pt";
    if (filtro !== "todos" && locale !== filtro) continue;
    sessoes.add(lead.session_id);
  }
  return [...sessoes];
}

// ── O PLANEJADOR DO CRON ─────────────────────────────────────────

export type LinhaResumoDia = { dia: string; filtro: string; atualizado_em: string };

/** Por quantas horas depois de fechar um dia ainda vale refazê-lo. */
export const RECENTE_H = 72;
/** Idade mínima da linha pra um dia recente ser refeito. */
export const REFAZER_H = 6;

/**
 * Os dias que o cron tem que (re)fazer, em ordem: primeiro os FALTANDO (algum
 * dos três filtros sem linha), do mais antigo ao mais novo; depois os RECENTES
 * VENCIDOS — fechados há menos de 72h com linha de mais de 6h. Isso pega
 * evento que chega atrasado e PIX pago depois da meia-noite.
 *
 * Hoje nunca entra: ainda está acontecendo.
 */
export function diasAFazer(linhas: LinhaResumoDia[], primeiroDia: string, agora: number): string[] {
  const hoje = diaBr(agora);
  const porDia = new Map<string, LinhaResumoDia[]>();
  for (const l of linhas) {
    const lista = porDia.get(l.dia) ?? [];
    lista.push(l);
    porDia.set(l.dia, lista);
  }

  const faltando: string[] = [];
  const vencidos: string[] = [];
  for (let t = limitesDoDia(primeiroDia).inicio.getTime(); diaBr(t) < hoje; t += DIA_MS) {
    const dia = diaBr(t);
    const doDia = porDia.get(dia) ?? [];
    if (!FILTROS.every((f) => doDia.some((l) => l.filtro === f))) {
      faltando.push(dia);
      continue;
    }
    const fechouHa = agora - limitesDoDia(dia).fim.getTime();
    const maisVelha = Math.min(...doDia.map((l) => Date.parse(l.atualizado_em)));
    if (fechouHa < RECENTE_H * 3_600_000 && agora - maisVelha > REFAZER_H * 3_600_000) {
      vencidos.push(dia);
    }
  }
  return [...faltando, ...vencidos];
}
