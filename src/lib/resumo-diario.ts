// O FECHAMENTO DO DIA, em números. Função PURA: recebe as linhas já lidas do
// banco e devolve o resumo. Quem lê o banco e manda o e-mail é o job
// `inngest/functions/resumoDiario.ts`; aqui só a conta, pra dar pra testar.
//
// ── AS RÉGUAS, E POR QUE ESTAS ───────────────────────────────────
//
// - VENDA é pedido `pago` com `paid_at` no dia (Brasília). Cortesia
//   (`dinheiro_entrou = false`) não é venda: o pedido fica pago pra música
//   chegar, mas o dinheiro nunca entrou. Mesma regra do painel.
// - UPSELL é o pedido com `:up:` na referência (vídeo, quadro, música extra
//   comprados depois). O bump do checkout NÃO é upsell: ele vem dentro do
//   pedido da música, e aparece só como contagem.
// - CANAL é first-touch, lido da atribuição do quiz, igual ao resto da casa.
//   Upsell não tem canal próprio (nasce no editor), então não entra na conta
//   de canal nem de CPA.
// - GASTO do Google vem de `metricas_campanha`, que o `puxarMetricasAds`
//   recarrega de hora em hora direto da API. TikTok e outros só entram se
//   alguém digitou em `gastos_ads`; sem isso o e-mail diz "não informado"
//   em vez de fingir que foi zero.
// - LUCRO = receita - gasto de mídia - custo de produção - taxas. Não tira
//   custo fixo nem imposto: é o lucro de operação do dia, pra comparar dias.

export type Atribuicao = Record<string, unknown> | null | undefined;

export type Canal = "Google" | "TikTok" | "Convite" | "Indicação" | "Direto" | string;

/** Canal de origem, first-touch. Mesma leitura dos scripts de canal. */
export function canalDe(a: Atribuicao): Canal {
  if (!a) return "Direto";
  const fonte = String(a.utm_source ?? "").toLowerCase();
  const ref = String(a.referrer ?? "").toLowerCase();
  if (a.ttclid || fonte.includes("tiktok") || ref.includes("tiktok")) return "TikTok";
  if (a.gclid || fonte.includes("google")) return "Google";
  if (fonte === "presente") return "Convite";
  // O link de indicação (member get member). Depois dos anúncios: quem
  // chegou por anúncio e depois recebeu o link continua contando pro
  // anúncio, que é a regra first-touch do resto desta leitura.
  if (a.ref) return "Indicação";
  if (fonte) return fonte;
  return "Direto";
}

export type TipoUpsell = "video" | "quadro" | "extra" | "outro";

/** `asaas:up:video:<uuid>` → "video". Sem `:up:` não é upsell. */
export function tipoUpsell(paymentId: string): TipoUpsell | null {
  const m = /:up:([a-z]+)/.exec(paymentId);
  if (!m) return null;
  if (m[1] === "video" || m[1] === "quadro") return m[1];
  if (m[1] === "extra" || m[1] === "tres") return "extra";
  return "outro";
}

export type PedidoDoDia = {
  paymentId: string;
  /** Já em real (pedido do funil espanhol convertido pelo câmbio). */
  valorBrl: number;
  taxaBrl: number;
  bumpQuadro: boolean;
  bumpVideo: boolean;
  atribuicao: Atribuicao;
};

export type GastoCampanha = { campanhaId: string; nome: string; gastoBrl: number };

export type Resumo = {
  receitaBrl: number;
  vendas: number;
  ticketBrl: number;
  upsells: Record<TipoUpsell, { n: number; brl: number }>;
  receitaUpsellBrl: number;
  bumps: { quadro: number; video: number };
  taxasBrl: number;
  gastoGoogleBrl: number;
  /** Gasto digitado à mão por origem (tiktok, meta...). Ausente = não informado. */
  gastoOutrosBrl: Record<string, number>;
  custoProducaoBrl: number;
  lucroBrl: number;
  porCanal: Array<{ canal: Canal; vendas: number; receitaBrl: number }>;
  porCampanha: Array<{
    id: string;
    nome: string;
    gastoBrl: number;
    vendas: number;
    cpaBrl: number | null;
  }>;
};

