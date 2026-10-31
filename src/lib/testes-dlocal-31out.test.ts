import { describe, expect, it } from "vitest";
import { documentoDepoisLigado } from "./documento-depois";
import { TEXTO_LOCAL_PRIMEIRO, localPrimeiroLigado } from "./local-primeiro";
import { tipoPagamentoDlocal } from "./spei-destaque";

describe("documento_depois", () => {
  it("só o B do México liga", () => {
    expect(documentoDepoisLigado("B", "MX")).toBe(true);
    expect(documentoDepoisLigado("b", " mx ")).toBe(true);
    expect(documentoDepoisLigado("A", "MX")).toBe(false);
    expect(documentoDepoisLigado("B", "CO")).toBe(false);
    expect(documentoDepoisLigado(null, "MX")).toBe(false);
  });
});

describe("local_primeiro", () => {
  it("só o B da Colômbia e do Peru liga; o Chile fica de fora", () => {
    expect(localPrimeiroLigado("B", "CO")).toBe(true);
    expect(localPrimeiroLigado("b", " pe ")).toBe(true);
    expect(localPrimeiroLigado("A", "CO")).toBe(false);
    expect(localPrimeiroLigado("B", "CL")).toBe(false);
    expect(localPrimeiroLigado("B", "MX")).toBe(false);
    expect(localPrimeiroLigado(undefined, "PE")).toBe(false);
  });

  it("a opção principal abre o método que ela promete", () => {
    // Nequi e PSE moram em BANK_TRANSFER; Yape, em VOUCHER (conferido em 31/10).
    expect(tipoPagamentoDlocal("CO", TEXTO_LOCAL_PRIMEIRO.CO.principal.metodo)).toBe("BANK_TRANSFER");
    expect(tipoPagamentoDlocal("PE", TEXTO_LOCAL_PRIMEIRO.PE.principal.metodo)).toBe("VOUCHER");
    expect(tipoPagamentoDlocal("CO", TEXTO_LOCAL_PRIMEIRO.CO.outra.metodo)).toBe("VOUCHER");
    expect(tipoPagamentoDlocal("PE", TEXTO_LOCAL_PRIMEIRO.PE.outra.metodo)).toBe("BANK_TRANSFER");
  });

  it("as opções de cada país são métodos diferentes", () => {
    for (const t of Object.values(TEXTO_LOCAL_PRIMEIRO)) expect(t.principal.metodo).not.toBe(t.outra.metodo);
  });
});
