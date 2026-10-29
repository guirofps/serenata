import { describe, expect, it } from "vitest";
import {
  bracoOxxoPendente,
  horaBoaNoMexico,
  quandoVence,
  toqueDevido,
  venceHojeOuAmanha,
  type Toque,
} from "./oxxo-pendente";
import { assuntoOxxoPendente, emailOxxoPendente, textoOxxoPendente } from "../../emails/oxxo-pendente";

const H = 3600e3;
const T0 = Date.parse("2026-10-28T18:00:00Z"); // 12h no México
const nada = new Set<Toque>();

describe("teste oxxo_pendente: quando cada toque sai", () => {
  const ficha = { criadaEm: T0, venceEm: T0 + 72 * H };

  it("o 1º toque só depois de 2h da ficha", () => {
    expect(toqueDevido({ ...ficha, agora: T0 + 1 * H, feitos: nada })).toBeNull();
    expect(toqueDevido({ ...ficha, agora: T0 + 2 * H, feitos: nada })).toBe(1);
  });

  it("depois do 1º, nada até o último dia; aí o 2º", () => {
    const um = new Set<Toque>([1]);
    expect(toqueDevido({ ...ficha, agora: T0 + 30 * H, feitos: um, ultimoEm: T0 + 2 * H })).toBeNull();
    expect(toqueDevido({ ...ficha, agora: T0 + 49 * H, feitos: um, ultimoEm: T0 + 2 * H })).toBe(2);
    expect(toqueDevido({ ...ficha, agora: T0 + 50 * H, feitos: new Set<Toque>([1, 2]), ultimoEm: T0 + 49 * H })).toBeNull();
  });

  it("ficha perto de vencer não recebe nada", () => {
    expect(toqueDevido({ ...ficha, agora: T0 + 71 * H, feitos: nada })).toBeNull();
  });

  it("se o 1º não saiu a tempo, vai direto o 2º, e nunca dois em menos de 12h", () => {
    expect(toqueDevido({ ...ficha, agora: T0 + 50 * H, feitos: nada })).toBe(2);
    expect(toqueDevido({ ...ficha, agora: T0 + 50 * H, feitos: new Set<Toque>([1]), ultimoEm: T0 + 45 * H })).toBeNull();
  });

  it("o braço sai do 8º caractere do fim do quiz", () => {
    expect(bracoOxxoPendente("aaaaaaaaaaaa-1aaaaaaa".replace(/-/g, ""))).toBe("B");
    expect(bracoOxxoPendente("aaaa2aaaaaaa")).toBe("A");
    expect(bracoOxxoPendente("")).toBe("A");
    let b = 0;
    for (let i = 0; i < 16; i++) if (bracoOxxoPendente(`${i.toString(16)}0000000`) === "B") b++;
    expect(b).toBe(8);
  });
});

describe("hora e data no México", () => {
  it("só entre 8h e 21h59 de lá (UTC-6)", () => {
    expect(horaBoaNoMexico(Date.parse("2026-10-28T13:59:00Z"))).toBe(false); // 7h59
    expect(horaBoaNoMexico(Date.parse("2026-10-28T14:00:00Z"))).toBe(true); // 8h
    expect(horaBoaNoMexico(Date.parse("2026-10-29T03:59:00Z"))).toBe(true); // 21h59
    expect(horaBoaNoMexico(Date.parse("2026-10-29T04:00:00Z"))).toBe(false); // 22h
  });

  it("escreve o vencimento em espanhol, no horário de lá", () => {
    const t = quandoVence(Date.parse("2026-10-30T21:40:00Z")); // 15h40 no México
    expect(t).toMatch(/^el viernes 30 de octubre a las 3:40/);
  });

  it("hoje e amanhã pelo calendário do México", () => {
    const agora = Date.parse("2026-10-29T05:30:00Z"); // 23h30 do dia 28 no México
    expect(venceHojeOuAmanha(Date.parse("2026-10-29T05:50:00Z"), agora)).toBe("hoy");
    expect(venceHojeOuAmanha(Date.parse("2026-10-29T20:00:00Z"), agora)).toBe("mañana");
    expect(venceHojeOuAmanha(Date.parse("2026-11-01T20:00:00Z"), agora)).toBeNull();
  });
});

describe("e-mail da ficha", () => {
  const base = {
    nome: "Lupita <3",
    toque: 1 as const,
    linkFicha: "https://checkout.dlocalgo.com/abc",
    linkCartao: "https://www.balladgift.com/retomar?s=x&de=oxxo",
    vence: "el jueves 30 de octubre a las 3:40 p. m.",
    quando: null,
    valor: "$199 MXN",
  };

  it("leva o link da ficha, o valor e a data, e escapa o nome", () => {
    const html = emailOxxoPendente(base);
    expect(html).toContain("https://checkout.dlocalgo.com/abc");
    expect(html).toContain("$199 MXN");
    expect(html).toContain("jueves 30 de octubre");
    expect(html).toContain("Lupita &lt;3");
    expect(html).not.toContain("Lupita <3");
  });

  it("o 2º toque fala do vencimento", () => {
    expect(assuntoOxxoPendente({ ...base, toque: 2, quando: "mañana" })).toBe("Tu ficha de OXXO vence mañana");
    expect(emailOxxoPendente({ ...base, toque: 2, quando: "hoy" })).toContain("Tu ficha vence hoy.");
  });

  it("sem travessão, sem real, em tú", () => {
    const tudo = [emailOxxoPendente(base), textoOxxoPendente(base), emailOxxoPendente({ ...base, toque: 2, quando: "mañana" })].join(" ");
    expect(tudo).not.toMatch(/—|R\$|PIX|\bvos\b|querés|tenés/);
  });
});
