import { describe, expect, it } from "vitest";
import { digitoRun, paisTemDocumento, validarDocumento } from "./documento-pais";

describe("documento de quem paga pela dLocal, por país", () => {
  it("Colômbia: cédula de 6 a 10 dígitos, com ponto ou sem", () => {
    expect(validarDocumento("CO", "1.023.456.789")).toEqual({
      ok: true,
      tipo: "CC",
      documento: "1023456789",
    });
    expect(validarDocumento("CO", "cedula")).toMatchObject({
      ok: false,
      motivo: "nome_do_documento",
    });
    expect(validarDocumento("CO", "12345")).toMatchObject({ ok: false, motivo: "formato" });
  });

  it("Chile: RUN com dígito verificador (módulo 11)", () => {
    expect(digitoRun("12345678")).toBe("5");
    expect(validarDocumento("CL", "12.345.678-5")).toEqual({
      ok: true,
      tipo: "RUN",
      documento: "12345678-5",
    });
    expect(validarDocumento("CL", "12.345.678-4")).toMatchObject({ ok: false, motivo: "digito" });
    expect(validarDocumento("CL", "12345678")).toMatchObject({ ok: false });
    expect(validarDocumento("CL", "rut")).toMatchObject({ ok: false, motivo: "nome_do_documento" });
  });

  it("Peru: DNI de 8 dígitos", () => {
    expect(validarDocumento("PE", "45678912")).toEqual({
      ok: true,
      tipo: "DNI",
      documento: "45678912",
    });
    expect(validarDocumento("PE", "4567891")).toMatchObject({ ok: false, motivo: "formato" });
  });

  it("México segue a regra da CURP, com a mensagem dela", () => {
    expect(validarDocumento("MX", "HEGG560427MVZRRL04")).toMatchObject({ ok: true, tipo: "CURP" });
    const r = validarDocumento("MX", "ife");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/número del documento/);
  });

  it("vazio pede o documento certo de cada país", () => {
    for (const p of ["CO", "CL", "PE", "MX"] as const)
      expect(validarDocumento(p, "").ok).toBe(false);
  });

  it("só os países da dLocal têm documento", () => {
    expect(paisTemDocumento("PE")).toBe(true);
    expect(paisTemDocumento("ES")).toBe(false);
    expect(paisTemDocumento("US")).toBe(false);
  });
});
