// AS LANDINGS DE ANÚNCIO NO PAINEL (11/11/2026): `/presente` e `/tendencia`.
// Um resumo por página: visitas, cliques no botão, letras, vendas e receita.
//
//  - VISITAS e CLIQUES saem do `funnel_events`, por sessão distinta: visita é
//    `page_view` com `path` da landing; clique é o evento do botão da página
//    (`LPS[].eventoCta`).
//  - LEADS, LETRAS, VENDAS e RECEITA saem do carimbo `attribution.lp` do lead
//    (`lp-origem.ts`). O carimbo existe desde 11/11 à noite: quem passou pela
//    landing antes disso não conta aqui.
//
// Puro, como `admin-tv.ts`: `admin-dados.ts` passa as listas que já leu.
import { LPS, lpDe, type LpId } from "@/lib/lp-origem";

export type ResumoLp = {
  id: LpId;
  nome: string;
  caminho: string;
  /** Sessões distintas que abriram a página. `null` = a leitura falhou. */
  visitas: number | null;
  /** Sessões distintas que clicaram num botão pro /criar. `null` = a leitura falhou. */
  cliques: number | null;
  /** Cliques ÷ visitas. */
  cliquePct: number | null;
  leads: number;
  letras: number;
  vendas: number;
  receitaBrl: number;
  /** Vendas ÷ visitas. */
  conversaoPct: number | null;
};

export function resumoLps(entrada: {
  visitas: { session_id: string; path: string | null }[] | null;
  cliques: { session_id: string; event_name: string }[] | null;
  leads: { id: string; attribution: unknown }[];
  comMusica: Set<string | null>;
  /** Vendas já filtradas por `ehVenda`, com a receita já em real. */
  vendas: { quiz_response_id: string | null; receitaBrl: number }[];
}): ResumoLp[] {
  return LPS.map((lp) => {
    const daLp = new Set(entrada.leads.filter((l) => lpDe(l.attribution) === lp.id).map((l) => l.id));
    let letras = 0;
    for (const id of daLp) if (entrada.comMusica.has(id)) letras++;
    let vendas = 0;
    let receitaBrl = 0;
    for (const v of entrada.vendas) {
      if (v.quiz_response_id && daLp.has(v.quiz_response_id)) {
        vendas++;
        receitaBrl += v.receitaBrl;
      }
    }
    const visitas = entrada.visitas
      ? new Set(entrada.visitas.filter((v) => v.path === lp.caminho).map((v) => v.session_id)).size
      : null;
    const cliques = entrada.cliques
      ? new Set(entrada.cliques.filter((c) => c.event_name === lp.eventoCta).map((c) => c.session_id)).size
      : null;
    return {
      id: lp.id,
      nome: lp.nome,
      caminho: lp.caminho,
      visitas,
      cliques,
      cliquePct: visitas && cliques !== null ? (cliques / visitas) * 100 : null,
      leads: daLp.size,
      letras,
      vendas,
      receitaBrl,
      conversaoPct: visitas ? (vendas / visitas) * 100 : null,
    };
  });
}
