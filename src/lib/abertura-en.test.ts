import { describe, expect, it } from "vitest";
import { destinoPularAbertura, scriptPularAbertura } from "./abertura-en";

describe("destinoPularAbertura", () => {
  const base = { variante: "B", pathname: "/criar", search: "?gclid=abc&utm_campaign=123", jaPulou: false };

  it("B no /criar sem passo vai pra primeira pergunta, levando os parâmetros do anúncio", () => {
    expect(destinoPularAbertura(base)).toBe("/criar?gclid=abc&utm_campaign=123&step=relacao");
  });
  it("A e C ficam", () => {
    expect(destinoPularAbertura({ ...base, variante: "A" })).toBeNull();
    expect(destinoPularAbertura({ ...base, variante: "C" })).toBeNull();
    expect(destinoPularAbertura({ ...base, variante: null })).toBeNull();
  });
  it("só uma vez por aba", () => {
    expect(destinoPularAbertura({ ...base, jaPulou: true })).toBeNull();
  });
  it("não mexe em quem já está num passo nem fora do /criar", () => {
    expect(destinoPularAbertura({ ...base, search: "?step=nome" })).toBeNull();
    expect(destinoPularAbertura({ ...base, pathname: "/" })).toBeNull();
  });
});

describe("scriptPularAbertura", () => {
  function rodar(v: string | null, search: string, pulou = false) {
    const guardado: Record<string, string> = pulou ? { mp_pulou_abertura: "1" } : {};
    let destino: string | null = null;
    const ambiente = {
      document: { documentElement: { getAttribute: () => v } },
      location: { pathname: "/criar", search, hash: "", replace: (u: string) => (destino = u) },
      sessionStorage: { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, x: string) => (guardado[k] = x) },
      URLSearchParams,
    };
    new Function(...Object.keys(ambiente), scriptPularAbertura())(...Object.values(ambiente));
    return { destino, guardado };
  }

  it("faz o mesmo que a regra pura", () => {
    expect(rodar("B", "?ttclid=x").destino).toBe("/criar?ttclid=x&step=relacao");
    expect(rodar("B", "?ttclid=x").guardado.mp_pulou_abertura).toBe("1");
    expect(rodar("A", "?ttclid=x").destino).toBeNull();
    expect(rodar("B", "?ttclid=x", true).destino).toBeNull();
    expect(rodar("B", "?step=nome").destino).toBeNull();
  });
});
