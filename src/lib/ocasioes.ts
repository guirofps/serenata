// AS DATAS DO CALENDÁRIO QUE VENDEM, e para quem falar em cada uma.
//
// ── POR QUE ISTO EXISTE, SE JÁ HÁ UM `volteCriar` ────────────────
//
// O `volteCriar` convida a criar outra música 5 a 30 dias depois da compra,
// com texto genérico, uma vez por pessoa para sempre. Medido no Raio-X de
// 07/09: **511 envios, zero vendas.**
//
// Ele falha por duas coisas que não dá pra consertar dentro dele:
//
//   QUANDO  o gatilho é "faz X dias que você comprou", que não é motivo
//           nenhum pra presentear alguém. Data de calendário é.
//   PARA QUEM  ele não diz de quem seria a música. E a gente SABE: `relacao`
//           vem preenchida em 100% dos quizzes e `filhos` em 26%, com os
//           nomes escritos pela própria pessoa.
//
// Medido em 08/09, sobre 2.313 compradores de 90 dias:
//
//   99%  nunca fizeram uma música para a MÃE
//   99%  nunca fizeram para o PAI
//   97%  nunca fizeram para um FILHO
//   606  (26,2%) nos deram o NOME do filho
//
// A base inteira fez música romântica pra parceira (63% esposa, 11%
// namorada). O espaço de recompra não é "mais uma pra ela", é todo o resto
// da família, e ele está intocado.
//
// ── O MEMORIAL NUNCA RECEBE ──────────────────────────────────────
//
// 1,5% dos quizzes são `ocasiao = memorial`: gente que perdeu alguém e pediu
// uma música em memória. Oferta alegre ali não é erro de marketing, é falta
// de leitura. O filtro é duro e vale para toda ocasião, sempre.

export type Ocasiao = {
  /** Entra no template do e-mail e na chave de registro. Só [a-z0-9-]. */
  slug: string;
  nome: string;
  /** Dia do ano, `MM-DD`. O ano vem do relógio: a régua se repete sozinha. */
  dia: string;
  /**
   * Janela de disparo, em dias ANTES da data.
   *
   * Começa cedo o bastante pra pessoa ter tempo de montar e entregar (a
   * música fica pronta em minutos, mas o presente é entregue por ela), e
   * fecha antes da véspera: e-mail de presente que chega no dia é tarde.
   */
  comecaDiasAntes: number;
  terminaDiasAntes: number;
  /**
   * Qual campo do quiz precisa estar preenchido pra pessoa entrar.
   * `null` = todo comprador (fora as exclusões duras).
   */
  exigeCampo: "filhos" | null;
  /**
   * Relações que JÁ receberam música. Quem fez pra essa relação não recebe:
   * a graça da oferta é falar de quem ainda não tem.
   */
  pulaSeJaFezPara: string[];
};

export const OCASIOES: Ocasiao[] = [
  {
    slug: "criancas",
    nome: "Dia das Crianças",
    dia: "10-12",
    // 21 dias dá tempo de a pessoa decidir, montar e entregar sem correria.
    // Fecha 3 dias antes: presente que chega na véspera vira estresse.
    comecaDiasAntes: 21,
    terminaDiasAntes: 3,
    // Só quem escreveu o nome do filho no quiz. Sem o nome o e-mail vira
    // genérico, e genérico é exatamente o que o `volteCriar` já provou que
    // não funciona.
    exigeCampo: "filhos",
    pulaSeJaFezPara: ["filho", "filha"],
  },
  {
    slug: "natal",
    nome: "Natal",
    dia: "12-25",
    // Janela maior: em dezembro a pessoa compra presente pra várias pessoas
    // e decide cedo.
    comecaDiasAntes: 30,
    terminaDiasAntes: 5,
    exigeCampo: null,
    pulaSeJaFezPara: [],
  },
  {
    slug: "maes",
    nome: "Dia das Mães",
    dia: "05-10",
    comecaDiasAntes: 21,
    terminaDiasAntes: 3,
    exigeCampo: null,
    // 99% nunca fizeram pra mãe: é o maior espaço vazio da base inteira.
    pulaSeJaFezPara: ["mae", "mãe"],
  },
];

/** `memorial` fica fora de toda oferta alegre. Ver o cabeçalho. */
export const OCASIAO_PROIBIDA = "memorial";

/**
 * A ocasião que está na janela HOJE, ou `null`.
 *
 * Devolve uma só: duas ofertas de calendário na mesma semana, pra mesma
 * pessoa, é perseguição. Se as janelas se cruzarem, ganha a mais próxima.
 */
