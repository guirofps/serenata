import { afterEach, expect, it } from "vitest";
import { planoCobravelDe } from "./preco";
import { descontoNaTela, MUSICA10_VALE_ATE } from "./cupom";
import { _resetConfigDoServidorParaTeste, definirConfigDoServidor, type ExperimentoConfig } from "./experimentos";

// Revisão final (07/10): a tela calculava o desconto sobre o braço GRUDADO no
// navegador (E, R$ 54,90) enquanto o servidor cobra braço de peso 0 como o
// controle (`bracoCobravel`). Com MUSICA10 a tela dizia R$ 44,90 e o QR, R$ 28.
function cfg(pesoE: number): ExperimentoConfig[] {
  return [
    {
      id: "preco",
      ativo: true,
      exposicaoPct: 100,
      nota: "",
      variantes: [
        { nome: "A", peso: 1, plano: { texto: "R$ 38", valor: 38, ancora: "R$ 97", checkout: "https://x/A" } },
        { nome: "E", peso: pesoE, plano: { texto: "R$ 54,90", valor: 54.9, ancora: "R$ 97", checkout: "https://x/E" } },
      ],
    },
  ];
}

afterEach(() => _resetConfigDoServidorParaTeste());

it("braço de peso 0 vira o controle, igual ao servidor", () => {
  definirConfigDoServidor(cfg(0));
  expect(planoCobravelDe("pt", "E").texto).toBe("R$ 38");
});

it("braço vivo continua sendo ele", () => {
  definirConfigDoServidor(cfg(1));
  expect(planoCobravelDe("pt", "E").texto).toBe("R$ 54,90");
});

it("preso no E zerado com MUSICA10: a tela mostra o que o QR cobra (R$ 28)", () => {
  definirConfigDoServidor(cfg(0));
  const base = Math.round(planoCobravelDe("pt", "E").valor * 100);
  const dentro = new Date(`${MUSICA10_VALE_ATE}T12:00:00-03:00`);
  expect(descontoNaTela("MUSICA10", "pt", base, "musica", dentro)?.por).toBe("R$ 28");
});
