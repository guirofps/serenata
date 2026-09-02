import { describe, expect, it } from "vitest";
import { emailPresentePronto } from "../../emails/presente-pronto";

// O E-MAIL DE ENTREGA, na parte que já foi consertada duas vezes.
//
// Os dois defeitos que estes testes seguram são o MESMO defeito: mandar quem
// já pagou pra uma tela que exige login. 84% dos compradores nunca entram na
// conta, e foi assim que R$ 473 em quadros pagos ficaram parados e o pacote de
// R$ 28 vendeu 18 PIX no mês inteiro.
//
// A regra: toda ação deste e-mail sai pelo `token_edicao`.

const base = {
  nome: "Camila",
  titulo: "Do jeito que ela é",
  linkEditor: "https://www.serenatagift.com/editar/tok-edicao-123",
  linkPresente: "https://www.serenatagift.com/p/tok-publico-abc",
};

describe("e-mail de entrega", () => {
  it("oferece a segunda música pelo editor, e não pelo painel", () => {
    const html = emailPresentePronto(base);
    expect(html).toContain("R$ 28");
    // A âncora leva ao bloco que abre o PIX sem login. Trocar isto por
    // `/dashboard` é o erro que enterrou o pacote.
    expect(html).toContain("/editar/tok-edicao-123#outra-musica");
  });

  it("cobre os dois idiomas: nada de bloco vazio em espanhol", () => {
    for (const locale of ["pt", "es"] as const) {
      const html = emailPresentePronto({ ...base, locale });
      expect(html).toContain("#outra-musica");
      // A linha tem texto de verdade, não só o link solto.
      expect(html).toMatch(/28[^<]*<a href|R\$ 28/);
    }
  });

  it("quem já pagou o quadro recebe entrega, não oferta", () => {
    const html = emailPresentePronto({ ...base, temQuadroPraMontar: true });
    expect(html).toContain("/editar/tok-edicao-123?de=quadro");
    // A oferta some: cobrar de novo por algo que ela já comprou é o pior
    // defeito possível deste e-mail.
    expect(html).not.toContain("/dashboard?aba=quadro");
  });

  it("sem o direito ao quadro, é oferta e não entrega", () => {
    const html = emailPresentePronto(base);
    expect(html).toContain("/dashboard?aba=quadro");
    expect(html).not.toContain("?de=quadro");
  });
});
