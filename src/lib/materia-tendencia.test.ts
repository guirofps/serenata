import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BRACOS_MATERIA,
  EXP_MATERIA_TITULO,
  MANCHETES,
  PARA_QUEM,
  cssMateriaTitulo,
  mostraNatal,
} from "./materia-tendencia";
import { EXPERIMENTOS } from "./experimentos";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("matéria /tendencia", () => {
  it("tem as três manchetes aprovadas, sem travessão nem preço", () => {
    expect(MANCHETES.A).toBe("Brasileiros estão trocando flores e perfume por músicas feitas com a história do casal");
    expect(MANCHETES.B).toBe("O presente que já fez mais de 6.600 famílias chorarem não se compra em loja");
    expect(MANCHETES.C).toBe("Quase metade é para a esposa: o presente que virou febre entre maridos brasileiros");
    for (const b of BRACOS_MATERIA) expect(MANCHETES[b]).not.toMatch(/[—–]|R\$/);
  });

  it("o CSS esconde as variantes e só troca A pelo braço sorteado", () => {
    const css = cssMateriaTitulo();
    expect(css.startsWith(".mtt-v{display:none}")).toBe(true);
    expect(css).toContain("html[data-exp-materia_titulo=B] .mtt-A{display:none}");
    expect(css).toContain("html[data-exp-materia_titulo=C] .mtt-C{display:inline}");
    expect(css).not.toMatch(/["'<&]/);
  });

  it("o experimento existe no código, desligado, com os mesmos braços", () => {
    const e = EXPERIMENTOS.find((x) => x.id === EXP_MATERIA_TITULO);
    expect(e).toBeDefined();
    expect(e!.ativo).toBe(false);
    expect(e!.variantes).toEqual([...BRACOS_MATERIA]);
  });

  it("a migration cria a linha com os mesmos braços, nascendo desligada", () => {
    const sql = ler("../../supabase/migrations/20261111010000_experimento_materia_titulo.sql");
    expect(sql).toContain(`'${EXP_MATERIA_TITULO}'`);
    expect(sql).toMatch(/false,\s*100/);
    for (const b of BRACOS_MATERIA) expect(sql).toContain(`"nome":"${b}"`);
  });

  it("o quadro 'para quem' fecha em 100% com os números de outubro", () => {
    expect(PARA_QUEM.find((p) => p.rotulo === "Esposa")?.pct).toBe(47);
    expect(PARA_QUEM.find((p) => p.rotulo === "Namorada")?.pct).toBe(12);
    expect(PARA_QUEM.reduce((s, p) => s + p.pct, 0)).toBe(100);
  });

  it("o parágrafo de Natal some depois do Natal", () => {
    expect(mostraNatal(new Date("2026-11-11T15:00:00Z"))).toBe(true);
    expect(mostraNatal(new Date("2026-12-25T15:00:00Z"))).toBe(true);
    expect(mostraNatal(new Date("2026-12-26T12:00:00Z"))).toBe(false);
    expect(mostraNatal(new Date("2027-11-20T12:00:00Z"))).toBe(false);
  });

  // O que deixa a página dentro das regras do Google: é publicidade assumida,
  // da nossa marca, sem imitar portal, sem preço e sem prova inventada.
  it("a página se declara publicidade, não imita portal e não fala em pagar", () => {
    const tsx = ler("../routes/tendencia.tsx");
    expect(tsx).toContain("Publicidade");
    expect(tsx).toContain("RESPONSAVEL");
    expect(tsx).toMatch(/prévia/);
    expect(tsx).not.toMatch(/\bpag(ar|a|ue)\b|R\$|60 segundos/i);
    expect(tsx).not.toMatch(/\bG1\b|Globo|UOL|Folha|Estad[ãa]o/i);
    expect(tsx).not.toMatch(/coment[áa]rio/i);
  });

  it("a rota só responde na Serenata", () => {
    expect(ler("../routes/__root.tsx")).toContain("tendencia$");
  });
});
