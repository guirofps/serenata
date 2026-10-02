// O GOSPEL NO PAINEL (02/10/2026): leads, letras, vendas e receita por lead
// de quem entrou por `/criar?t=gospel`, separados em louvor e presente,
// contra o resto. Puro: `admin-dados.ts` passa as listas que já leu.

export type ChaveTema = "gospel · louvor" | "gospel · presente" | "gospel · sem tipo" | "resto";

export type LeadTema = {
  id: string;
  attribution: Record<string, unknown> | null;
  respostas: Record<string, unknown> | null;
};

/** Venda já filtrada por `ehVenda` e já convertida pra real. */
export type VendaTema = { quiz_response_id: string | null; receitaBrl: number };

export type LinhaTema = {
  tema: ChaveTema;
  leads: number;
  letras: number;
  vendas: number;
  receitaBrl: number;
  conversaoPct: number;
  receitaPorLeadBrl: number;
};

const ORDEM: ChaveTema[] = ["gospel · louvor", "gospel · presente", "gospel · sem tipo", "resto"];

export function chaveTema(l: LeadTema): ChaveTema {
  // Pela atribuição OU pelas respostas: a linha de lead de uma sessão que já
  // existia antes do anúncio gospel pode ter a atribuição antiga.
  const gospel = l.attribution?.tema === "gospel" || l.respostas?.tema === "gospel";
  if (!gospel) return "resto";
  const tipo = l.respostas?.tipo;
  return tipo === "louvor" ? "gospel · louvor" : tipo === "presente" ? "gospel · presente" : "gospel · sem tipo";
}

export function porTemaDe(
  leads: LeadTema[],
  vendas: VendaTema[],
  comMusica: Set<string | null>,
): LinhaTema[] {
  const acc = new Map<ChaveTema, { leads: number; letras: number; vendas: number; receitaBrl: number }>();
  const linha = (k: ChaveTema) => {
    const v = acc.get(k) ?? { leads: 0, letras: 0, vendas: 0, receitaBrl: 0 };
    acc.set(k, v);
    return v;
  };
  const chaveDoLead = new Map<string, ChaveTema>();
  for (const l of leads) {
    const k = chaveTema(l);
    chaveDoLead.set(l.id, k);
    const v = linha(k);
    v.leads++;
    if (comMusica.has(l.id)) v.letras++;
  }
  for (const venda of vendas) {
    const k = (venda.quiz_response_id && chaveDoLead.get(venda.quiz_response_id)) || "resto";
    const v = linha(k);
    v.vendas++;
    v.receitaBrl += venda.receitaBrl;
  }
  const temGospel = ORDEM.slice(0, 3).some((k) => (acc.get(k)?.leads ?? 0) > 0);
  if (!temGospel) return [];
  return ORDEM.filter((k) => k === "resto" || (acc.get(k)?.leads ?? 0) > 0).map((k) => {
    const v = acc.get(k) ?? { leads: 0, letras: 0, vendas: 0, receitaBrl: 0 };
    return {
      tema: k,
      ...v,
      conversaoPct: v.leads > 0 ? (v.vendas / v.leads) * 100 : 0,
      receitaPorLeadBrl: v.leads > 0 ? v.receitaBrl / v.leads : 0,
    };
  });
}
