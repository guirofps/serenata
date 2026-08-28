// O RELATÓRIO DE CAMPANHA DO GOOGLE ADS, lido de um CSV colado.
//
// ── POR QUE UM ARQUIVO, E NÃO A API ──────────────────────────────
//
// A API resolveria isto sozinha e é pra onde vai um dia. Ela exige developer
// token com Basic access, que passa por revisão do Google e leva dias. Este
// caminho funciona hoje, e continua servindo depois: campanha excluída some
// da API, e o histórico dela fica aqui.
//
// ── O QUE ELE DESTRAVA ───────────────────────────────────────────
//
// A receita por campanha o painel já mostra em tempo real, lida do nosso
// banco. Falta o CUSTO — e sem custo não existe ROAS, só faturamento. Saber
// que uma campanha fez R$ 437 não diz nada até se saber se ela custou R$ 200
// ou R$ 900.
//
// ── ESTE ARQUIVO NÃO TOCA NO BANCO, DE PROPÓSITO ─────────────────
//
// Ele só transforma texto em dados, e por isso dá pra testar de verdade — com
// o cabeçalho real do Google, com a vírgula decimal brasileira, com a linha
// de total que não é campanha, com coluna faltando. Parser misturado com
// escrita é parser que ninguém testa.

export type MetricaCampanha = {
  /** `AAAA-MM-DD`. */
  dia: string;
  campanhaId: string;
  nome: string;
  status: string | null;
  tipo: string | null;
  custoBrl: number;
  cliques: number;
  impressoes: number;
  /** Conversões que o GOOGLE contou. Não é a nossa venda, e não deve virar. */
  conversoesGoogle: number;
};

export type LeituraRelatorio = {
  metricas: MetricaCampanha[];
  /** O que foi ignorado e por quê. Aparece na tela: importação silenciosa mente. */
  avisos: string[];
};

/**
 * Uma linha de CSV, respeitando aspas.
 *
 * Escrito à mão e não com `split(",")` porque nome de campanha tem vírgula
 * ("Busca: Música, homenagem") e o Google entrega isso entre aspas. Um split
 * cru deslocaria todas as colunas seguintes — e o custo entraria na coluna do
 * clique sem ninguém perceber.
 */
export function linhaCsv(linha: string): string[] {
  const out: string[] = [];
  let atual = "";
  let dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      // Aspas dobradas dentro de campo entre aspas viram uma aspa literal.
      if (dentro && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentro = !dentro;
      }
    } else if (c === "," && !dentro) {
      out.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  out.push(atual);
  return out.map((s) => s.trim());
}

/**
 * `1.234,56` -> 1234.56. `--` e vazio viram 0.
 *
 * O Google exporta no formato do idioma da conta. Em português é ponto de
 * milhar e vírgula decimal, e ler isso com `Number()` daria `NaN` — que
 * viraria custo zero e ROAS infinito, o erro mais convincente que existe.
 */
export function numeroBr(cru: string): number {
  const t = (cru ?? "").replace(/\s/g, "").replace(/[R$%]/g, "");
  if (!t || t === "--" || t === "-") return 0;

  // QUEM VEM POR ÚLTIMO É O DECIMAL. Regra única que resolve os dois idiomas
  // sem precisar saber qual está configurado na conta:
  //
  //   1.234,56  (pt-BR)  vírgula depois  -> vírgula é decimal
  //   1,234.56  (en-US)  ponto depois    -> ponto é decimal
  //
  // A primeira versão assumia "tem vírgula, então vírgula é decimal", e lia
  // `1,234.56` como 1,23 — mil vezes menos. Num campo que vira CUSTO, e custo
  // vira ROAS, esse erro não aparece: ele só faz uma campanha ruim parecer
  // ótima.
  const ultVirgula = t.lastIndexOf(",");
  const ultPonto = t.lastIndexOf(".");
  let normal: string;
  if (ultVirgula >= 0 && ultPonto >= 0) {
    normal =
      ultVirgula > ultPonto
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "");
  } else if (ultVirgula >= 0) {
    normal = t.replace(",", ".");
  } else {
    // Só ponto: ambíguo. `1.234` é mil e duzentos em pt-BR e um vírgula dois
    // em en-US. A conta é brasileira, então ponto seguido de exatamente três
    // dígitos até o fim é milhar.
    normal = t.replace(/\.(?=\d{3}(?:\D|$))/g, "");
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : 0;
}

