import { describe, expect, it } from "vitest";
import { bracosQueValem, mesclarAtribuicao } from "@/lib/retomar-sessao";

describe("mesclarAtribuicao", () => {
  it("o clique do anúncio do registro sobrevive ao aparelho novo", () => {
    const local = { utm_source: "email", referrer: "https://mail.google.com/", captured_at: "2026-10-08T10:00:00Z" };
    const registro = {
      gclid: "Cj0KCQ",
      utm_source: "google",
      utm_campaign: "campeao-1",
      exp: { preco: "A" },
      captured_at: "2026-10-01T10:00:00Z",
    };
    const m = mesclarAtribuicao(local, registro);
    expect(m?.gclid).toBe("Cj0KCQ");
    expect(m?.utm_source).toBe("google");
    expect(m?.utm_campaign).toBe("campeao-1");
    expect(m?.exp).toEqual({ preco: "A" });
    expect(m?.captured_at).toBe("2026-10-01T10:00:00Z");
    // O que só o aparelho tinha continua lá.
    expect(m?.referrer).toBe("https://mail.google.com/");
  });

  it("registro vazio ou ausente não apaga o local", () => {
    const local = { utm_source: "email", captured_at: "x" };
    expect(mesclarAtribuicao(local, null)).toEqual(local);
    expect(mesclarAtribuicao(local, {})).toEqual(local);
    expect(mesclarAtribuicao(null, null)).toBeNull();
  });

  it("sem nada local, o registro vira o objeto inteiro", () => {
    expect(mesclarAtribuicao(null, { gclid: "g", captured_at: "c" })).toEqual({ gclid: "g", captured_at: "c" });
  });
});

describe("bracosQueValem", () => {
  const ativos = [
    { id: "preco", variantes: [{ nome: "A" }, { nome: "E" }] },
    { id: "obrigado_direto", variantes: [{ nome: "A" }, { nome: "B" }] },
  ];

  it("repõe só experimento ativo com variante conhecida", () => {
    expect(
      bracosQueValem({ preco: "E", obrigado_direto: "B", desligado: "B", zap_previa: "A" }, ativos),
    ).toEqual({ preco: "E", obrigado_direto: "B" });
  });

  it("aceita `fora` e recusa variante apagada", () => {
    expect(bracosQueValem({ preco: "fora", obrigado_direto: "Z" }, ativos)).toEqual({ preco: "fora" });
  });

  it("sem registro, nada", () => {
    expect(bracosQueValem(null, ativos)).toEqual({});
  });
});
