import { inngest } from "../client.js";
import { createClient } from "@supabase/supabase-js";
import { consultarGoogleAds, contasGoogleAds, tokenGoogleAds } from "../lib/google-ads.js";

// O CUSTO DE CADA CAMPANHA, DIRETO DO GOOGLE, DE HORA EM HORA.
//
// ── O QUE ISTO DESTRAVA ──────────────────────────────────────────
//
// O painel já mostra receita por campanha em tempo real, lida do nosso banco
// no instante em que o webhook grava o pedido. O que faltava era o CUSTO, e
// sem custo não existe ROAS, só faturamento: saber que a CAMPEÃO 1 fez
// R$ 437 não decide nada até se saber se ela custou R$ 200 ou R$ 900.
//
// A tabela `metricas_campanha` foi criada em 28/08 pra isso e nasceu vazia
// (0 linhas em 31/08), porque a carga dependia de exportar CSV à mão. A
// migration dela já dizia: "A API do Google Ads resolveria isso sozinha e é
// pra onde vai. Ela exige developer token com Basic access." O Basic access
// saiu, então é este arquivo.
//
// ── A JANELA É DE 7 DIAS, E RECARREGA TUDO ───────────────────────
//
// O Google ajusta custo e conversão RETROATIVAMENTE por vários dias:
// invalidação de clique, reconciliação de moeda, conversão que chega tarde
// pela janela de 30 dias. Ler só "ontem" congelaria o primeiro número que ele
// deu, que costuma não ser o final.
//
// Por isso a chave da tabela é (campanha, dia) e o upsert REESCREVE: cada
// carga é a verdade final daquele dia, nunca mais uma parcela. Recarregar os
// mesmos 7 dias de hora em hora é o comportamento pretendido, não desperdício.
//
// ── O ID É O QUE CHEGA EM `utm_campaign` ─────────────────────────
//
// `campaign.id` do Google é o mesmo número que a atribuição guarda em
// `attribution.utm_campaign`, e por isso os dois lados casam sem tradução.
// Guardado como texto dos dois lados de propósito: converter em número em um
// só criaria chance de não casar.
//
// ── ISTO NÃO SUBSTITUI O UPLOAD DE CONVERSÕES ────────────────────
//
// Aqui a informação anda no sentido Google → nós, e serve pra LER. O
// `api/conversoes.ts` anda no sentido contrário, nós → Google, e serve pra
// ENSINAR o Smart Bidding. São caminhos independentes: este não desliga
// aquele, e o agendamento de upload continua como está.
//
// ── `conversoes_google` NUNCA É O NÚMERO DE VENDAS ───────────────
//
// Guardado pra comparar, e só. O Google conta pelo modelo dele, com janela de
// 30 dias e frações (0,5 de conversão existe). Venda nossa é linha em
// `pedidos`. Quando os dois divergirem muito, é sinal de rastreamento
// duplicado ou de atribuição pegando venda que não é dela.

const DIAS = 7;

type Metrica = {
  campanha_id: string;
  dia: string;
  custo_brl: number;
  cliques: number;
  impressoes: number;
  conversoes_google: number;
};

/** `2026-08-31`, no fuso da conta de anúncios (Brasil), não em UTC. */
function diaEm(desloc: number): string {
  const agora = new Date(Date.now() - 3 * 3600 * 1000 - desloc * 86400000);
  return agora.toISOString().slice(0, 10);
}

