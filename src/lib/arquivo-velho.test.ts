import { describe, expect, it } from "vitest";
import { deveRecarregar, deveReabrirCaixa, JANELA_MS } from "./arquivo-velho";

describe("deveReabrirCaixa (o caixa que a recarga fechou)", () => {
  const agora = 1_800_000_000_000;
  it("reabre logo depois da recarga", () => {
    expect(deveReabrirCaixa(agora, agora - 3_000)).toBe(true);
  });
  it("não reabre sem pedido, com pedido velho, estragado ou do futuro", () => {
    expect(deveReabrirCaixa(agora, null)).toBe(false);
    expect(deveReabrirCaixa(agora, agora - JANELA_MS - 1)).toBe(false);
    expect(deveReabrirCaixa(agora, Number.NaN)).toBe(false);
    expect(deveReabrirCaixa(agora, agora + 10_000)).toBe(false);
  });
});

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