export function ocasiaoDeHoje(agora: Date = new Date()): { ocasiao: Ocasiao; ano: number } | null {
  // Fuso de Brasília: o cron roda em UTC e a virada do dia importa aqui,
  // porque a janela é contada em dias inteiros.
  const hoje = new Date(agora.getTime() - 3 * 3600000);
  const candidatos: Array<{ ocasiao: Ocasiao; ano: number; faltam: number }> = [];

  for (const o of OCASIOES) {
    const [mes, dia] = o.dia.split("-").map(Number);
    // Este ano e o que vem: em dezembro, o Dia das Mães que importa é o do
    // ano seguinte, e sem isso a janela nunca abriria pra ele.
    for (const ano of [hoje.getUTCFullYear(), hoje.getUTCFullYear() + 1]) {
      const data = Date.UTC(ano, mes - 1, dia);
      const faltam = Math.floor((data - Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())) / 86400000);
      if (faltam <= o.comecaDiasAntes && faltam >= o.terminaDiasAntes) {
        candidatos.push({ ocasiao: o, ano, faltam });
      }
    }
  }
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => a.faltam - b.faltam);
  return { ocasiao: candidatos[0].ocasiao, ano: candidatos[0].ano };
}

/**
 * O template registrado em `emails_enviados`, com o ANO dentro.
 *
 * É o que permite a mesma pessoa receber Dia das Crianças em 2026 e de novo
 * em 2027 sem que a trava de "já mandei" a bloqueie para sempre — e ao mesmo
 * tempo garante que ela não receba duas vezes na mesma temporada.
 */
export const templateDaOcasiao = (slug: string, ano: number) => `ocasiao_${slug}_${ano}`;

/**
 * O primeiro nome escrito no campo `filhos`.
 *
 * O campo é livre e vem como "João Myguell", "Sara e Isaque", "Jennefer e
 * kauã". Pro assunto do e-mail um nome basta, e o primeiro é o que a pessoa
 * escreveu primeiro. Devolve `null` quando não dá pra extrair nada limpo —
 * e aí ela não entra na leva, porque sem nome o e-mail vira genérico.
 */
/**
 * Palavras que NÃO são nome, e que aparecem porque muita gente rotula o
 * campo antes de responder: "Filhos Marianne, Gabriela e P", "Filha mais
 * velha: Denize". O ensaio de 08/09 pegou as duas indo pro assunto como se
 * fossem nome de criança — "Filhos nunca teve uma música só dele".
 */
const ROTULOS = new Set([
  "filho", "filha", "filhos", "filhas", "menino", "menina", "meninos", "meninas",
  "bebe", "bebê", "crianca", "criança", "criancas", "crianças", "neto", "neta",
  "netos", "netas", "sobrinho", "sobrinha", "nome", "nomes", "sao", "são",
  "meu", "minha", "meus", "minhas", "o", "a", "os", "as", "e", "de", "da", "do",
  "nao", "não", "nenhum", "nenhuma", "tenho", "temos", "mais",
]);

export function primeiroNome(campo: unknown): string | null {
  const cru = String(campo ?? "").trim();
  if (!cru) return null;

  // DOIS-PONTOS SIGNIFICA "rótulo: valor", e o nome está do lado direito.
  // "Filha mais velha: Denize" tem três palavras antes do nome, e nenhuma
  // lista de rótulos cobriria "velha" — a estrutura cobre. Começar depois
  // do primeiro `:` resolve a família toda desses formatos de uma vez.
  const depoisDoRotulo = cru.includes(":") ? cru.slice(cru.indexOf(":") + 1).trim() : "";
  const bruto = depoisDoRotulo || cru;

  const pedacos = bruto.split(/\s*(?:,|;|\/|\be\b|\+|&)\s*/i);

  // Percorre os pedaços e as palavras dentro deles até achar algo que
  // pareça nome de gente. Sem isso, um rótulo no começo derruba a pessoa
  // inteira da leva, mesmo com nomes bons logo depois.
  for (const pedaco of pedacos) {
    for (const palavra of pedaco.split(/\s+/)) {
      const nome = palavra.trim();
      // Duas letras no mínimo, e nada de número ou símbolo: o campo é livre
      // e recebe de tudo, inclusive "-" e "nao tenho".
      if (nome.length < 2 || !/^[\p{L}][\p{L}'-]*$/u.test(nome)) continue;
      if (ROTULOS.has(nome.toLowerCase())) continue;
      return nome.charAt(0).toUpperCase() + nome.slice(1);
    }
  }
  return null;
}
