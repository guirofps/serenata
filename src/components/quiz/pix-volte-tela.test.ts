import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PixPagamento } from "./PixPagamento";

// TESTE `pix_volte`: a caixa só existe no B, e no B o e-mail aparece por extenso.
function render(avisoVolte?: { email: string | null }) {
  return renderToStaticMarkup(
    createElement(PixPagamento, {
      copiaECola: "00020101021226",
      valorTexto: "R$ 38",
      referencia: "serenata:teste",
      aoPagar: () => {},
      avisoVolte,
    }),
  );
}

describe("tela do PIX com o pix_volte", () => {
  it("A: tela de sempre, sem a caixa", () => {
    expect(render()).not.toContain("volte para esta tela");
  });

  it("B: a caixa com o e-mail", () => {
    const html = render({ email: "ana@gmail.com" });
    expect(html).toContain("Depois de pagar, volte para esta tela");
    expect(html).toContain("ana@gmail.com");
    expect(html).not.toContain("—");
  });

  it("B sem e-mail: a caixa sai sem a frase do e-mail", () => {
    const html = render({ email: null });
    expect(html).toContain("A sua música abre aqui sozinha.");
    expect(html).not.toContain("chega no seu e-mail");
  });
});
