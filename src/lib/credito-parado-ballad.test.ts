import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// O LEMBRETE DE CRÉDITO PARADO NAS DUAS MARCAS (28/10). Com a música extra
// vendida na Ballad (`extra_ballad`), o lembrete roda lá também: inglês e o
// espanhol de lá (`tú`), sem nada da Serenata. Sem a env, o português e o
// espanhol argentino como eram.

const PROIBIDOS = ["—", "R$", "PIX", "WhatsApp", "Serenata"];
const VOSEO = [/\btenés\b/i, /\bAbrí\b/, /\bContá\b/, /\brespondé\b/, /\bvos\b/];
const LINK = "https://www.balladgift.com/credito/ab12";

describe("na Ballad, o lembrete de crédito em inglês e em tú", () => {
  let m: typeof import("../../emails/credito-parado");
  beforeAll(async () => {
    vi.stubEnv("VITE_MARCA", "ballad");
    vi.resetModules();
    m = await import("../../emails/credito-parado");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  for (const locale of ["en", "es"] as const) {
    it(`${locale}: sem nada do Brasil nem voseo, com o link`, () => {
      const tudo = [
        m.assuntoCreditoParado(locale),
        m.emailCreditoParado({ link: LINK, saldo: 2, locale }),
        m.textoCreditoParado(LINK, locale),
      ].join(" ");
      for (const p of PROIBIDOS) expect(tudo).not.toContain(p);
      for (const v of VOSEO) expect(tudo).not.toMatch(v);
      expect(tudo).toContain(LINK);
      expect(tudo).toContain("Ballad");
    });
  }

  it("cada idioma na sua língua", () => {
    expect(m.assuntoCreditoParado("en")).toBe("You have a paid song waiting");
    expect(m.assuntoCreditoParado("es")).toBe("Tienes una canción pagada esperando");
    expect(m.emailCreditoParado({ link: LINK, saldo: 3, locale: "en" })).toContain("3 credits");
  });
});

describe("na Serenata, o lembrete de crédito como era", () => {
  it("português e o espanhol argentino", async () => {
    vi.resetModules();
    const s = await import("../../emails/credito-parado");
    expect(s.assuntoCreditoParado("pt")).toBe("Você tem uma música paga esperando");
    expect(s.assuntoCreditoParado("es")).toBe("Tenés una canción pagada esperando");
    expect(s.emailCreditoParado({ link: LINK, saldo: 2, locale: "pt" })).toContain("2 créditos");
  });
});
