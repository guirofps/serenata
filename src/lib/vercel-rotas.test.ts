import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// O ROTEAMENTO DA VERCEL, TESTADO COMO REGEX.
//
// Existe por causa de uma falha que nenhum teste de código pegaria: quando a
// home saiu do pré-render (Task 4, ver `vite.config.ts`), `dist/client/index.html`
// deixou de existir — e o catch-all era `/(.+)`, que exige ao menos UM
// caractere depois da barra. O path `/` não casava com regra nenhuma, e como
// não havia mais arquivo estático pra o filesystem servir, a home ia dar 404
// em produção. O site inteiro dependia de um `+` num arquivo de configuração.
//
// Mora em `src/lib/` porque é só onde o vitest varre (`vitest.config.ts`:
// `src/**/*.test.ts`), não porque tenha a ver com `lib`.
//
// A ORDEM IMPORTA: a Vercel usa a PRIMEIRA regra que casa. E rewrite roda
// DEPOIS da checagem de filesystem, então `/assets/*` e `/img/*` continuam
// saindo estáticos mesmo casando com o catch-all — por isso não há teste
// afirmando o contrário aqui.

type Rewrite = { source: string; destination: string };

const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
  rewrites: Rewrite[];
};

/**
 * O subconjunto de path-to-regexp que este `vercel.json` usa: `:param` casa um
 * segmento, e o que está entre parênteses já É regex e passa cru.
 */
function paraRegex(source: string): RegExp {
  const corpo = source
    .split(/(\(.*?\))/)
    .map((p) =>
      p.startsWith("(")
        ? p
        : p.replace(/[.+?^${}|[\]\\]/g, "\\$&").replace(/:[A-Za-z0-9_]+/g, "[^/]+"),
    )
    .join("");
  return new RegExp(`^${corpo}$`);
}

/**
 * Quem atende este path, pela mesma regra da Vercel: a primeira que casar,
 * com `$1` trocado pelo que o grupo capturou (é assim que `/api/(.*)` →
 * `/api/$1` continua apontando pro arquivo certo).
 */
function destinoDe(path: string): string | null {
  for (const r of vercel.rewrites) {
    const m = paraRegex(r.source).exec(path);
    if (m) return r.destination.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
  }
  return null;
}

describe("rewrites do vercel.json", () => {
  it("a raiz `/` é atendida pelo SSR — sem isto a home dá 404", () => {
    // O caso que quebrou: `/(.+)` não casa `/`, e desde que a home saiu do
    // pré-render não existe mais `dist/client/index.html` pro filesystem
    // atender antes dos rewrites.
    expect(destinoDe("/")).toBe("/api/ssr");
  });

  it.each(["/es", "/criar", "/es/criar", "/p/tok", "/obrigado"])(
    "%s continua caindo no SSR",
    (path) => {
      expect(destinoDe(path)).toBe("/api/ssr");
    },
  );

  it("as rotas de API continuam ganhando do catch-all", () => {
    expect(destinoDe("/api/inngest")).toBe("/api/inngest");
    expect(destinoDe("/api/og/tok123")).toBe("/api/og/[token]");
    expect(destinoDe("/api/x")).toBe("/api/x");
    expect(destinoDe("/api/webhook/cakto")).toBe("/api/webhook/cakto");
  });

  it("o catch-all é o ÚLTIMO da lista", () => {
    // Se ele subisse de posição engoliria `/api/*`, e nenhum outro teste
    // aqui perceberia — os dois casam o mesmo path.
    expect(vercel.rewrites[vercel.rewrites.length - 1].source).toBe("/(.*)");
  });
});
