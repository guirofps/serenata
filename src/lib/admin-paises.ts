// VENDAS, CONVERSÃO E CPA POR PAÍS, no painel da Ballad (13/11/2026).
//
// A Ballad vende em sete mercados (`mercados.ts`) e o painel só mostrava o
// total. Uma linha por país: leads, vendas, receita, taxa de conversão, gasto
// do Google e CPA.
//
// DE ONDE VEM CADA NÚMERO
//
//  - O PAÍS é o do quiz (`quiz_responses.pais`), gravado quando o servidor da
//    letra toca no quiz pela primeira vez (`paisDaSessao`, `coautoria.ts`).
//    Consequência: quem largou o quiz ANTES da letra não tem país, e cai na
//    linha "Sem país". A conversão de cada país é, então, entre quem chegou à
//    letra: mais alta que a do cartão geral, que divide por todo mundo.
//  - VENDA é o pedido pago da MÚSICA (tem quiz), pelo país do quiz dela, mesmo
//    que o quiz seja de antes da janela (recuperação). Upsell não tem quiz e
//    fica de fora.
//  - O GASTO é o do Google (`metricas_campanha`, por campanha). A tabela não
//    tem país, então o gasto de cada campanha vai INTEIRO pro país de onde veio
//    a maioria dos leads dela no período: na Ballad cada campanha mira um país
//    só, e o lead de outro país é vazamento. Campanha que gastou e não trouxe
//    lead nenhum entra pelo NOME ("MEX 37", "100 Colômbia"…); sem lead e sem
//    país no nome, o gasto fica em "Sem país". Sem isso, o dinheiro perdido em
//    campanha ruim sumiria do CPA do país.
//  - O CPA é gasto do Google ÷ vendas do país que vieram do Google
//    (`canalDaVenda`), a mesma régua do cartão de CPA: venda de TikTok, e-mail
//    e orgânico no divisor faria o número parecer melhor do que é.
//
// Puro, como `admin-lps.ts`: `admin-dados.ts` passa as listas que já leu.

import type { CanalVenda } from "@/lib/canal-venda";
import { MERCADOS, normalizarPais } from "@/lib/mercados";

/** Lead que não chegou à letra, e gasto de campanha sem país conhecido. */
export const SEM_PAIS = "sem";
/** País fora dos mercados da Ballad (Brasil, Equador…), todos juntos. */
export const OUTROS_PAISES = "outros";

const NOMES: Record<string, string> = {
  US: "EUA",
  MX: "México",
  ES: "Espanha",
  CO: "Colômbia",
  CL: "Chile",
  PE: "Peru",
  AR: "Argentina",
  [OUTROS_PAISES]: "Outros países",
  [SEM_PAIS]: "Sem país",
};

/** A ordem de desempate das linhas: os mercados como estão em `mercados.ts`, depois outros e sem. */
const ORDEM = [...Object.keys(MERCADOS), OUTROS_PAISES, SEM_PAIS];

export type ResumoPais = {
  /** "US", "MX"…, `OUTROS_PAISES` ou `SEM_PAIS`. */
  pais: string;
  nome: string;
  /** Quizzes da janela com este país (chegaram à letra). Em `SEM_PAIS`, os que não chegaram. */
  leads: number;
  /** Pedidos pagos da música, pelo país do quiz. */
  vendas: number;
  receitaBrl: number;
  /** Vendas ÷ leads. `null` sem lead, e sempre `null` em `SEM_PAIS`. */
  conversaoPct: number | null;
  /** Gasto do Google das campanhas deste país. */
  gastoBrl: number;
  /** Vendas do país pelo canal Google: o divisor do CPA. */
  vendasGoogle: number;
  /** Gasto ÷ vendas do Google. `null` sem gasto ou sem venda do Google. */
  cpaBrl: number | null;
};

