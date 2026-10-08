import { describe, expect, it } from "vitest";
import {
  MUSICA10,
  MUSICA10_VALE_ATE,
  centavosComCupom,
  codigoAplicado,
  codigoComPrazo,
  descontoNaTela,
  prazoDoCodigo,
  valorEsperadoDoUpsell,
  validadeCurta,
} from "./cupom";

const antes = new Date("2026-09-26T12:00:00Z");
describe("centavosComCupom", () => {
  it("SRN27 leva R$ 38 a R$ 28", () => {
    expect(centavosComCupom(3800, "srn27", antes)).toBe(2800);
  });
  it("código errado ou vazio não mexe", () => {
    expect(centavosComCupom(3800, "SRN99", antes)).toBe(3800);
    expect(centavosComCupom(3800, undefined, antes)).toBe(3800);
  });
  it("nunca sobe o preço", () => {
    expect(centavosComCupom(2500, "SRN27", antes)).toBe(2500);
  });
  it("vencido não vale", () => {
    expect(centavosComCupom(3800, "SRN27", new Date("2026-10-20T12:00:00Z"))).toBe(3800);
  });
});

// Um instante seguramente dentro da validade do MUSICA10 e um fora.
const dentro = new Date(`${MUSICA10_VALE_ATE}T12:00:00-03:00`);
const ultimoMinuto = new Date(`${MUSICA10_VALE_ATE}T23:59:00-03:00`);
const depois = new Date(new Date(`${MUSICA10_VALE_ATE}T23:59:59-03:00`).getTime() + 2000);

describe("MUSICA10 (R$ 10 fixos)", () => {
  it("tira R$ 10 da música, do extra, do quadro e do vídeo", () => {
    expect(centavosComCupom(3800, "MUSICA10", dentro, "musica")).toBe(2800);
    expect(centavosComCupom(2800, "MUSICA10", dentro, "extra")).toBe(1800);
    expect(centavosComCupom(2490, "MUSICA10", dentro, "quadro")).toBe(1490);
    expect(centavosComCupom(2490, "MUSICA10", dentro, "video")).toBe(1490);
  });
  it("vale sobre o braço da pessoa, não sobre um preço fixo", () => {
    expect(centavosComCupom(5490, "MUSICA10", dentro)).toBe(4490);
  });
  it("respeita o piso de R$ 5 e nunca sobe o preço", () => {
    expect(centavosComCupom(1200, "MUSICA10", dentro)).toBe(500);
    expect(centavosComCupom(400, "MUSICA10", dentro)).toBe(400);
  });
  it("minúsculas e espaços tanto faz", () => {
    expect(centavosComCupom(3800, "  musica10 ", dentro)).toBe(2800);
  });
  it("vale até 23h59 de Brasília do último dia, e não depois", () => {
    expect(centavosComCupom(3800, MUSICA10, ultimoMinuto)).toBe(2800);
    expect(centavosComCupom(3800, MUSICA10, depois)).toBe(3800);
  });
  it("o SRN27 continua só na música", () => {
    expect(centavosComCupom(2800, "SRN27", antes, "extra")).toBe(2800);
  });
  it("codigoAplicado só devolve quando baixou o preço", () => {
    expect(codigoAplicado(3800, " musica10", dentro)).toBe("MUSICA10");
    expect(codigoAplicado(3800, "NADA", dentro)).toBeNull();
    expect(codigoAplicado(400, "MUSICA10", dentro)).toBeNull();
  });
});

