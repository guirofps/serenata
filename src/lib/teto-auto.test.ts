import { describe, expect, it } from "vitest";
import { decidirTeto, TETO_MAXIMO } from "./teto-auto";

describe("teto que sobe sozinho", () => {
  it("dia bom (vende como sempre): sobe 50%, arredondado pra 500", () => {
    expect(decidirTeto({ teto: 4000, musicasHoje: 3200, vendasHoje: 420 })).toMatchObject({ subir: true, novo: 6000 });
    expect(decidirTeto({ teto: 2500, musicasHoje: 2000, vendasHoje: 280 })).toMatchObject({ subir: true, novo: 4000 });
  });
  it("nunca passa do máximo", () => {
    expect(decidirTeto({ teto: 8000, musicasHoje: 6400, vendasHoje: 900 })).toMatchObject({ subir: true, novo: TETO_MAXIMO });
    expect(decidirTeto({ teto: TETO_MAXIMO, musicasHoje: 8000, vendasHoje: 1200 })).toMatchObject({ subir: false, motivo: "no-maximo" });
  });
  it("música demais pra pouca venda é robô: não sobe", () => {
    expect(decidirTeto({ teto: 4000, musicasHoje: 3200, vendasHoje: 40 })).toMatchObject({ subir: false, motivo: "suspeito" });
  });
});
