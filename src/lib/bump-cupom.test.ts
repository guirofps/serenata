import { describe, expect, it } from "vitest";
import { itemDaReferencia, referenciaComItem } from "./bump";

describe("referência com cupom", () => {
  it("cupom muda a referência (o gateway recusa outro valor na mesma)", () => {
    expect(referenciaComItem("abc", null)).toBe("serenata:abc");
    expect(referenciaComItem("abc", null, false, true)).toBe("serenata:abc:d");
    expect(referenciaComItem("abc", null, true, true)).toBe("serenata:abc:i:d");
  });
  it("o sufixo do cupom não confunde a leitura do item", () => {
    expect(itemDaReferencia("serenata:abc:d")).toBeNull();
    expect(itemDaReferencia(referenciaComItem("abc", "quadro", false, true))).toBe("quadro");
  });
});
