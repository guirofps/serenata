import { describe, expect, it } from "vitest";
import { itemDaReferencia, itemDoBraco, oQueLeva, referenciaComItem, valorComItem } from "./bump";

describe("bump do checkout", () => {
  it("cada braço oferece o seu item, e o controle não oferece nada", () => {
    expect(itemDoBraco("A")).toBeNull();
    expect(itemDoBraco("fora")).toBeNull();
    expect(itemDoBraco(null)).toBeNull();
    expect(itemDoBraco("B2")).toBe("quadro");
    expect(itemDoBraco("B")).toBe("quadro"); // braço antigo grudado no navegador
    expect(itemDoBraco("V")).toBe("video");
    expect(itemDoBraco("C")).toBe("completo");
  });

  it("o valor soma o item no servidor", () => {
    expect(valorComItem(3800, null)).toBe(3800);
    expect(valorComItem(3800, "quadro")).toBe(6290);
    expect(valorComItem(3800, "video")).toBe(5790);
    expect(valorComItem(3800, "completo")).toBe(6790);
  });

  it("a referência carrega o item depois do id, e o webhook lê de volta", () => {
    for (const item of ["quadro", "video", "completo"] as const) {
      const ref = referenciaComItem("abc-123", item);
      expect(ref.startsWith("serenata:abc-123:")).toBe(true);
      expect(itemDaReferencia(ref)).toBe(item);
      expect(itemDaReferencia(`${ref}:r2`)).toBe(item); // recobrança da Woovi
    }
    expect(referenciaComItem("abc-123", null)).toBe("serenata:abc-123");
    expect(itemDaReferencia("serenata:abc-123")).toBeNull();
    expect(itemDaReferencia("serenata:abc-123:r2")).toBeNull();
  });

  it("o que a pessoa leva: coluna do pedido primeiro, referência como rede", () => {
    expect(oQueLeva({ bumpQuadro: true })).toEqual({ quadro: true, video: false });
    expect(oQueLeva({ bumpVideo: true })).toEqual({ quadro: false, video: true });
    expect(oQueLeva({ referencia: "serenata:x:c" })).toEqual({ quadro: true, video: true });
    expect(oQueLeva({ referencia: "serenata:x" })).toEqual({ quadro: false, video: false });
  });
});
