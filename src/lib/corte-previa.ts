// ONDE A PRÉVIA CORTA (teste `previa_refrao`, 08/10).
//
// Hoje a prévia corta num relógio fixo (40s). Medido em produção: 80% de quem
// NÃO clicou em comprar na oferta tinha dado play, e 73% bateu no limite. A
// hipótese do braço B é que 40s param ANTES do pico: no formato da nossa letra
// ([Short Intro] → [Verse 1] → [Chorus]), o primeiro refrão, onde o nome de
// quem recebe costuma ser cantado, termina perto de um minuto.
//
// Aqui só mora a CONTA, pura e testada. Quem decide o braço e trava o áudio é
// o `MusicaKaraoke`.
//
// ── DE ONDE VEM O TEMPO ─────────────────────────────────────────
//
// Dos timestamps do provedor (`musicas.timestamps`, gravados por
// `obterTimestamps` em `inngest/lib/kie.ts`): uma lista plana de
// `{ word, start, end }` em segundos, com o marcador de seção e a quebra de
// linha DENTRO da palavra:
//
//   { word: "[Chorus]\nDezoito ", start: 43.92, end: 44.60 }
//   { word: "presentão\n\n",      start: 55.93, end: 58.89 }
//
// O marcador é o caminho principal. Quando ele não vem, a letra (`letra`)
// diz quantas linhas há antes do refrão e quantas ele tem, e a conta confere
// a primeira palavra antes de confiar na posição.
//
// ── QUANDO NÃO DÁ, É O CORTE DE HOJE ────────────────────────────
//
// Sem timestamps (a prévia por stream, que chega ~60s antes deles), sem
// refrão achado ou com o refrão longe demais, o corte é o de sempre. O braço
// B nunca corta ANTES do A.

/** O corte de hoje. É o piso do braço B e o corte inteiro do braço A. */
export const PREVIA_PADRAO_S = 40;

/**
 * O teto do braço B: 75s no total (35s a mais que hoje).
 *
 * Nas músicas reais o primeiro refrão termina entre ~55s e ~65s. Acima de 75s
 * já é mais de um terço de uma música de 3 minutos de graça, e a prévia deixa
 * de ser prévia.
 */
export const PREVIA_MAX_S = 75;

/**
 * Quanto a última palavra pode "segurar". O `end` do provedor às vezes engole
 * o instrumental até a próxima seção ("contar\n\n": 10,19 → 14,07): sem teto,
 * o corte esperaria o solo inteiro.
 */
const SUSTENTA_MAX_S = 3;

/** Um respiro depois da última palavra, pra nota assentar antes da pausa. */
const RESPIRO_S = 0.4;

/**
 * Folga antes da próxima palavra. A trava roda no `timeupdate`, que dispara
 * ~4x por segundo: sem a folga, até 250ms da estrofe seguinte vazavam.
 */
const FOLGA_PROXIMA_S = 0.25;

export type MotivoCorte =
  /** Cortou no fim do primeiro refrão. */
  | "refrao"
  /** O refrão passava do teto: cortou no fim da última linha dele que cabe. */
  | "refrao_parcial"
  /** O refrão acaba antes de 40s: fica o corte de hoje. */
  | "refrao_cedo"
  /** Nem a primeira linha do refrão cabe no teto: corte de hoje. */
  | "refrao_tarde"
  /** Timestamps vazios ou ausentes (prévia por stream): corte de hoje. */
  | "sem_timestamps"
  /** Timestamps existem, mas o refrão não foi achado com segurança. */
  | "sem_refrao";

export type CorteDaPrevia = { s: number; motivo: MotivoCorte };

type PalavraCrua = { word?: unknown; start?: unknown; end?: unknown };
type Palavra = { texto: string; start: number; end: number };
type Item = { tipo: "marcador"; rotulo: string } | { tipo: "verso"; palavras: Palavra[] };

/** "[Chorus]", "[Refrão]", "[Coro]"... mas NUNCA "[Pre-Chorus]". */
export function ehRefrao(marcador: string): boolean {
  const rotulo = marcador.replace(/[[\]]/g, "").trim();
  return /^(chorus|refr[aã]o|coro|estribillo)\b/i.test(rotulo);
}

const MARCADOR = /\[[^\]]*\]/g;

