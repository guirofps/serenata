import { describe, expect, it } from "vitest";
import { chaveDepoisDaMorta, decidirSessao } from "./stripe-sessao-viva";

describe("decidirSessao", () => {
  it("aberta serve; sem estado lido, usa a que tem (como antes)", () => {
    expect(decidirSessao("open")).toBe("usa");
    expect(decidirSessao(undefined)).toBe("usa");
    expect(decidirSessao(null)).toBe("usa");
  });
  it("paga vai pro obrigado", () => {
    expect(decidirSessao("complete")).toBe("ja-pago");
  });
  it("expirada (o caso do fiv***) pede outra", () => {
    expect(decidirSessao("expired")).toBe("nova");
  });
});

describe("chaveDepoisDaMorta", () => {
  it("é a mesma pra mesma sessão morta e muda quando morre outra", () => {
    const base = "ballad-checkout:v6:br:quiz:abc";
    expect(chaveDepoisDaMorta(base, "cs_1")).toBe(chaveDepoisDaMorta(base, "cs_1"));
    expect(chaveDepoisDaMorta(base, "cs_1")).not.toBe(chaveDepoisDaMorta(base, "cs_2"));
    expect(chaveDepoisDaMorta("x".repeat(300), "cs_1").length).toBeLessThanOrEqual(255);
  });
});
