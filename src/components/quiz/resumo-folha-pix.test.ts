import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResumoDoPedido } from "./ResumoDoPedido";
import type { BracoFolha } from "@/lib/folha-pix";
import { valorComItem } from "@/lib/bump";

const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",").replace(/,00$/, "")}`;

// Os três braços do teste `folha_pix`, renderizados. O que importa aqui é o
// que cada um MOSTRA: o A não pode ganhar nada (é o controle), o B só ganha o
// CPF, e o C esconde a lista mas mantém cartão, garantia, CNPJ e e-mail.

const LISTA = "A música completa, nas duas gravações";

function render(
  braco: BracoFolha | undefined,
  extra: Partial<Parameters<typeof ResumoDoPedido>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(ResumoDoPedido, {
      nome: "Bianca",
      titulo: "Café Dela",
      precoTexto: "R$ 38",
      precoBase: 38,
      ancora: "R$ 89,90",
      email: "teste@exemplo.com",
      telefoneInicial: "",
      quadro: null,
      aoTrocarQuadro: () => {},
      aoConfirmar: () => {},
      aoEscolherCartao: () => {},
      gerando: false,
      ...(braco ? { braco } : {}),
      ...extra,
    }),
  );
}

describe("folha_pix: braço A (controle)", () => {
  it("sem braço é o A, e o A não tem CPF nenhum", () => {
    expect(render(undefined)).toBe(render("A"));
    const html = render("A");
    expect(html).not.toContain('name="cpf-pix"');
    expect(html).not.toContain("CPF");
    expect(html).toContain(LISTA);
    expect(html).toContain("Gerar meu PIX");
  });

  it("CPF lembrado não vaza pro A", () => {
    expect(render("A", { cpfInicial: "52998224725" })).toBe(render("A"));
  });
});

describe("folha_pix: braço B (CPF no resumo)", () => {
  it("o campo do CPF aparece com teclado numérico, sem autocomplete e com a explicação", () => {
    const html = render("B");
    expect(html).toContain('name="cpf-pix"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain("O banco pede o CPF pra emitir o PIX no seu nome. Não aparece pra ninguém.");
  });

  it("o CPF fica colado no botão: depois do cartão e do CNPJ, logo antes de 'Gerar meu PIX'", () => {
    const html = render("B");
    const cpf = html.indexOf('name="cpf-pix"');
    expect(cpf).toBeGreaterThan(html.indexOf("Pagar com cartão"));
    expect(cpf).toBeLessThan(html.indexOf("Gerar meu PIX"));
  });

  it("o resto é o resumo de sempre: lista, cartão, garantia", () => {
    const html = render("B");
    expect(html).toContain(LISTA);
    expect(html).toContain("Pagar com cartão");
    expect(html).toContain("reembolso sem perguntas");
  });

  it("CPF lembrado vem numa linha, mascarado, com 'trocar'", () => {
    const html = render("B", { cpfInicial: "52998224725" });
    expect(html).toContain("529.982.247-25");
    expect(html).not.toContain('name="cpf-pix"');
  });
});

describe("folha_pix: braço C (enxuto)", () => {
  it("botão grande com o valor, e a lista fechada atrás de 'O que eu recebo?'", () => {
    const html = render("C");
    expect(html).toContain("Gerar PIX de R$ 38");
    expect(html).not.toContain("Gerar meu PIX");
    expect(html).toContain("O que eu recebo?");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain(LISTA);
  });

  it("mantém CPF, e-mail editável, cartão, garantia e CNPJ", () => {
    const html = render("C");
    expect(html).toContain('name="cpf-pix"');
    expect(html).toContain("teste@exemplo.com");
    expect(html).toContain("trocar");
    expect(html).toContain("Pagar com cartão");
    expect(html).toContain("reembolso sem perguntas");
    expect(html).toContain("CNPJ");
  });

  it("o CPF vem antes do botão, e o cartão depois dele", () => {
    const html = render("C");
    const botao = html.indexOf("Gerar PIX de");
    expect(html.indexOf('name="cpf-pix"')).toBeLessThan(botao);
    expect(html.indexOf("Pagar com cartão")).toBeGreaterThan(botao);
  });

  it("com o bump marcado, o botão mostra o TOTAL, não o preço base", () => {
    const html = render("C", { quadro: true, item: "video" });
    const total = reais(valorComItem(3800, "video"));
    expect(total).not.toBe("R$ 38");
    expect(html).toContain(`Gerar PIX de ${total}`);
  });

  it("o e-mail com erro de digitação ainda ganha a sugestão de correção", () => {
    expect(render("C", { email: "teste@gmail.co" })).toContain("Você quis dizer");
  });

  it("nenhum texto novo com travessão", () => {
    for (const b of ["B", "C"] as const) {
      const html = render(b).replace(/<!--[\s\S]*?-->/g, "");
      expect(html).not.toContain("—");
    }
  });
});
