import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { audioDoExemploEsUs } from "@/lib/exemplos-es-us";
import { AUDIO_EXEMPLOS } from "@/lib/exemplos-pt";
import { exemploDoBlog } from "./exemplos-do-blog";
import { BLOG_BALLAD_ES, BLOG_SERENATA } from "./site";

describe("exemploDoBlog", () => {
  it("Ballad toca o catálogo e o bucket DELA; slug da Serenata não existe lá", () => {
    expect(exemploDoBlog(BLOG_BALLAD_ES, "es-us-abuela")?.audio).toBe(audioDoExemploEsUs("es-us-abuela"));
    expect(exemploDoBlog(BLOG_BALLAD_ES, "eva")).toBeUndefined();
  });

  it("Serenata toca o catálogo pt; slug da Ballad não existe lá", () => {
    expect(exemploDoBlog(BLOG_SERENATA, "eva")?.audio).toBe(`${AUDIO_EXEMPLOS}/eva.mp3`);
    expect(exemploDoBlog(BLOG_SERENATA, "es-us-abuela")).toBeUndefined();
  });

  // O `head` das rotas importa o site.ts, e o head fica no chunk de ENTRADA do
  // router: os catálogos de exemplos (capas, letras, áudios) não podem vir junto.
  it("site.ts não importa catálogo de exemplos", () => {
    expect(readFileSync("src/lib/blog/site.ts", "utf8")).not.toMatch(/from\s+["']@\/lib\/exemplos/);
  });
});