describe("descontoNaTela", () => {
  it("monta de/por a partir do preço da pessoa", () => {
    expect(descontoNaTela("MUSICA10", "pt", 3800, "musica", dentro)).toEqual({
      codigo: "MUSICA10",
      texto: "R$ 10",
      de: "R$ 38",
      por: "R$ 28",
      porCentavos: 2800,
    });
    expect(descontoNaTela("MUSICA10", "pt", 2490, "quadro", dentro)?.por).toBe("R$ 14,90");
  });
  it("não vale no espanhol nem no inglês", () => {
    expect(descontoNaTela("MUSICA10", "es", 3800, "musica", dentro)).toBeNull();
    expect(descontoNaTela("MUSICA10", "en", 3800, "musica", dentro)).toBeNull();
  });
  it("código desconhecido ou vazio não mostra nada", () => {
    expect(descontoNaTela("XPTO", "pt", 3800, "musica", dentro)).toBeNull();
    expect(descontoNaTela(null, "pt", 3800, "musica", dentro)).toBeNull();
  });
});

describe("valorEsperadoDoUpsell", () => {
  it("sem cupom no pedido, é o catálogo", () => {
    expect(valorEsperadoDoUpsell(2800, "extra", null)).toBe(2800);
    expect(valorEsperadoDoUpsell(2800, "extra", { cupom: null })).toBe(2800);
  });
  it("com cupom, vale a data em que o pedido NASCEU, não a do pagamento", () => {
    const criado = ultimoMinuto.toISOString();
    expect(valorEsperadoDoUpsell(2800, "extra", { cupom: "MUSICA10", created_at: criado })).toBe(1800);
  });
});

it("validadeCurta escreve dia/mês", () => {
  const [, m, d] = MUSICA10_VALE_ATE.split("-");
  expect(validadeCurta(MUSICA10)).toBe(`${d}/${m}`);
});

// O SRN27 COM PRAZO DE CADA PESSOA (teste `recuperacao_prazo`, 08/10).
describe("SRN27 com prazo (SRN27P + AAMMDD)", () => {
  it("vale até 23h59 de Brasília do dia escrito, e não depois", () => {
    const c = codigoComPrazo("2026-10-09");
    expect(c).toBe("SRN27P261009");
    expect(centavosComCupom(3800, c, new Date("2026-10-09T23:59:00-03:00"))).toBe(2800);
    expect(centavosComCupom(3800, c, new Date("2026-10-10T00:00:30-03:00"))).toBe(3800);
  });

  it("não depende da validade global do SRN27", () => {
    const depoisDoGlobal = new Date("2026-11-03T12:00:00-03:00");
    expect(centavosComCupom(3800, "SRN27", depoisDoGlobal)).toBe(3800);
    expect(centavosComCupom(3800, codigoComPrazo("2026-11-04"), depoisDoGlobal)).toBe(2800);
  });

  it("data editada pra longe não vale: no máximo 3 dias à frente", () => {
    const hoje = new Date("2026-10-08T12:00:00-03:00");
    expect(centavosComCupom(3800, codigoComPrazo("2026-10-11"), hoje)).toBe(2800);
    expect(centavosComCupom(3800, codigoComPrazo("2026-10-13"), hoje)).toBe(3800);
    expect(centavosComCupom(3800, "SRN27P991231", hoje)).toBe(3800);
  });

  it("data impossível ou formato errado não vale", () => {
    const hoje = new Date("2026-10-08T12:00:00-03:00");
    expect(prazoDoCodigo("SRN27P261332")).toBeNull();
    expect(prazoDoCodigo("SRN27P2610")).toBeNull();
    expect(centavosComCupom(3800, "SRN27P261332", hoje)).toBe(3800);
    expect(() => codigoComPrazo("09/10/2026")).toThrow();
  });

  it("só na música, e nunca sobe o preço", () => {
    const hoje = new Date("2026-10-08T12:00:00-03:00");
    const c = codigoComPrazo("2026-10-09");
    expect(centavosComCupom(2490, c, hoje, "video")).toBe(2490);
    expect(centavosComCupom(2500, c, hoje)).toBe(2500);
  });

  it("minúscula vale (o código passa pelo toUpperCase)", () => {
    expect(centavosComCupom(3800, "srn27p261009", new Date("2026-10-09T10:00:00-03:00"))).toBe(2800);
  });
});
