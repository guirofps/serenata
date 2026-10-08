import { describe, expect, it } from "vitest";
import {
  CHAVE_CPF,
  avisoDoCpf,
  bracoDaFolha,
  cpfNoResumo,
  guardarCpf,
  lerCpfGuardado,
  rotuloGerar,
} from "./folha-pix";
import { EXPERIMENTOS, FORA } from "./experimentos";

// CPF de teste com dígitos verificadores certos (gerado, não é de ninguém).
const VALIDO = "52998224725";

function guardaFalsa(inicial: Record<string, string> = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe("bracoDaFolha", () => {
  it("A, B e C viram o próprio braço", () => {
    expect(bracoDaFolha("A")).toBe("A");
    expect(bracoDaFolha("B")).toBe("B");
    expect(bracoDaFolha("C")).toBe("C");
  });

  it("quem ficou fora, sem carimbo ou com nome estranho vê a folha de sempre", () => {
    expect(bracoDaFolha(FORA)).toBe("A");
    expect(bracoDaFolha(null)).toBe("A");
    expect(bracoDaFolha(undefined)).toBe("A");
    expect(bracoDaFolha("")).toBe("A");
    expect(bracoDaFolha("Z")).toBe("A");
  });

  it("renomear o braço pra desgrudar quem foi sorteado NÃO desliga ele", () => {
    expect(bracoDaFolha("B2")).toBe("B");
    expect(bracoDaFolha("c3")).toBe("C");
  });

  it("só B e C pedem o CPF no resumo, e só o C leva o valor no botão", () => {
    expect(cpfNoResumo("A")).toBe(false);
    expect(cpfNoResumo("B")).toBe(true);
    expect(cpfNoResumo("C")).toBe(true);
    expect(rotuloGerar("A", "R$ 38")).toBe("Gerar meu PIX");
    expect(rotuloGerar("B", "R$ 38")).toBe("Gerar meu PIX");
    expect(rotuloGerar("C", "R$ 62,90")).toBe("Gerar PIX de R$ 62,90");
  });
});

describe("o CPF guardado no navegador", () => {
  it("guarda só os dígitos, e lê de volta", () => {
    const g = guardaFalsa();
    expect(guardarCpf("529.982.247-25", g)).toBe(true);
    expect(g.m.get(CHAVE_CPF)).toBe(VALIDO);
    expect(lerCpfGuardado(g)).toBe(VALIDO);
  });

  it("CPF que não fecha nunca é guardado", () => {
    const g = guardaFalsa();
    expect(guardarCpf("52998224724", g)).toBe(false);
    expect(guardarCpf("111.111.111-11", g)).toBe(false);
    expect(guardarCpf("123", g)).toBe(false);
    expect(g.m.size).toBe(0);
  });

  it("valor torto no navegador não vira CPF pré-preenchido", () => {
    expect(lerCpfGuardado(guardaFalsa({ [CHAVE_CPF]: "52998224724" }))).toBe("");
    expect(lerCpfGuardado(guardaFalsa({ [CHAVE_CPF]: "lixo" }))).toBe("");
    expect(lerCpfGuardado(guardaFalsa())).toBe("");
  });

  it("sem armazenamento (modo anônimo, servidor) nada quebra", () => {
    expect(lerCpfGuardado(null)).toBe("");
    expect(guardarCpf(VALIDO, null)).toBe(false);
    const explode = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    expect(lerCpfGuardado(explode)).toBe("");
    expect(guardarCpf(VALIDO, explode)).toBe(false);
  });
});

describe("avisoDoCpf", () => {
  it("não reclama enquanto a pessoa ainda está digitando", () => {
    expect(avisoDoCpf("", false)).toBeNull();
    expect(avisoDoCpf("529", false)).toBeNull();
    expect(avisoDoCpf(VALIDO, false)).toBeNull();
    expect(avisoDoCpf(VALIDO, true)).toBeNull();
  });

  it("11 dígitos que não fecham reclamam na hora", () => {
    expect(avisoDoCpf("52998224724", false)).toMatch(/não confere/);
  });

  it("depois do toque em pagar, diz o que falta", () => {
    expect(avisoDoCpf("", true)).toBe("Falta o CPF pra gerar o PIX.");
    expect(avisoDoCpf("529.98", true)).toBe("Faltam números no CPF.");
  });

  it("nenhum texto com travessão", () => {
    for (const t of [avisoDoCpf("", true), avisoDoCpf("52", true), avisoDoCpf("52998224724", false)]) {
      expect(t).not.toContain("—");
    }
  });
});

describe("o experimento no catálogo", () => {
  it("folha_pix existe, desligado no código, com A como controle e três braços iguais", () => {
    const e = EXPERIMENTOS.find((x) => x.id === "folha_pix");
    expect(e).toBeDefined();
    expect(e?.ativo).toBe(false);
    expect(e?.variantes).toEqual(["A", "B", "C"]);
    expect(e?.peso).toEqual([1, 1, 1]);
  });
});
