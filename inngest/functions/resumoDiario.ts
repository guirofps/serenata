import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  inicioDoDiaBrasilia,
  ontemEmBrasilia,
  resumirDia,
  somarDias,
  type PedidoDoDia,
  type Resumo,
} from "../../src/lib/resumo-diario.js";
import { assuntoResumoDiario, emailResumoDiario } from "../../emails/resumo-diario.js";

// O FECHAMENTO DO DIA, por e-mail, toda manhã, pro dono e pro sócio.
//
// Pedido do dono em 25/09: "igual tem os de notificação quando dá algum b.o",
// só que do dia a dia: faturamento, lucro, canal, upsell, CPA por campanha.
// Sai às 07h03 de Brasília com o dia ANTERIOR inteiro: fechar à meia-noite
// pegaria o gasto do Google ainda parcial (o `puxarMetricasAds` roda de hora
// em hora e o Google ajusta o dia por algumas horas depois).
//
// A conta mora em `src/lib/resumo-diario.ts` (pura, testada). Aqui só se lê
// o banco e se manda.
//
// Disparo manual, pra reenviar ou conferir um dia: evento
// `resumo/diario.enviar` com `{ dia?: "AAAA-MM-DD", para?: string[] }`.

const PARA = ["guilhermerojasiqueira@gmail.com", "nosfer@gmail.com"];
// Mesmo câmbio de `PRECOS.cambioUsdBrl` (src/lib/custos.ts). Não importado de
// lá porque aquele arquivo puxa o cliente do app pelo alias `@/`, que o
// bundle das funções não resolve.
const CAMBIO_USD_BRL = 5.4;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}
type Db = ReturnType<typeof db>;

