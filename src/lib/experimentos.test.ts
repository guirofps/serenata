import { describe, expect, it } from "vitest";
import { scriptExperimentos, cssExperimentos } from "./experimentos";

/**
 * Roda a string que vai de verdade pro <head>, num mundo de mentira.
 *
 * Testar uma cópia em TypeScript da mesma lógica seria mais confortável e
 * mais inútil: a cópia diverge do original em silêncio, e aí o teste passa
 * enquanto o site erra.
 */
export function rodarScript(
  script: string,
  opcoes: { aleatorios: number[]; guardado?: Record<string, string>; busca?: string } = {
    aleatorios: [0.5],
  },
): { atributos: Record<string, string>; guardado: Record<string, string> } {
  const atributos: Record<string, string> = {};
  const guardado: Record<string, string> = { ...(opcoes.guardado ?? {}) };
  let i = 0;

  const contexto = {
    document: {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          atributos[k] = v;
        },
      },
    },
    localStorage: {
      getItem: (k: string) => guardado[k] ?? null,
      setItem: (k: string, v: string) => {
        guardado[k] = v;
      },
    },
    location: { search: opcoes.busca ?? "" },
    Math: { ...Math, random: () => opcoes.aleatorios[i++ % opcoes.aleatorios.length] },
    URLSearchParams,
  };

  const chaves = Object.keys(contexto);
  const valores = Object.values(contexto);
  // eslint-disable-next-line no-new-func
  new Function(...chaves, script)(...valores);
  return { atributos, guardado };
}

import type { ExperimentoConfig } from "./experimentos";

/** Uma config de teste. Todos os casos partem daqui. */
export const cfg = (over: Partial<ExperimentoConfig> = {}): ExperimentoConfig[] => [
  {
    id: "preco",
    ativo: true,
    exposicaoPct: 100,
    nota: "",
    variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 1 }],
    ...over,
  },
];

describe("scriptExperimentos", () => {
  it("config vazia produz script inerte", () => {
    // É o que protege o pré-render da home: no build não existe banco, o
    // fallback tem tudo desligado, e o script congelado no HTML estático não
    // pode sortear ninguém com config velha.
    expect(scriptExperimentos([])).toBe("");
  });

  it("respeita a escolha já guardada no navegador", () => {
    const { atributos } = rodarScript(scriptExperimentos(cfg()), {
      aleatorios: [0.99],
      guardado: { "mp_exp:preco": "A" },
    });
    expect(atributos["data-exp-preco"]).toBe("A");
  });
});
