import { describe, expect, it } from "vitest";
import { linhasDeRefrao, montarCenas } from "../../video/src/cenas";
import type { LinhaKaraoke } from "../../video/src/props";

const linha = (start: number, texto: string, dur = 2): LinhaKaraoke => {
  const palavras = texto.split(" ");
  return {
    start,
    end: start + dur,
    words: palavras.map((t, i) => ({
      t,
      s: start + (i * dur) / palavras.length,
      e: start + ((i + 1) * dur) / palavras.length,
    })),
  };
};

describe("montarCenas", () => {
  const karaoke = [
    linha(6, "Daiane escuta essa história"),
    linha(8, "que eu preciso te contar"), // 2s depois: curta demais pra cortar
    linha(12, "naquele primeiro olhar na igreja"),
    linha(40, "vai até o último trilho"), // 28s de instrumental antes
    linha(44, "vai até o último trilho"),
  ];
  const cenas = montarCenas({ karaoke, nFotos: 3, durS: 60 });

  it("cobre o vídeo inteiro, sem buraco nem sobreposição", () => {
    expect(cenas[0].ini).toBe(0);
    expect(cenas[cenas.length - 1].fim).toBe(60);
    for (let i = 1; i < cenas.length; i++) expect(cenas[i].ini).toBeCloseTo(cenas[i - 1].fim);
  });

  it("nenhuma cena fica mais curta que o mínimo nem mais longa que o máximo (tirando a última)", () => {
    for (const c of cenas.slice(0, -1)) {
      expect(c.fim - c.ini).toBeGreaterThanOrEqual(3.2 - 1e-9);
      expect(c.fim - c.ini).toBeLessThanOrEqual(7.5 + 1e-9);
    }
  });

  it("corta um pouco antes da voz entrar", () => {
    expect(cenas.some((c) => Math.abs(c.ini - 11.85) < 1e-9)).toBe(true);
  });

  it("instrumental longo ganha cortes no meio", () => {
    expect(cenas.filter((c) => c.ini > 13 && c.ini < 39.8).length).toBeGreaterThanOrEqual(3);
  });

  it("refrão chegando entra com clarão", () => {
    const c = cenas.find((x) => Math.abs(x.ini - 39.85) < 1e-9);
    expect(c?.transicao).toBe("clarao");
  });

  it("uma foto só alterna o jeito de mostrar", () => {
    const uma = montarCenas({ karaoke, nFotos: 1, durS: 60 });
    expect(new Set(uma.map((c) => c.estilo)).size).toBe(2);
    expect(uma.every((c) => c.foto === 0)).toBe(true);
  });

  it("enquanto a abertura está na tela, nada de moldura (ela ficava embaixo do texto)", () => {
    const comIntro = montarCenas({ karaoke, nFotos: 3, durS: 60, introAte: 30 });
    expect(comIntro.filter((c) => c.ini < 30).every((c) => c.estilo === "cheia")).toBe(true);
    expect(comIntro.some((c) => c.ini >= 30 && c.estilo === "moldura")).toBe(true);
  });

  it("sem foto não monta cena", () => {
    expect(montarCenas({ karaoke, nFotos: 0, durS: 60 })).toEqual([]);
  });
});

describe("linhasDeRefrao", () => {
  it("marca as linhas que se repetem, ignorando acento e pontuação", () => {
    const k = [
      linha(0, "Vai até o último trilho"),
      linha(3, "outra coisa aqui"),
      linha(6, "vai ate o ultimo trilho!"),
    ];
    expect([...linhasDeRefrao(k)]).toEqual([0, 2]);
  });
});
