import { describe, expect, it } from "vitest";
import { MARCAS, chaveDaMarca, remetenteEDaMarca } from "./marca-identidade";

describe("chaveDaMarca", () => {
  it("sem env é Serenata: o site que vende nunca depende de configuração", () => {
    expect(chaveDaMarca(undefined)).toBe("serenata");
    expect(chaveDaMarca("")).toBe("serenata");
  });

  it("só 'ballad' vira Ballad; qualquer outra coisa é Serenata", () => {
    expect(chaveDaMarca("ballad")).toBe("ballad");
    expect(chaveDaMarca("serenata")).toBe("serenata");
    expect(chaveDaMarca("balad")).toBe("serenata");
    expect(chaveDaMarca("BALLAD")).toBe("serenata"); // a normalização é de quem lê a env
  });
});

describe("remetenteEDaMarca", () => {
  const serenata = MARCAS.serenata;
  const ballad = MARCAS.ballad;

  it("reconhece os dois remetentes da Serenata, com nome ou sem", () => {
    expect(remetenteEDaMarca("Serenata <contato@serenatagift.com>", serenata)).toBe(true);
    expect(remetenteEDaMarca("Serenata <ola@envio.serenatagift.com>", serenata)).toBe(true);
    expect(remetenteEDaMarca("contato@serenatagift.com", serenata)).toBe(true);
    expect(remetenteEDaMarca("CONTATO@SerenataGift.com", serenata)).toBe(true);
  });

  it("evento de uma marca nunca passa como da outra", () => {
    expect(remetenteEDaMarca("Ballad Gift <hello@balladgift.com>", serenata)).toBe(false);
    expect(remetenteEDaMarca("Serenata <contato@serenatagift.com>", ballad)).toBe(false);
    expect(remetenteEDaMarca("Ballad Gift <hello@balladgift.com>", ballad)).toBe(true);
  });

  it("domínio parecido não engana: sufixo e subdomínio estranho ficam de fora", () => {
    expect(remetenteEDaMarca("x@falso-serenatagift.com", serenata)).toBe(false);
    expect(remetenteEDaMarca("x@serenatagift.com.evil.io", serenata)).toBe(false);
    expect(remetenteEDaMarca("x@outro.serenatagift.com", serenata)).toBe(false);
  });

  it("sem remetente não é da marca (quem decide o caso vazio é o webhook)", () => {
    expect(remetenteEDaMarca(undefined, serenata)).toBe(false);
    expect(remetenteEDaMarca("", serenata)).toBe(false);
    expect(remetenteEDaMarca("sem-arroba", serenata)).toBe(false);
  });

  it("os remetentes configurados de cada marca são dela mesma", () => {
    for (const m of Object.values(MARCAS)) {
      expect(remetenteEDaMarca(m.remetenteTransacional, m)).toBe(true);
      expect(remetenteEDaMarca(m.remetenteRecuperacao, m)).toBe(true);
      expect(remetenteEDaMarca(m.responderPara, m)).toBe(true);
    }
  });
});