/** Palavra inteira, com letra acentuada contando como letra ("Peruíbe" não é Peru). */
const palavra = (p: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${p})(?![\\p{L}\\p{N}])`, "iu");

// `ES` sozinho NÃO entra: nos nomes das campanhas ele é a LÍNGUA ("ES 37 banda
// Aberto" roda nos EUA), não a Espanha.
const PELO_NOME: [string, RegExp][] = [
  ["MX", palavra("mex|mx|m[eé]xico")],
  ["CO", palavra("col[oô]mbia")],
  ["PE", palavra("per[uú]")],
  ["CL", palavra("chile")],
  ["ES", palavra("espanha|espa[nñ]a|spain")],
  ["AR", palavra("argentina|arg")],
  ["US", palavra("eua|usa|us|estados unidos|ee\\.?uu")],
];

/** O país que o NOME da campanha diz. Só serve de reserva: ver `paisDaCampanha`. */
export function paisPeloNome(nome: string | null | undefined): string | null {
  const n = String(nome ?? "");
  if (!n.trim()) return null;
  for (const [pais, re] of PELO_NOME) if (re.test(n)) return pais;
  return null;
}

/**
 * O país de uma campanha: o da maioria dos leads dela. No empate o nome
 * desempata (e, sem nome que ajude, a ordem alfabética, pra a resposta não
 * mudar de uma leitura pra outra). Sem lead com país, o nome; sem nome, `null`.
 */
export function paisDaCampanha(contagem: ReadonlyMap<string, number>, nome: string | null | undefined): string | null {
  let maior = 0;
  for (const n of contagem.values()) if (n > maior) maior = n;
  if (maior <= 0) return paisPeloNome(nome);
  const empatados = [...contagem.entries()].filter(([, n]) => n === maior).map(([p]) => p).sort();
  if (empatados.length === 1) return empatados[0];
  const doNome = paisPeloNome(nome);
  return doNome && empatados.includes(doNome) ? doNome : empatados[0];
}

/** O balde de um país gravado: mercado da Ballad, `outros` ou `sem`. */
function balde(pais: string | null | undefined): string {
  const p = normalizarPais(pais);
  if (!p) return SEM_PAIS;
  return Object.prototype.hasOwnProperty.call(MERCADOS, p) ? p : OUTROS_PAISES;
}

const duas = (n: number) => Math.round(n * 100) / 100;

export function resumoPaises(entrada: {
  /** Os leads da janela, com o id da campanha do primeiro toque (`chaveOrigem`). */
  leads: { id: string; campanha: string | null }[];
  /** O país de cada quiz: os da janela e os das vendas de quiz mais antigo. */
  paisDoQuiz: ReadonlyMap<string, string | null>;
  /** Vendas já filtradas por `ehVenda`, com a receita em real e o canal (`canalDaVenda`). */
  vendas: { quiz_response_id: string | null; receitaBrl: number; canal: CanalVenda }[];
  /** O gasto do Google no período, por campanha (todas, com ou sem lead). */
  custoPorCampanha: ReadonlyMap<string, number>;
  /** O nome das campanhas que gastaram sem trazer lead com país. */
  nomeDaCampanha: ReadonlyMap<string, string>;
}): ResumoPais[] {
  const linhas = new Map<string, ResumoPais>();
  const linha = (pais: string): ResumoPais => {
    let l = linhas.get(pais);
    if (!l) {
      l = { pais, nome: NOMES[pais] ?? pais, leads: 0, vendas: 0, receitaBrl: 0, conversaoPct: null, gastoBrl: 0, vendasGoogle: 0, cpaBrl: null };
      linhas.set(pais, l);
    }
    return l;
  };

  // Leads por país, e de quais países vieram os leads de cada campanha.
  const paisesDaCampanha = new Map<string, Map<string, number>>();
  for (const l of entrada.leads) {
    const b = balde(entrada.paisDoQuiz.get(l.id));
    linha(b).leads++;
    if (!l.campanha || b === SEM_PAIS) continue;
    const m = paisesDaCampanha.get(l.campanha) ?? new Map<string, number>();
    m.set(b, (m.get(b) ?? 0) + 1);
    paisesDaCampanha.set(l.campanha, m);
  }

  // Vendas da música, pelo país do quiz. Upsell (sem quiz) não é de país nenhum.
  for (const v of entrada.vendas) {
    if (!v.quiz_response_id) continue;
    const l = linha(balde(entrada.paisDoQuiz.get(v.quiz_response_id)));
    l.vendas++;
    l.receitaBrl += v.receitaBrl;
    if (v.canal === "google") l.vendasGoogle++;
  }

  // O gasto de cada campanha, inteiro, pro país dela.
  for (const [campanha, custo] of entrada.custoPorCampanha) {
    if (!(custo > 0)) continue;
    const pais = paisDaCampanha(paisesDaCampanha.get(campanha) ?? new Map(), entrada.nomeDaCampanha.get(campanha));
    linha(pais ?? SEM_PAIS).gastoBrl += custo;
  }

  const posicao = (p: string) => {
    const i = ORDEM.indexOf(p);
    return i < 0 ? ORDEM.length : i;
  };
  return [...linhas.values()]
    .filter((l) => l.leads > 0 || l.vendas > 0 || l.gastoBrl > 0)
    .map((l) => ({
      ...l,
      receitaBrl: duas(l.receitaBrl),
      gastoBrl: duas(l.gastoBrl),
      conversaoPct: l.pais !== SEM_PAIS && l.leads > 0 ? duas((l.vendas / l.leads) * 100) : null,
      cpaBrl: l.pais !== SEM_PAIS && l.gastoBrl > 0 && l.vendasGoogle > 0 ? duas(l.gastoBrl / l.vendasGoogle) : null,
    }))
    .sort(
      (a, b) =>
        Number(a.pais === SEM_PAIS) - Number(b.pais === SEM_PAIS) ||
        b.vendas - a.vendas ||
        b.leads - a.leads ||
        b.gastoBrl - a.gastoBrl ||
        posicao(a.pais) - posicao(b.pais),
    );
}
