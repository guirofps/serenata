import { describe, expect, it } from "vitest";
import { canalDaVenda, contarPorCanal } from "./canal-venda";

describe("canalDaVenda", () => {
  it("anúncio pelo primeiro toque", () => {
    expect(canalDaVenda({ gclid: "abc" }, null)).toBe("google");
    expect(canalDaVenda({ utm_source: "google" }, null)).toBe("google");
    expect(canalDaVenda({ ttclid: "x" }, null)).toBe("tiktok");
  });
  it("gbraid/wbraid (iPhone, sem gclid) é Google", () => {
    expect(canalDaVenda({ gbraid: "b" }, null)).toBe("google");
    expect(canalDaVenda({ wbraid: "w", utm_campaign: "24116713654" }, null)).toBe("google");
  });
  it("primeiro toque sem canal: vale o último clique de anúncio", () => {
    const em = "2026-10-15T10:00:00Z";
    expect(canalDaVenda({ referrer: "https://www.bing.com/", ultimo_clique: { gbraid: "b", em } }, null)).toBe("google");
    expect(canalDaVenda({ ultimo_clique: { wbraid: "w", em } }, null)).toBe("google");
    expect(canalDaVenda({ ultimo_clique: { gclid: "g", em } }, null)).toBe("google");
    expect(canalDaVenda({ ultimo_clique: { ttclid: "t", em } }, null)).toBe("tiktok");
  });
  it("primeiro toque com canal continua mandando sobre o último clique", () => {
    const em = "2026-10-15T10:00:00Z";
    expect(canalDaVenda({ gclid: "g", ultimo_clique: { ttclid: "t", em } }, null)).toBe("google");
    expect(canalDaVenda({ ttclid: "t", ultimo_clique: { gclid: "g", em } }, null)).toBe("tiktok");
    expect(canalDaVenda({ utm_campaign: "gleysi", ultimo_clique: { gclid: "g", em } }, null)).toBe("influencer");
    expect(canalDaVenda({ utm_source: "email", ultimo_clique: { gclid: "g", em } }, null)).toBe("email");
    expect(canalDaVenda({ ref: "K7M2QX", ultimo_clique: { gclid: "g", em } }, null)).toBe("organico");
    expect(canalDaVenda({ ultimo_clique: { gclid: "g", em } }, "MUSICA10")).toBe("email");
  });
  it("cupom de e-mail vence o primeiro toque", () => {
    expect(canalDaVenda({ gclid: "abc" }, "MUSICA10")).toBe("email");
    expect(canalDaVenda({ ttclid: "x" }, "SRN27")).toBe("email");
    expect(canalDaVenda(null, "MUSICA10")).toBe("email");
  });
  it("pedido marcado como vindo de e-mail vence o primeiro toque", () => {
    expect(canalDaVenda({ gclid: "abc" }, null, "email")).toBe("email");
    expect(canalDaVenda({ gclid: "abc" }, null, null)).toBe("google");
  });
  it("link de e-mail sem cupom é e-mail", () => {
    expect(canalDaVenda({ utm_source: "email" }, null)).toBe("email");
    expect(canalDaVenda({ utm_source: "lembrete_data" }, null)).toBe("email");
  });
  it("influenciador: utm_source/utm_medium 'influencer', ou link só com utm_campaign", () => {
    expect(canalDaVenda({ utm_source: "influencer", utm_campaign: "gleysi" }, null)).toBe("influencer");
    expect(canalDaVenda({ utm_source: "instagram", utm_medium: "Influenciador", utm_campaign: "gleysi" }, null)).toBe("influencer");
    expect(canalDaVenda({ utm_campaign: "gleysi", referrer: "https://l.instagram.com/" }, null)).toBe("influencer");
  });
  it("anúncio e e-mail continuam vencendo o influenciador", () => {
    expect(canalDaVenda({ gclid: "x", utm_campaign: "24116713654" }, null)).toBe("google");
    expect(canalDaVenda({ utm_campaign: "gleysi" }, "MUSICA10")).toBe("email");
    expect(canalDaVenda({ utm_source: "email", utm_campaign: "letra_pronta" }, null)).toBe("email");
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
  expect(n).toEqual({ google: 1, tiktok: 1, email: 1, influencer: 0, organico: 1 });
});