export function resumirDia(args: {
  pedidos: PedidoDoDia[];
  gastoGoogle: GastoCampanha[];
  gastoOutros: Record<string, number>;
  custoProducaoBrl: number;
}): Resumo {
  const upsells: Resumo["upsells"] = {
    video: { n: 0, brl: 0 },
    quadro: { n: 0, brl: 0 },
    extra: { n: 0, brl: 0 },
    outro: { n: 0, brl: 0 },
  };
  const canais = new Map<Canal, { vendas: number; receitaBrl: number }>();
  const vendasPorCampanha = new Map<string, number>();
  let receita = 0,
    vendas = 0,
    taxas = 0;
  const bumps = { quadro: 0, video: 0 };

  for (const p of args.pedidos) {
    receita += p.valorBrl;
    taxas += p.taxaBrl;
    const up = tipoUpsell(p.paymentId);
    if (up) {
      upsells[up].n += 1;
      upsells[up].brl += p.valorBrl;
      continue;
    }
    vendas += 1;
    if (p.bumpQuadro) bumps.quadro += 1;
    if (p.bumpVideo) bumps.video += 1;
    const canal = canalDe(p.atribuicao);
    const c = canais.get(canal) ?? { vendas: 0, receitaBrl: 0 };
    c.vendas += 1;
    c.receitaBrl += p.valorBrl;
    canais.set(canal, c);
    const camp = String(p.atribuicao?.utm_campaign ?? "");
    if (canal === "Google" && camp)
      vendasPorCampanha.set(camp, (vendasPorCampanha.get(camp) ?? 0) + 1);
  }

  const gastoGoogle = args.gastoGoogle.reduce((s, g) => s + g.gastoBrl, 0);
  const gastoOutros = Object.values(args.gastoOutros).reduce((s, v) => s + v, 0);
  const receitaUpsell = Object.values(upsells).reduce((s, u) => s + u.brl, 0);

  const porCampanha = args.gastoGoogle
    .filter((g) => g.gastoBrl > 0 || vendasPorCampanha.has(g.campanhaId))
    .map((g) => {
      const v = vendasPorCampanha.get(g.campanhaId) ?? 0;
      return {
        id: g.campanhaId,
        nome: g.nome,
        gastoBrl: g.gastoBrl,
        vendas: v,
        // Campanha que quase não gastou no dia e recebeu venda de clique antigo
        // daria "CPA R$ 0,04": número que parece ótimo e não diz nada.
        cpaBrl: v && g.gastoBrl >= 1 ? g.gastoBrl / v : null,
      };
    })
    .sort((a, b) => b.gastoBrl - a.gastoBrl);

  return {
    receitaBrl: receita,
    vendas,
    // Receita total (com upsell) por comprador: é o AOV que a gente persegue.
    ticketBrl: vendas ? receita / vendas : 0,
    upsells,
    receitaUpsellBrl: receitaUpsell,
    bumps,
    taxasBrl: taxas,
    gastoGoogleBrl: gastoGoogle,
    gastoOutrosBrl: args.gastoOutros,
    custoProducaoBrl: args.custoProducaoBrl,
    lucroBrl: receita - gastoGoogle - gastoOutros - args.custoProducaoBrl - taxas,
    porCanal: [...canais.entries()]
      .map(([canal, c]) => ({ canal, ...c }))
      .sort((a, b) => b.vendas - a.vendas),
    porCampanha,
  };
}

/** Início do dia `AAAA-MM-DD` em Brasília (UTC-3, sem horário de verão). */
export function inicioDoDiaBrasilia(dia: string): Date {
  return new Date(`${dia}T03:00:00Z`);
}

/** O dia de ontem em Brasília, como `AAAA-MM-DD`. */
export function ontemEmBrasilia(agora = new Date()): string {
  return new Date(agora.getTime() - 3 * 3600000 - 86400000).toISOString().slice(0, 10);
}

/** `AAAA-MM-DD` deslocado `n` dias. */
export function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}
