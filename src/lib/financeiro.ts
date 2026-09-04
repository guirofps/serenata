import { supabaseAdmin } from "@/lib/supabase-admin";

// O RESULTADO DA OPERAÇÃO, DE PONTA A PONTA.
//
// ── POR QUE ISTO É UM MÓDULO, E NÃO UMA PLANILHA ────────────────
//
// A primeira versão foi um script que despejava números no terminal, e ela
// tinha dois defeitos que só uma planilha manual tem: era preciso lembrar de
// rodar, e cada número novo exigia editar o script. Pior, ela lia só o que já
// estava no banco — e o gasto de mídia de julho e agosto NÃO estava, então o
// lucro que ela mostrava era maior do que o real.
//
// Aqui a apuração é uma função só, e o painel a chama. Dinheiro que vai ser
// dividido entre dois sócios não pode depender de alguém lembrar de rodar um
// script.
//
// ── DE ONDE VEM CADA LINHA ──────────────────────────────────────
//
//   receita        `pedidos` com status pago, por `paid_at`
//   taxa           `pedidos.taxa_centavos` quando existe; estimada quando não
//   IA e música    `custos` (Anthropic e kie.ai, gravado a cada chamada)
//   mídia Google   `metricas_campanha` (API do Google, de hora em hora)
//   o resto        `custos_fixos`, lançado à mão porque não tem API
//
// ── A TAXA ESTIMADA, E POR QUE ELA É HONESTA ────────────────────
//
// Só 34% dos pedidos pagos têm `taxa_centavos` gravado: o campo entrou depois
// que a operação já rodava. Ignorar os outros 66% inflaria o lucro; chutar um
// número redondo esconderia a incerteza.
//
// Então a estimativa usa a taxa REAL MEDIDA de cada gateway, e o resultado
// diz quantos reais foram estimados. Quem lê decide se confia.
//
// As taxas vêm do CLAUDE.md, medidas em transações reais:
//   Perfect Pay  11,39% (média de R$ 4,63 no ticket de R$ 38)
//   Woovi         0,8% com piso de R$ 0,50 — no ticket de hoje, R$ 0,50
const TAXA = {
  perfectpay: (v: number) => v * 0.1139,
  woovi: (v: number) => Math.max(0.5, v * 0.008),
  asaas: (v: number) => Math.max(0.99, v * 0.0199),
  // Gateway desconhecido não recebe taxa zero: zero é uma afirmação de que
  // não houve custo, e aqui a verdade é que não se sabe. A média dos
  // conhecidos erra menos que zero.
  outro: (v: number) => v * 0.03,
} as const;

export type LinhaMes = {
  mes: string;
  vendas: number;
  receita: number;
  taxa: number;
  taxaEstimada: number;
  ia: number;
  midiaGoogle: number;
  custosFixos: number;
  liquido: number;
};

export type Financeiro = {
  meses: LinhaMes[];
  total: LinhaMes;
  porFornecedor: Array<{ fornecedor: string; categoria: string; valor: number }>;
  /** Metade do líquido, que é o acerto entre os dois sócios. */
  porSocio: number;
  /** O que ainda não foi lançado e que o dono precisa completar. */
  avisos: string[];
};

const mesDe = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 7);

/** Lê tudo de uma tabela, contornando o teto de 1000 linhas do PostgREST. */
async function tudo<T>(tabela: string, colunas: string, ordem: string): Promise<T[]> {
  const db = supabaseAdmin();
  const fora: T[] = [];
  for (let i = 0; i < 200000; i += 1000) {
    const { data, error } = await db.from(tabela).select(colunas).order(ordem).range(i, i + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    fora.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) break;
  }
  return fora;
}

