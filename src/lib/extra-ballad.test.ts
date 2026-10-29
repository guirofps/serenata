import { describe, expect, it } from "vitest";
import { bracoExtraBallad, TEXTO_EXTRA_BALLAD } from "./extra-ballad";
import { OFERTAS, precoUsdTexto, precoVideoUsdTexto } from "./creditos";
import { centavosMxnDe, textoEmPeso, usdDoPeso, valorPagoConfere } from "./preco-mxn";

describe("teste extra_ballad", () => {
  it("o braço sai do 3º caractere do fim do token, pela paridade", () => {
    expect(bracoExtraBallad("abcdef2100")).toBe("B"); // '1' ímpar
    expect(bracoExtraBallad("abcdef1200")).toBe("A"); // '2' par
    expect(bracoExtraBallad("abcdef0f00")).toBe("B"); // 'f' = 15
  });

  it("token vazio ou estranho fica no A", () => {
    expect(bracoExtraBallad(null)).toBe("A");
    expect(bracoExtraBallad("")).toBe("A");
    expect(bracoExtraBallad("zz")).toBe("A");
    expect(bracoExtraBallad("abczzz")).toBe("A");
  });

  it("divide perto de meio a meio em tokens hexadecimais", () => {
    let b = 0;
    for (let i = 0; i < 4096; i++) if (bracoExtraBallad(i.toString(16).padStart(8, "0")) === "B") b++;
    expect(b).toBe(2048);
  });

  it("o preço: US$ 14 nos EUA, $149 MXN no México, e o caixa em peso confere", () => {
    expect(OFERTAS.find((o) => o.id === "extra")?.precoUsd).toBe(14);
    expect(precoUsdTexto("extra")).toBe("$14");
    expect(precoVideoUsdTexto()).toBe("$12");
    expect(precoUsdTexto("quadro")).toBeNull();
    expect(centavosMxnDe(1400)).toBe(14900);
    expect(textoEmPeso("$14")).toBe("$149 MXN");
    expect(textoEmPeso("US$ 19")).toBe("$199 MXN");
    expect(valorPagoConfere("mxn", 14900, usdDoPeso(14900))).toBe(true);
  });

  it("a copy não fala de Brasil, real nem PIX", () => {
    for (const t of Object.values(TEXTO_EXTRA_BALLAD)) {
      const tudo = [t.pergunta, t.rotulo("$14"), t.jaTem(1), t.jaTem(2), t.fino(t.cheio), t.folha("$14")].join(" ");
      expect(tudo).not.toMatch(/R\$|PIX|Brasil|real/i);
    }
  });
});
