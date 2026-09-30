import { describe, expect, it } from "vitest";
import { dominioDe, recebeEmail } from "./dominio-email";

describe("recebeEmail", () => {
  it("MX presente recebe", () => expect(recebeEmail({ mx: "tem", a: "erro" })).toBe(true));
  it("sem MX mas com A recebe (RFC 5321)", () => expect(recebeEmail({ mx: "nao-tem", a: "tem" })).toBe(true));
  it("sem MX e sem A não recebe", () => expect(recebeEmail({ mx: "nao-tem", a: "nao-tem" })).toBe(false));
  it("DNS com erro falha aberto", () => {
    expect(recebeEmail({ mx: "erro", a: "erro" })).toBe(true);
    expect(recebeEmail({ mx: "nao-tem", a: "erro" })).toBe(true);
  });
});

describe("dominioDe", () => {
  it("extrai o domínio em minúsculas", () => expect(dominioDe(" Ana@Gmail.COM ")).toBe("gmail.com"));
  it("sem @ ou vazio devolve null", () => {
    expect(dominioDe("ana")).toBeNull();
    expect(dominioDe("ana@")).toBeNull();
  });
});
