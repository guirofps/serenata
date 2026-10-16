import { describe, expect, it } from "vitest";
import { tipoSugerido } from "./datas-especiais";

describe("tipo de data sugerido pela relação", () => {
  it("esposa e marido: aniversário de casamento", () => {
    expect(tipoSugerido("esposa")).toBe("casamento");
    expect(tipoSugerido("marido")).toBe("casamento");
  });
  it("namorados: aniversário de namoro", () => {
    expect(tipoSugerido("namorada")).toBe("namoro");
    expect(tipoSugerido("namorado")).toBe("namoro");
  });
  it("o resto: aniversário", () => {
    expect(tipoSugerido("mae")).toBe("aniversario");
    expect(tipoSugerido(null)).toBe("aniversario");
  });
});
