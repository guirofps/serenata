import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  creditoNoNavegador,
  esquecerCreditoNoNavegador,
  guardarCreditoNoNavegador,
} from "./credito-no-navegador";

// O CRACHÁ DE CRÉDITO.
//
// Ele existe porque o resgate acontece no fim do quiz SEGUINTE, numa sessão
// anônima. Se ele falhar, a pessoa que pagou R$ 28 é cobrada R$ 38 de novo —
// então as três garantias abaixo valem dinheiro, não elegância.

const memoria = () => {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
  };
};

describe("crachá de crédito", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoria());
  });

  it("guarda e devolve o token", () => {
    guardarCreditoNoNavegador("abcdef0123456789abcdef");
    expect(creditoNoNavegador()).toBe("abcdef0123456789abcdef");
  });

  it("esquece depois que o crédito foi gasto", () => {
    guardarCreditoNoNavegador("abcdef0123456789abcdef");
    esquecerCreditoNoNavegador();
    expect(creditoNoNavegador()).toBeNull();
  });

  it("recusa lixo curto: token de 8 letras não é token", () => {
    guardarCreditoNoNavegador("curto");
    expect(creditoNoNavegador()).toBeNull();
  });

  it("storage bloqueado não derruba a tela", () => {
    // Aba anônima e navegador com cookies de terceiros bloqueados LANÇAM ao
    // tocar no localStorage. Sem o try/catch isto quebraria a tela de oferta
    // inteira — a que cobra — por causa de uma conveniência.
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(() => guardarCreditoNoNavegador("abcdef0123456789abcdef")).not.toThrow();
    expect(creditoNoNavegador()).toBeNull();
    expect(() => esquecerCreditoNoNavegador()).not.toThrow();
  });
});
