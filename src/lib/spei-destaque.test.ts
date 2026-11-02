import { describe, expect, it } from "vitest";
import { fichaServeAoVoltar, metodoDlocalValido, speiDestaqueLigado, tipoPagamentoDlocal } from "./spei-destaque";

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

  describe("a ficha emitida na volta à folha", () => {
    const MIN = 60e3;
    it("escolheu OXXO e a ficha é de transferência: não serve (o caso do José)", () => {
      expect(fichaServeAoVoltar("MX", "oxxo", "BANK_TRANSFER", 5 * MIN)).toBe(false);
      expect(fichaServeAoVoltar("MX", "transferencia", "VOUCHER", 5 * MIN)).toBe(false);
    });
    it("escolheu o mesmo método: serve", () => {
      expect(fichaServeAoVoltar("MX", "oxxo", "VOUCHER", 2000 * MIN)).toBe(true);
      expect(fichaServeAoVoltar("MX", "transferencia", "BANK_TRANSFER", 2000 * MIN)).toBe(true);
    });
    it("sem escolha, a do OXXO sempre volta e a transferência só na primeira hora", () => {
      expect(fichaServeAoVoltar("MX", undefined, "VOUCHER", 2000 * MIN)).toBe(true);
      expect(fichaServeAoVoltar("MX", undefined, "BANK_TRANSFER", 59 * MIN)).toBe(true);
      expect(fichaServeAoVoltar("MX", undefined, "BANK_TRANSFER", 61 * MIN)).toBe(false);
    });
    it("sem saber o tipo, volta a de sempre", () => {
      expect(fichaServeAoVoltar("MX", "oxxo", undefined, 2000 * MIN)).toBe(true);
    });
  });

  it("método desconhecido vira sem escolha", () => {
    expect(metodoDlocalValido("transferencia")).toBe("transferencia");
    expect(metodoDlocalValido("oxxo")).toBe("oxxo");
    expect(metodoDlocalValido("CARD")).toBeUndefined();
    expect(metodoDlocalValido(1)).toBeUndefined();
  });
});
