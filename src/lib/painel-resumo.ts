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
