import { describe, expect, it } from "vitest";
import {
  MERCADOS,
  centavosDoTexto,
  cssPrecoPorPais,
  formatarNaMoeda,
  localeStripeDe,
  mercadoDaMoeda,
  mercadoDoPais,
  textoNaMoeda,
  unidadeMenorDe,
  usdDe,
  valorNaMoeda,
  valorPagoConfere,
} from "./mercados";

describe("a tabela de mercados", () => {
  it("país desconhecido, vazio ou lixo cai nos EUA", () => {
    expect(mercadoDoPais(null).pais).toBe("US");
    expect(mercadoDoPais("").pais).toBe("US");
    expect(mercadoDoPais("BR").pais).toBe("US");
    expect(mercadoDoPais("AR").pais).toBe("US");
    expect(mercadoDoPais("<script>").pais).toBe("US");
    expect(mercadoDoPais("es").pais).toBe("ES");
    expect(mercadoDoPais(" co ").pais).toBe("CO");
  });

  it("cada país tem a moeda, a variante do espanhol e o lang certos", () => {
    expect(mercadoDoPais("US")).toMatchObject({ moeda: "usd", conteudo: "eua", tagIdioma: "es-US" });
    expect(mercadoDoPais("MX")).toMatchObject({ moeda: "mxn", conteudo: "mexico", tagIdioma: "es-MX" });
    expect(mercadoDoPais("ES")).toMatchObject({ moeda: "eur", conteudo: "espanha", tagIdioma: "es-ES", localeStripe: "es" });
    expect(mercadoDoPais("CO")).toMatchObject({ moeda: "cop", conteudo: "latam", tagIdioma: "es-CO", localeStripe: "es-419" });
    expect(mercadoDoPais("CL")).toMatchObject({ moeda: "clp", conteudo: "latam", tagIdioma: "es-CL", decimais: 0 });
    expect(mercadoDoPais("PE")).toMatchObject({ moeda: "pen", conteudo: "latam", tagIdioma: "es-PE" });
  });

  it("a dLocal está ligada no México e na LATAM; Espanha e EUA só cartão", () => {
    const comDlocal = Object.values(MERCADOS).filter((m) => m.temDlocal).map((m) => m.pais);
    expect(comDlocal).toEqual(["MX", "CO", "CL", "PE"]);
  });

  it("o caixa em inglês fica em inglês; o espanhol segue o país", () => {
    expect(localeStripeDe(MERCADOS.ES, "en")).toBe("en");
    expect(localeStripeDe(MERCADOS.ES, "es")).toBe("es");
    expect(localeStripeDe(MERCADOS.US, "es")).toBe("es-419");
    expect(localeStripeDe(MERCADOS.CO, "es")).toBe("es-419");
  });

  it("os quatro preços do catálogo estão tabelados em todo mercado local", () => {
    for (const m of Object.values(MERCADOS)) {
      if (m.moeda === "usd") continue;
      for (const usd of [1900, 4900, 1200, 1400]) expect(m.precos[usd], `${m.pais} ${usd}`).toBeGreaterThan(0);
      // A âncora é sempre mais cara que a música, e o vídeo mais barato.
      expect(valorNaMoeda(m, 4900)).toBeGreaterThan(valorNaMoeda(m, 1900));
      expect(valorNaMoeda(m, 1200)).toBeLessThan(valorNaMoeda(m, 1900));
    }
  });

  it("o México não mudou um centavo", () => {
    expect(valorNaMoeda(MERCADOS.MX, 1900)).toBe(19900);
    expect(valorNaMoeda(MERCADOS.MX, 4900)).toBe(54900);
    expect(valorNaMoeda(MERCADOS.MX, 1200)).toBe(12900);
    expect(valorNaMoeda(MERCADOS.MX, 1400)).toBe(14900);
    expect(valorNaMoeda(MERCADOS.MX, 2400)).toBe(44900);
    expect(usdDe(MERCADOS.MX, 19900)).toBe(1082);
    expect(formatarNaMoeda(MERCADOS.MX, 19900)).toBe("$199 MXN");
  });

  it("CLP não tem decimal; COP vai em centavos pro Stripe mas é peso inteiro", () => {
    expect(valorNaMoeda(MERCADOS.CL, 1900)).toBe(9990);
    expect(formatarNaMoeda(MERCADOS.CL, 9990)).toBe("$9.990 CLP");
    expect(valorNaMoeda(MERCADOS.CO, 1900)).toBe(3990000);
    expect(valorNaMoeda(MERCADOS.CO, 1900) % 100).toBe(0);
    expect(formatarNaMoeda(MERCADOS.CO, 3990000)).toBe("$39.900 COP");
    // a dLocal devolve o valor em unidade maior
    expect(unidadeMenorDe(MERCADOS.CL, 9990)).toBe(9990);
    expect(unidadeMenorDe(MERCADOS.CO, 39900)).toBe(3990000);
    expect(unidadeMenorDe(MERCADOS.MX, 199)).toBe(19900);
  });

  it("escreve cada moeda como o país lê", () => {
    expect(formatarNaMoeda(MERCADOS.ES, 1499)).toBe("14,99 €");
    expect(formatarNaMoeda(MERCADOS.ES, 1900)).toBe("19 €");
    expect(formatarNaMoeda(MERCADOS.ES, 1500)).toBe("15 €");
    expect(formatarNaMoeda(MERCADOS.PE, 3900)).toBe("S/ 39");
    expect(formatarNaMoeda(MERCADOS.CO, 9990000)).toBe("$99.900 COP");
    expect(formatarNaMoeda(MERCADOS.CL, 24990)).toBe("$24.990 CLP");
  });

  it("fora da tabela, a conversão arredonda pro preço de loja", () => {
    // US$ 24 → €21,60 → 21,99
    expect(valorNaMoeda(MERCADOS.ES, 2400)).toBe(2199);
    // US$ 24 → $81.600 → $81.900
    expect(valorNaMoeda(MERCADOS.CO, 2400)).toBe(8190000);
    // US$ 24 → $25.440 → $25.990
    expect(valorNaMoeda(MERCADOS.CL, 2400)).toBe(25990);
    // US$ 24 → S/ 82,80 → S/ 83
    expect(valorNaMoeda(MERCADOS.PE, 2400)).toBe(8300);
    expect(valorNaMoeda(MERCADOS.US, 2400)).toBe(2400);
  });

  it("o pedido grava o dólar do que se cobrou, e o webhook confere contra ele", () => {
    for (const m of Object.values(MERCADOS)) {
      for (const usd of [1900, 1200, 1400]) {
        const local = valorNaMoeda(m, usd);
        const pedido = usdDe(m, local);
        expect(valorPagoConfere(m.moeda, local, pedido), `${m.pais} ${usd}`).toBe(true);
        // A conversão é muitos-pra-um (um centavo de dólar vale ~10 pesos
        // chilenos), então o que se prova é que um valor DIFERENTE de verdade não passa.
        expect(valorPagoConfere(m.moeda, Math.round(local * 0.9), pedido), `${m.pais} -10%`).toBe(false);
      }
    }
    expect(usdDe(MERCADOS.ES, 1900)).toBe(2111);
    expect(usdDe(MERCADOS.CL, 9990)).toBe(942);
  });

  it("a conferência genérica mantém os casos antigos do peso e recusa moeda estranha", () => {
    expect(valorPagoConfere("usd", 1900, 1900)).toBe(true);
    expect(valorPagoConfere(null, 1900, 1900)).toBe(true);
    expect(valorPagoConfere("MXN", 34900, 1900)).toBe(true);
    expect(valorPagoConfere("mxn", 19900, 1900)).toBe(false);
    expect(valorPagoConfere("brl", 1900, 1900)).toBe(false);
    expect(valorPagoConfere("eur", 1900, 1900)).toBe(false);
    // o mesmo número em outra moeda nunca passa: 1499 euros-centavo não são 1499 pesos
    expect(valorPagoConfere("eur", 1499, usdDe(MERCADOS.ES, 1499))).toBe(true);
    expect(valorPagoConfere("pen", 1499, usdDe(MERCADOS.ES, 1499))).toBe(false);
  });

  it("a moeda cobrada leva de volta ao mercado", () => {
    expect(mercadoDaMoeda("EUR")?.pais).toBe("ES");
    expect(mercadoDaMoeda("clp")?.pais).toBe("CL");
    expect(mercadoDaMoeda("brl")).toBeNull();
  });

  it("o texto em dólar vira o texto local pela mesma tabela", () => {
    expect(centavosDoTexto("US$ 19")).toBe(1900);
    expect(centavosDoTexto("$12.50")).toBe(1250);
    expect(textoNaMoeda(MERCADOS.ES, "US$ 19")).toBe("19 €");
    expect(textoNaMoeda(MERCADOS.ES, "$49")).toBe("49 €");
    expect(textoNaMoeda(MERCADOS.CO, "US$ 12")).toBe("$25.900 COP");
    expect(textoNaMoeda(MERCADOS.CL, "$14")).toBe("$7.490 CLP");
    expect(textoNaMoeda(MERCADOS.PE, "$19")).toBe("S/ 39");
    expect(textoNaMoeda(MERCADOS.US, "$19")).toBeNull();
    expect(textoNaMoeda(MERCADOS.ES, "gratis")).toBeNull();
  });

  it("o CSS mostra uma moeda por país e o dólar no resto", () => {
    const css = cssPrecoPorPais();
    for (const p of ["MX", "ES", "CO", "CL", "PE"]) {
      const m = MERCADOS[p as keyof typeof MERCADOS];
      expect(css).toContain(`html[data-pais="${p}"] .preco-usd`);
      expect(css).toContain(`html[data-pais="${p}"] .preco-${m.moeda}`);
    }
    expect(css).not.toContain('data-pais="US"');
  });
});
