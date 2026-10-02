import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CONTRATO DE FONTE DO PAINEL.
//
// O projeto não renderiza componente nem fala com banco em teste
// (`vitest.config.ts`). O que dá pra garantir sobre o caminho do painel é lido
// do próprio fonte — o mesmo recurso de `ga4-contrato.test.ts`.

const DADOS = readFileSync("src/lib/admin-dados.ts", "utf8");

describe("admin-dados", () => {
  it("não pagina mais por OFFSET", () => {
    // `.range(` era a paginação que reordenava a janela inteira a cada página.
    expect(DADOS).not.toMatch(/\.range\(/);
    expect(DADOS).not.toMatch(/function paginado/);
  });

  it("lê as janelas por lerJanela, com cursor", () => {
    expect(DADOS).toMatch(/lerJanela</);
    expect(DADOS).toMatch(/filtroCursor\(/);
    expect(DADOS).toMatch(/\.order\("created_at"\)\s*\.order\("id"\)/);
  });

  it("registra uma linha de tempos por painel", () => {
    expect(DADOS).toMatch(/console\.log\(\s*`\[admin\] painel /);
  });
});
