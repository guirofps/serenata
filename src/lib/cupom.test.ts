import { describe, expect, it } from "vitest";
import { centavosComCupom } from "./cupom";

const antes = new Date("2026-09-26T12:00:00Z");
describe("centavosComCupom", () => {
  it("SRN27 leva R$ 38 a R$ 28", () => {
    expect(centavosComCupom(3800, "srn27", antes)).toBe(2800);
  });
  it("código errado ou vazio não mexe", () => {
    expect(centavosComCupom(3800, "SRN99", antes)).toBe(3800);
    expect(centavosComCupom(3800, undefined, antes)).toBe(3800);
  });
  it("nunca sobe o preço", () => {
    expect(centavosComCupom(2500, "SRN27", antes)).toBe(2500);
  });
  it("vencido não vale", () => {
    expect(centavosComCupom(3800, "SRN27", new Date("2026-10-20T12:00:00Z"))).toBe(3800);
  });
});
