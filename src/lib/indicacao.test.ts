import { describe, expect, it } from "vitest";
import {
  CARENCIA_DIAS,
  PCT_COMISSAO,
  PCT_DESCONTO,
  SAQUE_MINIMO_CENTAVOS,
  chavePixAceitavel,
  comissaoDe,
  descontoDoConvite,
  gerarCodigo,
  linkDoConvite,
  normalizarCodigo,
  reaisDeCentavos,
} from "./indicacao";

describe("indicação: os números combinados com o dono", () => {
  // Estes quatro também existem em SQL (a trigger da comissão). Se um teste
  // daqui quebrar porque o número mudou, mude a migração junto.
  it("10% pro convidado, 20% pra quem indica, 30 dias, saque a partir de R$ 100", () => {
    expect(PCT_DESCONTO).toBe(10);
    expect(PCT_COMISSAO).toBe(20);
    expect(CARENCIA_DIAS).toBe(30);
    expect(SAQUE_MINIMO_CENTAVOS).toBe(10_000);
  });
});

describe("descontoDoConvite", () => {
  it("R$ 38 vira R$ 34,20", () => {
    expect(3800 - descontoDoConvite(3800)).toBe(3420);
  });
  it("arredonda pro centavo, nunca devolve fração", () => {
    expect(descontoDoConvite(2990)).toBe(299);
    expect(descontoDoConvite(3795)).toBe(380);
  });
  it("valor inválido não vira desconto", () => {
    expect(descontoDoConvite(0)).toBe(0);
    expect(descontoDoConvite(-100)).toBe(0);
    expect(descontoDoConvite(Number.NaN)).toBe(0);
  });
});

describe("comissaoDe", () => {
  it("20% do que o convidado pagou", () => {
    expect(comissaoDe(3420)).toBe(684);
    // Com o vídeo junto: 34,20 + 19,90
    expect(comissaoDe(5410)).toBe(1082);
  });
  it("pedido de zero (crédito, cortesia) não gera comissão", () => {
    expect(comissaoDe(0)).toBe(0);
  });
});

describe("normalizarCodigo", () => {
  it("aceita o código em minúscula e com espaço em volta", () => {
    expect(normalizarCodigo(" k7m2qx ")).toBe("K7M2QX");
  });
  it("recusa os caracteres que o alfabeto tirou de propósito", () => {
    expect(normalizarCodigo("K7M2Q0")).toBeNull();
    expect(normalizarCodigo("K7M2QO")).toBeNull();
    expect(normalizarCodigo("K7M2Q1")).toBeNull();
    expect(normalizarCodigo("K7M2QI")).toBeNull();
    expect(normalizarCodigo("K7M2QL")).toBeNull();
  });
  it("recusa tamanho errado e o que não é texto", () => {
    expect(normalizarCodigo("K7M2Q")).toBeNull();
    expect(normalizarCodigo("K7M2QXX")).toBeNull();
    expect(normalizarCodigo(null)).toBeNull();
    expect(normalizarCodigo(123456)).toBeNull();
    expect(normalizarCodigo("'; drop")).toBeNull();
  });
});

describe("gerarCodigo", () => {
  it("todo código gerado passa no próprio formato", () => {
    for (let i = 0; i < 500; i++) {
      const c = gerarCodigo();
      expect(normalizarCodigo(c)).toBe(c);
    }
  });
  it("não estoura quando o aleatório devolve o limite de cima", () => {
    expect(normalizarCodigo(gerarCodigo(() => 0.9999999999))).not.toBeNull();
  });
});

describe("formatos", () => {
  it("o link aponta pra home com o ref", () => {
    expect(linkDoConvite("K7M2QX")).toBe("https://www.serenatagift.com/?ref=K7M2QX");
  });
  it("reais no formato do funil", () => {
    expect(reaisDeCentavos(3420)).toBe("R$ 34,20");
    expect(reaisDeCentavos(10000)).toBe("R$ 100");
    expect(reaisDeCentavos(123456)).toBe("R$ 1.234,56");
  });
});

describe("chavePixAceitavel", () => {
  it("aceita os formatos comuns sem tentar adivinhar o tipo", () => {
    expect(chavePixAceitavel(" fulano@gmail.com ")).toBe("fulano@gmail.com");
    expect(chavePixAceitavel("123.456.789-09")).toBe("123.456.789-09");
    expect(chavePixAceitavel("+5511999998888")).toBe("+5511999998888");
  });
  it("recusa o que sai quebrado no painel", () => {
    expect(chavePixAceitavel("")).toBeNull();
    expect(chavePixAceitavel("abc")).toBeNull();
    expect(chavePixAceitavel("a".repeat(141))).toBeNull();
    expect(chavePixAceitavel("chave\ncom quebra")).toBeNull();
    expect(chavePixAceitavel("<script>x</script>")).toBeNull();
  });
});
