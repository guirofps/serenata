import { describe, expect, it } from "vitest";
import {
  CHAVE_PIX_ABERTO,
  JANELA_REABRE_MS,
  esquecerPixAberto,
  guardarPixAberto,
  lerPixAberto,
  pixParaReabrir,
  pixReabreLigado,
  type PixAberto,
} from "@/lib/pix-reabre";

const AGORA = 1_760_000_000_000;
const BOM: PixAberto = {
  referencia: "serenata:7b1c0b8e-1111-4c1e-9a2b-000000000000:q",
  sessionId: "sessao-1",
  criadoEm: AGORA - 5 * 60 * 1000,
  texto: "R$ 38",
  ancora: "R$ 89,90",
  valor: 38,
};

describe("reabrir ou não", () => {
  it("registro bom, da mesma sessão, com menos de 1h: reabre", () => {
    expect(pixParaReabrir(BOM, AGORA, "sessao-1")).toEqual(BOM);
  });

  it("referência do Asaas também vale", () => {
    expect(pixParaReabrir({ ...BOM, referencia: "pay_abc123XYZ" }, AGORA, "sessao-1")?.referencia).toBe(
      "pay_abc123XYZ",
    );
  });

  it("outra sessão (outra música) nunca herda o PIX", () => {
    expect(pixParaReabrir(BOM, AGORA, "sessao-2")).toBeNull();
  });

  it("a janela é de uma hora, fechada no fim", () => {
    expect(pixParaReabrir({ ...BOM, criadoEm: AGORA - JANELA_REABRE_MS + 1 }, AGORA, "sessao-1")).not.toBeNull();
    expect(pixParaReabrir({ ...BOM, criadoEm: AGORA - JANELA_REABRE_MS }, AGORA, "sessao-1")).toBeNull();
  });

  it("registro do futuro não vale", () => {
    expect(pixParaReabrir({ ...BOM, criadoEm: AGORA + 1000 }, AGORA, "sessao-1")).toBeNull();
  });

  it("lixo no armazenamento não quebra nada", () => {
    for (const cru of [null, undefined, "x", 3, [], {}, { ...BOM, referencia: "" }]) {
      expect(pixParaReabrir(cru, AGORA, "sessao-1")).toBeNull();
    }
    expect(pixParaReabrir({ ...BOM, referencia: "../../admin" }, AGORA, "sessao-1")).toBeNull();
    expect(pixParaReabrir({ ...BOM, referencia: "a".repeat(200) }, AGORA, "sessao-1")).toBeNull();
    expect(pixParaReabrir({ ...BOM, valor: 0 }, AGORA, "sessao-1")).toBeNull();
    expect(pixParaReabrir({ ...BOM, texto: "" }, AGORA, "sessao-1")).toBeNull();
    expect(pixParaReabrir({ ...BOM, criadoEm: "ontem" }, AGORA, "sessao-1")).toBeNull();
  });

  it("âncora vazia vira ausente", () => {
    expect(pixParaReabrir({ ...BOM, ancora: "" }, AGORA, "sessao-1")?.ancora).toBeUndefined();
  });
});

describe("o armazenamento", () => {
  function guardaFalsa() {
    const m = new Map<string, string>();
    return {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  }

  it("guarda, lê e esquece", () => {
    const g = guardaFalsa();
    guardarPixAberto(BOM, g);
    expect(g.m.has(CHAVE_PIX_ABERTO)).toBe(true);
    expect(pixParaReabrir(lerPixAberto(g), AGORA, "sessao-1")).toEqual(BOM);
    esquecerPixAberto(g);
    expect(lerPixAberto(g)).toBeNull();
  });

  it("JSON torto e armazenamento que lança viram nada", () => {
    const g = guardaFalsa();
    g.m.set(CHAVE_PIX_ABERTO, "{nao é json");
    expect(lerPixAberto(g)).toBeNull();
    const quebrada = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("cheio");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(() => guardarPixAberto(BOM, quebrada)).not.toThrow();
    expect(lerPixAberto(quebrada)).toBeNull();
    expect(() => esquecerPixAberto(quebrada)).not.toThrow();
  });
});

describe("o braço", () => {
  it("só o B, só no pt", () => {
    expect(pixReabreLigado("B", "pt")).toBe(true);
    expect(pixReabreLigado("A", "pt")).toBe(false);
    expect(pixReabreLigado("fora", "pt")).toBe(false);
    expect(pixReabreLigado("B", "es")).toBe(false);
    expect(pixReabreLigado("B", "en")).toBe(false);
  });
});
