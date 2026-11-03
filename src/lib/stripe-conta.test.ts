import { describe, expect, it } from "vitest";
import { bracoStripeConta, chaveSecretaDa, contaStripeDoQuiz, contasStripeLigadas } from "./stripe-conta";

const COM_UK = { STRIPE_SECRET_KEY: "sk_br", STRIPE_UK_SECRET_KEY: "rk_uk", STRIPE_UK_PUBLISHABLE_KEY: "pk_uk" };

describe("stripe_conta", () => {
  it("sorteia pelo 9º caractere do fim do id (par = A, ímpar = B)", () => {
    expect(bracoStripeConta("00000000-0000-0000-0000-0000a0000000".replace("a", "2"))).toBe("A");
    // o 9º do fim de ...-000b00000000 é o "b" (11, ímpar)
    expect(bracoStripeConta("00000000-0000-0000-0000-000b00000000")).toBe("B");
    expect(bracoStripeConta("00000000-0000-0000-0000-000400000000")).toBe("A");
  });

  it("não usa a mesma posição dos outros testes (5º a 8º do fim)", () => {
    // muda só o 8º do fim: o braço não pode mudar
    expect(bracoStripeConta("00000000-0000-0000-0000-000010000000")).toBe(bracoStripeConta("00000000-0000-0000-0000-000000000000"));
  });

  it("B vai pro Reino Unido só com as duas chaves e sem o interruptor", () => {
    const b = "00000000-0000-0000-0000-000b00000000";
    expect(contaStripeDoQuiz(b, COM_UK)).toBe("uk");
    expect(contaStripeDoQuiz(b, { ...COM_UK, STRIPE_UK_OFF: "1" })).toBe("br");
    expect(contaStripeDoQuiz(b, { ...COM_UK, STRIPE_UK_PUBLISHABLE_KEY: undefined })).toBe("br");
    expect(contaStripeDoQuiz(b, { STRIPE_SECRET_KEY: "sk_br" })).toBe("br");
    expect(contaStripeDoQuiz("00000000-0000-0000-0000-000400000000", COM_UK)).toBe("br");
  });

  it("lista as contas com chave, a de sempre primeiro", () => {
    expect(contasStripeLigadas(COM_UK)).toEqual(["br", "uk"]);
    expect(contasStripeLigadas({ STRIPE_SECRET_KEY: "x" })).toEqual(["br"]);
    expect(chaveSecretaDa("uk", COM_UK)).toBe("rk_uk");
    expect(chaveSecretaDa("br", COM_UK)).toBe("sk_br");
  });
});
