import { describe, expect, it } from "vitest";
import { avisoRecusaLigado, bracoRecusaEmail, sessaoTeveRecusa } from "@/lib/aviso-recusa";

describe("aviso_recusa", () => {
  it("só no B", () => {
    expect(avisoRecusaLigado("B")).toBe(true);
    expect(avisoRecusaLigado("b2")).toBe(true);
    expect(avisoRecusaLigado("A")).toBe(false);
    expect(avisoRecusaLigado(undefined)).toBe(false);
    expect(avisoRecusaLigado("fora")).toBe(false);
  });
});

describe("e-mail de recusa", () => {
  it("braço pelo 6º caractere do fim, ignorando hífens", () => {
    // ...-xxxx0abcde: 6º do fim = "0" (par) → A; "1" (ímpar) → B
    expect(bracoRecusaEmail("11111111-2222-3333-4444-5555550abcde")).toBe("A");
    expect(bracoRecusaEmail("11111111-2222-3333-4444-5555551abcde")).toBe("B");
  });

  it("recusa só quando o PaymentIntent tem erro e não foi pago", () => {
    expect(sessaoTeveRecusa({ payment_intent: { status: "requires_payment_method", last_payment_error: { code: "card_declined" } } })).toBe(true);
    expect(sessaoTeveRecusa({ payment_intent: { status: "succeeded", last_payment_error: { code: "card_declined" } } })).toBe(false);
    expect(sessaoTeveRecusa({ payment_intent: { status: "requires_payment_method", last_payment_error: null } })).toBe(false);
    expect(sessaoTeveRecusa({ payment_intent: "pi_123" })).toBe(false);
    expect(sessaoTeveRecusa({ payment_intent: null })).toBe(false);
    expect(sessaoTeveRecusa(null)).toBe(false);
  });
});
