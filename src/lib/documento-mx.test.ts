import { describe, expect, it } from "vitest";
import {
  digitoCurp,
  nomeCompletoValido,
  normalizarDocumentoMx,
  validarDocumentoMx,
} from "./documento-mx";

describe("documento do México no OXXO", () => {
  it("CURP válida passa, com o dígito verificador do RENAPO", () => {
    expect(digitoCurp("HEGG560427MVZRRL0")).toBe(4);
    expect(validarDocumentoMx("HEGG560427MVZRRL04")).toEqual({
      ok: true,
      tipo: "CURP",
      documento: "HEGG560427MVZRRL04",
    });
    // como a pessoa digita: minúscula, com espaço e hífen
    expect(validarDocumentoMx(" hegg-560427 mvzrrl04 ")).toEqual({
      ok: true,
      tipo: "CURP",
      documento: "HEGG560427MVZRRL04",
    });
  });

  it("os erros reais de 29/10 viram mensagem que aponta o conserto", () => {
    expect(validarDocumentoMx("ife")).toEqual({ ok: false, motivo: "nome_do_documento" });
    expect(validarDocumentoMx("INE")).toEqual({ ok: false, motivo: "nome_do_documento" });
    expect(validarDocumentoMx("mamv660422")).toEqual({ ok: false, motivo: "rfc_sem_homoclave" });
    expect(validarDocumentoMx("")).toEqual({ ok: false, motivo: "vazio" });
  });

  it("CURP com um caractere trocado é recusada pelo dígito", () => {
    expect(validarDocumentoMx("HEGG560427MVZRRL05")).toEqual({ ok: false, motivo: "curp_digito" });
  });

  it("RFC com homoclave e clave de elector da INE também passam", () => {
    expect(validarDocumentoMx("MAMV660422AB1")).toEqual({
      ok: true,
      tipo: "RFC",
      documento: "MAMV660422AB1",
    });
    expect(validarDocumentoMx("GMVLMR80070501M100")).toEqual({
      ok: true,
      tipo: "IFE",
      documento: "GMVLMR80070501M100",
    });
  });

  it("data impossível e lixo não passam", () => {
    expect(validarDocumentoMx("HEGG561327MVZRRL04").ok).toBe(false);
    expect(validarDocumentoMx("123456789").ok).toBe(false);
    expect(validarDocumentoMx("asdfgh")).toEqual({ ok: false, motivo: "formato" });
  });

  it("normaliza sem perder o Ñ", () => {
    expect(normalizarDocumentoMx("ñaño-660422 ab1")).toBe("ÑAÑO660422AB1");
  });

  it("nome completo pede nome e sobrenome, sem número", () => {
    expect(nomeCompletoValido("María López")).toBe(true);
    expect(nomeCompletoValido("María")).toBe(false);
    expect(nomeCompletoValido("Juan 123")).toBe(false);
  });
});
