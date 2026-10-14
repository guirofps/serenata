import { describe, expect, it } from "vitest";
import { tamanhoFinal } from "./imagem";

// A foto sobe inteira: nada de corte quadrado (14/10, a Edna perdeu o rosto em 3 fotos).
describe("tamanhoFinal", () => {
  it("foto em pé de celular mantém a proporção", () => {
    expect(tamanhoFinal(3024, 4032)).toEqual({ w: 1200, h: 1600 });
  });
  it("foto deitada mantém a proporção", () => {
    expect(tamanhoFinal(4032, 3024)).toEqual({ w: 1600, h: 1200 });
  });
  it("foto pequena não é ampliada", () => {
    expect(tamanhoFinal(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it("print alto de tela continua alto", () => {
    expect(tamanhoFinal(1170, 2532)).toEqual({ w: 739, h: 1600 });
  });
});
