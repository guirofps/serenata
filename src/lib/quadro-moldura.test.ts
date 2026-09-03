import { describe, expect, it } from "vitest";
import { molduraDaFoto } from "@/lib/quadro-estilo";

// A MOLDURA QUE SE AJUSTA À FOTO.
//
// Antes a foto caía em três baldes de tamanho fixo, e o balde do meio era o
// pior negócio da folha: uma foto quadrada era esticada numa faixa de 2,2:1 e
// metade da imagem ficava de fora. Não dava pra ajustar; só dava pra escolher
// qual metade se perdia.
//
// A regra nova é uma só, e é o que estes testes protegem: a moldura tenta ter
// a proporção da foto, dentro do que a folha A4 permite.

/** Quanto da imagem sobra fora da moldura, em porcentagem da área. */
function cortePorcento(proporcaoFoto: number) {
  const m = molduraDaFoto(proporcaoFoto);
  const rMoldura = m.larguraMm / m.alturaMm;
  // `cover` escala pelo lado apertado: o excesso do outro lado é o corte.
  const sobra = rMoldura > proporcaoFoto ? 1 - proporcaoFoto / rMoldura : 1 - rMoldura / proporcaoFoto;
  return Math.round(sobra * 100);
}

describe("molduraDaFoto", () => {
  it("foto quadrada não perde mais metade da imagem", () => {
    // O caso que motivou tudo. Na moldura antiga (210x96mm, ou 2,19:1) uma
    // foto 1:1 perdia 54% da área.
    expect(cortePorcento(1)).toBe(0);
    const m = molduraDaFoto(1);
    expect(m.sangra).toBe(false);
    expect(m.larguraMm).toBe(m.alturaMm);
  });

  it("foto em pé vira bloco centralizado, sem corte", () => {
    expect(cortePorcento(0.75)).toBe(0);
    expect(molduraDaFoto(0.75).sangra).toBe(false);
  });

  it("3:2 e 16:9, as fotos que saem de celular, param de cortar", () => {
    // Este era o buraco da primeira tentativa. Com a linha da sangria em 1,5
    // o 3:2 perdia 26% da área, porque sangrar prende a largura em 210mm e a
    // moldura não consegue mais ter a proporção da foto.
    expect(cortePorcento(1.5)).toBe(0);
    expect(cortePorcento(1.78)).toBe(0);
    expect(molduraDaFoto(1.5).sangra).toBe(false);
  });

  it("só o que é panorâmico de verdade sangra", () => {
    expect(molduraDaFoto(2).sangra).toBe(true);
    expect(molduraDaFoto(1.9).sangra).toBe(false);
    expect(cortePorcento(2)).toBeLessThanOrEqual(3);
  });

  it("panorâmica bate no teto e volta a cortar, mas pouco", () => {
    // 62mm é o piso: abaixo disso a foto vira selo e o rosto some. Uma
    // panorâmica de 3:1 aceita corte porque a alternativa é sumir da folha.
    const m = molduraDaFoto(3);
    expect(m.alturaMm).toBe(70);
    expect(cortePorcento(3)).toBeLessThanOrEqual(5);
  });

  it("nunca passa da altura que a letra precisa", () => {
    // Acima de 104mm o corpo da letra encolhe até ficar ilegível. Vale pra
    // qualquer proporção, inclusive as absurdas.
    for (const r of [0.2, 0.5, 0.75, 1, 1.33, 1.5, 2, 3, 8]) {
      const m = molduraDaFoto(r);
      expect(m.alturaMm).toBeLessThanOrEqual(104);
      expect(m.alturaMm).toBeGreaterThanOrEqual(62);
      expect(m.larguraMm).toBeLessThanOrEqual(210);
    }
  });

  it("sem medida ainda, assume foto deitada em vez de quebrar", () => {
    // O instante entre a folha montar e a imagem carregar. Devolver NaN aqui
    // viraria `height: NaNmm`, declaração inválida que o navegador descarta —
    // a faixa colapsaria pra zero e a folha piscaria sem foto.
    for (const ruim of [null, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const m = molduraDaFoto(ruim as number | null);
      expect(Number.isFinite(m.alturaMm)).toBe(true);
      expect(m.alturaMm).toBeGreaterThan(0);
    }
  });
});
