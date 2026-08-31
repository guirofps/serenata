import { describe, it, expect } from "vitest";
import {
  mascaraCpf, cpfValido, mascaraCep, cepValido,
  mascaraCartao, cartaoValido, mascaraValidade, validadeValida, partesValidade,
} from "./documentos";

// Cada validacao aqui existe pra evitar uma RECUSA no antifraude do Asaas.
// Recusa nao e so a venda perdida: recusa em serie derruba a reputacao do
// nosso lote inteiro com eles.

describe("CPF", () => {
  it("mascara enquanto digita", () => {
    expect(mascaraCpf("249")).toBe("249");
    expect(mascaraCpf("249715")).toBe("249.715");
    expect(mascaraCpf("24971563792")).toBe("249.715.637-92");
  });
  it("ignora o que nao e digito e nao passa de 11", () => {
    expect(mascaraCpf("249.715.637-92999")).toBe("249.715.637-92");
  });
  it("aceita CPF com digito verificador certo", () => {
    expect(cpfValido("249.715.637-92")).toBe(true);
  });
  it("recusa um digito trocado, que e o erro mais comum", () => {
    expect(cpfValido("249.715.637-93")).toBe(false);
  });
  // Estes PASSAM na conta do verificador por acidente matematico, e sao
  // exatamente o que alguem digita pra pular o campo.
  it("recusa os onze digitos repetidos", () => {
    for (const n of ["00000000000", "11111111111", "99999999999"]) expect(cpfValido(n)).toBe(false);
  });
  it("recusa tamanho errado", () => {
    expect(cpfValido("2497156379")).toBe(false);
  });
});

describe("CEP", () => {
  it("mascara e valida", () => {
    expect(mascaraCep("89223005")).toBe("89223-005");
    expect(cepValido("89223-005")).toBe(true);
    expect(cepValido("8922300")).toBe(false);
  });
});

describe("cartao", () => {
  it("mascara em grupos de quatro", () => {
    expect(mascaraCartao("4444444444444444")).toBe("4444 4444 4444 4444");
  });
  // Numero real: passa no Luhn de verdade.
  it("aceita cartao valido", () => {
    expect(cartaoValido("4539 5789 0123 4564")).toBe(true);
  });
  // Os de homologacao NAO passam no Luhn — sao fabricados. Sem a excecao,
  // ninguem consegue testar o proprio checkout antes de subir.
  it("aceita os cartoes de teste do Asaas, que nao passam no Luhn", () => {
    expect(cartaoValido("4444 4444 4444 4444")).toBe(true);
    expect(cartaoValido("5184019740373151")).toBe(true);
  });
  it("recusa um digito trocado", () => {
    expect(cartaoValido("4444 4444 4444 4445")).toBe(false);
  });
  it("recusa tamanho impossivel", () => {
    expect(cartaoValido("4444")).toBe(false);
  });
});

describe("validade", () => {
  it("mascara MM/AA", () => {
    expect(mascaraValidade("1230")).toBe("12/30");
  });
  it("aceita futuro e recusa passado", () => {
    expect(validadeValida("12/30")).toBe(true);
    expect(validadeValida("01/20")).toBe(false);
  });
  it("recusa mes impossivel", () => {
    expect(validadeValida("13/30")).toBe(false);
    expect(validadeValida("00/30")).toBe(false);
  });
  // O cartao vale ate o ULTIMO dia do mes impresso — quem tem 12/2026 pode
  // comprar em 31/12/2026.
  it("o mes impresso vale ate o fim dele", () => {
    const agora = new Date();
    const mm = String(agora.getMonth() + 1).padStart(2, "0");
    const aa = String(agora.getFullYear()).slice(2);
    expect(validadeValida(`${mm}/${aa}`)).toBe(true);
  });
  it("separa nas partes que a API pede", () => {
    expect(partesValidade("12/30")).toEqual({ mes: "12", ano: "2030" });
    expect(partesValidade("12/2030")).toEqual({ mes: "12", ano: "2030" });
  });
});
