import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BRACOS_LP, HEADLINES_LP, SLUGS_EXEMPLO_LP, cssLpHeadline, headlineCompleta, EXP_LP_HEADLINE } from "./lp-presente";
import { EXPERIMENTOS } from "./experimentos";
import { exemploPorSlug } from "./exemplos-pt";

describe("lp_headline", () => {
  it("tem uma frase por braço, sem travessão nem preço", () => {
    for (const b of BRACOS_LP) {
      const f = headlineCompleta(b);
      expect(f.length).toBeGreaterThan(20);
      expect(f).not.toMatch(/[—–]|R\$/);
      expect(HEADLINES_LP[b].ouro.trim()).not.toBe("");
    }
  });

  it("o CSS esconde as variantes e só troca A pelo braço sorteado", () => {
    const css = cssLpHeadline();
    expect(css.startsWith(".lph-v{display:none}")).toBe(true);
    expect(css).toContain("html[data-exp-lp_headline=B] .lph-A{display:none}");
    expect(css).toContain("html[data-exp-lp_headline=C] .lph-C{display:inline}");
    expect(css).not.toMatch(/["'<&]/);
  });

  it("o experimento existe no código, desligado, com os mesmos braços", () => {
    const e = EXPERIMENTOS.find((x) => x.id === EXP_LP_HEADLINE);
    expect(e).toBeDefined();
    expect(e!.ativo).toBe(false);
    expect(e!.variantes).toEqual([...BRACOS_LP]);
  });

  it("a migration cria a linha com os mesmos braços, nascendo desligada", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/20261111000000_experimento_lp_headline.sql", import.meta.url), "utf8");
    expect(sql).toContain(`'${EXP_LP_HEADLINE}'`);
    expect(sql).toMatch(/false,\s*100/);
    for (const b of BRACOS_LP) expect(sql).toContain(`"nome":"${b}"`);
  });

  it("as três músicas de exemplo existem na lista da home", () => {
    for (const s of SLUGS_EXEMPLO_LP) expect(exemploPorSlug(s)).toBeDefined();
  });
});
