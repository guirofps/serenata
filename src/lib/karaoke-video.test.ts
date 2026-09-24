import { describe, expect, it } from "vitest";
import { montarKaraoke } from "./karaoke-video";

const w = (word: string, start: number, end = start + 0.3) => ({ word, start, end });

describe("montarKaraoke", () => {
  it("tag colada na primeira palavra some e NÃO quebra a linha", () => {
    // Formato real do Suno (música "Sete Meses Pra Te Levar Pro Altar").
    const linhas = montarKaraoke([
      w("[Short Intro - máx 8s]\nDaiane... ", 3.9),
      w("escuta ", 6.4),
      w("essa ", 6.7),
      w("história\n", 7.1),
      w("Que ", 9.4),
    ]);
    expect(linhas.map((l) => l.words.map((p) => p.t).join(" "))).toEqual([
      "Daiane... escuta essa história",
      "Que",
    ]);
    expect(linhas[0].start).toBe(3.9);
  });

  it("tag e quebra soltas não viram palavra", () => {
    const linhas = montarKaraoke([
      w("cantando", 1),
      w("\n", 1.5),
      w("[Verse 1]", 2),
      w("Eu", 3),
      w("lembro\n", 3.4),
    ]);
    expect(linhas.map((l) => l.words.map((p) => p.t).join(" "))).toEqual(["cantando", "Eu lembro"]);
  });

  it("entrada estranha não derruba o render", () => {
    expect(montarKaraoke(null)).toEqual([]);
    expect(montarKaraoke([{ word: 3 }, { word: "oi", start: "x", end: 1 }])).toEqual([]);
  });
});