export const puxarMetricasAds = inngest.createFunction(
  {
    id: "puxar-metricas-ads",
    retries: 2,
    // No Inngest v4 o gatilho vive na CONFIG, não num segundo argumento.
    // Minuto 45: fora do minuto cheio e longe dos outros vigias.
    triggers: [{ cron: "45 * * * *" }],
  },
  async ({ step }) => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const contas = contasGoogleAds();
    if (!url || !key || !contas.length) return { pulado: "sem credenciais" };
    const db = createClient(url, key, { auth: { persistSession: false } });

    // ── UMA LEITURA POR CONTA (17/10) ────────────────────────────
    //
    // A Serenata lê a conta nova e a suspensa (`contas-google-ads.ts`). Uma
    // conta que falha não apaga a outra: o upsert só reescreve o que chegou,
    // e o histórico de quem não respondeu fica como estava. Só lança se
    // NENHUMA respondeu, pro Inngest tentar de novo.
    const de = diaEm(DIAS - 1);
    const ate = diaEm(0);
    const linhas: Array<Record<string, Record<string, unknown>>> = [];
    const falhas: string[] = [];
    for (const conta of contas) {
      const r = await step.run(`ler-google-${conta.id}`, async () => {
        try {
          const acesso = await tokenGoogleAds();
          return { linhas: (await consultarGoogleAds(`
            SELECT campaign.id, campaign.name, campaign.status,
                   campaign.advertising_channel_type, segments.date,
                   metrics.cost_micros, metrics.clicks, metrics.impressions,
                   metrics.conversions
            FROM campaign
            WHERE segments.date BETWEEN '${de}' AND '${ate}'`, acesso, conta)) as Array<Record<string, Record<string, unknown>>>, erro: null };
        } catch (err) {
          console.error("[metricas-ads] conta", conta.id, "falhou:", err);
          return { linhas: [], erro: err instanceof Error ? err.message : String(err) };
        }
      });
      if (r.erro) falhas.push(`${conta.id}: ${r.erro}`);
      // O passo volta serializado (JSON): o tipo perde a forma, o conteúdo não.
      linhas.push(...(r.linhas as Array<Record<string, Record<string, unknown>>>));
    }
    if (falhas.length === contas.length) throw new Error("Google Ads: " + falhas.join(" | "));

    const metricas = new Map<string, Metrica>();
    const campanhas = new Map<string, { id: string; nome: string; status: string; tipo: string }>();
    for (const x of linhas) {
      const c = x.campaign as { id?: unknown; name?: unknown; status?: unknown; advertisingChannelType?: unknown };
      const m = x.metrics as Record<string, unknown>;
      const dia = String((x.segments as { date?: unknown })?.date ?? "");
      const id = String(c?.id ?? "");
      if (!id || !dia) continue;

      campanhas.set(id, {
        id,
        nome: String(c.name ?? id),
        status: String(c.status ?? ""),
        tipo: String(c.advertisingChannelType ?? ""),
      });

      // A mesma campanha volta em várias linhas quando o Google segmenta por
      // dentro; somar é o certo, sobrescrever perderia parte do gasto.
      const k = id + "|" + dia;
      const a = metricas.get(k) ?? {
        campanha_id: id, dia, custo_brl: 0, cliques: 0, impressoes: 0, conversoes_google: 0,
      };
      a.custo_brl += Number(m.costMicros ?? 0) / 1e6;
      a.cliques += Number(m.clicks ?? 0);
      a.impressoes += Number(m.impressions ?? 0);
      a.conversoes_google += Number(m.conversions ?? 0);
      metricas.set(k, a);
    }

    // ── OS NOMES PRIMEIRO ────────────────────────────────────────
    //
    // O painel junta `metricas_campanha` com `campanhas` pra mostrar o nome.
    // Métrica sem nome apareceria como um número de sete dígitos na tela.
    const nomes = await step.run("gravar-campanhas", async () => {
      const lista = [...campanhas.values()];
      if (!lista.length) return 0;
      const { error } = await db.from("campanhas").upsert(
        lista.map((c) => ({ ...c, atualizado_em: new Date().toISOString() })),
        { onConflict: "id" },
      );
      if (error) throw new Error("campanhas: " + error.message);
      return lista.length;
    });

    const gravadas = await step.run("gravar-metricas", async () => {
      const lista = [...metricas.values()].map((m) => ({
        ...m,
        custo_brl: Math.round(m.custo_brl * 100) / 100,
        conversoes_google: Math.round(m.conversoes_google * 100) / 100,
        atualizado_em: new Date().toISOString(),
      }));
      if (!lista.length) return 0;
      // Em lotes: 7 dias × dezenas de campanhas cabe folgado, mas o dia em que
      // não couber é o dia em que isto falharia calado por tamanho de corpo.
      for (let i = 0; i < lista.length; i += 200) {
        const { error } = await db
          .from("metricas_campanha")
          .upsert(lista.slice(i, i + 200), { onConflict: "campanha_id,dia" });
        if (error) throw new Error("metricas_campanha: " + error.message);
      }
      return lista.length;
    });

    return { campanhas: nomes, metricas: gravadas, dias: DIAS, contas: contas.length, falhas };
  },
);
