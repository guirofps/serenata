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
const TELA = readFileSync("src/routes/admin.tsx", "utf8");

describe("tela do admin", () => {
  it("o comparativo só dispara com o núcleo pronto, e não com o dado antigo", () => {
    // Com keepPreviousData, o núcleo fica isSuccess enquanto busca o período
    // novo. Só `isSuccess` faria os dois voltarem a correr juntos.
    const bloco = TELA.slice(TELA.indexOf('["painel", "comparativo"'));
    const ate = bloco.slice(0, bloco.indexOf("});"));
    expect(ate).toMatch(/enabled:\s*nucleo\.isSuccess\s*&&\s*!nucleo\.isPlaceholderData/);
  });
});
describe("cron do resumo diário", () => {
  const VERCEL = JSON.parse(readFileSync("vercel.json", "utf8"));
  const CRON = readFileSync("api/painel-resumo.ts", "utf8");

  it("roda de hora em hora, com 300s de função", () => {
    expect(VERCEL.crons).toContainEqual({ path: "/api/painel-resumo", schedule: "7 * * * *" });
    expect(VERCEL.functions["api/painel-resumo.ts"]).toEqual({ maxDuration: 300 });
  });

  it("autentica pelo CRON_SECRET em tempo constante", () => {
    expect(CRON).toMatch(/process\.env\.CRON_SECRET/);
    expect(CRON).toMatch(/segredoConfere\(/);
  });

  it("não importa nada pelo alias @/ (api/ não resolve)", () => {
    expect(CRON).not.toMatch(/from "@\//);
    for (const f of [
      "src/lib/painel-resumo.ts",
      "src/lib/painel-fechar.ts",
      "src/lib/ler-janela.ts",
    ]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/from "@\//);
    }
  });
});
describe("painel lê o resumo diário", () => {
  it("admin-dados soma os dias da tabela e só chama o RPC nas faixas vivas", () => {
    expect(DADOS).toMatch(/from\("painel_eventos_dia"\)/);
    expect(DADOS).toMatch(/fatiarJanela\(/);
    expect(DADOS).toMatch(/faixasVivas\(/);
    expect(DADOS).toMatch(/somarResumos\(/);
  });

  it("a regra de venda vem de ehVenda/sessoesQueCompraram, não é reescrita", () => {
    expect(DADOS).toMatch(/sessoesQueCompraram\(/);
    expect(DADOS).toMatch(/filter\(ehVenda\)/);
    expect(DADOS).not.toMatch(/p\.status === "pago" && p\.dinheiro_entrou !== false/);
  });

  it("EventosResumo tem uma definição só", () => {
    expect(DADOS).not.toMatch(/^type EventosResumo = \{/m);
  });

  it("a tela aceita ?vivo=1 e manda pro servidor", () => {
    expect(TELA).toMatch(/vivo:\s*z\.coerce\.number\(\)\.optional\(\)/);
    expect(TELA).toMatch(/vivo === 1/);
  });

  it("o cartão de Visitantes avisa que é soma por dia", () => {
    expect(TELA).toMatch(/somados dia a dia/);
  });
});

// ── Achados da revisão final (02/10/2026) ──────────────────────────
describe("revisão final", () => {
  const bloco = TELA.slice(TELA.indexOf('["painel", "comparativo"'));
  const comparativoQuery = bloco.slice(0, bloco.indexOf("});"));

  it("o comparativo não refaz junto com o núcleo no foco nem no Atualizar", () => {
    // Foco da aba e invalidate refazem tudo que está habilitado ao mesmo tempo.
    expect(comparativoQuery).toMatch(/!nucleo\.isFetching/);
    expect(comparativoQuery).toMatch(/refetchOnWindowFocus:\s*false/);
    expect(TELA).toMatch(/queryKey:\s*\["painel",\s*"comparativo"\],\s*refetchType:\s*"none"/);
  });

  it("setinha do recorte anterior não aparece sobre o recorte novo", () => {
    expect(TELA).toMatch(
      /comparativo=\{comparativo\.isPlaceholderData \? null : \(comparativo\.data \?\? null\)\}/,
    );
  });

  it("a tabela de entradas não promete mais visitante único", () => {
    expect(TELA).not.toMatch(/Cada visitante conta uma vez só/);
    expect(TELA).toMatch(/somados dia a dia/);
  });
});
