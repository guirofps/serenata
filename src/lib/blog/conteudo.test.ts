import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARTIGOS, artigoPorSlug } from "@/conteudo/blog";
import { PAUTA } from "@/conteudo/blog/pauta";
import { EXEMPLOS_PT } from "@/lib/exemplos-pt";
import { problemasDoArtigo } from "./validar";

const ctx = {
  slugsPauta: new Set<string>(PAUTA),
  slugsExemplos: new Set(EXEMPLOS_PT.map((e) => e.slug)),
};

describe.each(ARTIGOS.map((a) => [a.slug, a] as const))("artigo %s", (_slug, a) => {
  it("passa em todas as regras de SEO e de copy", () => {
    expect(problemasDoArtigo(a, ctx)).toEqual([]);
  });

  it("tem a imagem de topo (até 200 KB) e a de compartilhar", () => {
    const topo = `public/img/blog/${a.slug}.webp`;
    expect(existsSync(topo)).toBe(true);
    expect(statSync(topo).size).toBeLessThanOrEqual(200 * 1024);
    expect(existsSync(`public/img/blog/${a.slug}-og.jpg`)).toBe(true);
  });

  it("está na pauta", () => {
    expect(PAUTA).toContain(a.slug);
  });
});

describe("registro", () => {
  it("slugs únicos e na ordem da pauta", () => {
    const slugs = ARTIGOS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(PAUTA.filter((s) => slugs.includes(s)));
  });

  it("a pauta inteira está publicada", () => {
    expect(ARTIGOS.map((a) => a.slug)).toEqual([...PAUTA]);
  });

  it("só o louvor tem tema gospel", () => {
    for (const a of ARTIGOS) expect(a.tema).toBe(a.slug === "louvor-personalizado" ? "gospel" : undefined);
  });

  it("slug desconhecido não acha nada", () => {
    expect(artigoPorSlug("nao-existe")).toBeUndefined();
  });
});
