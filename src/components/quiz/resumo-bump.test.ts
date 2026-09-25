import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResumoDoPedido } from "./ResumoDoPedido";
import { BUMPS, TEXTO_BUMP, valorComItem, type ItemBump } from "@/lib/bump";

// A caixinha do bump mostra o preço do MESMO catálogo que o servidor cobra.
// Tela e cobrança discordando é o único jeito de o bump virar reclamação
// (já aconteceu em 31/08: "R$ 38" na tela, código de R$ 62,90).
const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",").replace(/,00$/, "")}`;

function render(item: ItemBump, marcado: boolean) {
  return renderToStaticMarkup(
    createElement(ResumoDoPedido, {
      nome: "Bianca",
      titulo: "Café Dela",
      precoTexto: "R$ 38",
      precoBase: 38,
      email: "teste@exemplo.com",
      telefoneInicial: "",
      quadro: marcado,
      item,
      aoTrocarQuadro: () => {},
      aoConfirmar: () => {},
      aoEscolherCartao: () => {},
      gerando: false,
    }),
  );
}

describe("caixinha do bump no resumo do pedido", () => {
  for (const item of ["quadro", "video", "completo"] as const) {
    it(`${item}: título e preço do catálogo, e o total bate com a cobrança`, () => {
      const html = render(item, true);
      expect(html).toContain(TEXTO_BUMP[item].titulo);
      expect(html).toContain(`+ ${reais(BUMPS[item].centavos)}`);
      // Total da tela = valor que o servidor cobra (base 38 + item).
      expect(html).toContain(reais(valorComItem(3800, item)));
    });
  }

  it("o completo mostra o preço cheio riscado", () => {
    expect(render("completo", false)).toContain("R$ 49,80");
  });
});
