import { describe, expect, it } from "vitest";
import { balanco, brl, desdeMeiaNoiteBr, meiaNoiteBr, textoDoAviso, usd } from "./resumo-vendas";

// O AVISO DE VENDAS, testado no FUSO — que é onde ele mente calado.
//
// Um número errado no WhatsApp não estoura em lugar nenhum: ele só faz o dono
// achar que o dia está pior (ou melhor) do que está. E o erro clássico é de
// uma linha: contar "hoje" a partir da meia-noite UTC, que no Brasil são 21h
// do dia ANTERIOR — três horas de vendas entrando no balde errado, todo dia.

const t = (iso: string) => new Date(iso).getTime();

describe("a meia-noite do Brasil", () => {
  it("01:00 UTC ainda é ONTEM no Brasil (22h)", () => {
    // O caso que pega o bug: às 01:00 UTC o dia BR começou há 22 horas.
    const agora = t("2026-09-28T01:00:00Z");
    expect(desdeMeiaNoiteBr(agora)).toBe(22 * 3600000);
    expect(new Date(meiaNoiteBr(agora)).toISOString()).toBe("2026-09-27T03:00:00.000Z");
  });

  it("15:00 UTC são 12h no Brasil", () => {
    const agora = t("2026-09-28T15:00:00Z");
    expect(desdeMeiaNoiteBr(agora)).toBe(12 * 3600000);
  });

  it("03:00 UTC é exatamente a virada do dia BR", () => {
    expect(desdeMeiaNoiteBr(t("2026-09-28T03:00:00Z"))).toBe(0);
  });
});

describe("balanco", () => {
  // 22h BR de 28/09.
  const agora = t("2026-09-29T01:00:00Z");

  it("conta hoje e ontem ATÉ A MESMA HORA, não o dia inteiro de ontem", () => {
    const b = balanco(
      [
        // hoje (28/09 BR)
        { pago_em: "2026-09-28T13:00:00Z", valor_centavos: 3800 },
        { pago_em: "2026-09-28T20:00:00Z", valor_centavos: 3800 },
        // ontem até as 22h (27/09 BR)
        { pago_em: "2026-09-27T14:00:00Z", valor_centavos: 3800 },
        // ontem DEPOIS das 22h: fora da comparação, senão a conta ficaria
        // injusta com o dia de hoje, que ainda não chegou lá.
        { pago_em: "2026-09-28T02:00:00Z", valor_centavos: 3800 },
      ],
      agora,
    );
    expect(b.vendas).toBe(2);
    expect(b.centavos).toBe(7600);
    expect(b.vendasOntem).toBe(1);
  });

  it("venda das 22h BR de hoje NÃO cai em ontem", () => {
    // 2026-09-29T00:30Z = 21:30 BR do dia 28: é hoje.
    const b = balanco([{ pago_em: "2026-09-29T00:30:00Z", valor_centavos: 3800 }], agora);
    expect(b.vendas).toBe(1);
    expect(b.vendasOntem).toBe(0);
  });

  it("venda de anteontem não entra em nada", () => {
    const b = balanco([{ pago_em: "2026-09-26T15:00:00Z", valor_centavos: 3800 }], agora);
    expect(b).toEqual({ vendas: 0, centavos: 0, vendasOntem: 0, centavosOntem: 0 });
  });

  it("data inválida e valor nulo não derrubam a conta", () => {
    const b = balanco(
      [
        { pago_em: "nao é data", valor_centavos: 3800 },
        { pago_em: "2026-09-28T13:00:00Z", valor_centavos: null },
      ],
      agora,
    );
    expect(b.vendas).toBe(1);
    expect(b.centavos).toBe(0);
  });
});

describe("o texto", () => {
  const agora = t("2026-09-29T01:00:00Z"); // 22h BR

  it("traz venda, receita e a comparação", () => {
    const msg = textoDoAviso(
      { vendas: 23, centavos: 87400, vendasOntem: 19, centavosOntem: 72200 },
      agora,
    );
    expect(msg).toContain("23 vendas");
    expect(msg).toContain("R$ 874,00");
    expect(msg).toContain("ontem a esta hora: 19");
    expect(msg).toContain("↑ 21%");
  });

  it("queda aparece como queda", () => {
    const msg = textoDoAviso(
      { vendas: 10, centavos: 38000, vendasOntem: 20, centavosOntem: 76000 },
      agora,
    );
    expect(msg).toContain("↓ 50%");
  });

  it("sem venda ontem, NÃO inventa porcentagem", () => {
    // "↑ 100%" contra um dia em que o provedor estava fora seria ruído
    // comemorando uma recuperação contra um dia quebrado.
    const msg = textoDoAviso({ vendas: 5, centavos: 19000, vendasOntem: 0, centavosOntem: 0 }, agora);
    expect(msg).toContain("nenhuma");
    expect(msg).not.toMatch(/[↑↓]/);
  });

  it("zero venda não divide por zero no ticket médio", () => {
    const msg = textoDoAviso({ vendas: 0, centavos: 0, vendasOntem: 3, centavosOntem: 11400 }, agora);
    expect(msg).toContain("0 vendas");
    expect(msg).not.toContain("NaN");
    expect(msg).not.toContain("ticket");
  });

  it("uma venda é 'venda', não 'vendas'", () => {
    expect(textoDoAviso({ vendas: 1, centavos: 3800, vendasOntem: 0, centavosOntem: 0 }, agora)).toContain("1 venda ");
  });

  it("às 12h o título é 'até agora'; às 22h é 'de hoje'", () => {
    const meio = t("2026-09-28T15:00:00Z");
    const zero = { vendas: 1, centavos: 3800, vendasOntem: 0, centavosOntem: 0 };
    expect(textoDoAviso(zero, meio)).toContain("Vendas até agora");
    expect(textoDoAviso(zero, agora)).toContain("Vendas de hoje");
  });
});

describe("brl", () => {
  it("formata com milhar e centavo", () => {
    expect(brl(123450)).toBe("R$ 1.234,50");
    expect(brl(3800)).toBe("R$ 38,00");
    expect(brl(0)).toBe("R$ 0,00");
  });
});

// A BALLAD GIFT manda pro mesmo WhatsApp. O aviso dela precisa dizer de quem
// é e cobrar na moeda certa: lá `valor_centavos` é centavo de DÓLAR.
describe("o aviso da Ballad Gift", () => {
  const agora = t("2026-09-29T01:00:00Z");
  const b = { vendas: 2, centavos: 3800, vendasOntem: 1, centavosOntem: 1900 };

  it("sem opção é exatamente o texto da Serenata", () => {
    expect(textoDoAviso(b, agora, {})).toBe(textoDoAviso(b, agora));
    expect(textoDoAviso(b, agora, undefined)).toBe(textoDoAviso(b, agora));
  });

  it("em dólar e com a marca na frente, sem nenhum R$", () => {
    const msg = textoDoAviso(b, agora, { marca: "Ballad Gift", moeda: "USD" });
    expect(msg.split("\n")[0]).toBe("*[Ballad Gift] Vendas de hoje*");
    expect(msg).toContain("2 vendas · US$ 38,00");
    expect(msg).toContain("ontem a esta hora: 1 · US$ 19,00");
    expect(msg).toContain("ticket médio US$ 19,00");
    expect(msg).not.toContain("R$");
  });

  it("usd escreve igual ao brl, só troca o símbolo", () => {
    expect(usd(123450)).toBe("US$ 1.234,50");
    expect(usd(1900)).toBe("US$ 19,00");
  });
});
