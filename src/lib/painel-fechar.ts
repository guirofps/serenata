// O LAÇO DO CRON DO RESUMO DIÁRIO.
//
// Separado de `api/painel-resumo.ts` pra poder ser testado: banco e relógio
// entram por `deps`. Sem `@/`, porque o handler em `api/` importa daqui.

import {
  FILTROS,
  limitesDoDia,
  sessoesQueCompraram,
  type EventosResumo,
  type Faixa,
  type FiltroFunil,
  type LeadSessao,
  type PedidoVenda,
} from "./painel-resumo.js";

export type DepsFechamento = {
  lerLeads(f: Faixa): Promise<LeadSessao[]>;
  lerPedidos(f: Faixa): Promise<PedidoVenda[]>;
  resumir(f: Faixa, filtro: FiltroFunil, sessoesVenda: string[]): Promise<EventosResumo>;
  gravar(dia: string, filtro: FiltroFunil, resumo: EventosResumo): Promise<void>;
  agora(): number;
};

export type RelatorioFechamento = {
  feitos: string[];
  falhas: Array<{ dia: string; erro: string }>;
  pendentes: string[];
};

/**
 * Fecha os dias em ordem, os três filtros de cada um.
 *
 * Passado `prazoMs`, não começa dia novo: o próximo ciclo do cron continua dali.
 * Um dia que falha é registrado e o laço segue — um dia ruim não trava a fila.
 * Um dia que falha NO MEIO fica com filtro faltando, e `diasAFazer` o devolve
 * como faltando no ciclo seguinte.
 */
export async function fecharDias(
  deps: DepsFechamento,
  dias: string[],
  prazoMs: number,
): Promise<RelatorioFechamento> {
  const comeco = deps.agora();
  const relatorio: RelatorioFechamento = { feitos: [], falhas: [], pendentes: [] };

  for (let i = 0; i < dias.length; i++) {
    if (deps.agora() - comeco >= prazoMs) {
      relatorio.pendentes = dias.slice(i);
      break;
    }
    const dia = dias[i];
    const faixa = limitesDoDia(dia);
    try {
      const [leads, pedidos] = await Promise.all([deps.lerLeads(faixa), deps.lerPedidos(faixa)]);
      for (const filtro of FILTROS) {
        const resumo = await deps.resumir(
          faixa,
          filtro,
          sessoesQueCompraram(pedidos, leads, filtro),
        );
        await deps.gravar(dia, filtro, resumo);
      }
      relatorio.feitos.push(dia);
    } catch (e) {
      relatorio.falhas.push({ dia, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return relatorio;
}