/** PostgREST devolve no máximo 1000 linhas: pagina com ordem estável. */
async function tudo<T>(
  consulta: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nomeCurto = (n: string) => n.replace(/^GD \| Serenata \| /, "").replace(/#$/, "");

async function resumoDoDia(sb: Db, dia: string): Promise<Resumo> {
  const ini = inicioDoDiaBrasilia(dia).toISOString();
  const fim = inicioDoDiaBrasilia(somarDias(dia, 1)).toISOString();

  type LinhaPedido = {
    id: string;
    payment_id: string;
    valor_centavos: number | null;
    taxa_centavos: number | null;
    bump_quadro: boolean | null;
    bump_video: boolean | null;
    quiz_response_id: string | null;
    dinheiro_entrou: boolean | null;
  };
  const pedidos = (
    await tudo<LinhaPedido>((a, b) =>
      sb
        .from("pedidos")
        .select(
          "id, payment_id, valor_centavos, taxa_centavos, bump_quadro, bump_video, quiz_response_id, dinheiro_entrou",
        )
        .eq("status", "pago")
        .gte("paid_at", ini)
        .lt("paid_at", fim)
        .order("paid_at")
        .order("id")
        .range(a, b),
    )
  ).filter((p) => p.dinheiro_entrou !== false); // cortesia não é venda

  const ids = [
    ...new Set(pedidos.map((p) => p.quiz_response_id).filter((x): x is string => Boolean(x))),
  ];
  const quiz = new Map<
    string,
    { attribution: Record<string, unknown> | null; locale: string | null }
  >();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await sb
      .from("quiz_responses")
      .select("id, attribution, locale")
      .in("id", ids.slice(i, i + 300));
    if (error) throw new Error(error.message);
    for (const q of data ?? []) quiz.set(q.id, { attribution: q.attribution, locale: q.locale });
  }

  const linhas: PedidoDoDia[] = pedidos.map((p) => {
    const q = p.quiz_response_id ? quiz.get(p.quiz_response_id) : undefined;
    const fator = q?.locale === "es" ? CAMBIO_USD_BRL : 1;
    return {
      paymentId: p.payment_id,
      valorBrl: ((p.valor_centavos ?? 0) / 100) * fator,
      taxaBrl: ((p.taxa_centavos ?? 0) / 100) * fator,
      bumpQuadro: Boolean(p.bump_quadro),
      bumpVideo: Boolean(p.bump_video),
      atribuicao: q?.attribution,
    };
  });

  const { data: metricas, error: eM } = await sb
    .from("metricas_campanha")
    .select("campanha_id, custo_brl")
    .eq("dia", dia);
  if (eM) throw new Error(eM.message);
  const campIds = (metricas ?? []).map((m) => String(m.campanha_id));
  const nomes = new Map<string, string>();
  if (campIds.length) {
    const { data } = await sb.from("campanhas").select("id, nome").in("id", campIds);
    for (const c of data ?? []) nomes.set(String(c.id), String(c.nome));
  }

  const { data: outros } = await sb.from("gastos_ads").select("origem, valor_brl").eq("dia", dia);
  const gastoOutros: Record<string, number> = {};
  for (const g of outros ?? []) {
    const o = String(g.origem).toLowerCase();
    if (o === "google") continue; // o Google já vem da API; digitado à mão contaria duas vezes
    gastoOutros[o] = (gastoOutros[o] ?? 0) + Number(g.valor_brl ?? 0);
  }

  const custos = await tudo<{ custo_brl: number | null }>((a, b) =>
    sb
      .from("custos")
      .select("custo_brl")
      .gte("created_at", ini)
      .lt("created_at", fim)
      .order("id")
      .range(a, b),
  );

  return resumirDia({
    pedidos: linhas,
    gastoGoogle: (metricas ?? []).map((m) => ({
      campanhaId: String(m.campanha_id),
      nome: esc(nomeCurto(nomes.get(String(m.campanha_id)) ?? String(m.campanha_id))),
      gastoBrl: Number(m.custo_brl ?? 0),
    })),
    gastoOutros,
    custoProducaoBrl: custos.reduce((s, c) => s + Number(c.custo_brl ?? 0), 0),
  });
}

export const resumoDiario = inngest.createFunction(
  {
    id: "resumo-diario",
    retries: 2,
    triggers: [{ cron: "3 10 * * *" }, { event: "resumo/diario.enviar" }], // 07h03 de Brasília
  },
  async ({ event, step }) => {
    const dados = (event?.data ?? {}) as { dia?: string; para?: string[] };
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(dados.dia ?? "")
      ? (dados.dia as string)
      : ontemEmBrasilia();
    const para =
      Array.isArray(dados.para) && dados.para.length
        ? dados.para.filter((e) => PARA.includes(e))
        : PARA;

    const hoje = await step.run("dia", () => resumoDoDia(db(), dia));
    const anteriores: Resumo[] = [];
    for (let n = 1; n <= 7; n++) {
      anteriores.push(
        await step.run(`dia-menos-${n}`, () => resumoDoDia(db(), somarDias(dia, -n))),
      );
    }
    const media = (k: "receitaBrl" | "vendas" | "lucroBrl" | "ticketBrl") =>
      anteriores.reduce((s, r) => s + r[k], 0) / anteriores.length;

    const enviado = await step.run("enviar", async () => {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) throw new Error("RESEND_API_KEY ausente");
      const { data, error } = await new Resend(chave).emails.send({
        from: "Serenata <contato@serenatagift.com>",
        to: para,
        subject: assuntoResumoDiario(dia, hoje),
        html: emailResumoDiario({
          dia,
          hoje,
          ontem: anteriores[0] ?? null,
          media7: {
            receitaBrl: media("receitaBrl"),
            vendas: media("vendas"),
            lucroBrl: media("lucroBrl"),
            ticketBrl: media("ticketBrl"),
          },
        }),
        tags: [{ name: "template", value: "resumo_diario" }],
      });
      if (error) throw new Error(error.message);
      return data?.id ?? null;
    });

    return {
      dia,
      para,
      emailId: enviado,
      receita: hoje.receitaBrl,
      vendas: hoje.vendas,
      lucro: hoje.lucroBrl,
    };
  },
);
