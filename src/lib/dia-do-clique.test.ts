// src/lib/dia-do-clique.test.ts
import { describe, expect, it } from "vitest";
import { diaAnterior, diaNoFuso, planejarConsultas, precisaConsultar } from "./dia-do-clique";

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

describe("precisaConsultar", () => {
  const agora = new Date("2026-10-08T15:00:00Z");
  const fuso = "America/Sao_Paulo";
  const h = (horas: number) => new Date(agora.getTime() - horas * 3600000).toISOString();
  it("nunca consultado: consulta", () => {
    expect(precisaConsultar(undefined, agora, fuso)).toBe(true);
  });
  it("achado com anúncio, ou achado sem anúncio (PMAX): não consulta mais", () => {
    expect(precisaConsultar({ anuncio_id: "1", campanha_id: "9", dia: "2026-10-01", tentado_em: h(100) }, agora, fuso)).toBe(false);
    expect(precisaConsultar({ anuncio_id: null, campanha_id: "9", dia: "2026-10-01", tentado_em: h(100) }, agora, fuso)).toBe(false);
  });
  it("clique de hoje/ontem não achado: tenta de novo depois de 2h", () => {
    expect(precisaConsultar({ anuncio_id: null, campanha_id: null, dia: "2026-10-08", tentado_em: h(1) }, agora, fuso)).toBe(false);
    expect(precisaConsultar({ anuncio_id: null, campanha_id: null, dia: "2026-10-07", tentado_em: h(3) }, agora, fuso)).toBe(true);
  });
  it("clique antigo não achado: espera 24h", () => {
    expect(precisaConsultar({ anuncio_id: null, campanha_id: null, dia: "2026-10-01", tentado_em: h(3) }, agora, fuso)).toBe(false);
    expect(precisaConsultar({ anuncio_id: null, campanha_id: null, dia: "2026-10-01", tentado_em: h(25) }, agora, fuso)).toBe(true);
  });
});
