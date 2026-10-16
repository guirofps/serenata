import { describe, expect, it } from "vitest";
import { formatoDoQuando } from "./quando-musica";

// A data do card do painel segue o país de quem lê (16/10): o espanhol da
// Ballad saía no formato e no fuso do Brasil.

describe("formatoDoQuando", () => {
  it("português: dia antes do mês, no fuso de São Paulo", () => {
    const o = formatoDoQuando("pt", false).resolvedOptions();
    expect(o.locale).toBe("pt-BR");
    expect(o.timeZone).toBe("America/Sao_Paulo");
  });

  it("espanhol da Ballad: es-US, relógio de 12 horas, fuso do aparelho", () => {
    const f = formatoDoQuando("es", true);
    const o = f.resolvedOptions();
    expect(o.locale).toBe("es-US");
    expect(o.timeZone).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(f.format(new Date(2026, 9, 3, 15, 0))).toMatch(/p\.\s?m\./);
  });

  it("espanhol da Serenata (Argentina): es-AR, sem o fuso do Brasil forçado", () => {
    const o = formatoDoQuando("es", false).resolvedOptions();
    expect(o.locale).toBe("es-AR");
    expect(o.timeZone).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("inglês: mês antes do dia", () => {
    const f = formatoDoQuando("en", true);
    expect(f.resolvedOptions().locale).toBe("en-US");
    expect(f.format(new Date(2026, 9, 3, 15, 0))).toMatch(/^10\/03/);
  });
});
