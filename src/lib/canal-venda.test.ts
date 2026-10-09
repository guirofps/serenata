import { describe, expect, it } from "vitest";
import { canalDaVenda, contarPorCanal } from "./canal-venda";

describe("canalDaVenda", () => {
  it("anúncio pelo primeiro toque", () => {
    expect(canalDaVenda({ gclid: "abc" }, null)).toBe("google");
    expect(canalDaVenda({ utm_source: "google" }, null)).toBe("google");
    expect(canalDaVenda({ ttclid: "x" }, null)).toBe("tiktok");
  });
  it("cupom de e-mail vence o primeiro toque", () => {
    expect(canalDaVenda({ gclid: "abc" }, "MUSICA10")).toBe("email");
    expect(canalDaVenda({ ttclid: "x" }, "SRN27")).toBe("email");
    expect(canalDaVenda(null, "MUSICA10")).toBe("email");
  });
  it("link de e-mail sem cupom é e-mail", () => {
    expect(canalDaVenda({ utm_source: "email" }, null)).toBe("email");
    expect(canalDaVenda({ utm_source: "lembrete_data" }, null)).toBe("email");
  });
  it("o resto é orgânico", () => {
    expect(canalDaVenda(null, null)).toBe("organico");
    expect(canalDaVenda({}, "")).toBe("organico");
    expect(canalDaVenda({ ref: "K7M2QX" }, null)).toBe("organico");
    expect(canalDaVenda({ utm_source: "presente" }, null)).toBe("organico");
    expect(canalDaVenda({ referrer: "https://www.bing.com/" }, null)).toBe("organico");
  });
});

it("contarPorCanal soma o total de vendas", () => {
  const n = contarPorCanal([
    { atribuicao: { gclid: "a" }, cupom: null },
    { atribuicao: { gclid: "b" }, cupom: "MUSICA10" },
    { atribuicao: null, cupom: null },
    { atribuicao: { ttclid: "c" }, cupom: null },
  ]);
  expect(n).toEqual({ google: 1, tiktok: 1, email: 1, organico: 1 });
});
