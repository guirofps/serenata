import { describe, expect, it } from "vitest";
import { caminhoDeVolta } from "./volta-ao-funil";
import { rotaSensivel } from "./rotas-sensiveis";

const SESSAO = "3f0c2a9e-6b1d-4c8e-9a7f-1e2d3c4b5a69";

describe("caminhoDeVolta", () => {
  it("com sessão, volta pra música dela pelo /retomar", () => {
    expect(caminhoDeVolta(SESSAO)).toBe(`/retomar?s=${SESSAO}`);
  });

  it("nunca manda pro /criar?checkout=1, que o schema do /criar descarta", () => {
    // O defeito de 08/10: o `checkout=1` sumia e a pessoa caía na abertura.
    expect(caminhoDeVolta(SESSAO)).not.toContain("checkout");
    expect(caminhoDeVolta(null)).not.toContain("checkout");
  });

  it("sem sessão (ou com lixo no lugar), cai no /criar", () => {
    expect(caminhoDeVolta(null)).toBe("/criar");
    expect(caminhoDeVolta(undefined)).toBe("/criar");
    expect(caminhoDeVolta("")).toBe("/criar");
    expect(caminhoDeVolta("ssr")).toBe("/criar");
    // Um `&` ou `/` injetado não vira parâmetro nem caminho novo.
    expect(caminhoDeVolta(`${SESSAO}&cupom=SRN27`)).toBe("/criar");
    expect(caminhoDeVolta("../admin")).toBe("/criar");
  });

  it("leva o cupom do pedido junto, e só se ele tiver cara de cupom", () => {
    expect(caminhoDeVolta(SESSAO, "MUSICA10")).toBe(`/retomar?s=${SESSAO}&cupom=MUSICA10`);
    expect(caminhoDeVolta(SESSAO, null)).toBe(`/retomar?s=${SESSAO}`);
    expect(caminhoDeVolta(SESSAO, "a&b=c")).toBe(`/retomar?s=${SESSAO}`);
  });

  it("o destino é rota sensível: a sessão na URL não vai pra script de terceiro", () => {
    expect(rotaSensivel(caminhoDeVolta(SESSAO).split("?")[0])).toBe(true);
    // E as duas telas que montam este link também.
    expect(rotaSensivel("/pix/pay_abc123")).toBe(true);
    expect(rotaSensivel("/oferta/x.7.y")).toBe(true);
  });
});
