// src/lib/dia-do-clique.test.ts
import { describe, expect, it } from "vitest";
import { diaAnterior, diaNoFuso, planejarConsultas } from "./dia-do-clique";

describe("diaNoFuso", () => {
  it("usa o fuso da conta, não UTC", () => {
    expect(diaNoFuso("2026-10-08T02:30:00.000Z", "America/Sao_Paulo")).toBe("2026-10-07");
    expect(diaNoFuso("2026-10-08T03:30:00.000Z", "America/Sao_Paulo")).toBe("2026-10-08");
  });
  it("data inválida ou vazia é null", () => {
    expect(diaNoFuso("", "America/Sao_Paulo")).toBeNull();
    expect(diaNoFuso("ontem", "America/Sao_Paulo")).toBeNull();
  });
});

it("diaAnterior atravessa o mês", () => {
  expect(diaAnterior("2026-10-01")).toBe("2026-09-30");
});

describe("planejarConsultas", () => {
  const agora = new Date("2026-10-08T15:00:00Z");
  const fuso = "America/Sao_Paulo";
  it("agrupa por dia, do mais novo pro mais velho, sem repetir gclid", () => {
    expect(
      planejarConsultas(
        [
          { gclid: "a", capturadoEm: "2026-10-07T12:00:00Z" },
          { gclid: "b", capturadoEm: "2026-10-05T12:00:00Z" },
          { gclid: "c", capturadoEm: "2026-10-07T20:00:00Z" },
          { gclid: "a", capturadoEm: "2026-10-07T12:00:00Z" },
        ],
        fuso,
        agora,
      ),
    ).toEqual([
      { dia: "2026-10-07", gclids: ["a", "c"] },
      { dia: "2026-10-05", gclids: ["b"] },
    ]);
  });
  it("fora: clique com mais de 89 dias e captured_at ausente", () => {
    expect(
      planejarConsultas(
        [
          { gclid: "velho", capturadoEm: "2026-07-01T12:00:00Z" },
          { gclid: "sem", capturadoEm: null },
        ],
        fuso,
        agora,
      ),
    ).toEqual([]);
  });
  it("no máximo maxDias dias por execução", () => {
    const vendas = [1, 2, 3].map((d) => ({ gclid: `g${d}`, capturadoEm: `2026-10-0${d}T12:00:00Z` }));
    expect(planejarConsultas(vendas, fuso, agora, 2).map((x) => x.dia)).toEqual(["2026-10-03", "2026-10-02"]);
  });
});
