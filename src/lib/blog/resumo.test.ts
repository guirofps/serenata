import { describe, expect, it } from "vitest";
import { ARTIGOS } from "@/conteudo/blog";
import { ARTIGOS_ES } from "@/conteudo/blog-es";
import { resumoDoArtigo } from "./tipos";

// O resumo vai inteiro pro HTML do SSR (índice e "leia também"): nada de prompt
// de imagem, e o da Serenata com o mesmo formato de antes do motor.
describe("resumoDoArtigo", () => {
  it("Serenata: só slug, título, descrição e alt", () => {
    for (const a of ARTIGOS) expect(Object.keys(resumoDoArtigo(a))).toEqual(["slug", "titulo", "descricao", "alt"]);
  });

  it("Ballad: leva o arquivo da foto reaproveitada, nunca o prompt", () => {
    for (const a of ARTIGOS_ES) {
      const r = resumoDoArtigo(a);
      expect(r).toEqual({ slug: a.slug, titulo: a.titulo, descricao: a.descricao, alt: a.imagem.alt, arquivo: a.imagem.arquivo });
      expect(JSON.stringify(r)).not.toContain(a.imagem.prompt);
    }
  });
});
