import { describe, expect, it } from "vitest";
import { assuntoResumoDiario, emailResumoDiario, type MarcaDoResumo } from "../../emails/resumo-diario";
import { resumirDia } from "./resumo-diario";

// O FECHAMENTO DO DIA nas duas marcas. Sem `marca`, é o e-mail da Serenata
// de sempre; com ela (Ballad Gift), leva o nome no assunto e no cabeçalho, diz
// o câmbio da conversão e usa as réguas de CPA da Ballad.

const hoje = resumirDia({
  pedidos: [
    {
      paymentId: "stripe:cs_1",
      valorBrl: 19 * 5.4,
      taxaBrl: 0.85 * 5.4,
      bumpQuadro: false,
      bumpVideo: false,
      atribuicao: { gclid: "x", utm_campaign: "111" },
    },
  ],
  gastoGoogle: [
    { campanhaId: "111", nome: "EUA 01", gastoBrl: 70 },
    { campanhaId: "222", nome: "EUA 02", gastoBrl: 100 },
  ],
  gastoOutros: {},
  custoProducaoBrl: 1,
});

const BALLAD: MarcaDoResumo = {
  nome: "Ballad Gift",
  cambioUsdBrl: 5.4,
  cpaLimiteBrl: 15 * 5.4,
  semVendaBrl: 30 * 5.4,
  url: "https://www.balladgift.com",
};

describe("fechamento do dia da Serenata (sem marca)", () => {
  it("assunto e cabeçalho de sempre", () => {
    expect(assuntoResumoDiario("2026-09-29", hoje)).toMatch(/^Fechamento 29\/09: /);
    const html = emailResumoDiario({ dia: "2026-09-29", hoje, ontem: null, media7: null });
    expect(html).toContain("SERENATA · FECHAMENTO DO DIA");
    expect(html).toContain("Vermelho: CPA acima do break-even (R$ 33,80), ou R$ 76 gastos sem venda.");
    expect(html).not.toContain("dólar");
  });
});

describe("fechamento do dia da Ballad Gift", () => {
  const html = emailResumoDiario({
    dia: "2026-09-29",
    hoje,
    ontem: null,
    media7: null,
    saques: { n: 1, centavos: 1000 },
    marca: BALLAD,
  });

  it("a marca na frente do assunto e no cabeçalho", () => {
    expect(assuntoResumoDiario("2026-09-29", hoje, BALLAD)).toMatch(/^\[Ballad Gift\] Fechamento 29\/09: /);
    expect(html).toContain("BALLAD GIFT · FECHAMENTO DO DIA");
    expect(html).not.toContain("SERENATA");
  });

  it("diz que a receita em dólar foi convertida, e por quanto", () => {
    expect(html).toContain("Vendas cobradas em dólar, convertidas a R$ 5,40 por US$ 1.");
  });

  it("o link do painel é o da Ballad", () => {
    expect(html).toContain('href="https://www.balladgift.com/admin?aba=indicacoes"');
    expect(html).not.toContain("serenatagift");
  });

  it("as réguas de vermelho são as da Ballad, não as R$ 33,80 da Serenata", () => {
    expect(html).toContain("Vermelho: CPA acima do alvo (R$ 81,00), ou R$ 162 gastos sem venda.");
    // EUA 01: 1 venda por R$ 70, abaixo do alvo de R$ 81: não fica vermelho.
    expect(html).toMatch(/EUA 01<\/td><td[^>]*>R\$ 70<\/td><td[^>]*>1<\/td><td style="[^"]*text-align:right;white-space:nowrap;">/);
    // EUA 02: R$ 100 sem venda, abaixo dos R$ 162: ainda não é "sem venda".
    expect(html).not.toContain(">sem venda<");
  });
});