/** `27/08/2026`, `2026-08-27` e `27 de ago. de 2026` -> `2026-08-27`. */
export function diaIso(cru: string): string | null {
  const t = (cru ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const MES: Record<string, string> = {
    jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
    jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  };
  const ext = t.toLowerCase().match(/^(\d{1,2})\s*de\s*([a-zç]{3})\.?\s*de\s*(\d{4})$/);
  if (ext && MES[ext[2]]) return `${ext[3]}-${MES[ext[2]]}-${ext[1].padStart(2, "0")}`;
  return null;
}

/** Acha a coluna por qualquer um dos nomes possíveis, sem acento e sem caixa. */
function acharColuna(cabecalho: string[], nomes: string[]): number {
  const limpo = cabecalho.map((c) =>
    c.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim(),
  );
  for (const n of nomes) {
    const i = limpo.indexOf(n);
    if (i >= 0) return i;
  }
  // Segundo passe, por prefixo: o Google muda "Custo" pra "Custo (BRL)" e
  // "Conversões" pra "Conversões (por interação)" dependendo da conta.
  for (const n of nomes) {
    const i = limpo.findIndex((c) => c.startsWith(n));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Lê o relatório inteiro.
 *
 * EXIGE a coluna de dia. O relatório padrão do Google vem AGREGADO no período,
 * e importar isso como se fosse um dia só inventaria um custo diário que nunca
 * existiu — o número ficaria bonito e errado. Sem a coluna, recusa e explica
 * que é pra segmentar por dia na exportação.
 */
export function lerRelatorioCampanhas(csv: string): LeituraRelatorio {
  const avisos: string[] = [];
  const linhas = (csv ?? "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!linhas.length) return { metricas: [], avisos: ["Arquivo vazio."] };

  // O export do Google tem duas ou três linhas de preâmbulo (título e
  // período) antes do cabeçalho de verdade. Acha a linha que tem "campanha".
  const iCab = linhas.findIndex((l) => {
    const c = linhaCsv(l).map((x) => x.toLowerCase());
    return c.some((x) => x.startsWith("campanha")) && c.length >= 3;
  });
  if (iCab < 0) return { metricas: [], avisos: ["Não achei o cabeçalho com a coluna Campanha."] };

  const cab = linhaCsv(linhas[iCab]);
  const cId = acharColuna(cab, ["id da campanha", "campaign id", "id"]);
  const cNome = acharColuna(cab, ["campanha", "campaign"]);
  const cDia = acharColuna(cab, ["dia", "data", "day", "date"]);
  const cCusto = acharColuna(cab, ["custo", "cost"]);
  const cCliques = acharColuna(cab, ["cliques", "clicks"]);
  const cImpr = acharColuna(cab, ["impr.", "impressoes", "impressions", "impr"]);
  const cConv = acharColuna(cab, ["conversoes", "conversions"]);
  const cStatus = acharColuna(cab, ["status da campanha", "campaign state", "status"]);
  const cTipo = acharColuna(cab, ["tipo de campanha", "campaign type"]);

  if (cNome < 0) return { metricas: [], avisos: ["Não achei a coluna Campanha."] };
  if (cId < 0) {
    return {
      metricas: [],
      avisos: [
        "Falta a coluna 'ID da campanha'. É por ela que a venda casa com o gasto — " +
          "o nome muda, o ID não. Adicione essa coluna na exportação.",
      ],
    };
  }
  if (cDia < 0) {
    return {
      metricas: [],
      avisos: [
        "Falta a coluna 'Dia'. O relatório veio somado no período, e importar isso " +
          "como um dia só inventaria um custo diário que nunca existiu. " +
          "Na exportação, segmente por dia.",
      ],
    };
  }
  if (cCusto < 0) avisos.push("Sem coluna de Custo: as linhas entram com custo zero.");

  const metricas: MetricaCampanha[] = [];
  for (const linha of linhas.slice(iCab + 1)) {
    const col = linhaCsv(linha);
    const id = (col[cId] ?? "").replace(/\D/g, "");
    const nome = col[cNome] ?? "";
    const dia = diaIso(col[cDia] ?? "");

    // A LINHA DE TOTAL não é campanha. O Google fecha o arquivo com
    // "Total: contas", "Total: campanhas" etc., sem id e sem dia — e somá-la
    // dobraria o gasto do período inteiro.
    if (!id || !dia) {
      if (/^total/i.test(nome)) continue;
      if (nome) avisos.push(`Linha ignorada (sem ID ou sem dia): ${nome.slice(0, 60)}`);
      continue;
    }

    metricas.push({
      dia,
      campanhaId: id,
      nome,
      status: cStatus >= 0 ? (col[cStatus] || null) : null,
      tipo: cTipo >= 0 ? (col[cTipo] || null) : null,
      custoBrl: cCusto >= 0 ? numeroBr(col[cCusto] ?? "") : 0,
      cliques: cCliques >= 0 ? Math.round(numeroBr(col[cCliques] ?? "")) : 0,
      impressoes: cImpr >= 0 ? Math.round(numeroBr(col[cImpr] ?? "")) : 0,
      conversoesGoogle: cConv >= 0 ? numeroBr(col[cConv] ?? "") : 0,
    });
  }

  if (!metricas.length) avisos.push("Nenhuma linha de campanha aproveitável.");
  return { metricas, avisos };
}
