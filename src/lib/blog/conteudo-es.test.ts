import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARTIGOS_ES, artigoEsPorSlug } from "@/conteudo/blog-es";
import { PAUTA_ES } from "@/conteudo/blog-es/pauta";
import { exemplosEsUsProntos } from "@/lib/exemplos-es-us";
import { BLOG_BALLAD_ES } from "./site";
import { problemasDoArtigo } from "./validar";

// O conteúdo do blog da Ballad em espanhol (spec 2026-10-20-blog-ballad-es-design.md §3 e §5).
const ctx = {
  site: BLOG_BALLAD_ES,
  slugsPauta: new Set<string>(PAUTA_ES),
  slugsExemplos: new Set(exemplosEsUsProntos().map((e) => e.slug)),
};
const SITEMAP = readFileSync("public/ballad/sitemap.xml", "utf8");
// A música da abuela é a única de fé e soa católica: só onde o tema cabe (spec §2).
const COM_ABUELA = new Set([
  "homenaje-a-la-abuela",
  "cancion-cristiana-personalizada",
  "alabanza-personalizada",
  "cancion-de-testimonio",
  "regalo-para-mama-cristiana",
  "cancion-de-consuelo",
]);
const PROIBIDAS_NA_CITACAO = /\b(rezar|reza|cruz|cruces|estampitas?|persign\w*)\b/i; // palavra inteira: "cruzaste" pode
const FOTOS_DO_RIO = new Set(["louvor-de-gratidao", "louvor-para-momento-dificil"]);

describe.each(ARTIGOS_ES.map((a) => [a.slug, a] as const))("artigo %s", (_slug, a) => {
  it("passa em todas as regras de SEO e de copy da Ballad", () => {
    expect(problemasDoArtigo(a, ctx)).toEqual([]);
  });

  it("usa uma foto do blog da Serenata (até 200 KB), com a de compartilhar, fora as do Rio", () => {
    expect(a.imagem.arquivo, "imagem.arquivo").toBeTruthy();
    const topo = `public/img/blog/${a.imagem.arquivo}.webp`;
    expect(existsSync(topo), topo).toBe(true);
    expect(statSync(topo).size).toBeLessThanOrEqual(200 * 1024);
    expect(existsSync(`public/img/blog/${a.imagem.arquivo}-og.jpg`)).toBe(true);
    expect(FOTOS_DO_RIO.has(a.imagem.arquivo!)).toBe(false);
  });

  it("o botão vai sempre pro /es/criar (sem tema)", () => {
    expect(a.tema).toBeUndefined();
  });

  it("a música da abuela só onde o tema cabe", () => {
    if (!COM_ABUELA.has(a.slug)) expect(a.musicas).not.toContain("es-us-abuela");
  });

  it("nenhum trecho citado com rezar, cruz, estampitas ou persignar", () => {
    for (const l of a.corpo.split("\n").filter((l) => l.startsWith(">"))) expect(l).not.toMatch(PROIBIDAS_NA_CITACAO);
  });

  it("nenhuma canção prometida PARA Deus (o quiz em espanhol não tem esse destinatário)", () => {
    expect(a.corpo).not.toMatch(/(canci[oó]n|alabanza|letra)\s+(para|a)\s+Dios/i);
  });

  it("tem <url> com lastmod no sitemap da Ballad", () => {
    const loc = `<loc>https://www.balladgift.com/es/blog/${a.slug}</loc>`;
    const i = SITEMAP.indexOf(loc);
    expect(i, loc).toBeGreaterThan(-1);
    expect(SITEMAP.slice(i, SITEMAP.indexOf("</url>", i))).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });
});

describe("registro em espanhol", () => {
  it("tem artigos, slugs únicos e na ordem da pauta", () => {
    const slugs = ARTIGOS_ES.map((a) => a.slug);
    expect(slugs.length).toBeGreaterThan(0);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(PAUTA_ES.filter((s) => slugs.includes(s)));
  });

  it("cada verso citado aparece em um artigo só (um trecho diferente por artigo, spec §5)", () => {
    const dono = new Map<string, string>();
    for (const a of ARTIGOS_ES) {
      for (const l of new Set(a.corpo.split("\n").filter((l) => l.startsWith(">")))) {
        expect(dono.get(l), `"${l}" em ${dono.get(l)} e ${a.slug}`).toBeUndefined();
        dono.set(l, a.slug);
      }
    }
  });

  it("a pauta inteira está publicada", () => {
    expect(ARTIGOS_ES.map((a) => a.slug)).toEqual([...PAUTA_ES]);
  });

  it("slug desconhecido não acha nada", () => {
    expect(artigoEsPorSlug("nao-existe")).toBeUndefined();
  });
});
