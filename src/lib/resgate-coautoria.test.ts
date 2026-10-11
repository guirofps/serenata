import { describe, expect, it } from "vitest";
import { bracoResgate, entraNoResgate, INATIVO_MIN, JANELA_H, type CandidatoResgate } from "@/lib/resgate-coautoria";

const agora = Date.parse("2026-10-11T15:00:00Z");
const base: CandidatoResgate = {
  furthestStep: 9,
  email: "a@b.com",
  locale: "pt",
  criadoEm: agora - 3 * 3600000,
  ultimoEventoEm: agora - 3 * 3600000,
  temMusica: false,
  jaResgatado: false,
};

describe("bracoResgate", () => {
  it("usa o 5º caractere do fim, par = A", () => {
    expect(bracoResgate("00000000-0000-0000-0000-000000000000")).toBe("A");
    expect(bracoResgate("00000000-0000-0000-0000-000000010000")).toBe("C");
    // O 2º-4º do fim (testes de e-mail) não mexem no braço.
    expect(bracoResgate("00000000-0000-0000-0000-000000001110")).toBe("A");
  });
  it("divide perto de meio a meio", () => {
    let c = 0;
    for (let i = 0; i < 4096; i++) if (bracoResgate(crypto.randomUUID()) === "C") c++;
    expect(c / 4096).toBeGreaterThan(0.45);
    expect(c / 4096).toBeLessThan(0.55);
  });
});

describe("entraNoResgate", () => {
  it("lead completo, parado há 3h, sem música: entra", () => {
    expect(entraNoResgate(base, agora)).toBe(true);
  });
  it("quem ainda mexeu há menos de 2h fica de fora", () => {
    expect(entraNoResgate({ ...base, ultimoEventoEm: agora - (INATIVO_MIN - 1) * 60000 }, agora)).toBe(false);
  });
  it("sem evento, conta a criação do quiz", () => {
    expect(entraNoResgate({ ...base, ultimoEventoEm: null }, agora)).toBe(true);
    expect(entraNoResgate({ ...base, ultimoEventoEm: null, criadoEm: agora - 60 * 60000 }, agora)).toBe(false);
  });
  it("fora: com música, já resgatado, sem e-mail, quiz incompleto, outro idioma, velho", () => {
    expect(entraNoResgate({ ...base, temMusica: true }, agora)).toBe(false);
    expect(entraNoResgate({ ...base, jaResgatado: true }, agora)).toBe(false);
    expect(entraNoResgate({ ...base, email: null }, agora)).toBe(false);
    expect(entraNoResgate({ ...base, furthestStep: 8 }, agora)).toBe(false);
    expect(entraNoResgate({ ...base, locale: "es" }, agora)).toBe(false);
    expect(entraNoResgate({ ...base, criadoEm: agora - (JANELA_H + 1) * 3600000 }, agora)).toBe(false);
  });
  it("locale nulo é português", () => {
    expect(entraNoResgate({ ...base, locale: null }, agora)).toBe(true);
  });
});
