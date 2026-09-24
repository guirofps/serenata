// A LETRA CANTADA, em linhas, pro karaokê do vídeo.
//
// O `get-timestamped-lyrics` devolve uma lista plana de palavras com início e
// fim. Duas sujeiras vêm junto, e as duas já apareceram numa música real
// ("Sete Meses Pra Te Levar Pro Altar", 24/09):
//
//   1. TAG DE SEÇÃO COLADA NA PALAVRA. A primeira palavra veio como
//      "[Short Intro - máx 8s]\nDaiane... ". Mostrada crua, a tag aparece
//      escrita no vídeo.
//   2. A QUEBRA DE LINHA MORA DENTRO DA PALAVRA ("história\n"). É o único
//      sinal de onde a linha da letra termina, então precisa ser lida antes
//      de ser limpa.

import type { LinhaKaraoke } from "../../video/src/props.js";

type PalavraCrua = { word?: unknown; start?: unknown; end?: unknown };

export function montarKaraoke(timestamps: unknown): LinhaKaraoke[] {
  if (!Array.isArray(timestamps)) return [];

  const limpas: { t: string; s: number; e: number; fimDeLinha: boolean }[] = [];
  for (const w of timestamps as PalavraCrua[]) {
    if (!w || typeof w.word !== "string") continue;
    const s = Number(w.start);
    const e = Number(w.end);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;

    const semTag = w.word.replace(/\[[^\]]*\]/g, "");
    // A quebra que interessa é a que vem DEPOIS de texto. A que só separava a
    // tag da primeira palavra ("[Intro]\nDaiane") não encerra linha nenhuma.
    const texto = semTag.replace(/\s+/g, " ").trim();
    const fimDeLinha = /\S[^\S\n]*\n/.test(semTag) || (/\n\s*$/.test(semTag) && texto !== "");

    if (!texto) {
      // Palavra que era só tag/quebra: se ela quebrava linha, a linha acaba na
      // palavra anterior.
      if (/\n/.test(w.word) && limpas.length) limpas[limpas.length - 1].fimDeLinha = true;
      continue;
    }
    limpas.push({ t: texto, s, e, fimDeLinha });
  }

  const linhas: LinhaKaraoke[] = [];
  let atual: typeof limpas = [];
  for (const w of limpas) {
    atual.push(w);
    if (w.fimDeLinha) {
      linhas.push(fechar(atual));
      atual = [];
    }
  }
  if (atual.length) linhas.push(fechar(atual));
  return linhas;
}

function fechar(ws: { t: string; s: number; e: number }[]): LinhaKaraoke {
  return {
    start: ws[0].s,
    end: ws[ws.length - 1].e,
    words: ws.map((w) => ({ t: w.t, s: w.s, e: w.e })),
  };
}
