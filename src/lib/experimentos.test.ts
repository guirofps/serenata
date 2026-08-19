import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  scriptExperimentos,
  cssExperimentos,
  scriptConfigGlobal,
  configAtual,
  definirConfigDoServidor,
  _resetConfigDoServidorParaTeste,
  type ExperimentoConfig,
  type ExperimentoConfigPublica,
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

  it("peso zero num braço tira ele do sorteio, sem apagar a variante", () => {
    // `0` é peso VÁLIDO — zerar B é como parar de mandar tráfego pra ele sem
    // apagar a variante (o painel vai deixar fazer isso). Bug que isto
    // protege: `v.peso || 1` tratava `0` como ausente e sorteava B do mesmo
    // jeito, na fatia de peso 1.
    const c = cfg({
      variantes: [
        { nome: "A", peso: 1 },
        { nome: "B", peso: 0 },
      ],
    });
    for (const r of [0.01, 0.5, 0.999]) {
      expect(
        rodarScript(scriptExperimentos(c), { aleatorios: [r] }).atributos["data-exp-preco"],
      ).toBe("A");
    }
  });

  it("todos os pesos zerados cai no controle, nunca trava e nunca sorteia variante", () => {
    const c = cfg({
      variantes: [
        { nome: "A", peso: 0 },
        { nome: "B", peso: 0 },
      ],
    });
    for (const r of [0.01, 0.5, 0.999]) {
      expect(
        rodarScript(scriptExperimentos(c), { aleatorios: [r] }).atributos["data-exp-preco"],
      ).toBe("A");
    }
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

  it("desligado esconde TODAS as variantes e deixa só o controle visível", () => {
    // Regressão de 10/08: desligar um experimento fazia a linha de
    // `display:none` sumir do CSS inteiro (não só a de reveal), e a variante
    // B ficava sem regra nenhuma — ou seja, visível pra 100% do tráfego. Esta
    // é a asserção que pegaria essa regressão: o teste antigo só checava a
    // linha do controle, que sempre existiu mesmo com o bug.
    const css = cssExperimentos(cfg({ ativo: false }));
    expect(css).toContain('[data-v="preco:A"],[data-v="preco:B"]{display:none}');
    expect(css).toContain('[data-v="preco:A"]{display:contents}');
    expect(css).not.toContain('html[data-exp-preco="B"]');
  });
});

describe("scriptConfigGlobal", () => {
  it("planta window.__SRN_CFG__ com a config recebida", () => {
    const script = scriptConfigGlobal(cfg());
    expect(script.startsWith("window.__SRN_CFG__=")).toBe(true);
    expect(script.endsWith(";")).toBe(true);
    // Precisa fechar o roundtrip: é isto que garante que o cliente, lendo de
    // volta `window.__SRN_CFG__`, enxerga exatamente a config que o servidor
    // usou pra gerar scriptExperimentos/cssExperimentos.
    const jsonBruto = script.slice("window.__SRN_CFG__=".length, -1);
    expect(JSON.parse(jsonBruto)).toEqual(cfg());
  });

  it("escapa `<` pra não deixar texto livre fechar a tag <script> mais cedo", () => {
    // scriptConfigGlobal é um serializador burro — quem decide o que entra
    // é configAtual()/projetarParaPublico (ver describe abaixo). Aqui só
    // provamos que, seja lá o que for embarcado, `</script>` não sobrevive.
    const script = scriptConfigGlobal(
      cfg({
        variantes: [
          {
            nome: "A",
            peso: 1,
            plano: {
              texto: "</script><script>alert(1)</script>",
              valor: 1,
              ancora: "",
              checkout: "",
            },
          },
        ],
      }),
    );
    expect(script).not.toContain("</script>");
    expect(script).toContain("\\u003c/script\\u003e");
  });
});

describe("configAtual (isomórfico)", () => {
  // O vitest roda em Node (vitest.config.ts: environment "node"), então
  // `typeof window === "undefined"` aqui é verdade — o mesmo ramo que
  // `configAtual()` toma no SERVIDOR de verdade.
  afterEach(() => {
    _resetConfigDoServidorParaTeste();
  });

  it("sem snapshot do servidor, cai no fallback com tudo desligado", () => {
    const c = configAtual().find((e) => e.id === "preco");
    expect(c?.ativo).toBe(false);
  });

  it("com snapshot do servidor, devolve os campos públicos exatamente como plantados — e `nota` não sobrevive", () => {
    const plantada = cfg({ ativo: true, exposicaoPct: 42, nota: "estratégia interna de preço" });
    definirConfigDoServidor(plantada);

    const publica: ExperimentoConfigPublica[] = configAtual();
    expect(publica).toEqual([
      {
        id: "preco",
        ativo: true,
        exposicaoPct: 42,
        variantes: [
          { nome: "A", peso: 1 },
          { nome: "B", peso: 1 },
        ],
      },
    ]);
    expect(JSON.stringify(publica)).not.toContain("nota");
    expect(JSON.stringify(publica)).not.toContain("estratégia interna");
  });
});

describe("round-trip de isomorfia (servidor → HTML → cliente)", () => {
  afterEach(() => {
    _resetConfigDoServidorParaTeste();
    vi.unstubAllGlobals();
  });

  it("scriptConfigGlobal, scriptExperimentos e cssExperimentos saem byte a byte iguais dos dois lados, mesmo com payload malicioso, e `nota` não faz a viagem", () => {
    const cfgCrua = cfg({
      exposicaoPct: 42,
      nota: "estratégia de preço interna: </script><script>alert(document.cookie)</script>",
    });

    // SERVIDOR: planta o snapshot cru (como `recarregar()` faria de verdade)
    // e lê pelo MESMO caminho que `RootShell` usa — já projetado.
    definirConfigDoServidor(cfgCrua);
    const cfgServidor = configAtual(); // typeof window === "undefined" aqui
    const scriptCfgServidor = scriptConfigGlobal(cfgServidor);
    const scriptSorteioServidor = scriptExperimentos(cfgServidor);
    const cssServidor = cssExperimentos(cfgServidor);

    // CLIENTE: roda o <script> de verdade num sandbox de Node (`vm`) — é
    // literalmente o que o navegador faz ao parsear o <head> — e planta um
    // `window` global pra `configAtual()` tomar o ramo do cliente, do jeito
    // que ele tomaria no navegador de verdade.
    const sandbox: { window: Record<string, unknown> } = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(scriptCfgServidor, sandbox);
    vi.stubGlobal("window", sandbox.window);

    const cfgCliente = configAtual(); // typeof window !== "undefined" agora
    expect(cfgCliente).toEqual(cfgServidor);
    expect(scriptConfigGlobal(cfgCliente)).toBe(scriptCfgServidor);
    expect(scriptExperimentos(cfgCliente)).toBe(scriptSorteioServidor);
    expect(cssExperimentos(cfgCliente)).toBe(cssServidor);

    // E o payload malicioso não sobrevive à viagem: nem quebra a tag `<script>`,
    // nem carrega a `nota` (que nem deveria estar em `window.__SRN_CFG__`).
    expect(scriptCfgServidor).not.toContain("</script>");
    expect(scriptCfgServidor).not.toContain("estratégia de preço interna");
    expect(JSON.stringify(sandbox.window.__SRN_CFG__)).not.toContain("estratégia");
  });
});
