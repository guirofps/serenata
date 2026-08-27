import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// O ALIAS `@/` NÃO EXISTE NO RUNTIME DO NODE.
//
// Em 26/08 às 21:00 o `/api/inngest` saiu do ar por QUATRO HORAS e nada
// avisou. 65 músicas ficaram presas em `aguardando`: a pessoa lia a letra e
// não tinha o que ouvir. Zero compradores afetados, porque a regra de ouro
// (gerar antes de cobrar) bloqueia o checkout sem música — mas foram 65
// vendas que não aconteceram.
//
// A causa foi uma linha:
//
//   // em src/lib/generos.ts
//   import { ehEspanha } from "@/lib/mercado-es";
//
//   Cannot find package '@/lib' imported from /var/task/src/lib/generos.js
//
// `@/` é atalho do Vite. O `generos.ts` é importado pelo `gerarMusica`, que
// roda como ESM no Node da Vercel, onde esse atalho não é resolvido — e um
// import quebrado derruba o ENDPOINT INTEIRO, não só a função que o usa.
//
// O arquivo já tinha `import type { Locale } from "@/lib/i18n"` e nunca
// quebrou: import de TIPO some na compilação. Só o de VALOR chega no runtime.
//
// ── POR QUE UM TESTE E NÃO UM COMENTÁRIO ─────────────────────────
//
// O CLAUDE.md já documenta a irmã dessa armadilha (a extensão `.js`
// obrigatória), e ela derrubou o webhook por 5h29 em 18/08. O comentário não
// impediu a repetição em outra forma. Regra que só existe em prosa é regra
// que alguém quebra às três da manhã.
//
// Este teste anda pelo grafo REAL de imports a partir dos arquivos que a
// Vercel executa como Node, e falha se algum deles alcançar um `@/` de valor.

const RAIZ = resolve(__dirname, "..", "..");

/** Os pontos de entrada que a Vercel roda como função Node. */
function entradas(): string[] {
  const out: string[] = [];
  const anda = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) anda(p);
      else if (/\.(ts|mts)$/.test(nome)) out.push(p);
    }
  };
  anda(join(RAIZ, "api"));
  return out;
}

/**
 * Os imports de VALOR de um arquivo. Ignora `import type` e `import { type X }`
 * porque esses somem na compilação e nunca chegam no runtime — é justamente
 * por isso que o `@/lib/i18n` do `generos.ts` conviveu meses sem quebrar.
 */
function importsDeValor(codigo: string): string[] {
  const out: string[] = [];
  const re = /import\s+(?!type\s)([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  for (const m of codigo.matchAll(re)) {
    const clausula = m[1];
    // `import { type A, type B } from "..."`: tudo tipo, não chega no runtime.
    const nomes = clausula.replace(/^\{|\}$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    const soTipos = nomes.length > 0 && nomes.every((n) => n.startsWith("type "));
    if (soTipos) continue;
    out.push(m[2]);
  }
  return out;
}

function resolverRelativo(deArquivo: string, spec: string): string | null {
  const base = resolve(dirname(deArquivo), spec.replace(/\.js$/, ""));
  for (const cand of [base + ".ts", base + ".mts", join(base, "index.ts")]) {
    try {
      if (statSync(cand).isFile()) return cand;
    } catch {
      /* segue */
    }
  }
  return null;
}

describe("imports que rodam no Node da Vercel", () => {
  it("nenhum arquivo alcançável por api/ importa VALOR de um alias @/", () => {
    const vistos = new Set<string>();
    const culpados: string[] = [];
    const fila = entradas();

    while (fila.length) {
      const arq = fila.pop() as string;
      if (vistos.has(arq)) continue;
      vistos.add(arq);

      let codigo: string;
      try {
        codigo = readFileSync(arq, "utf8");
      } catch {
        continue;
      }

      for (const spec of importsDeValor(codigo)) {
        if (spec.startsWith("@/")) {
          culpados.push(`${arq.slice(RAIZ.length + 1)} → ${spec}`);
          continue;
        }
        if (!spec.startsWith(".")) continue; // pacote do node_modules, tudo bem
        const alvo = resolverRelativo(arq, spec);
        if (alvo) fila.push(alvo);
      }
    }

    // A mensagem carrega o conserto, pra quem quebrar não precisar caçar.
    expect(
      culpados,
      `Alias "@/" só é resolvido pelo Vite. Estes arquivos rodam como ESM no ` +
        `Node da Vercel e o import quebra o endpoint INTEIRO. Troque por ` +
        `caminho relativo com extensão .js:\n  ${culpados.join("\n  ")}`,
    ).toEqual([]);
  });

  it("nenhum import relativo alcançável por api/ esquece a extensão .js", () => {
    // A irmã da armadilha acima, e a que derrubou o webhook por 5h29 em 18/08.
    // O resolver ESM do Node não completa extensão: sem `.js` o módulo não
    // resolve e o handler morre antes de rodar uma linha.
    const vistos = new Set<string>();
    const culpados: string[] = [];
    const fila = entradas();

    while (fila.length) {
      const arq = fila.pop() as string;
      if (vistos.has(arq)) continue;
      vistos.add(arq);

      let codigo: string;
      try {
        codigo = readFileSync(arq, "utf8");
      } catch {
        continue;
      }

      for (const spec of importsDeValor(codigo)) {
        if (!spec.startsWith(".")) continue;
        if (!spec.endsWith(".js")) culpados.push(`${arq.slice(RAIZ.length + 1)} → ${spec}`);
        const alvo = resolverRelativo(arq, spec);
        if (alvo) fila.push(alvo);
      }
    }

    expect(
      culpados,
      `Import relativo sem ".js" não resolve no ESM do Node e derruba o ` +
        `handler antes da primeira linha (webhook fora do ar 5h29 em 18/08):\n  ` +
        culpados.join("\n  "),
    ).toEqual([]);
  });
});
