import { afterEach, describe, expect, it, vi } from "vitest";
import { meuPlano, planoControle, planoDe, PLANOS, variantesComPlano, varianteDePreco } from "./preco";
import {
  _resetConfigDoServidorParaTeste,
  definirConfigDoServidor,
  type ExperimentoConfig,
  type Plano,
} from "./experimentos";

// Ambiente de teste é "node" (vitest.config.ts), sem `window` — o mesmo ramo
// de `configAtual()` que roda no SERVIDOR de verdade. Por isso a config viva
// entra por `definirConfigDoServidor`, exatamente como `experimentos-config
// .server.ts` faria depois de ler o banco. Testar o ramo do cliente
// (`window.__SRN_CFG__`) é papel de `experimentos.test.ts`, que já prova
// (no describe "round-trip de isomorfia") que os dois ramos de `configAtual()`
// devolvem o mesmo valor — não há lógica nova a duplicar aqui.

/** Uma config de teste pro experimento `preco`, com plano em cada variante. */
function cfgComPlano(over: Partial<ExperimentoConfig> = {}): ExperimentoConfig[] {
  return [
    {
      id: "preco",
      ativo: true,
      exposicaoPct: 100,
      nota: "",
      variantes: [
        {
          nome: "A",
          peso: 1,
          plano: { texto: "R$ 41", valor: 41, ancora: "R$ 97", checkout: "https://exemplo/A41" },
        },
      ],
      ...over,
    },
  ];
}

describe("planoDe / planoControle", () => {
  afterEach(() => {
    _resetConfigDoServidorParaTeste();
  });

  it("cai no catálogo do código quando não há config no servidor", () => {
    expect(planoDe("pt", "A").checkout).toBe(PLANOS.pt.A.checkout);
    expect(planoControle("pt").checkout).toBe(PLANOS.pt.A.checkout);
  });

  it("prefere o plano que veio da config viva", () => {
    definirConfigDoServidor(cfgComPlano());
    expect(planoDe("pt", "A").texto).toBe("R$ 41");
    expect(planoDe("pt", "A").checkout).toBe("https://exemplo/A41");
    expect(planoControle("pt").texto).toBe("R$ 41");
  });

  it("variante sem plano na config cai no controle, nunca em preço vazio", () => {
    definirConfigDoServidor(cfgComPlano());
    // "Z" não existe em variante nenhuma — nem no código, nem na config.
    expect(planoDe("pt", "Z").texto).toBe("R$ 41");
  });

  it("controle sem plano cadastrado (config incompleta) cai no catálogo do código, não inventa preço", () => {
    definirConfigDoServidor(
      cfgComPlano({ variantes: [{ nome: "A", peso: 1 }] }), // sem `plano`
    );
    expect(planoControle("pt").checkout).toBe(PLANOS.pt.A.checkout);
    expect(planoDe("pt", "A").checkout).toBe(PLANOS.pt.A.checkout);
  });

  it("experimento desligado na config, mas ainda com plano nas variantes, não muda o controle público", () => {
    // Cenário real: admin desliga o experimento sem apagar os preços. O
    // controle continua vindo da PRIMEIRA variante da config (a mesma que
    // `cssExperimentos` trata como controle), não do código, porque é a
    // config que decide "quem é a variante zero" agora.
    definirConfigDoServidor(cfgComPlano({ ativo: false }));
    expect(planoControle("pt").texto).toBe("R$ 41");
  });

  it("espanhol nunca lê a config: sempre o plano único do código, mesmo com config ativa", () => {
    definirConfigDoServidor(cfgComPlano());
    expect(planoDe("es", "A").checkout).toBe(PLANOS.es.A.checkout);
    expect(planoControle("es").checkout).toBe(PLANOS.es.A.checkout);
    // E nem uma variante "B" inventada em português vaza pro espanhol.
    expect(planoDe("es", "B").checkout).toBe(PLANOS.es.A.checkout);
  });
});

