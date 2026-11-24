import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BLACK_FRIDAY_ATE, blackFridayAberta, pctDoSelo, reaisDoTexto, seloBlackFriday,
} from "./black-friday";
import { MOEDA } from "./i18n";

const base = {
  agora: new Date("2026-11-27T15:00:00Z"),
  locale: "pt",
  ballad: false,
  temCredito: false,
  temCupom: false,
  temConvite: false,
  planos: [{ texto: "R$ 38", ancora: "R$ 97" }],
};

describe("selo de Black Friday", () => {
  it("o 60% é a conta do preço de hoje, não um número escrito à mão", () => {
    expect(pctDoSelo(MOEDA.pt.texto, MOEDA.pt.ancora)).toBe(60);
  });

  it("arredonda pra baixo e não anuncia desconto pequeno", () => {
    expect(pctDoSelo("R$ 38", "R$ 97")).toBe(60); // 60,8%
    expect(pctDoSelo("R$ 29", "R$ 97")).toBe(70); // 70,1%
    expect(pctDoSelo("R$ 54,90", "R$ 97")).toBe(43);
    expect(pctDoSelo("R$ 38", "R$ 49,90")).toBeNull(); // 23%
    expect(pctDoSelo("R$ 97", "R$ 97")).toBeNull();
    expect(pctDoSelo("US$ 19", "US$ 49")).toBeNull();
  });

  it("lê preço em real com e sem centavos", () => {
    expect(reaisDoTexto("R$ 38")).toBe(38);
    expect(reaisDoTexto("R$ 49,90")).toBe(49.9);
    expect(reaisDoTexto("$199 MXN")).toBeNull();
  });

  it("vale até domingo 29/11, 23h59 de Brasília, e some depois", () => {
    expect(blackFridayAberta(new Date("2026-11-30T02:59:00Z"))).toBe(true);
    expect(blackFridayAberta(new Date("2026-11-30T03:00:00Z"))).toBe(false);
    expect(seloBlackFriday({ ...base, agora: new Date(BLACK_FRIDAY_ATE) })).toBe(60);
    expect(seloBlackFriday({ ...base, agora: new Date("2026-12-01T12:00:00Z") })).toBeNull();
  });

  it("só na Serenata em português", () => {
    expect(seloBlackFriday(base)).toBe(60);
    expect(seloBlackFriday({ ...base, ballad: true })).toBeNull();
    expect(seloBlackFriday({ ...base, locale: "es" })).toBeNull();
    expect(seloBlackFriday({ ...base, locale: "en" })).toBeNull();
  });

  it("quem paga outro valor (cupom, convite) ou não paga (crédito) não vê o selo", () => {
    expect(seloBlackFriday({ ...base, temCupom: true })).toBeNull();
    expect(seloBlackFriday({ ...base, temConvite: true })).toBeNull();
    expect(seloBlackFriday({ ...base, temCredito: true })).toBeNull();
  });

  it("braços de preço com contas diferentes: sem selo", () => {
    const outro = { texto: "R$ 29", ancora: "R$ 97" };
    expect(seloBlackFriday({ ...base, planos: [base.planos[0], base.planos[0]] })).toBe(60);
    expect(seloBlackFriday({ ...base, planos: [base.planos[0], outro] })).toBeNull();
    expect(seloBlackFriday({ ...base, planos: [] })).toBeNull();
  });

  it("o cabeçalho nasce escondido e só o braço B acende (CSS)", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.bf-topo\s*\{\s*display:\s*none/);
    expect(css).toContain('html[data-exp-black_friday="B"] .bf-topo');
    // nenhuma regra do selo fora do braço B, além da que esconde o cabeçalho
    const regras = css.split("}").filter((r) => r.includes(".bf-"));
    for (const r of regras) {
      if (/\.bf-topo\s*\{\s*display:\s*none/.test(r)) continue;
      expect(r).toContain('html[data-exp-black_friday="B"]');
    }
  });
});
