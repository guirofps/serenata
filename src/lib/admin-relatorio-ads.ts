import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { lerRelatorioCampanhas } from "@/lib/relatorio-ads";

// IMPORTA O RELATÓRIO DE CAMPANHA DO GOOGLE ADS.
//
// Duas tabelas de uma vez, e as duas com a mesma carga:
//   `campanhas`          id -> nome (o painel mostra nome em vez de número)
//   `metricas_campanha`  custo, cliques, impressões por dia
//
// Cruzando com a receita de `pedidos` (que já é tempo real), isso dá ROAS por
// campanha — o número que decide o que matar e o que escalar.
//
// ── O PARSER MORA EM OUTRO ARQUIVO, DE PROPÓSITO ─────────────────
//
// `relatorio-ads.ts` só transforma texto em dados, sem tocar no banco, e por
// isso tem 14 casos de teste. Este arquivo só escreve. Parser misturado com
// escrita é parser que ninguém testa — e este vira CUSTO, que vira ROAS.

export type ResultadoImportacao = {
  ok: boolean;
  /** Quantas linhas de métrica entraram. */
  linhas: number;
  /** Quantas campanhas ganharam ou atualizaram nome. */
  campanhas: number;
  dias: string[];
  /** Custo total do que foi importado, pra conferir de bate-pronto. */
  custoBrl: number;
  avisos: string[];
};

/** Teto de tamanho: o relatório é colado, e texto colado não tem limite natural. */
const MAX_CHARS = 4_000_000;

export const importarRelatorioAds = createServerFn({ method: "POST" })
  .validator((data: { csv: string; dia?: string | null }) => data)
  .handler(async ({ data }): Promise<ResultadoImportacao> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();

    const csv = String(data.csv ?? "");
    if (csv.length > MAX_CHARS) {
      return { ok: false, linhas: 0, campanhas: 0, dias: [], custoBrl: 0, avisos: ["Arquivo grande demais."] };
    }

    // `dia` só é usado quando o arquivo não tem coluna de dia. Ver o bloco
    // "SEM COLUNA DE DIA" em `relatorio-ads.ts`: ele NUNCA sobrepõe um
    // preâmbulo que declara várias datas.
    const { metricas, avisos } = lerRelatorioCampanhas(csv, { dia: data.dia ?? null });
    if (!metricas.length) {
      return { ok: false, linhas: 0, campanhas: 0, dias: [], custoBrl: 0, avisos };
    }

    const db = supabaseAdmin();

    // ── OS NOMES ────────────────────────────────────────────────
    //
    // Um por campanha, com o dado do dia MAIS RECENTE do arquivo: status e
    // nome mudam com o tempo, e o que interessa na tela é o de agora.
    const porId = new Map<string, (typeof metricas)[number]>();
    for (const m of metricas) {
      const antes = porId.get(m.campanhaId);
      if (!antes || m.dia > antes.dia) porId.set(m.campanhaId, m);
    }
    const nomes = [...porId.values()].map((m) => ({
      id: m.campanhaId,
      nome: m.nome,
      status: m.status,
      tipo: m.tipo,
      atualizado_em: new Date().toISOString(),
    }));
    const { error: erroNomes } = await db.from("campanhas").upsert(nomes, { onConflict: "id" });
    if (erroNomes) {
      console.error("[admin] nomes de campanha falharam:", erroNomes.message);
      avisos.push(`Nomes não gravaram: ${erroNomes.message}`);
    }

    // ── AS MÉTRICAS ─────────────────────────────────────────────
    //
    // Em blocos: um relatório de 30 dias × 15 campanhas são 450 linhas, e
    // mandar tudo numa tacada é o tipo de coisa que funciona até o dia em que
    // o período é maior.
    let gravadas = 0;
    for (let i = 0; i < metricas.length; i += 400) {
      const bloco = metricas.slice(i, i + 400).map((m) => ({
        campanha_id: m.campanhaId,
        dia: m.dia,
        custo_brl: m.custoBrl,
        cliques: m.cliques,
        impressoes: m.impressoes,
        conversoes_google: m.conversoesGoogle,
        atualizado_em: new Date().toISOString(),
      }));
      const { error } = await db
        .from("metricas_campanha")
        .upsert(bloco, { onConflict: "campanha_id,dia" });
      if (error) {
        console.error("[admin] métricas falharam:", error.message);
        avisos.push(`Bloco não gravou: ${error.message}`);
        continue;
      }
      gravadas += bloco.length;
    }

    const dias = [...new Set(metricas.map((m) => m.dia))].sort();
    return {
      ok: gravadas > 0,
      linhas: gravadas,
      campanhas: nomes.length,
      dias,
      custoBrl: Math.round(metricas.reduce((a, m) => a + m.custoBrl, 0) * 100) / 100,
      avisos,
    };
  });
