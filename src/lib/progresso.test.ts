import { describe, it, expect } from "vitest";
import { pctEm } from "@/components/quiz/ProgressoGeracao";

// A BARRA DA GERACAO. Medido em 31/08, 77 geracoes reais: mediana 36s ate a
// previa, p90 50s, p95 90s. A regua antiga era linear em 135s e estava em 28%
// na mediana — pulava de 28% direto pra 100%.

describe("curva da barra de progresso", () => {
  it("comeca visivel, nao em zero", () => {
    expect(pctEm(0)).toBeCloseTo(4, 1);
  });

  // O ponto da mudanca inteira: na mediana medida, a barra tem que estar perto
  // do fim, nao no comeco.
  it("na mediana (36s) esta acima de 75%, nao em 28%", () => {
    expect(pctEm(36)).toBeGreaterThan(75);
    expect(pctEm(36)).toBeLessThan(90);
  });

  it("corre no comeco: 20s ja passa da metade", () => {
    expect(pctEm(20)).toBeGreaterThan(55);
  });

  // A razao de ser exponencial em vez de reta em 45s. Barra parada e o defeito
  // que o CLAUDE.md registra como falha da Cantoria.
  it("NUNCA para: continua subindo na cauda", () => {
    for (const [a, b] of [[45, 60], [60, 90], [90, 150], [150, 300]]) {
      expect(pctEm(b)).toBeGreaterThan(pctEm(a));
    }
  });

  // So a musica pronta leva a 100%. A barra sozinha nunca promete que acabou.
  //
  // Ate 300s, que e 3x o p95 medido. Alem disso o `e^-x` vira zero por
  // precisao de float e a curva encosta em 93 — mas uma espera de minutos ja
  // e geracao quebrada, e o componente ainda tem o `Math.min(TETO, ...)`.
  it("nao encosta no teto durante uma espera real", () => {
    for (const s of [45, 90, 150, 300]) expect(pctEm(s)).toBeLessThan(93);
  });

  it("e monotonica", () => {
    let ant = -1;
    for (let s = 0; s <= 200; s += 2) {
      const v = pctEm(s);
      expect(v).toBeGreaterThan(ant);
      ant = v;
    }
  });
});
