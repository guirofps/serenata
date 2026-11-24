import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BLACK_FRIDAY_ATE,
  BLACK_FRIDAY_ATE_BALLAD,
  blackFridayAberta,
  pctDeValores,
  pctDoSelo,
  pctNoMercado,
  reaisDoTexto,
  seloBlackFriday,
} from "./black-friday";
import { MOEDA } from "./i18n";
import { MERCADOS, MERCADOS_LOCAIS } from "./mercados";

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

describe("selo de Black Friday na Ballad", () => {
  const plano = { texto: MOEDA.en.texto, ancora: MOEDA.en.ancora };
  const ballad = { ...base, ballad: true, locale: "en", planos: [plano] };

  it("inglês e espanhol da Ballad veem; o português não existe lá", () => {
    expect(seloBlackFriday(ballad)).toBe(61); // $49 por $19
    expect(seloBlackFriday({ ...ballad, locale: "es" })).toBe(61);
    expect(seloBlackFriday({ ...ballad, locale: "pt" })).toBeNull();
    expect(seloBlackFriday({ ...ballad, temCupom: true })).toBeNull();
    expect(seloBlackFriday({ ...ballad, temCredito: true })).toBeNull();
  });

  it("vale até domingo 29/11, 23h59 do Pacífico", () => {
    expect(seloBlackFriday({ ...ballad, agora: new Date(BLACK_FRIDAY_ATE_BALLAD) })).toBe(61);
    expect(seloBlackFriday({ ...ballad, agora: new Date("2026-11-30T08:00:00Z") })).toBeNull();
    // a Serenata já fechou a essa hora
    expect(seloBlackFriday({ ...base, agora: new Date("2026-11-30T05:00:00Z") })).toBeNull();
  });

  it("o número de cada moeda sai da tabela do caixa daquele país", () => {
    const porPais = Object.fromEntries(
      MERCADOS_LOCAIS.map((m) => [m.pais, pctNoMercado(m, plano)]),
    );
    expect(porPais).toEqual({ MX: 63, ES: 61, CO: 60, CL: 60, PE: 60, AR: 60 });
    expect(pctNoMercado(MERCADOS.US, plano)).toBe(61);
    // México: $549 por $199
    expect(pctNoMercado(MERCADOS.MX, plano)).toBe(63);
    // todo país tem um desconto de verdade pra anunciar
    for (const m of MERCADOS_LOCAIS) expect(pctNoMercado(m, plano)).not.toBeNull();
  });

  it("braço do teste de preço do país muda o número junto com o preço", () => {
    const co = MERCADOS.CO;
    expect(pctNoMercado(co, plano)).toBe(60); // $99.900 por $39.900
    expect(pctNoMercado(co, plano, "C")).toBe(53); // $74.900 por $34.900
  });

  it("valores iguais ou invertidos não viram selo", () => {
    expect(pctDeValores(100, 100)).toBeNull();
    expect(pctDeValores(120, 100)).toBeNull();
    expect(pctDeValores(null, 100)).toBeNull();
    expect(pctDeValores(40, 100)).toBe(60);
  });
});
