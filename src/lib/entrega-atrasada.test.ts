import { describe, expect, it } from "vitest";
import { emLotes, faltamEntregar } from "./entrega-atrasada";

// A segunda varredura do vigia de pagamento (auditoria de 08/10): o teto
// vinha antes do filtro e a janela de 72h virava 4 a 6 horas.

describe("faltamEntregar", () => {
  it("o teto vale DEPOIS de tirar quem já recebeu", () => {
    // 50 pagos recentes já entregues na frente, e o comprador esquecido
    // depois deles. Com o teto antes do filtro, ele nunca aparecia.
    const pagos = [
      ...Array.from({ length: 50 }, (_, i) => ({ quiz_response_id: `ok-${i}` })),
      { quiz_response_id: "esquecido" },
    ];
    const ja = new Set(pagos.slice(0, 50).map((p) => p.quiz_response_id));
    expect(faltamEntregar(pagos, ja, 40)).toEqual([{ quiz_response_id: "esquecido" }]);
  });

  it("um por quiz e no máximo `max`", () => {
    const pagos = [
      { quiz_response_id: "a" },
      { quiz_response_id: "a" },
      { quiz_response_id: "b" },
      { quiz_response_id: null },
      { quiz_response_id: "c" },
    ];
    expect(faltamEntregar(pagos, new Set(), 2)).toEqual([{ quiz_response_id: "a" }, { quiz_response_id: "b" }]);
  });
});

describe("emLotes", () => {
  it("parte sem perder nem repetir", () => {
    const itens = Array.from({ length: 250 }, (_, i) => i);
    const lotes = emLotes(itens, 100);
    expect(lotes.map((l) => l.length)).toEqual([100, 100, 50]);
    expect(lotes.flat()).toEqual(itens);
    expect(emLotes([], 100)).toEqual([]);
  });

  it("lote vazio é erro, não laço infinito", () => {
    expect(() => emLotes([1], 0)).toThrow();
  });
});
