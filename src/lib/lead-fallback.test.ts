import { describe, expect, it } from "vitest";
import { atribuicaoDoCliente, emailDoCliente } from "./lead-fallback";

describe("emailDoCliente", () => {
  it("aceita e-mail plausível, limpo", () => {
    expect(emailDoCliente("  Maria@Gmail.com. ")).toBe("maria@gmail.com");
  });
  it("recusa lixo, tipo errado e endereço gigante", () => {
    expect(emailDoCliente("maria@")).toBeNull();
    expect(emailDoCliente(123)).toBeNull();
    expect(emailDoCliente(undefined)).toBeNull();
    expect(emailDoCliente(`${"a".repeat(260)}@gmail.com`)).toBeNull();
  });
});

describe("atribuicaoDoCliente", () => {
  it("aceita objeto pequeno", () => {
    expect(atribuicaoDoCliente({ gclid: "x", exp: { preco: "A" } })).toEqual({ gclid: "x", exp: { preco: "A" } });
  });
  it("recusa vazio, lista, texto e o que passa do teto", () => {
    expect(atribuicaoDoCliente({})).toBeNull();
    expect(atribuicaoDoCliente([1, 2])).toBeNull();
    expect(atribuicaoDoCliente("gclid=x")).toBeNull();
    expect(atribuicaoDoCliente({ lixo: "x".repeat(5000) })).toBeNull();
  });
});
