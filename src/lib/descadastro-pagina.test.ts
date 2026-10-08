import { describe, expect, it } from "vitest";
import { MARCAS } from "./marca-identidade";
import { idiomaDescadastro, paginaConfirmarDescadastro, paginaDescadastrado } from "./descadastro-pagina";

// A página do "Cancelar inscrição" veste a marca do deploy (08/10).

describe("descadastro na marca certa", () => {
  it("Ballad: inglês, BALLAD, nada de Serenata nem português", () => {
    const get = paginaConfirmarDescadastro(MARCAS.ballad, "a@b.com", "/api/descadastro?e=a%40b.com&t=x");
    const post = paginaDescadastrado(MARCAS.ballad);
    expect(idiomaDescadastro(MARCAS.ballad)).toBe("en");
    for (const html of [get, post]) {
      expect(html).toContain('lang="en"');
      expect(html).toContain("BALLAD");
      expect(html).not.toMatch(/SERENATA|Serenata|você|e-mails/);
    }
    expect(get).toContain("unsubscribe");
  });

  it("Serenata: português, como era", () => {
    const get = paginaConfirmarDescadastro(MARCAS.serenata, "a@b.com", "/api/descadastro?e=a&t=x");
    expect(get).toContain('lang="pt-BR"');
    expect(get).toContain("SERENATA");
    expect(get).toContain("Sim, não quero mais receber");
    expect(paginaDescadastrado(MARCAS.serenata)).toContain("Pronto, você não recebe mais estes e-mails.");
  });

  it("o e-mail e a ação saem escapados", () => {
    const html = paginaConfirmarDescadastro(MARCAS.serenata, '"><script>x</script>', '/api/descadastro?e="x"');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('action="/api/descadastro?e="x""');
  });

  it("sem travessão", () => {
    for (const m of [MARCAS.serenata, MARCAS.ballad]) {
      expect(paginaConfirmarDescadastro(m, "a@b.com", "/x")).not.toContain("—");
      expect(paginaDescadastrado(m)).not.toContain("—");
    }
  });
});
