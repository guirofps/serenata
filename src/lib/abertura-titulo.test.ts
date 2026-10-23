import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aberturaTituloVale,
  BRACOS_TITULO,
  cssAberturaTitulo,
  EXP_ABERTURA_TITULO,
  TITULOS,
} from "@/lib/abertura-titulo";
import { EXPERIMENTOS } from "@/lib/experimentos";
import { FAMILIAS } from "@/lib/prova-numeros";

const texto = (b: (typeof BRACOS_TITULO)[number]) => TITULOS[b].antes + TITULOS[b].ouro + TITULOS[b].depois;

describe("quem recebe o teste do título", () => {
  it("só o funil pt sem tema", () => {
    expect(aberturaTituloVale("pt", null)).toBe(true);
    expect(aberturaTituloVale("pt", undefined)).toBe(true);
    expect(aberturaTituloVale("pt", "gospel")).toBe(false);
    expect(aberturaTituloVale("es", null)).toBe(false);
    expect(aberturaTituloVale("en", null)).toBe(false);
  });
});

describe("as frases", () => {
  it("A é exatamente o título de hoje", () => {
    expect(texto("A")).toBe("Uma música feita da história de quem você ama");
  });

  it("seis braços, cada um com a palavra dourada e frase diferente", () => {
    expect(BRACOS_TITULO).toEqual(["A", "B", "C", "D", "E", "F"]);
    for (const b of BRACOS_TITULO) expect(TITULOS[b].ouro.trim().length).toBeGreaterThan(0);
    expect(new Set(BRACOS_TITULO.map(texto)).size).toBe(6);
  });

  // 28px fecha em duas linhas a 375px com o título de hoje (46 caracteres),
  // medido em `AberturaPresente`. Frase mais longa que isso pode ir pra três.
  it("nenhuma passa do tamanho que fecha em duas linhas", () => {
    for (const b of BRACOS_TITULO) expect(texto(b).length, b).toBeLessThanOrEqual(47);
  });

  it("o número do F é o mesmo do bloco de prova social, sem o +", () => {
    expect(TITULOS.F.ouro).toContain(FAMILIAS.replace("+", ""));
    expect(texto("F")).toBe(`Mais de ${FAMILIAS.replace("+", "")} famílias já deram esse presente`);
  });

  it("sem travessão nem promessa de prazo", () => {
    for (const b of BRACOS_TITULO) {
      expect(texto(b)).not.toContain("—");
      expect(texto(b)).not.toMatch(/minuto|segundo/i);
    }
  });
});

describe("o CSS do braço", () => {
  const css = cssAberturaTitulo();

  it("os braços B a F nascem escondidos: sem carimbo, aparece o A", () => {
    expect(css.startsWith(".abt-v{display:none}")).toBe(true);
  });

  it("cada carimbo esconde o A e mostra o seu braço", () => {
    for (const b of BRACOS_TITULO.slice(1)) {
      const sel = `html[data-exp-${EXP_ABERTURA_TITULO}=${b}]`;
      expect(css).toContain(`${sel} .abt-A{display:none}`);
      expect(css).toContain(`${sel} .abt-${b}{display:inline}`);
    }
  });

  it("cabe num <style> inline sem escapar nada", () => {
    expect(css).not.toMatch(/["'<>&]/);
  });
});

describe("registro", () => {
  it("o experimento existe no código, desligado, A controle, pesos iguais", () => {
    const e = EXPERIMENTOS.find((x) => x.id === EXP_ABERTURA_TITULO);
    expect(e?.variantes).toEqual([...BRACOS_TITULO]);
    expect(e?.peso).toEqual([1, 1, 1, 1, 1, 1]);
    expect(e?.ativo).toBe(false);
  });

  it("a migration cria a linha desligada, com os seis braços", () => {
    const sql = readFileSync("supabase/migrations/20261023000000_experimento_abertura_titulo.sql", "utf8");
    expect(sql).toMatch(/'abertura_titulo',\s*false/);
    for (const b of BRACOS_TITULO) expect(sql).toContain(`{"nome":"${b}","peso":1}`);
    expect(sql).toMatch(/on conflict \(id\) do nothing/);
  });
});

// O projeto não renderiza componente em teste: o caminho da tela é garantido
// lendo o fonte, como em `abertura-pergunta.test.ts`.
describe("contrato da tela", () => {
  const ABERTURA = readFileSync("src/components/quiz/AberturaPresente.tsx", "utf8");

  it("o <style> do braço vem antes do título, e só no pt sem tema", () => {
    expect(ABERTURA).toMatch(/comTitulo && <style dangerouslySetInnerHTML=\{\{ __html: cssAberturaTitulo\(\) \}\} \/>/);
    expect(ABERTURA).toMatch(/const comTitulo = aberturaTituloVale\(locale, tema\)/);
    expect(ABERTURA.indexOf("cssAberturaTitulo()")).toBeLessThan(ABERTURA.indexOf("<h1 className"));
  });

  it("o A nasce visível e os outros com a classe que os esconde", () => {
    expect(ABERTURA).toMatch(/className=\{b === "A" \? "abt-A" : `abt-v abt-\$\{b\}`\}/);
  });

  it("o bloco de prova social lê o mesmo número", () => {
    const prova = readFileSync("src/components/landing/ProvaSocial.tsx", "utf8");
    expect(prova).toMatch(/import \{ FAMILIAS \} from "@\/lib\/prova-numeros"/);
    expect(prova).not.toMatch(/const FAMILIAS =/);
  });
});
