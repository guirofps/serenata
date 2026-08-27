import { describe, it, expect } from "vitest";
import { jaExiste } from "./woovi";

// O QUE ESTE TESTE SEGURA
//
// A Woovi não é idempotente no POST /charge, ao contrário do que a
// documentação sugere ao chamar o `correlationID` de "identificador único".
// Repetir o mesmo id devolve 400 com uma mensagem EM PORTUGUÊS e sem código
// nenhum. Todo o conserto (reler a cobrança em vez de estourar) pende de
// reconhecer essa mensagem.
//
// Se um dia eles trocarem o texto, é aqui que se descobre — e o preço de
// errar é a pessoa que fechou a aba, voltou, e encontrou "não consegui gerar
// o PIX" em cima de uma cobrança que existe e está esperando o dinheiro dela.

describe("jaExiste", () => {
  it("reconhece a mensagem real, medida em 27/08", () => {
    expect(jaExiste('400 {"error":"Já existe uma cobrança com este Correlação ID"}')).toBe(true);
  });

  it("não depende de acento nem de caixa", () => {
    expect(jaExiste('400 {"error":"ja existe uma cobranca com este correlacao id"}')).toBe(true);
    expect(jaExiste('400 {"error":"JÁ EXISTE UMA COBRANÇA COM ESTE CORRELAÇÃO ID"}')).toBe(true);
  });

  it("sobrevive a eles padronizarem em inglês", () => {
    expect(jaExiste('400 {"error":"A charge with this correlationID already exists"}')).toBe(true);
    expect(jaExiste('400 {"error":"duplicate correlationID"}')).toBe(true);
  });

  it("NÃO confunde com outro 400", () => {
    // Este é o caso perigoso ao contrário: tratar um erro qualquer como
    // "já existe" faria a gente reler uma cobrança que nunca foi criada, e
    // aí o GET falha e a pessoa vê um erro pior e mais confuso.
    expect(jaExiste('400 {"error":"value must be a positive integer"}')).toBe(false);
    expect(jaExiste('400 {"error":"correlationID is required"}')).toBe(false);
  });

  it("NÃO trata 500 nem 401 como duplicata", () => {
    // 5xx passa pro outro gateway; 401 é chave errada. Confundir qualquer um
    // dos dois com duplicata trocaria um erro que dá pra contornar por um
    // GET que vai falhar em seguida.
    expect(jaExiste('500 {"error":"Já existe uma cobrança com este Correlação ID"}')).toBe(false);
    expect(jaExiste('401 unauthorized')).toBe(false);
  });
});
