import { describe, expect, it } from "vitest";
import { degrauDoEvento, posicoesNaRegua, type EventoDeEnvio } from "./regua-escada";

const Q = "11111111-2222-3333-4444-555555555555";
const ev = (event_name: string, created_at: string, extra: Record<string, unknown> = {}): EventoDeEnvio => ({
  event_name,
  created_at,
  event_data: { quiz_response_id: Q, ...extra },
});
const t = (s: string) => new Date(s).getTime();

describe("degrauDoEvento", () => {
  it("a letra é o 1, os disparos dirigidos valem 2, a escada carimba o número", () => {
    expect(degrauDoEvento(ev("email_letra_enviado", "2026-10-01T00:00:00Z"))).toBe(1);
    expect(degrauDoEvento(ev("pix_nao_pago_enviado", "2026-10-01T00:00:00Z"))).toBe(2);
    expect(degrauDoEvento(ev("quase_comprou_enviado", "2026-10-01T00:00:00Z"))).toBe(2);
    expect(degrauDoEvento(ev("email_sequencia_enviado", "2026-10-01T00:00:00Z", { numero: 3 }))).toBe(3);
  });
});

describe("posicoesNaRegua", () => {
  it("no empate de degrau, o relógio é o envio MAIS RECENTE (08/10)", () => {
    // O pixNaoPago manda aos 10 min e de novo ~20h depois: os dois valem 2.
    const p = posicoesNaRegua([
      ev("email_letra_enviado", "2026-10-01T10:00:00Z"),
      ev("pix_nao_pago_enviado", "2026-10-01T10:10:00Z"),
      ev("pix_nao_pago_enviado", "2026-10-02T06:10:00Z"),
    ]).get(Q);
    expect(p).toEqual({ numero: 2, quando: t("2026-10-02T06:10:00Z") });
  });

  it("um envio de degrau MENOR depois de um maior também reinicia o relógio", () => {
    const p = posicoesNaRegua([
      ev("email_sequencia_enviado", "2026-10-03T10:00:00Z", { numero: 3 }),
      ev("pix_nao_pago_enviado", "2026-10-04T10:00:00Z"),
    ]).get(Q);
    expect(p).toEqual({ numero: 3, quando: t("2026-10-04T10:00:00Z") });
  });

  it("não depende da ordem em que os eventos chegam", () => {
    const eventos = [
      ev("pix_nao_pago_enviado", "2026-10-02T06:10:00Z"),
      ev("email_sequencia_enviado", "2026-10-01T12:00:00Z", { numero: 2 }),
      ev("email_letra_enviado", "2026-10-01T10:00:00Z"),
    ];
    expect(posicoesNaRegua(eventos).get(Q)).toEqual(posicoesNaRegua([...eventos].reverse()).get(Q));
    expect(posicoesNaRegua(eventos).get(Q)).toEqual({ numero: 2, quando: t("2026-10-02T06:10:00Z") });
  });

  it("evento sem quiz fica de fora", () => {
    const m = posicoesNaRegua([{ event_name: "email_letra_enviado", created_at: "2026-10-01T00:00:00Z", event_data: {} }]);
    expect(m.size).toBe(0);
  });
});
