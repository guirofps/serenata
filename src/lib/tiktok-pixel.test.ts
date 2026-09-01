import { describe, it, expect, vi, beforeEach } from "vitest";
import { compraTiktok, checkoutTiktok, scriptTiktok } from "@/lib/tiktok-pixel";

// O PIXEL DO TIKTOK NÃO PODE QUEBRAR NADA.
//
// A conta foi comprada pra TESTAR. Enquanto o teste não vinga, este código
// roda em cima de um funil que fatura todo dia, e a regra é: sem id
// configurado, ele não existe; com id, ele não atrapalha o que já funciona.

declare global {
  // eslint-disable-next-line no-var
  var window: any;
}

beforeEach(() => {
  globalThis.window = {} as never;
});

describe("o pixel some quando não há conta", () => {
  it("não estoura quando `ttq` não existe (id não configurado)", () => {
    expect(() => compraTiktok({ valor: 38 })).not.toThrow();
    expect(() => checkoutTiktok({ valor: 38 })).not.toThrow();
  });
});

describe("a compra", () => {
  it("manda valor, moeda e o id de dedupe", () => {
    const track = vi.fn();
    globalThis.window = { ttq: { track } } as never;
    compraTiktok({ valor: 54.9, moeda: "BRL", eventId: "ref-123" });
    const [evento, dados, opcoes] = track.mock.calls[0];
    expect(evento).toBe("CompletePayment");
    expect(dados.value).toBe(54.9);
    expect(dados.currency).toBe("BRL");
    expect(opcoes).toEqual({ event_id: "ref-123" });
  });

  it("OMITE o event_id quando não há id, em vez de mandar vazio", () => {
    // Mesmo raciocínio do `transaction_id` do Google: id vazio faz a
    // plataforma tratar todas as vendas como a mesma e descartar o resto, o
    // que erra pra baixo. Omitir erra pra cima.
    const track = vi.fn();
    globalThis.window = { ttq: { track } } as never;
    compraTiktok({ valor: 38 });
    expect(track.mock.calls[0][2]).toBeUndefined();
  });

  it("id só com espaço conta como ausente", () => {
    const track = vi.fn();
    globalThis.window = { ttq: { track } } as never;
    compraTiktok({ valor: 38, eventId: "   " });
    expect(track.mock.calls[0][2]).toBeUndefined();
  });

  it("dólar passa como dólar, pro funil espanhol", () => {
    const track = vi.fn();
    globalThis.window = { ttq: { track } } as never;
    compraTiktok({ valor: 9, moeda: "USD", eventId: "x" });
    expect(track.mock.calls[0][1].currency).toBe("USD");
  });
});

describe("o script base", () => {
  it("carrega o id que recebeu", () => {
    expect(scriptTiktok("ABC123")).toContain("ttq.load('ABC123')");
  });

  it("dispara o page view sozinho", () => {
    expect(scriptTiktok("ABC123")).toContain("ttq.page()");
  });
});
