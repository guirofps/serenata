import { describe, expect, it } from "vitest";
import { metodoDlocalValido, speiDestaqueLigado, tipoPagamentoDlocal } from "./spei-destaque";

describe("spei_destaque", () => {
  it("só o B do México liga", () => {
    expect(speiDestaqueLigado("B", "MX")).toBe(true);
    expect(speiDestaqueLigado("b", " mx ")).toBe(true);
    expect(speiDestaqueLigado("A", "MX")).toBe(false);
    expect(speiDestaqueLigado("B", "CO")).toBe(false);
    expect(speiDestaqueLigado(null, "MX")).toBe(false);
  });

  it("a cobrança nasce só com o método escolhido, fora do Chile", () => {
    expect(tipoPagamentoDlocal("MX", "transferencia")).toBe("BANK_TRANSFER");
    expect(tipoPagamentoDlocal("MX", "oxxo")).toBe("VOUCHER");
    expect(tipoPagamentoDlocal("MX", undefined)).toBe("VOUCHER,BANK_TRANSFER");
    expect(tipoPagamentoDlocal("CO", "transferencia")).toBe("BANK_TRANSFER");
    expect(tipoPagamentoDlocal("PE", "oxxo")).toBe("VOUCHER");
    expect(tipoPagamentoDlocal("CO", undefined)).toBe("VOUCHER,BANK_TRANSFER");
    expect(tipoPagamentoDlocal("CL", "transferencia")).toBe("VOUCHER,BANK_TRANSFER");
    expect(tipoPagamentoDlocal("MX", "CARD")).toBe("VOUCHER,BANK_TRANSFER");
  });

  it("método desconhecido vira sem escolha", () => {
    expect(metodoDlocalValido("transferencia")).toBe("transferencia");
    expect(metodoDlocalValido("oxxo")).toBe("oxxo");
    expect(metodoDlocalValido("CARD")).toBeUndefined();
    expect(metodoDlocalValido(1)).toBeUndefined();
  });
});
