import { describe, expect, it } from "vitest";
import { assuntoIndicacao, emailIndicacao, mensagemPronta, textoIndicacao } from "../../emails/indicacao";
import { assuntoEmProducao, emailEmProducao } from "../../emails/entrega-em-producao";
import { assuntoDesculpa, emailDesculpaAtraso } from "../../emails/desculpa-atraso";

// Regra do funil: nada de "—" no texto que o cliente lê (auditoria de 08/10
// achou nos assuntos e corpos destes três). Comentário de HTML não conta: a
// pessoa não vê.

const visivel = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "");

describe("sem travessão no texto do cliente", () => {
  it("convite de indicação", () => {
    const link = "https://www.serenatagift.com/criar?ref=abc";
    expect(assuntoIndicacao()).not.toContain("—");
    expect(mensagemPronta(link)).not.toContain("—");
    expect(textoIndicacao({ nome: "Ana", link })).not.toContain("—");
    expect(
      visivel(emailIndicacao({ nome: "Ana", link, linkPainel: "https://x/indique", linkDescadastro: "https://x/api/descadastro" })),
    ).not.toContain("—");
  });

  it("entrega em produção e desculpa pelo atraso, nos três idiomas", () => {
    for (const l of ["pt", "es"] as const) {
      expect(assuntoEmProducao("Ana", l)).not.toContain("—");
      expect(visivel(emailEmProducao({ nome: "Ana", linkEditor: "https://x/editar/t", locale: l }))).not.toContain("—");
      expect(assuntoDesculpa("Ana", l)).not.toContain("—");
      expect(visivel(emailDesculpaAtraso({ nome: "Ana", linkEditor: "https://x/editar/t", locale: l }))).not.toContain("—");
    }
    expect(assuntoEmProducao("Ana", "en")).not.toContain("—");
    expect(visivel(emailEmProducao({ nome: "Ana", linkEditor: "https://x/editar/t", locale: "en" }))).not.toContain("—");
  });
});