export async function apurar(): Promise<Financeiro> {
  const [pedidos, custos, midia, fixos] = await Promise.all([
    tudo<{ status: string; valor_centavos: number | null; taxa_centavos: number | null; gateway: string | null; paid_at: string | null }>(
      "pedidos", "status,valor_centavos,taxa_centavos,gateway,paid_at", "created_at"),
    tudo<{ custo_brl: number | null; created_at: string }>("custos", "custo_brl,created_at", "created_at"),
    tudo<{ custo_brl: number | null; dia: string }>("metricas_campanha", "custo_brl,dia", "dia"),
    tudo<{ valor_brl: number; dia: string; fornecedor: string; categoria: string }>(
      "custos_fixos", "valor_brl,dia,fornecedor,categoria", "dia"),
  ]);

  const meses = new Map<string, LinhaMes>();
  const linha = (m: string): LinhaMes => {
    if (!meses.has(m)) {
      meses.set(m, { mes: m, vendas: 0, receita: 0, taxa: 0, taxaEstimada: 0, ia: 0, midiaGoogle: 0, custosFixos: 0, liquido: 0 });
    }
    return meses.get(m)!;
  };

  for (const p of pedidos) {
    if (p.status !== "pago" || !p.paid_at) continue;
    const l = linha(mesDe(p.paid_at));
    const v = (p.valor_centavos ?? 0) / 100;
    l.vendas++;
    l.receita += v;
    if (p.taxa_centavos != null) {
      l.taxa += p.taxa_centavos / 100;
    } else {
      const f = TAXA[(p.gateway ?? "outro") as keyof typeof TAXA] ?? TAXA.outro;
      const est = f(v);
      l.taxa += est;
      l.taxaEstimada += est;
    }
  }
  for (const c of custos) linha(mesDe(c.created_at)).ia += Number(c.custo_brl ?? 0);
  for (const m of midia) linha(String(m.dia).slice(0, 7)).midiaGoogle += Number(m.custo_brl ?? 0);
  for (const f of fixos) linha(String(f.dia).slice(0, 7)).custosFixos += Number(f.valor_brl ?? 0);

  const lista = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  for (const l of lista) l.liquido = l.receita - l.taxa - l.ia - l.midiaGoogle - l.custosFixos;

  const total: LinhaMes = { mes: "total", vendas: 0, receita: 0, taxa: 0, taxaEstimada: 0, ia: 0, midiaGoogle: 0, custosFixos: 0, liquido: 0 };
  for (const l of lista) {
    total.vendas += l.vendas; total.receita += l.receita; total.taxa += l.taxa;
    total.taxaEstimada += l.taxaEstimada; total.ia += l.ia;
    total.midiaGoogle += l.midiaGoogle; total.custosFixos += l.custosFixos; total.liquido += l.liquido;
  }

  const porForn = new Map<string, { fornecedor: string; categoria: string; valor: number }>();
  for (const f of fixos) {
    const atual = porForn.get(f.fornecedor) ?? { fornecedor: f.fornecedor, categoria: f.categoria, valor: 0 };
    atual.valor += Number(f.valor_brl ?? 0);
    porForn.set(f.fornecedor, atual);
  }

  // ── O QUE FALTA, DITO EM VOZ ALTA ──────────────────────────────
  //
  // Um painel financeiro que esconde as próprias lacunas é pior que nenhum:
  // ele produz confiança sem produzir exatidão, e alguém divide o lucro por
  // dois em cima disso.
  const avisos: string[] = [];
  if (total.taxaEstimada > 0) {
    avisos.push(`R$ ${total.taxaEstimada.toFixed(2)} de taxa são estimados pela alíquota do gateway, não lidos do extrato`);
  }
  const temTiktok = fixos.some((f) => f.fornecedor.toLowerCase().includes("tiktok"));
  if (!temTiktok) avisos.push("Gasto do TikTok Ads não lançado (não há API disponível)");
  for (const nome of ["UTMify", "Inngest", "Vercel"]) {
    if (!fixos.some((f) => f.fornecedor.toLowerCase() === nome.toLowerCase())) {
      avisos.push(`${nome} não lançado`);
    }
  }

  return {
    meses: lista,
    total,
    porFornecedor: [...porForn.values()].sort((a, b) => b.valor - a.valor),
    porSocio: total.liquido / 2,
    avisos,
  };
}
