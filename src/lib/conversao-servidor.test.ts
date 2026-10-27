import { describe, expect, it } from "vitest";
import { emailNormalizado, eventoDoPedido, idDoClique, moedaDoPedido } from "./conversao-servidor";

const DIA = 86400000;
const AGORA = Date.parse("2026-10-27T15:00:00Z");
const diasAtras = (n: number) => new Date(AGORA - n * DIA).toISOString();

const pedido = (attribution: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
  id: "ped-1",
  paid_at: "2026-10-27T12:30:00Z",
  valor_centavos: 3800,
  gateway: "asaas",
  attribution,
  ...extra,
});

describe("idDoClique", () => {
  it("prefere o gclid do último clique fresco", () => {
    expect(idDoClique({ gclid: "velho", ultimo_clique: { gclid: "novo", em: diasAtras(1) } }, AGORA)).toEqual({ gclid: "novo" });
  });

  it("sem gclid, manda o gbraid do iPhone (a lista nunca mandou)", () => {
    expect(idDoClique({ ultimo_clique: { gbraid: "gb1", em: diasAtras(2) } }, AGORA)).toEqual({ gbraid: "gb1" });
    expect(idDoClique({ wbraid: "wb1", captured_at: diasAtras(3) }, AGORA)).toEqual({ wbraid: "wb1" });
  });

  it("clique de mais de 90 dias não sobe", () => {
    expect(idDoClique({ gbraid: "gb", captured_at: diasAtras(95) }, AGORA)).toBeNull();
    expect(idDoClique({ ultimo_clique: { wbraid: "wb", em: diasAtras(100) } }, AGORA)).toBeNull();
  });

  it("venda sem clique do Google não sobe", () => {
    expect(idDoClique({ ttclid: "tt", utm_source: "tiktok" }, AGORA)).toBeNull();
    expect(idDoClique(null, AGORA)).toBeNull();
  });
});

describe("moedaDoPedido", () => {
  it("segue a régua da lista: Stripe e dLocal em dólar, o resto em real", () => {
    expect(moedaDoPedido("stripe")).toBe("USD");
    expect(moedaDoPedido("dlocalgo")).toBe("USD");
    expect(moedaDoPedido("asaas")).toBe("BRL");
    expect(moedaDoPedido("perfectpay")).toBe("BRL");
    expect(moedaDoPedido(null)).toBe("BRL");
  });
});

describe("eventoDoPedido", () => {
  it("monta a venda com o id do pedido (o mesmo Order ID da lista, que deduplica)", () => {
    const r = eventoDoPedido(pedido({ gclid: "abc", captured_at: diasAtras(1) }), AGORA, "hash");
    expect(r).toEqual({
      evento: {
        adIdentifiers: { gclid: "abc" },
        conversionValue: 38,
        currency: "BRL",
        eventTimestamp: "2026-10-27T12:30:00.000Z",
        transactionId: "ped-1",
        eventSource: "WEB",
        userData: { userIdentifiers: [{ emailAddress: "hash" }] },
      },
    });
  });

  it("sem e-mail, sai sem userData", () => {
    const r = eventoDoPedido(pedido({ gclid: "abc" }), AGORA);
    expect("evento" in r && r.evento.userData).toBeFalsy();
  });

  it("explica por que pulou", () => {
    expect(eventoDoPedido(pedido({ utm_source: "tiktok" }), AGORA)).toEqual({ pula: "sem_clique" });
    expect(eventoDoPedido(pedido({ gclid: "abc" }, { valor_centavos: 0 }), AGORA)).toEqual({ pula: "sem_valor" });
    expect(eventoDoPedido(pedido({ gclid: "abc" }, { paid_at: null }), AGORA)).toEqual({ pula: "sem_valor" });
  });
});

describe("emailNormalizado", () => {
  it("minúsculo e sem espaço, como o Google exige antes do hash", () => {
    expect(emailNormalizado("  Maria@Gmail.COM ")).toBe("maria@gmail.com");
    expect(emailNormalizado("")).toBeNull();
    expect(emailNormalizado(null)).toBeNull();
  });
});
