import { describe, expect, it } from "vitest";
import { campoEmv, recebedorDoPix } from "./pix-emv";

// Monta um EMV de verdade (id + tamanho + valor), sem CRC: o leitor não confere CRC.
const emv = (campos: [string, string][]) => campos.map(([id, v]) => id + String(v.length).padStart(2, "0") + v).join("");

describe("o nome do recebedor no código PIX", () => {
  const codigo = emv([["00", "01"], ["26", "0014br.gov.bcb.pix0136abc"], ["52", "0000"], ["53", "986"], ["54", "38.00"], ["58", "BR"], ["59", "ROCKETFY TECNOLOGIA LTDA"], ["60", "Santo Andre"], ["62", "0503***"]]);

  it("lê o campo 59, que é o que o banco mostra", () => {
    expect(recebedorDoPix(codigo)).toBe("ROCKETFY TECNOLOGIA LTDA");
    expect(campoEmv(codigo, "60")).toBe("Santo Andre");
  });

  it("vale pro código da conta antiga também", () => {
    expect(recebedorDoPix(emv([["00", "01"], ["59", "45835258 GUILHERME ROJA"]]))).toBe("45835258 GUILHERME ROJA");
  });

  it("código estranho ou sem o campo não inventa nome", () => {
    expect(recebedorDoPix("")).toBeNull();
    expect(recebedorDoPix("lixo")).toBeNull();
    expect(recebedorDoPix(emv([["00", "01"], ["58", "BR"]]))).toBeNull();
  });
});