describe("variantesComPlano", () => {
  afterEach(() => {
    _resetConfigDoServidorParaTeste();
  });

  it("sem config, usa o cruzamento do catálogo em código com o experimento em código", () => {
    expect(variantesComPlano("pt")).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("com config viva, lista exatamente as variantes que ELA precificou — a mesma fonte que o CSS usa", () => {
    definirConfigDoServidor(
      cfgComPlano({
        variantes: [
          { nome: "A", peso: 1, plano: PLANOS.pt.A },
          { nome: "B", peso: 1, plano: PLANOS.pt.B },
          // "C" está declarada mas ainda sem plano: não pode virar bloco na
          // tela (a mesma trava que sempre existiu, agora sobre dado vivo).
          { nome: "C", peso: 1 },
        ],
      }),
    );
    expect(variantesComPlano("pt")).toEqual(["A", "B"]);
  });

  it("espanhol ignora a config: sempre o plano único do código", () => {
    definirConfigDoServidor(cfgComPlano());
    expect(variantesComPlano("es")).toEqual(["A"]);
  });
});

describe("plano incompleto na config é tratado como inexistente", () => {
  afterEach(() => {
    _resetConfigDoServidorParaTeste();
  });

  // Casos de plano PARCIAL — o formato mais provável de erro de digitação
  // manual no banco hoje, e de formulário mal preenchido depois da Task 7.
  // Nenhum deles pode aparecer na tela nem virar link de checkout quebrado
  // (`undefined?ppc=...`); todos têm que se comportar como se a variante não
  // tivesse plano nenhum.
  const casos: Array<[string, Plano]> = [
    ["checkout vazio", { texto: "R$ 12", valor: 12, ancora: "R$ 97", checkout: "" }],
    ["valor não é número finito (NaN)", { texto: "R$ 12", valor: NaN, ancora: "R$ 97", checkout: "https://exemplo/G" }],
    ["texto vazio", { texto: "", valor: 12, ancora: "R$ 97", checkout: "https://exemplo/G" }],
    ["ancora vazia", { texto: "R$ 12", valor: 12, ancora: "", checkout: "https://exemplo/G" }],
  ];

  it.each(casos)("%s → variante cai fora de variantesComPlano e planoDe cai no controle", (_nome, planoParcial) => {
    definirConfigDoServidor(
      cfgComPlano({
        variantes: [
          { nome: "A", peso: 1, plano: PLANOS.pt.A },
          { nome: "G", peso: 1, plano: planoParcial },
        ],
      }),
    );
    expect(variantesComPlano("pt")).not.toContain("G");
    expect(planoDe("pt", "G").checkout).toBe(PLANOS.pt.A.checkout);
  });
});

describe("varianteDePreco: o gate tem que validar contra a MESMA lista que a tela usa", () => {
  afterEach(() => {
    _resetConfigDoServidorParaTeste();
    vi.unstubAllGlobals();
  });

  /**
   * Simula o atributo já carimbado no `<html>` pelo script de sorteio —
   * `varianteDe()` (`experimentos.ts`) lê `document.documentElement
   * .getAttribute`, e o ambiente de teste é Node, sem `document` de
   * verdade.
   */
  function carimbarVariante(nome: string) {
    vi.stubGlobal("document", {
      documentElement: { getAttribute: (attr: string) => (attr === "data-exp-preco" ? nome : null) },
    });
  }

  it(
    "variante que só existe na config viva (nome novo, sem deploy) resolve o MESMO preço e checkout que a tela já mostra — " +
      "bug real corrigido aqui: o gate validava contra PLANOS.pt (só código) e derrubava essa variante pro controle, " +
      "então a pessoa lia o preço de F na tela e o caixa cobrava o de A",
    () => {
      definirConfigDoServidor(
        cfgComPlano({
          variantes: [
            { nome: "A", peso: 1, plano: PLANOS.pt.A },
            {
              nome: "F",
              peso: 1,
              plano: { texto: "R$ 15", valor: 15, ancora: "R$ 97", checkout: "https://exemplo/F15" },
            },
          ],
        }),
      );
      carimbarVariante("F");

      // A TELA: `variantesComPlano`/`planoDe` já leem a config viva desde a
      // primeira parte da Task 5 — isto aqui só confirma a premissa do teste.
      expect(variantesComPlano("pt")).toContain("F");
      expect(planoDe("pt", "F").texto).toBe("R$ 15");

      // O CAIXA: `varianteDePreco` (via `meuPlano`) tem que concordar.
      expect(varianteDePreco("pt")).toBe("F");
      expect(meuPlano("pt").checkout).toBe("https://exemplo/F15");
      expect(meuPlano("pt").texto).toBe("R$ 15");
    },
  );

  it("variante carimbada que NÃO existe em lugar nenhum (nem código, nem config) cai no controle", () => {
    carimbarVariante("Z");
    expect(varianteDePreco("pt")).toBe("A");
    expect(meuPlano("pt").checkout).toBe(PLANOS.pt.A.checkout);
  });

  it("variante com plano incompleto na config também cai no controle no caixa, não só na tela", () => {
    definirConfigDoServidor(
      cfgComPlano({
        variantes: [
          { nome: "A", peso: 1, plano: PLANOS.pt.A },
          { nome: "G", peso: 1, plano: { texto: "R$ 12", valor: 12, ancora: "R$ 97", checkout: "" } },
        ],
      }),
    );
    carimbarVariante("G");
    expect(varianteDePreco("pt")).toBe("A");
    expect(meuPlano("pt").checkout).toBe(PLANOS.pt.A.checkout);
  });
});
