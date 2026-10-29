import { describe, expect, it } from "vitest";
import { deveRecarregar, JANELA_MS } from "./arquivo-velho";

describe("deveRecarregar", () => {
  const agora = 1_800_000_000_000;

  it("recarrega quando nunca recarregou", () => {
    expect(deveRecarregar(agora, null)).toBe(true);
  });

  it("não recarrega de novo dentro de um minuto (sem laço)", () => {
    expect(deveRecarregar(agora, agora - 5_000)).toBe(false);
    expect(deveRecarregar(agora, agora - JANELA_MS)).toBe(false);
  });

  it("recarrega de novo depois de um minuto (outra publicação)", () => {
    expect(deveRecarregar(agora, agora - JANELA_MS - 1)).toBe(true);
  });

  it("valor estragado no storage conta como nunca", () => {
    expect(deveRecarregar(agora, Number.NaN)).toBe(true);
  });
});
