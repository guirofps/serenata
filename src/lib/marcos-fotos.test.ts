import { describe, expect, it } from "vitest";
import { marcosDasFotos, TELA_MINIMA_S } from "./marcos-fotos";

// O caso real (14/09/2026): galeria de 12 fotos numa música de 8 seções.
// Com "uma foto por seção" as fotos 9 a 12 nunca apareciam.
const SECOES_8 = [0, 11.9, 34.2, 58.7, 81.3, 104.6, 128.4, 160.2];
const DURACAO = 186.8;

describe("marcosDasFotos", () => {
  it("12 fotos em 8 seções: toda foto ganha a sua vez", () => {
    const m = marcosDasFotos(SECOES_8, 12, DURACAO);
    expect(m).toHaveLength(12);
    // O índice exibido é o do último marco já passado: com 12 marcos, a foto
    // 12 aparece no último trecho.
    expect(m.every((t, i) => i === 0 || t > m[i - 1])).toBe(true);
    expect(m.at(-1)!).toBeLessThan(DURACAO);
  });

  it("as viradas da música continuam onde estavam", () => {
    const m = marcosDasFotos(SECOES_8, 12, DURACAO);
    for (const s of SECOES_8) expect(m).toContain(s);
  });

  it("com fotos de menos, fica igual ao que era: uma virada por seção", () => {
    expect(marcosDasFotos(SECOES_8, 5, DURACAO)).toEqual(SECOES_8);
    expect(marcosDasFotos(SECOES_8, 8, DURACAO)).toEqual(SECOES_8);
  });

  it("sem duração conhecida (gravação 2), parte só os trechos entre seções", () => {
    const m = marcosDasFotos(SECOES_8, 12, null);
    expect(m).toHaveLength(12);
    expect(Math.max(...m)).toBe(160.2);
  });

  it("nenhuma foto fica menos que o mínimo na tela", () => {
    const curta = [0, 6, 12, 18];
    const m = marcosDasFotos(curta, 12, 24);
    const trechos = m.map((t, i) => (i + 1 < m.length ? m[i + 1] : 24) - t);
    expect(Math.min(...trechos)).toBeGreaterThanOrEqual(TELA_MINIMA_S);
  });

  it("sem seções, espalha por igual pela duração", () => {
    expect(marcosDasFotos([], 4, 100)).toEqual([0, 25, 50, 75]);
    expect(marcosDasFotos([], 4, null)).toEqual([]);
  });

  it("uma foto só não precisa de virada", () => {
    expect(marcosDasFotos(SECOES_8, 1, DURACAO)).toEqual([]);
  });
});
