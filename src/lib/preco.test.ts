import { afterEach, describe, expect, it } from "vitest";
import { planoControle, planoDe, PLANOS, variantesComPlano } from "./preco";
import {
  _resetConfigDoServidorParaTeste,
  definirConfigDoServidor,
  type ExperimentoConfig,
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
