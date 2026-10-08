import { describe, expect, it } from "vitest";
import { bounceEPermanente, decidirBloqueio, TEMPORARIOS_ATE_BLOQUEAR } from "./bounce-regras";

// Quando o bounce trava o endereço em `emails_mortos` (auditoria de 08/10).

describe("bounceEPermanente", () => {
  it("lê o tipo do Resend sem ligar pra caixa", () => {
    expect(bounceEPermanente("Permanent")).toBe(true);
    expect(bounceEPermanente("hard")).toBe(true);
    expect(bounceEPermanente("Transient")).toBe(false);
    expect(bounceEPermanente("Undetermined")).toBe(false);
    expect(bounceEPermanente(null)).toBe(false);
  });
});

describe("decidirBloqueio", () => {
  it("Permanent bloqueia na primeira", () => {
    expect(decidirBloqueio({ tipo: "Permanent", anterior: null })).toEqual({ bloquear: true, vezes: 1 });
  });

  it("temporário da primeira vez fica registrado e não bloqueia", () => {
    expect(TEMPORARIOS_ATE_BLOQUEAR).toBe(2);
    expect(decidirBloqueio({ tipo: "Transient", anterior: null })).toEqual({ bloquear: false, vezes: 1 });
  });

  it("o segundo temporário bloqueia", () => {
    const primeiro = { vezes: 1, liberado_em: "2026-10-08T10:00:00Z" };
    expect(decidirBloqueio({ tipo: "Transient", anterior: primeiro })).toEqual({ bloquear: true, vezes: 2 });
  });

  it("temporário nunca desbloqueia quem já estava bloqueado", () => {
    expect(decidirBloqueio({ tipo: "Transient", anterior: { vezes: 1, liberado_em: null } }).bloquear).toBe(true);
  });

  it("liberado pelo atendimento e voltou a voltar: bloqueia de novo", () => {
    expect(decidirBloqueio({ tipo: "Transient", anterior: { vezes: 3, liberado_em: "2026-10-01T00:00:00Z" } }).bloquear).toBe(true);
  });

  it("sem conseguir ler a linha, bloqueia (como era antes)", () => {
    expect(decidirBloqueio({ tipo: "Transient", anterior: null, leituraFalhou: true }).bloquear).toBe(true);
  });
});
