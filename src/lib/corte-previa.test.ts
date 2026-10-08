import { describe, expect, it } from "vitest";
import {
  PREVIA_B_SEM_TIMESTAMPS_S,
  PREVIA_MAX_S,
  PREVIA_PADRAO_S,
  corteDaPrevia,
  corteNoAudio,
  ehRefrao,
  proximoCorte,
} from "./corte-previa";

// FORMATO REAL de `musicas.timestamps` (alignedWords da kie.ai, mapeado em
// `obterTimestamps`): marcador e quebra de linha DENTRO da palavra, `end` da
// última palavra de cada seção engolindo o instrumental. Os TEMPOS são os de
// uma música real de 2026 (intro, verso 1, primeiro refrão e começo do verso
// 2); as palavras foram trocadas por texto neutro, pra não guardar a letra de
// um cliente no repositório.
const w = (word: string, start: number, end: number) => ({ word, start, end });

const INTRO_E_VERSO = [
  w("[Short Intro - máx 8s]\nAmor, ", 8.537, 9.07575),
  w("vem ", 9.1355, 9.255),
  w("ouvir ", 9.335, 9.415),
  w("isso\n\n", 10.19275, 14.06754),
  w("[Verse 1]\nAmanhã ", 14.09208, 16.197),
  w("faz ", 16.3165, 16.835),
  w("um ", 16.86914, 17.394),
  w("ano\n", 18.1515, 20.745),
  w("E ", 20.904, 20.984),
  w("eu ", 21.144, 21.223),
  w("quero ", 22.0368, 22.58),
  w("contar\n", 25.23275, 27.527),
  w("Tudo ", 27.6465, 28.245),
  w("que ", 28.3645, 28.723),
  w("vivemos\n", 30.74467, 31.436),
  w("Na ", 31.516, 31.596),
  w("casa ", 33.471, 33.91),
  w("nova\n", 34.468, 35.106),
  w("Cada ", 35.20575, 35.745),
  w("canto ", 36.96833, 37.979),
  w("tem\n", 38.07875, 38.457),
  w("Você ", 38.617, 38.617),
  w("aqui ", 41.11075, 41.649),
  w("sorrindo\n\n", 41.75533, 43.90292),
];

const PRIMEIRO_REFRAO = [
  w("[Chorus]\nUm ", 43.92283, 44.601),
  w("ano ", 44.7205, 45.08),
  w("do ", 45.1995, 45.319),
  w("seu ", 45.399, 45.559),
  w("lado,\n", 45.6585, 47.6488),
  w("Você ", 47.7446, 48.032),
  w("rindo ", 48.085, 48.511),
  w("à ", 49.069, 49.149),
  w("toa,\n", 49.24875, 51.0318),
  w("Cuidando ", 51.0796, 51.622),
  w("de ", 51.742, 51.862),
  w("mim,\n", 52.9148, 54.136),
  w("Amor, ", 54.176, 54.8938),
  w("você ", 54.9736, 55.213),
  w("é ", 55.372, 55.452),
  w("meu ", 55.55833, 55.851),
  w("presente\n\n", 55.93075, 58.88967),
];

const VERSO_2 = [
  w("[Verse 2]\nCedinho ", 58.89633, 59.521),
  w("na ", 59.641, 59.761),
  w("cozinha\n", 59.8805, 60.638),
];

const MUSICA = [...INTRO_E_VERSO, ...PRIMEIRO_REFRAO, ...VERSO_2];

const LETRA = `[Short Intro - máx 8s]
Amor, vem ouvir isso

[Verse 1]
Amanhã faz um ano
E eu quero contar
Tudo que vivemos
Na casa nova
Cada canto tem
Você aqui sorrindo

[Chorus]
Um ano do seu lado,
Você rindo à toa,
Cuidando de mim,
Amor, você é meu presente

[Verse 2]
Cedinho na cozinha`;

/** Desloca a música inteira no tempo (refrão mais tarde ou mais cedo). */
const deslocar = (ws: typeof MUSICA, ds: number) =>
  ws.map((p) => ({ ...p, start: p.start + ds, end: p.end + ds }));

/** O mesmo áudio sem nenhum marcador de seção nas palavras. */
const semMarcadores = (ws: typeof MUSICA) =>
  ws.map((p) => ({ ...p, word: p.word.replace(/\[[^\]]*\]\n?/g, "") }));

