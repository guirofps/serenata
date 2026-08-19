import { describe, expect, it } from "vitest";
import {
  scriptExperimentos,
  cssExperimentos,
  scriptConfigGlobal,
  configAtual,
  definirConfigDoServidor,
  type ExperimentoConfig,
} from "./experimentos";

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
  new Function(...chaves, script)(...valores);
  return { atributos, guardado };
}

/** Uma config de teste. Todos os casos partem daqui. */
export const cfg = (over: Partial<ExperimentoConfig> = {}): ExperimentoConfig[] => [
  {
    id: "preco",
    ativo: true,
    exposicaoPct: 100,
    nota: "",
    variantes: [
      { nome: "A", peso: 1 },
      { nome: "B", peso: 1 },
    ],
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

  it("divide pelo peso", () => {
    // 0.2 do total 2 cai na primeira fatia; 0.9 na segunda.
    expect(
      rodarScript(scriptExperimentos(cfg()), { aleatorios: [0.2] }).atributos["data-exp-preco"],
    ).toBe("A");
    expect(
      rodarScript(scriptExperimentos(cfg()), { aleatorios: [0.9] }).atributos["data-exp-preco"],
    ).toBe("B");
  });

  it("peso desigual é respeitado", () => {
    const c = cfg({
      variantes: [
        { nome: "A", peso: 9 },
        { nome: "B", peso: 1 },
      ],
    });
    expect(
      rodarScript(scriptExperimentos(c), { aleatorios: [0.85] }).atributos["data-exp-preco"],
    ).toBe("A");
    expect(
      rodarScript(scriptExperimentos(c), { aleatorios: [0.95] }).atributos["data-exp-preco"],
    ).toBe("B");
  });

  it("exposição de 0% joga todo mundo pra fora", () => {
    const c = cfg({ exposicaoPct: 0 });
    expect(
      rodarScript(scriptExperimentos(c), { aleatorios: [0.01, 0.5] }).atributos["data-exp-preco"],
    ).toBe("fora");
  });

  it("exposição de 100% nunca produz `fora`", () => {
    for (const r of [0.001, 0.5, 0.999]) {
      const v = rodarScript(scriptExperimentos(cfg()), { aleatorios: [r, r] }).atributos[
        "data-exp-preco"
      ];
      expect(v).not.toBe("fora");
    }
  });

  it("exposição parcial separa quem entra de quem fica fora", () => {
    const c = cfg({ exposicaoPct: 30 });
    // primeiro sorteio = exposição; 0.1 < 0.30 entra, 0.9 fica fora
    expect(
      rodarScript(scriptExperimentos(c), { aleatorios: [0.1, 0.2] }).atributos["data-exp-preco"],
    ).toBe("A");
    expect(
      rodarScript(scriptExperimentos(c), { aleatorios: [0.9, 0.2] }).atributos["data-exp-preco"],
    ).toBe("fora");
  });

  it("experimento desligado não carimba", () => {
    expect(
      rodarScript(scriptExperimentos(cfg({ ativo: false })), { aleatorios: [0.5] }).atributos,
    ).toEqual({});
  });

  it("?exp= força a variante", () => {
    const r = rodarScript(scriptExperimentos(cfg()), {
      aleatorios: [0.1],
      busca: "?exp=preco:b",
    });
    expect(r.atributos["data-exp-preco"]).toBe("B");
    expect(r.guardado["mp_exp:preco"]).toBe("B");
  });
});

describe("cssExperimentos", () => {
  it("esconde toda variante e revela `fora` como controle", () => {
    const css = cssExperimentos(cfg({ exposicaoPct: 30 }));
    expect(css).toContain('[data-v="preco:A"],[data-v="preco:B"]{display:none}');
    expect(css).toContain('html[data-exp-preco="fora"] [data-v="preco:A"]{display:contents}');
  });

  it("desligado deixa só o controle visível", () => {
    const css = cssExperimentos(cfg({ ativo: false }));
    expect(css).toContain('[data-v="preco:A"]{display:contents}');
    expect(css).not.toContain('html[data-exp-preco="B"]');
  });
});

describe("scriptConfigGlobal", () => {
  it("planta window.__SRN_CFG__ com a config inteira", () => {
    const script = scriptConfigGlobal(cfg());
    expect(script.startsWith("window.__SRN_CFG__=")).toBe(true);
    expect(script.endsWith(";")).toBe(true);
    // Precisa fechar o roundtrip: é isto que garante que o cliente, lendo de
    // volta `window.__SRN_CFG__`, enxerga exatamente a config que o servidor
    // usou pra gerar scriptExperimentos/cssExperimentos.
    const jsonBruto = script.slice("window.__SRN_CFG__=".length, -1);
    expect(JSON.parse(jsonBruto)).toEqual(cfg());
  });

  it("escapa `<` pra não deixar `nota` fechar a tag <script> mais cedo", () => {
    // Se isto vazasse cru, `nota` como `</script><script>alert(1)</script>`
    // injetaria HTML no <head> de todo visitante — a config vem do painel,
    // texto livre digitado por gente.
    const script = scriptConfigGlobal(cfg({ nota: "</script><script>alert(1)</script>" }));
    expect(script).not.toContain("</script>");
    expect(script).toContain("\\u003c/script\\u003e");
  });
});

describe("configAtual (isomórfico)", () => {
  // O vitest roda em Node (vitest.config.ts: environment "node"), então
  // `typeof window === "undefined"` aqui é verdade — o mesmo ramo que
  // `configAtual()` toma no SERVIDOR de verdade. É o ramo que mais importa
  // testar: é o que decide o que vai pro <head> em toda visita.

  it("sem snapshot do servidor, cai no fallback com tudo desligado", () => {
    // PRECISA rodar antes do teste abaixo: `snapshotDoServidor` é uma
    // variável de módulo, e só este teste enxerga o estado "ninguém plantou
    // nada ainda" — depois que o próximo teste chamar `definirConfigDoServidor`,
    // o valor plantado passa a valer pro resto do arquivo.
    const c = configAtual().find((e) => e.id === "preco");
    expect(c?.ativo).toBe(false);
  });

  it("com snapshot do servidor, devolve exatamente o que foi plantado", () => {
    const plantada = cfg({ ativo: true, exposicaoPct: 42 });
    definirConfigDoServidor(plantada);
    expect(configAtual()).toEqual(plantada);
  });
});
