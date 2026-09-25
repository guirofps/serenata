import { describe, expect, it } from "vitest";
import { diasAte, hojeEmBrasilia } from "./datas-especiais";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);

describe("diasAte", () => {
  it("conta até a próxima ocorrência no ano", () => {
    expect(diasAte(5, 10, dia("2026-09-25"))).toBe(10);
    expect(diasAte(25, 9, dia("2026-09-25"))).toBe(0);
  });

  it("data que já passou este ano conta pro ano que vem", () => {
    expect(diasAte(24, 9, dia("2026-09-25"))).toBe(364);
    expect(diasAte(3, 1, dia("2026-12-24"))).toBe(10);
  });

  it("29/02 em ano sem ele é lembrado no dia 28", () => {
    expect(diasAte(29, 2, dia("2027-02-18"))).toBe(10);
    expect(diasAte(29, 2, dia("2028-02-19"))).toBe(10);
  });
});

describe("hojeEmBrasilia", () => {
  it("01h UTC ainda é o dia anterior em Brasília", () => {
    expect(hojeEmBrasilia(new Date("2026-09-26T01:00:00Z")).toISOString().slice(0, 10)).toBe(
      "2026-09-25",
    );
    expect(hojeEmBrasilia(new Date("2026-09-26T04:00:00Z")).toISOString().slice(0, 10)).toBe(
      "2026-09-26",
    );
  });
});