describe("corteDaPrevia", () => {
  it("corta no fim do primeiro refrão, antes da estrofe seguinte entrar", () => {
    const c = corteDaPrevia(MUSICA, LETRA);
    expect(c.motivo).toBe("refrao");
    // "presente" começa em 55,93 e o `end` (58,89) engole a pausa: teto de 3s
    // de sustentação + respiro (59,33), mas a próxima palavra começa em
    // 58,896, e a folga de 0,25s do timeupdate puxa pra 58,65.
    expect(c.s).toBeCloseTo(58.65, 2);
    expect(c.s).toBeGreaterThan(55.93); // a última palavra do refrão soa
    expect(c.s).toBeLessThan(58.896); // a primeira do verso 2 não
  });

  it("sem timestamps (a prévia por stream) corta no fim ESTIMADO do refrão, 60s", () => {
    const estimado = { s: PREVIA_B_SEM_TIMESTAMPS_S, motivo: "estimado_60s" };
    expect(PREVIA_B_SEM_TIMESTAMPS_S).toBe(60);
    expect(corteDaPrevia(null, LETRA)).toEqual(estimado);
    expect(corteDaPrevia([], LETRA)).toEqual(estimado);
    expect(corteDaPrevia(undefined)).toEqual(estimado);
    // Dentro da janela do braço B.
    expect(PREVIA_B_SEM_TIMESTAMPS_S).toBeGreaterThanOrEqual(PREVIA_PADRAO_S);
    expect(PREVIA_B_SEM_TIMESTAMPS_S).toBeLessThanOrEqual(PREVIA_MAX_S);
  });

  it("lixo nos timestamps não derruba: é ignorado", () => {
    const sujo = [{ word: 3 }, { word: "x", start: "nada", end: 1 }, null, ...MUSICA] as never;
    expect(corteDaPrevia(sujo, LETRA).motivo).toBe("refrao");
    expect(corteDaPrevia([{ word: 3 }] as never)).toEqual({
      s: PREVIA_B_SEM_TIMESTAMPS_S,
      motivo: "estimado_60s",
    });
  });

  it("sem marcador nas palavras, acha o refrão contando as linhas da letra", () => {
    const c = corteDaPrevia(semMarcadores(MUSICA), LETRA);
    expect(c.motivo).toBe("refrao");
    expect(c.s).toBeCloseTo(58.65, 2);
  });

  it("sem marcador e com a letra desencontrada do áudio, não adivinha", () => {
    // Uma linha a menos antes do refrão: a posição cairia no lugar errado, e
    // a primeira palavra não bate.
    const letraTorta = LETRA.replace("Na casa nova\n", "");
    expect(corteDaPrevia(semMarcadores(MUSICA), letraTorta)).toEqual({
      s: PREVIA_PADRAO_S,
      motivo: "sem_refrao",
    });
    expect(corteDaPrevia(semMarcadores(MUSICA))).toEqual({
      s: PREVIA_PADRAO_S,
      motivo: "sem_refrao",
    });
  });

  it("[Pre-Chorus] não é o refrão", () => {
    expect(ehRefrao("[Pre-Chorus]")).toBe(false);
    expect(ehRefrao("[Chorus]")).toBe(true);
    expect(ehRefrao("[Refrão]")).toBe(true);
    expect(ehRefrao("[Final Chorus]")).toBe(false);
    const comPre = [
      ...INTRO_E_VERSO.slice(0, -1),
      w("[Pre-Chorus]\nsorrindo\n\n", 41.75533, 43.90292),
      ...PRIMEIRO_REFRAO,
      ...VERSO_2,
    ];
    expect(corteDaPrevia(comPre).s).toBeCloseTo(58.65, 2);
  });

  it("refrão que passa do teto corta no fim da última linha dele que cabe", () => {
    // +20s: o refrão acabaria em ~78,65. A linha "Cuidando de mim," cabe:
    // "mim," vai até 74,14, mas "Amor," entra em 74,18, e a folga puxa o
    // corte pra 73,93.
    const c = corteDaPrevia(deslocar(MUSICA, 20), LETRA);
    expect(c.motivo).toBe("refrao_parcial");
    expect(c.s).toBeLessThanOrEqual(PREVIA_MAX_S);
    expect(c.s).toBeCloseTo(73.93, 2);
  });

  it("nem a primeira linha do refrão cabe no teto: corte de hoje", () => {
    expect(corteDaPrevia(deslocar(MUSICA, 40), LETRA)).toEqual({
      s: PREVIA_PADRAO_S,
      motivo: "refrao_tarde",
    });
  });

  it("refrão que acaba antes de 40s nunca corta mais cedo que hoje", () => {
    expect(corteDaPrevia(deslocar(MUSICA, -25), LETRA)).toEqual({
      s: PREVIA_PADRAO_S,
      motivo: "refrao_cedo",
    });
  });

  it("sustentação do fim do refrão tem teto quando vem instrumental depois", () => {
    // Última palavra com `end` engolindo 10s de solo e nada cantado depois.
    const solo = [
      ...INTRO_E_VERSO,
      ...PRIMEIRO_REFRAO.slice(0, -1),
      w("presente\n\n", 55.93075, 66),
    ];
    // 55,93 + 3 de teto + 0,4 de respiro.
    expect(corteDaPrevia(solo).s).toBeCloseTo(59.33, 2);
  });
});

describe("proximoCorte (timestamps chegando com a prévia tocando)", () => {
  const estimado = corteDaPrevia(null);
  const refrao = corteDaPrevia(MUSICA, LETRA); // 58,65

  it("antes do fim do refrão calculado, troca a estimativa pela conta de verdade", () => {
    expect(proximoCorte(estimado, refrao, 30, false)).toBe(refrao);
    expect(proximoCorte(estimado, refrao, 58, false)).toBe(refrao);
  });

  it("refrão calculado mais longo que a estimativa também vale (até 75s)", () => {
    const longo = corteDaPrevia(deslocar(MUSICA, 10), LETRA); // ~68,65
    expect(longo.motivo).toBe("refrao");
    expect(proximoCorte(estimado, longo, 59, false)).toBe(longo);
  });

  it("já passou do fim do refrão: fica a estimativa, nunca volta o áudio", () => {
    expect(proximoCorte(estimado, refrao, 58.7, false)).toBe(estimado);
    expect(proximoCorte(estimado, refrao, 59.9, false)).toBe(estimado);
  });

  it("depois do corte, nada muda", () => {
    expect(proximoCorte(estimado, refrao, 20, true)).toBe(estimado);
  });
});

describe("corteNoAudio", () => {
  it("o corte nunca passa do fim do arquivo", () => {
    expect(corteNoAudio(60, 45.2)).toBe(45.2);
    expect(corteNoAudio(60, 180)).toBe(60);
  });

  it("duração desconhecida não limita", () => {
    expect(corteNoAudio(60, Number.NaN)).toBe(60);
    expect(corteNoAudio(60, Number.POSITIVE_INFINITY)).toBe(60);
    expect(corteNoAudio(60, 0)).toBe(60);
  });
});
