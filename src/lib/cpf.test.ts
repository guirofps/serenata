import { describe, expect, it } from "vitest";
import { cpfValido, formatarCpf, soDigitosCpf } from "./cpf";

describe("cpfValido", () => {
  it("aceita CPF real, com e sem máscara", () => {
    // Gerado pelos próprios verificadores, não é de ninguém.
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("recusa quando um dígito verificador não fecha", () => {
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("529.982.247-35")).toBe(false);
  });

  it("recusa todos os dígitos iguais", () => {
    // Estes PASSAM na conta dos verificadores. É exatamente o que alguém
    // digita pra vencer o campo, e por isso tem regra própria.
    for (const d of ["111.111.111-11", "000.000.000-00", "99999999999"]) {
      expect(cpfValido(d), d).toBe(false);
    }
  });

  it("recusa tamanho errado, vazio e lixo", () => {
    expect(cpfValido("123")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false); // 10
    expect(cpfValido("529982247250")).toBe(false); // 12
    expect(cpfValido("")).toBe(false);
    expect(cpfValido(null)).toBe(false);
    expect(cpfValido(undefined)).toBe(false);
    expect(cpfValido("abcdefghijk")).toBe(false);
  });

  it("aceita CPF cujo verificador é zero", () => {
    // O caso do resto 10/11 virar 0. Se a conta usasse `resto % 10` em vez
    // da regra da Receita, estes dois passariam a falhar.
    //
    // Calculados pelos próprios verificadores (`scratch`, varredura de
    // 100.000.000 em diante), não inventados: na primeira versão deste teste
    // eu chutei um número "com cara de" verificador zero, ele não fechava, e
    // o teste reprovou código que estava certo.
    expect(cpfValido("100.000.001-08")).toBe(true); // primeiro verificador 0
    expect(cpfValido("100.000.037-00")).toBe(true); // os dois verificadores 0
  });
});

describe("soDigitosCpf", () => {
  it("tira máscara, espaço e qualquer enfeite", () => {
    expect(soDigitosCpf(" 529.982.247-25 ")).toBe("52998224725");
    expect(soDigitosCpf("529 982 247 25")).toBe("52998224725");
  });

  it("não explode com nada", () => {
    expect(soDigitosCpf(null)).toBe("");
    expect(soDigitosCpf(undefined)).toBe("");
  });
});

describe("formatarCpf", () => {
  it("vai pondo a máscara conforme digita", () => {
    expect(formatarCpf("529")).toBe("529");
    expect(formatarCpf("529982")).toBe("529.982");
    expect(formatarCpf("529982247")).toBe("529.982.247");
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  it("corta o que passa de 11 dígitos em vez de deixar transbordar", () => {
    expect(formatarCpf("529982247259999")).toBe("529.982.247-25");
  });
});
