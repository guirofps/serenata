import { describe, it, expect, vi, beforeEach } from "vitest";
import { compraTiktok, checkoutTiktok, scriptTiktok } from "@/lib/tiktok-pixel";

// O PIXEL DO TIKTOK NÃƒO PODE QUEBRAR NADA.
//
// A conta foi comprada pra TESTAR. Enquanto o teste nÃ£o vinga, este cÃ³digo
// roda em cima de um funil que fatura todo dia, e a regra Ã©: sem id
// configurado, ele nÃ£o existe; com id, ele nÃ£o atrapalha o que jÃ¡ funciona.

// `window` global sem redeclarar o tipo dele: `declare global { var window }`
// entra em conflito com o `Window & typeof globalThis` que o TS jÃ¡ conhece, e
// o `tsc` reclama mesmo com o vitest passando.
const g = globalThis as unknown as { window: { ttq?: { track: (...a: unknown[]) => void } } };

beforeEach(() => {
  g.window = {};
});

describe("o pixel some quando nÃ£o hÃ¡ conta", () => {
  it("nÃ£o estoura quando `ttq` nÃ£o existe (id nÃ£o configurado)", () => {
    expect(() => compraTiktok({ valor: 38 })).not.toThrow();
    expect(() => checkoutTiktok({ valor: 38 })).not.toThrow();
  });
});

describe("a compra", () => {
  it("manda valor, moeda e o id de dedupe", () => {
    const track = vi.fn();
    g.window = { ttq: { track } };
    compraTiktok({ valor: 54.9, moeda: "BRL", eventId: "ref-123" });
    const [evento, dados, opcoes] = track.mock.calls[0];
    expect(evento).toBe("CompletePayment");
    expect(dados.value).toBe(54.9);
    expect(dados.currency).toBe("BRL");
    expect(opcoes).toEqual({ event_id: "ref-123" });
  });

  it("OMITE o event_id quando nÃ£o hÃ¡ id, em vez de mandar vazio", () => {
    // Mesmo raciocÃ­nio do `transaction_id` do Google: id vazio faz a
    // plataforma tratar todas as vendas como a mesma e descartar o resto, o
    // que erra pra baixo. Omitir erra pra cima.
    const track = vi.fn();
    g.window = { ttq: { track } };
    compraTiktok({ valor: 38 });
    expect(track.mock.calls[0][2]).toBeUndefined();
  });

  it("id sÃ³ com espaÃ§o conta como ausente", () => {
    const track = vi.fn();
    g.window = { ttq: { track } };
    compraTiktok({ valor: 38, eventId: "   " });
    expect(track.mock.calls[0][2]).toBeUndefined();
  });

  it("dÃ³lar passa como dÃ³lar, pro funil espanhol", () => {
    const track = vi.fn();
    g.window = { ttq: { track } };
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

