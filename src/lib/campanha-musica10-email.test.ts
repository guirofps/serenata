import { describe, expect, it } from "vitest";
import { assuntoCampanhaMusica10, emailCampanhaMusica10 } from "../../emails/campanha-musica10";

const base = {
  linkCriar: "https://serenatagift.com/criar?cupom=MUSICA10&utm_content=comprador",
  linkExemplo: "https://serenatagift.com/p/533db522753f423e8b2227",
  linkDescadastro: "https://serenatagift.com/api/descadastro?e=a%40b.com&t=x",
  valeAte: "20/10",
};

describe("e-mail MUSICA10", () => {
  for (const versao of ["comprador", "lead"] as const) {
    it(`${versao}: tem botão, cupom, validade, exemplo, descadastro e CNPJ`, () => {
      const html = emailCampanhaMusica10({ ...base, versao, nome: "Maria" });
      expect(html).toContain(base.linkCriar.replace(/&/g, "&amp;"));
      expect(html).toContain(base.linkExemplo);
      expect(html).toContain(base.linkDescadastro.replace(/&/g, "&amp;"));
      expect(html).toContain("MUSICA10");
      expect(html).toContain("20/10");
      expect(html).toContain("45.835.258/0001-46");
      expect(html).toContain("Maria");
    });
    it(`${versao}: sem nome, não escreve null nem undefined`, () => {
      const html = emailCampanhaMusica10({ ...base, versao, nome: null });
      expect(html).not.toMatch(/null|undefined/);
    });
    it(`${versao}: o único preço citado é o desconto de R$ 10`, () => {
      const html = emailCampanhaMusica10({ ...base, versao, nome: null });
      const precos = html.match(/R\$\s?[\d.,]+/g) ?? [];
      expect(precos.length).toBeGreaterThan(0);
      expect(precos.every((p) => /R\$\s?10$/.test(p))).toBe(true);
      expect(html).not.toMatch(/60 segundos/i);
    });
  }
  it("escapa o nome (vem de campo livre)", () => {
    const html = emailCampanhaMusica10({ ...base, versao: "lead", nome: "<b>Ana</b>" });
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
  });
  it("assunto com e sem nome", () => {
    expect(assuntoCampanhaMusica10("comprador", "Maria")).toBe("Maria, quem merece a próxima música?");
    expect(assuntoCampanhaMusica10("comprador", null)).toBe("Quem merece a próxima música?");
    expect(assuntoCampanhaMusica10("lead", "Maria")).toBe("Maria, a sua história ainda pode virar música");
    expect(assuntoCampanhaMusica10("lead", null)).toBe("A sua história ainda pode virar música");
  });
});
