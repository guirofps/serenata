import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AUTOMACOES, TEMPLATES_CONHECIDOS, renderizarPreview } from "./automacoes.server";
import { DEGRAUS } from "../../emails/escada";

// O CATÁLOGO DE AUTOMAÇÕES, testado onde ele mente sem avisar.
//
// O catálogo é escrito à mão, e o jeito de ele ficar errado é alguém criar
// uma régua nova (ou renomear uma etiqueta) e não voltar aqui. O painel não
// quebra: a linha nova cai em "o catálogo não conhece", e a antiga fica com
// zero pra sempre, parecendo régua morta. Estes testes pegam os dois casos
// na hora do `vitest`, não na hora de alguém estranhar o zero.

const raiz = join(__dirname, "..", "..");

/** Toda etiqueta que o código de verdade grava em `emails_enviados`. */
function etiquetasNoCodigo(): Set<string> {
  const pastas = ["inngest/functions", "api/lib", "api/webhook", "src/lib"];
  const fora = new Set<string>();
  for (const pasta of pastas) {
    for (const nome of readdirSync(join(raiz, pasta))) {
      if (!nome.endsWith(".ts") || nome.endsWith(".test.ts")) continue;
      const texto = readFileSync(join(raiz, pasta, nome), "utf8");
      // `template: "letra_pronta"` — a forma que `registrarEnvio` recebe.
      for (const m of texto.matchAll(/template:\s*"([a-z0-9_]+)"/g)) fora.add(m[1]);
      // A escada monta a etiqueta: `escada_${p.numero}` e "escada_2ouviu".
      if (/escada_\$\{/.test(texto)) {
        for (const n of DEGRAUS) fora.add(`escada_${n}`);
      }
      for (const m of texto.matchAll(/"(escada_\d+ouviu)"/g)) fora.add(m[1]);
    }
  }
  return fora;
}

describe("o catálogo de automações", () => {
  it("não repete etiqueta: cada template mora numa régua só", () => {
    const vistos = new Set<string>();
    for (const t of TEMPLATES_CONHECIDOS) {
      expect(vistos.has(t), `etiqueta repetida: ${t}`).toBe(false);
      vistos.add(t);
    }
  });

  it("conhece toda etiqueta que o código grava em emails_enviados", () => {
    const noCodigo = etiquetasNoCodigo();
    // Sanidade: se a varredura não achou nada, o teste passaria à toa.
    expect(noCodigo.size).toBeGreaterThan(5);
    const faltam = [...noCodigo].filter((t) => !TEMPLATES_CONHECIDOS.includes(t));
    expect(faltam, `réguas sem entrada no catálogo: ${faltam.join(", ")}`).toEqual([]);
  });

  it("não inventa etiqueta que o código não grava", () => {
    const noCodigo = etiquetasNoCodigo();
    const sobram = TEMPLATES_CONHECIDOS.filter((t) => !noCodigo.has(t));
    expect(sobram, `no catálogo mas em nenhum envio: ${sobram.join(", ")}`).toEqual([]);
  });

  it("toda régua tem gatilho, público e ao menos um e-mail", () => {
    for (const a of AUTOMACOES) {
      expect(a.gatilho.length, a.id).toBeGreaterThan(3);
      expect(a.quemRecebe.length, a.id).toBeGreaterThan(10);
      expect(a.emails.length, a.id).toBeGreaterThan(0);
    }
  });
});

describe("o preview", () => {
  it("renderiza todo template do catálogo em português, com assunto e HTML", () => {
    for (const t of TEMPLATES_CONHECIDOS) {
      const p = renderizarPreview(t, "pt");
      expect(p.aviso, t).toBeUndefined();
      expect(p.assunto.length, t).toBeGreaterThan(5);
      expect(p.html, t).toContain("<");
      // Os dados de exemplo têm que ter entrado: todo e-mail carrega ao menos
      // um link do site. (O nome NÃO é exigido no corpo de propósito: o degrau
      // 10 cita a pessoa só no assunto, e isso é escolha de copy, não defeito.)
      expect(p.html, t).toContain("serenatagift.com");
    }
  });

  it("em espanhol, o que não tem versão avisa em vez de fingir", () => {
    const p = renderizarPreview("escada_7", "es");
    expect(p.aviso).toMatch(/portugu/);
    expect(p.html).toContain("<");
    const q = renderizarPreview("letra_pronta", "es");
    expect(q.aviso).toBeUndefined();
    expect(q.html).toContain("Maria");
  });

  it("não vaza {nome} nem {preco} cru pro HTML", () => {
    for (const t of TEMPLATES_CONHECIDOS) {
      const p = renderizarPreview(t, "pt");
      expect(p.html, t).not.toMatch(/\{(nome|preco)\}/);
      expect(p.assunto, t).not.toMatch(/\{(nome|preco)\}/);
    }
  });

  it("template desconhecido devolve aviso, não erro", () => {
    const p = renderizarPreview("regua_que_nao_existe", "pt");
    expect(p.aviso).toMatch(/não sabe renderizar/);
    expect(p.html).toBe("");
  });
});
