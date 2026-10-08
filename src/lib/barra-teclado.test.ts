import { describe, expect, it } from "vitest";
import { subidaDaBarra } from "./barra-teclado";

describe("subidaDaBarra", () => {
  it("sem teclado, a barra fica onde está", () => {
    expect(subidaDaBarra({ fimDaBarra: 844, subidaAtual: 0, visivelTopo: 0, visivelAltura: 844 })).toBe(0);
  });

  it("teclado cobrindo 300px: sobe 300", () => {
    expect(subidaDaBarra({ fimDaBarra: 844, subidaAtual: 0, visivelTopo: 0, visivelAltura: 544 })).toBe(300);
  });

  it("já subida, a medição seguinte não soma de novo", () => {
    // Depois de subir 300, a barra é medida com o fim em 544: continua 300, não 0 nem 600.
    expect(subidaDaBarra({ fimDaBarra: 544, subidaAtual: 300, visivelTopo: 0, visivelAltura: 544 })).toBe(300);
  });

  it("o iOS rola a página com o teclado aberto: conta o topo do visível", () => {
    expect(subidaDaBarra({ fimDaBarra: 844, subidaAtual: 0, visivelTopo: 120, visivelAltura: 544 })).toBe(180);
  });

  it("teclado fechou: desce de volta", () => {
    expect(subidaDaBarra({ fimDaBarra: 544, subidaAtual: 300, visivelTopo: 0, visivelAltura: 844 })).toBe(0);
  });

  it("até 24px é arredondamento, não teclado", () => {
    expect(subidaDaBarra({ fimDaBarra: 844, subidaAtual: 0, visivelTopo: 0, visivelAltura: 822 })).toBe(0);
  });
});
