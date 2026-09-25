// A MONTAGEM: quando cada foto entra, de que jeito, e com que transição.
//
// Puro (sem React, sem Remotion) de propósito: é a parte do vídeo que tem
// regra, e regra se testa (`src/lib/cenas-video.test.ts`).
//
// ── O CORTE ACOMPANHA A VOZ, NÃO O RELÓGIO ───────────────────────
//
// A primeira versão trocava de foto a cada N segundos, fixo. Cortar num
// instante qualquer é o que faz vídeo de fotos parecer apresentação de slides:
// o olho percebe que a troca não tem nada a ver com a música. Aqui a foto
// troca quando começa uma FRASE cantada (um pouco antes, pra imagem já estar
// lá quando a voz entra), com duas travas:
//
//   - mínimo de 3,2s por foto: frase curta seguida de frase curta viraria
//     pisca-pisca;
//   - trecho instrumental longo ganha cortes a cada ~5s: sem voz não há
//     frase, e uma foto parada 15s num solo morre na tela.

import type { LinhaKaraoke } from "./props";

export type EstiloCena = "cheia" | "moldura";
export type Movimento = "aproxima" | "afasta" | "esquerda" | "direita";
export type Transicao = "dissolve" | "zoom" | "clarao";

export type Cena = {
  ini: number;
  fim: number;
  /** Índice em `fotos`. */
  foto: number;
  estilo: EstiloCena;
  movimento: Movimento;
  /** Como ESTA cena entra (a primeira entra por dissolve). */
  transicao: Transicao;
};

const MIN_CENA = 3.2;
const MAX_CENA = 7;
const PASSO_INSTRUMENTAL = 5;
/** A imagem entra um tico antes da voz. */
const ANTES_DA_VOZ = 0.15;

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Linhas de REFRÃO: as que se repetem na música. É o único sinal que sobra
 * depois de a tag `[Chorus]` ser limpa, e é o que importa: o refrão é o que
 * volta, e é onde o vídeo pode crescer.
 */
export function linhasDeRefrao(karaoke: LinhaKaraoke[]): Set<number> {
  const contagem = new Map<string, number>();
  const chaves = karaoke.map((l) => normalizar(l.words.map((w) => w.t).join(" ")));
  for (const k of chaves) if (k.split(" ").length >= 3) contagem.set(k, (contagem.get(k) ?? 0) + 1);
  const out = new Set<number>();
  chaves.forEach((k, i) => {
    if ((contagem.get(k) ?? 0) >= 2) out.add(i);
  });
  return out;
}

export function montarCenas(args: {
  karaoke: LinhaKaraoke[];
  nFotos: number;
  durS: number;
  /** Onde a primeira foto "de verdade" começa (fim da abertura). */
  inicio?: number;
  /**
   * Até quando o card de abertura (título e dedicatória) está na tela. Cena
   * que começa antes disso não entra de moldura: a polaroid ficava EMBAIXO do
   * texto e a tela embolava (primeiro render da v2, 24/09).
   */
  introAte?: number;
}): Cena[] {
  const { karaoke, nFotos, durS } = args;
  if (nFotos <= 0 || durS <= 0) return [];
  const inicio = Math.max(0, args.inicio ?? 0);
  const refrao = linhasDeRefrao(karaoke);

  // 1. Candidatos a corte: começo de cada frase, e se é refrão começando.
  const candidatos: { t: number; refrao: boolean }[] = karaoke
    .map((l, i) => ({
      t: l.start - ANTES_DA_VOZ,
      refrao: refrao.has(i) && !refrao.has(i - 1),
    }))
    .filter((c) => c.t > inicio && c.t < durS - 1);

  // 2. Escolhe os cortes respeitando mínimo e máximo por cena.
  const cortes: { t: number; refrao: boolean }[] = [{ t: 0, refrao: false }];
  const empurra = (ate: number) => {
    // Enche buracos longos (instrumental) com cortes regulares.
    let ultimo = cortes[cortes.length - 1].t;
    while (ate - ultimo > MAX_CENA + 0.5) {
      ultimo += Math.min(PASSO_INSTRUMENTAL, (ate - ultimo) / 2);
      cortes.push({ t: ultimo, refrao: false });
    }
  };
  for (const c of candidatos) {
    empurra(c.t);
    const ultimo = cortes[cortes.length - 1];
    if (c.t - ultimo.t >= MIN_CENA) cortes.push(c);
    else if (c.refrao && !ultimo.refrao && cortes.length > 1 && c.t - cortes[cortes.length - 2].t >= MIN_CENA) {
      // O refrão chegando vale mais que o corte anterior: troca um pelo outro.
      cortes[cortes.length - 1] = c;
    }
  }
  empurra(durS);

  // 3. Cada corte vira uma cena, com foto, estilo, movimento e transição.
  const movimentos: Movimento[] = ["aproxima", "direita", "afasta", "esquerda"];
  return cortes.map((c, i) => {
    const fim = i + 1 < cortes.length ? cortes[i + 1].t : durS;
    // Uma foto só: alterna o jeito de mostrar, que é a única variedade que há.
    const querMoldura = nFotos === 1 ? i % 2 === 1 : i % 3 === 2;
    const estilo: EstiloCena = querMoldura && c.t >= (args.introAte ?? 0) ? "moldura" : "cheia";
    const transicao: Transicao = i === 0 ? "dissolve" : c.refrao ? "clarao" : i % 2 ? "zoom" : "dissolve";
    return { ini: c.t, fim, foto: i % nFotos, estilo, movimento: movimentos[i % movimentos.length], transicao };
  });
}
