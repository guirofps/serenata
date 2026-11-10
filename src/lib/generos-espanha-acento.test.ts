import { describe, expect, it } from "vitest";
import { estiloParaSuno } from "./generos";

// 10/11 (dono): a música do funil da Espanha pede o sotaque de lá no estilo. O vídeo de
// anúncio pedia ("acento andaluz"), os estilos do quiz não pediam, e lead→venda na
// Espanha era metade do dos EUA em espanhol. O pedido tem que SOBREVIVER ao corte de
// 190 caracteres do envio ao Suno, com a voz e o timbre mais longos somados.
const VALORES = ["balada_esp", "pop_esp", "cantautor", "rumba", "bachata_es", "reggaeton_es", "copla", "flamenco", "rock_espanha"];

describe("estilos da Espanha pedem o sotaque de lá", () => {
  for (const g of VALORES) {
    it(g, () => {
      const e = estiloParaSuno({ genero: g, voz: "feminina", estiloDoModelo: "voz femenina cálida y emotiva" });
      expect(e).toContain("acento castellano de España");
      expect(e.length).toBeLessThanOrEqual(190);
    });
  }
  it("os estilos latinos NÃO ganham o sotaque", () => {
    expect(estiloParaSuno({ genero: "mariachi", voz: "masculina" })).not.toContain("España");
  });
});