/** Palavras do provedor → linhas e marcadores, na ordem em que são cantados. */
function itensDosTimestamps(words: readonly PalavraCrua[]): Item[] {
  const itens: Item[] = [];
  let atual: Palavra[] = [];
  const fechar = () => {
    if (atual.length) itens.push({ tipo: "verso", palavras: atual });
    atual = [];
  };

  for (const w of words) {
    if (!w || typeof w.word !== "string") continue;
    const start = Number(w.start);
    const end = Number(w.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const partes = w.word.split("\n");
    for (let p = 0; p < partes.length; p++) {
      if (p > 0) fechar(); // cada \n encerra a linha corrente
      const parte = partes[p];
      // Marcador colado no texto sem quebra ("[Chorus] Você") também conta.
      let ultimo = 0;
      for (const m of parte.matchAll(MARCADOR)) {
        const antes = parte.slice(ultimo, m.index).trim();
        if (antes) atual.push({ texto: antes, start, end });
        fechar();
        itens.push({ tipo: "marcador", rotulo: m[0] });
        ultimo = (m.index ?? 0) + m[0].length;
      }
      const resto = parte.slice(ultimo).trim();
      if (resto) atual.push({ texto: resto, start, end });
    }
  }
  fechar();
  return itens;
}

/** Só letras, minúsculas e sem acento: "Dezoito," e "dezoito" são a mesma. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function primeiraPalavra(s: string): string {
  return normalizar(s).split(" ")[0] ?? "";
}

/** As linhas do primeiro refrão pelos marcadores que vieram nos timestamps. */
function refraoPelosMarcadores(itens: Item[]): Palavra[][] | null {
  const i = itens.findIndex((it) => it.tipo === "marcador" && ehRefrao(it.rotulo));
  if (i < 0) return null;
  const linhas: Palavra[][] = [];
  for (let j = i + 1; j < itens.length; j++) {
    const it = itens[j];
    if (it.tipo === "marcador") break;
    linhas.push(it.palavras);
  }
  return linhas.length ? linhas : null;
}

/**
 * Sem marcador nos timestamps: conta as linhas da LETRA. Quantas vêm antes do
 * primeiro [Chorus] e quantas ele tem, e pega a mesma posição nas linhas
 * cantadas.
 *
 * Só confia se a primeira palavra da linha cantada na posição bater com a
 * primeira palavra do refrão na letra. O Suno segue a letra (95% medido), mas
 * uma linha a mais ou a menos desloca tudo, e cortar no lugar errado é pior
 * que cortar no de hoje.
 */
function refraoPelaLetra(itens: Item[], letra: string): Palavra[][] | null {
  const linhasLetra = letra
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let antes = 0;
  let achou = false;
  const refrao: string[] = [];
  for (const l of linhasLetra) {
    const ehMarcador = /^\[.*\]$/.test(l);
    if (!achou) {
      if (ehMarcador && ehRefrao(l)) achou = true;
      else if (!ehMarcador) antes++;
      continue;
    }
    if (ehMarcador) break;
    refrao.push(l);
  }
  if (!achou || !refrao.length) return null;

  const cantadas = itens.filter(
    (it): it is Extract<Item, { tipo: "verso" }> => it.tipo === "verso",
  );
  if (cantadas.length < antes + refrao.length) return null;
  const linhas = cantadas.slice(antes, antes + refrao.length).map((it) => it.palavras);
  const alvo = primeiraPalavra(refrao[0]);
  if (!alvo || primeiraPalavra(linhas[0][0].texto) !== alvo) return null;
  return linhas;
}

/** Onde cortar depois de uma linha: a última palavra assenta, a próxima não entra. */
function fimDaLinha(linha: Palavra[], proxima: Palavra | undefined): number {
  const ultima = linha[linha.length - 1];
  let fim = Math.min(ultima.end, ultima.start + SUSTENTA_MAX_S) + RESPIRO_S;
  if (proxima) fim = Math.min(fim, proxima.start - FOLGA_PROXIMA_S);
  // Nunca antes de a última palavra começar a soar.
  return Math.max(fim, ultima.start + 0.5);
}

const arredondar = (s: number) => Math.round(s * 100) / 100;

/**
 * O segundo em que a prévia do braço B corta: o fim do primeiro refrão,
 * dentro de [PREVIA_PADRAO_S, PREVIA_MAX_S]. Fora disso, ou sem dado, o
 * corte de hoje.
 */
export function corteDaPrevia(
  words: readonly PalavraCrua[] | null | undefined,
  letra?: string | null,
): CorteDaPrevia {
  const padrao = (motivo: MotivoCorte): CorteDaPrevia => ({ s: PREVIA_PADRAO_S, motivo });
  if (!Array.isArray(words) || !words.length) return padrao("sem_timestamps");

  const itens = itensDosTimestamps(words);
  if (!itens.some((it) => it.tipo === "verso")) return padrao("sem_timestamps");

  const refrao = refraoPelosMarcadores(itens) ?? (letra ? refraoPelaLetra(itens, letra) : null);
  if (!refrao) return padrao("sem_refrao");

  // A palavra cantada logo depois de cada linha do refrão (a da linha
  // seguinte, ou a primeira da próxima seção).
  const todas = itens.flatMap((it) => (it.tipo === "verso" ? [it.palavras] : []));
  const fins = refrao.map((linha) => {
    const k = todas.indexOf(linha);
    return fimDaLinha(linha, todas[k + 1]?.[0]);
  });

  const fimDoRefrao = fins[fins.length - 1];
  if (fimDoRefrao <= PREVIA_MAX_S) {
    if (fimDoRefrao < PREVIA_PADRAO_S) return padrao("refrao_cedo");
    return { s: arredondar(fimDoRefrao), motivo: "refrao" };
  }

  // O refrão passa do teto: o fim da última linha dele que ainda cabe.
  const cabe = fins.filter((f) => f <= PREVIA_MAX_S);
  if (!cabe.length) return padrao("refrao_tarde");
  const melhor = cabe[cabe.length - 1];
  if (melhor < PREVIA_PADRAO_S) return padrao("refrao_tarde");
  return { s: arredondar(melhor), motivo: "refrao_parcial" };
}
