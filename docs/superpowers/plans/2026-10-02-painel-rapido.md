# Painel rápido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o `/admin` abrir com 7, 30 e 90 dias, com o funil, sem estourar o
tempo do banco, e com tempo que não cresce com o tráfego.

**Architecture:** Parte A troca a paginação por OFFSET de `montarPainel` por
leitura em fatias de 1 dia paginadas por cursor `(created_at, id)`, cria os
índices que faltam e faz o comparativo esperar o núcleo. Parte B cria
`painel_eventos_dia` (saída de `admin_eventos_resumo` por dia BRT e filtro),
alimentada por um Vercel Cron de hora em hora, e o painel soma os dias
fechados e calcula ao vivo só as pontas.

**Tech Stack:** TanStack Start (server functions), Supabase (PostgREST +
supabase-js), Vercel Functions + Cron, Vitest 3 (ambiente node), TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-02-painel-rapido-design.md`

## Global Constraints

- Faturamento, vendas, receita, custo, CPA, ROAS e lucro **não mudam**; só o
  funil (de `funnel_events`) passa a vir do resumo.
- O resumo diário tem **exatamente** o formato de `admin_eventos_resumo`. A
  mesma função alimenta o vivo e o resumo: nenhuma regra de funil é reescrita
  em SQL novo.
- A regra de venda (`status === "pago" && dinheiro_entrou !== false`) mora em
  UM lugar, em JS (`ehVenda`), usada pelo painel e pelo cron.
- Dia = fuso de Brasília, offset fixo de 3h (o mesmo `OFFSET_BR` de
  `admin-dados.ts`; o Brasil não tem horário de verão).
- O cron autentica por `Authorization: Bearer $CRON_SECRET` com
  `segredoConfere` (tempo constante), como `api/vigia-externo.ts`.
- Código importado por `api/` não usa o alias `@/`: imports relativos com
  `.js` (padrão de `src/lib/avisar-donos.ts`).
- Teste só de lógica pura, Vitest em ambiente node, arquivos
  `src/**/*.test.ts`. Componente não se renderiza: o que a tela garante é
  checado por contrato lendo o código-fonte (padrão de `ga4-contrato.test.ts`).
- Comentários em português, no tom do arquivo vizinho (o porquê, não o quê).
- Migrations: o dono cola o SQL no SQL Editor da Serenata **e** no da Ballad.
  `scratch/ballad-migrar.mjs` não existe nesta máquina. Esta sessão não tem
  chave do banco e não pede.
- Nunca `git push --force`. Push só com o OK do dono, e com
  `git pull --rebase` antes.
- `npm install` local apaga `libc` do `package-lock.json`. Se aparecer no
  diff, `git checkout -- package-lock.json`.
- `npm run format` (prettier) antes de cada commit nos arquivos tocados.
  Conferir o código de saída **sem** `| tail`, que o esconde.

## Review Focus

1. **Troca de período com dado antigo na tela:** com `keepPreviousData`, o
   núcleo fica `isSuccess` enquanto busca o período novo. Se o comparativo
   usar só `isSuccess`, os dois voltam a disparar juntos. Esperado: o
   comparativo espera `isSuccess && !isPlaceholderData`. Fixado por teste de
   contrato na Task 3.
2. **Timestamp com microssegundos e fuso no cursor:** o PostgREST devolve
   `2026-10-01T12:34:56.123456+00:00`. Sem aspas, o `+` e os `:` quebram o
   filtro `or=(...)`. Esperado: o valor vai entre aspas duplas, e o empate de
   `created_at` desempata por `id`. Fixado pelo teste de `filtroCursor` na
   Task 1.
3. **Cursor que não anda:** uma página cheia cuja última linha é igual ao
   cursor anterior (dado estranho, coluna sem `created_at` no select) faria
   laço infinito. Esperado: erro explícito. Teste "cursor parado" na Task 1.
4. **Dia parcialmente gravado:** o cron grava `todos` e `pt` e falha no `es`.
   Esperado: o dia conta como faltando e é refeito; o painel trata o dia como
   ausente para o filtro que falta. Testes em `diasAFazer` (Task 5) e
   `fecharDias` (Task 6).
5. **Janela anterior do comparativo terminando no meio de ontem:** o último
   pedaço é um dia passado incompleto, não o "hoje". Esperado: vira fatia
   viva, não linha da tabela. Teste em `fatiarJanela` (Task 4).

---

## File Structure

| Arquivo                                                            | Responsabilidade                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `supabase/migrations/20261002000000_painel_indices.sql` (novo)     | índices `(created_at, id)`                                        |
| `src/lib/ler-janela.ts` (novo)                                     | leitura em fatias de 1 dia + cursor. Puro, recebe a consulta      |
| `src/lib/ler-janela.test.ts` (novo)                                | testes da leitura                                                 |
| `src/lib/admin-dados.ts`                                           | usa `lerJanela`, log de tempos, lê o resumo diário, `vivo`        |
| `src/routes/admin.tsx`                                             | comparativo espera o núcleo; `?vivo=1`; nota em Visitantes        |
| `src/lib/admin-painel-contrato.test.ts` (novo)                     | contrato de fonte da tela e do `admin-dados`                      |
| `src/lib/painel-resumo.ts` (novo)                                  | tipos e funções puras do resumo (janela, soma, venda, planejador) |
| `src/lib/painel-resumo.test.ts` (novo)                             | testes das funções puras                                          |
| `src/lib/painel-fechar.ts` (novo)                                  | `fecharDias`: o laço do cron, com dependências injetadas          |
| `src/lib/painel-fechar.test.ts` (novo)                             | testes do laço                                                    |
| `supabase/migrations/20261002010000_painel_eventos_dia.sql` (novo) | tabela do resumo                                                  |
| `api/painel-resumo.ts` (novo)                                      | handler do Vercel Cron                                            |
| `vercel.json`                                                      | cron de hora em hora + `maxDuration`                              |
| `CLAUDE.md`                                                        | seção "Painel rápido (02/10/2026)"                                |

---

# PARTE A — consultas consertadas (primeiro deploy)

### Task 1: `lerJanela` (fatias de 1 dia + cursor) e índices

**Files:**

- Create: `src/lib/ler-janela.ts`
- Create: `src/lib/ler-janela.test.ts`
- Create: `supabase/migrations/20261002000000_painel_indices.sql`

**Interfaces:**

- Consumes: nada.
- Produces:
  - `type LinhaComCursor = { id: string; created_at: string }`
  - `type Cursor = { created_at: string; id: string }`
  - `type ConsultaFatia<T> = (a: { desde: string; ate: string; cursor: Cursor | null; limite: number }) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>`
  - `filtroCursor(c: Cursor): string`
  - `fatiasDe(inicio: Date, fim: Date, passoMs?: number): Array<{ desde: string; ate: string }>`
  - `lerJanela<T extends LinhaComCursor>(consulta: ConsultaFatia<T>, inicio: Date, fim: Date): Promise<T[]>`
  - constantes `PAGINA = 1000`, `PARALELO = 12`, `TETO = 500_000`

- [ ] **Step 1: Escrever os testes**

`src/lib/ler-janela.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  fatiasDe,
  filtroCursor,
  lerJanela,
  PAGINA,
  type ConsultaFatia,
  type LinhaComCursor,
} from "./ler-janela";

// A LEITURA DO PAINEL. Substitui a paginação por OFFSET, que obrigava o banco
// a reordenar a janela inteira por um uuid aleatório a cada página.

type L = LinhaComCursor & { n: number };

/** Um banco de mentira que obedece ao mesmo contrato do PostgREST. */
function bancoFalso(linhas: L[]) {
  const chamadas: Array<{ desde: string; ate: string; cursor: unknown }> = [];
  const ordenadas = [...linhas].sort((a, b) =>
    a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1,
  );
  const consulta: ConsultaFatia<L> = async ({ desde, ate, cursor, limite }) => {
    chamadas.push({ desde, ate, cursor });
    const data = ordenadas
      .filter((l) => l.created_at >= desde && l.created_at < ate)
      .filter(
        (l) =>
          !cursor ||
          l.created_at > cursor.created_at ||
          (l.created_at === cursor.created_at && l.id > cursor.id),
      )
      .slice(0, limite);
    return { data, error: null };
  };
  return { consulta, chamadas };
}

const t = (iso: string) => new Date(iso);
const linha = (i: number, created_at: string): L => ({
  id: `id-${String(i).padStart(6, "0")}`,
  created_at,
  n: i,
});

describe("fatiasDe", () => {
  it("corta em pedaços de 24h a partir do início, e o último termina no fim", () => {
    expect(fatiasDe(t("2026-10-01T10:00:00.000Z"), t("2026-10-03T04:00:00.000Z"))).toEqual([
      { desde: "2026-10-01T10:00:00.000Z", ate: "2026-10-02T10:00:00.000Z" },
      { desde: "2026-10-02T10:00:00.000Z", ate: "2026-10-03T04:00:00.000Z" },
    ]);
  });

  it("janela vazia não tem fatia", () => {
    expect(fatiasDe(t("2026-10-01T10:00:00.000Z"), t("2026-10-01T10:00:00.000Z"))).toEqual([]);
  });
});

describe("filtroCursor", () => {
  it("põe o timestamp entre aspas e desempata por id", () => {
    // Sem aspas, o "+" e os ":" do fuso quebram o or=(...) do PostgREST.
    expect(filtroCursor({ created_at: "2026-10-01T12:34:56.123456+00:00", id: "abc" })).toBe(
      'created_at.gt."2026-10-01T12:34:56.123456+00:00",and(created_at.eq."2026-10-01T12:34:56.123456+00:00",id.gt.abc)',
    );
  });
});

describe("lerJanela", () => {
  it("janela sem linhas devolve lista vazia", async () => {
    const { consulta } = bancoFalso([]);
    expect(
      await lerJanela(consulta, t("2026-10-01T00:00:00.000Z"), t("2026-10-03T00:00:00.000Z")),
    ).toEqual([]);
  });

  it("fatia com mais de uma página anda pelo cursor sem repetir nem pular", async () => {
    const linhas = Array.from({ length: PAGINA * 2 + 7 }, (_, i) =>
      linha(i, `2026-10-01T05:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:00.000Z`),
    );
    const { consulta } = bancoFalso(linhas);
    const lidas = await lerJanela(
      consulta,
      t("2026-10-01T00:00:00.000Z"),
      t("2026-10-02T00:00:00.000Z"),
    );
    expect(lidas).toHaveLength(linhas.length);
    expect(new Set(lidas.map((l) => l.id)).size).toBe(linhas.length);
  });

  it("empate de created_at maior que uma página desempata por id", async () => {
    // Mil e poucas linhas no MESMO instante: sem o id no cursor, a segunda
    // página repetiria a primeira pra sempre.
    const linhas = Array.from({ length: PAGINA + 3 }, (_, i) =>
      linha(i, "2026-10-01T05:00:00.000Z"),
    );
    const { consulta } = bancoFalso(linhas);
    const lidas = await lerJanela(
      consulta,
      t("2026-10-01T00:00:00.000Z"),
      t("2026-10-02T00:00:00.000Z"),
    );
    expect(lidas).toHaveLength(PAGINA + 3);
  });

  it("junta as fatias de dias diferentes", async () => {
    const linhas = [linha(1, "2026-10-01T05:00:00.000Z"), linha(2, "2026-10-02T05:00:00.000Z")];
    const { consulta, chamadas } = bancoFalso(linhas);
    const lidas = await lerJanela(
      consulta,
      t("2026-10-01T00:00:00.000Z"),
      t("2026-10-03T00:00:00.000Z"),
    );
    expect(lidas.map((l) => l.n).sort()).toEqual([1, 2]);
    expect(chamadas).toHaveLength(2);
  });

  it("erro numa fatia lança, como antes", async () => {
    const consulta: ConsultaFatia<L> = async () => ({
      data: null,
      error: { message: "statement timeout" },
    });
    await expect(
      lerJanela(consulta, t("2026-10-01T00:00:00.000Z"), t("2026-10-02T00:00:00.000Z")),
    ).rejects.toThrow("statement timeout");
  });

  it("cursor parado lança em vez de girar pra sempre", async () => {
    // Página cheia que ignora o cursor: devolve sempre as mesmas linhas.
    const cheia = Array.from({ length: PAGINA }, (_, i) => linha(i, "2026-10-01T05:00:00.000Z"));
    const consulta: ConsultaFatia<L> = async () => ({ data: cheia, error: null });
    await expect(
      lerJanela(consulta, t("2026-10-01T00:00:00.000Z"), t("2026-10-02T00:00:00.000Z")),
    ).rejects.toThrow(/cursor parado/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/ler-janela.test.ts`
Expected: FAIL — `Failed to resolve import "./ler-janela"`.

- [ ] **Step 3: Implementar**

`src/lib/ler-janela.ts`:

```ts
// LEITURA DE UMA JANELA DO BANCO, EM FATIAS DE UM DIA, POR CURSOR.
//
// Substitui o `paginado` do painel, que pedia 12 páginas por OFFSET ao mesmo
// tempo, ordenadas por `id` — um uuid aleatório. Pra entregar a página N o
// banco ordenava a janela INTEIRA e jogava fora N×1000 linhas, doze vezes em
// paralelo. Foi isso que fez o painel estourar o tempo até em 7 dias
// (02/10/2026).
//
// Aqui cada fatia é um trecho do índice `(created_at, id)`, e cada página
// continua de onde a anterior parou: nada é reordenado, nada é descartado.
// O paralelismo continua, só que entre DIAS, não entre páginas do mesmo dia.
//
// Puro: recebe a consulta pronta. O painel e o cron montam a sua.

export type LinhaComCursor = { id: string; created_at: string };
export type Cursor = { created_at: string; id: string };
export type ConsultaFatia<T> = (a: {
  desde: string;
  ate: string;
  cursor: Cursor | null;
  limite: number;
}) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** O teto de linhas por requisição do PostgREST. */
export const PAGINA = 1000;
/** Quantas fatias ao mesmo tempo. Cada uma é uma conexão no PostgREST. */
export const PARALELO = 12;
/** Acima disso lança: número errado é pior que erro visível. */
export const TETO = 500_000;

const DIA_MS = 86_400_000;

/**
 * O filtro `or` do PostgREST pra "depois do cursor".
 *
 * O timestamp vai ENTRE ASPAS: o banco devolve `...123456+00:00`, e sem aspas
 * o `+` e os `:` quebram a gramática do `or=(...)`. O `id` desempata linhas
 * gravadas no mesmo instante — sem ele, um empate maior que uma página giraria
 * pra sempre.
 */
export function filtroCursor(c: Cursor): string {
  return `created_at.gt."${c.created_at}",and(created_at.eq."${c.created_at}",id.gt.${c.id})`;
}

/** A janela em pedaços de `passoMs`, a partir do início. */
export function fatiasDe(
  inicio: Date,
  fim: Date,
  passoMs = DIA_MS,
): Array<{ desde: string; ate: string }> {
  const fatias: Array<{ desde: string; ate: string }> = [];
  for (let t = inicio.getTime(); t < fim.getTime(); t += passoMs) {
    fatias.push({
      desde: new Date(t).toISOString(),
      ate: new Date(Math.min(t + passoMs, fim.getTime())).toISOString(),
    });
  }
  return fatias;
}

async function lerFatia<T extends LinhaComCursor>(
  consulta: ConsultaFatia<T>,
  desde: string,
  ate: string,
): Promise<T[]> {
  const linhas: T[] = [];
  let cursor: Cursor | null = null;
  for (;;) {
    const { data, error } = await consulta({ desde, ate, cursor, limite: PAGINA });
    if (error) throw new Error(error.message);
    const pagina = data ?? [];
    linhas.push(...pagina);
    if (pagina.length < PAGINA) return linhas;

    const ultima = pagina[pagina.length - 1];
    // Uma página cheia que termina onde a anterior terminou não vai acabar
    // nunca. Melhor erro na tela que função pendurada até a Vercel matar.
    if (cursor && ultima.created_at === cursor.created_at && ultima.id === cursor.id) {
      throw new Error(`cursor parado em ${ultima.created_at}: a consulta ignorou o cursor`);
    }
    cursor = { created_at: ultima.created_at, id: ultima.id };
    if (linhas.length >= TETO) {
      throw new Error(
        `recorte grande demais: mais de ${TETO} linhas. Diminua o período do painel.`,
      );
    }
  }
}

/**
 * Lê `[inicio, fim)` inteira, fatia por fatia, até `PARALELO` ao mesmo tempo.
 *
 * A deduplicação por `id` ficou como cinto: com cursor, escrita concorrente
 * não empurra linha entre páginas, mas a junção de fatias é o lugar onde um
 * erro de borda apareceria.
 */
export async function lerJanela<T extends LinhaComCursor>(
  consulta: ConsultaFatia<T>,
  inicio: Date,
  fim: Date,
): Promise<T[]> {
  const fatias = fatiasDe(inicio, fim);
  const resultados: T[][] = new Array(fatias.length);
  let proxima = 0;
  const trabalhador = async () => {
    while (proxima < fatias.length) {
      const i = proxima++;
      resultados[i] = await lerFatia(consulta, fatias[i].desde, fatias[i].ate);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALELO, fatias.length) }, trabalhador));

  const vistos = new Set<string>();
  const tudo: T[] = [];
  for (const lote of resultados) {
    for (const l of lote) {
      if (vistos.has(l.id)) continue;
      vistos.add(l.id);
      tudo.push(l);
    }
  }
  if (tudo.length > TETO) {
    throw new Error(`recorte grande demais: mais de ${TETO} linhas. Diminua o período do painel.`);
  }
  return tudo;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/ler-janela.test.ts`
Expected: PASS, 9 testes.

- [ ] **Step 5: Migration dos índices**

`supabase/migrations/20261002000000_painel_indices.sql`:

```sql
-- PAINEL RÁPIDO, PARTE A (02/10/2026).
--
-- O painel filtra estas quatro tabelas por `created_at` e, desde hoje, pagina
-- por cursor `(created_at, id)`. `quiz_responses`, `musicas` e `pedidos` não
-- tinham índice nenhum que começasse por `created_at` — cada abertura do painel
-- lia a tabela inteira, inclusive a coluna `respostas` com as histórias.
-- `custos` tinha `(created_at desc)`, que serve ao filtro mas não ao cursor.
--
-- Criar índice trava a ESCRITA na tabela por alguns segundos (as tabelas são
-- pequenas). O quiz espera, não falha. Aplicar de madrugada, na Serenata E na
-- Ballad. Se o editor deixar rodar fora de transação, `create index
-- concurrently`, um por vez.

create index if not exists quiz_responses_created_at_id_idx on public.quiz_responses (created_at, id);
create index if not exists musicas_created_at_id_idx        on public.musicas        (created_at, id);
create index if not exists pedidos_created_at_id_idx        on public.pedidos        (created_at, id);
create index if not exists custos_created_at_id_idx         on public.custos         (created_at, id);
```

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/lib/ler-janela.ts src/lib/ler-janela.test.ts
npx prettier --check src/lib/ler-janela.ts src/lib/ler-janela.test.ts
git add src/lib/ler-janela.ts src/lib/ler-janela.test.ts supabase/migrations/20261002000000_painel_indices.sql
git commit -m "feat(admin): leitura em fatias de 1 dia por cursor, e os indices que faltavam"
```

---

### Task 2: `montarPainel` lê por `lerJanela` e registra os tempos

**Files:**

- Modify: `src/lib/admin-dados.ts` (constantes `PAGINA`/`LOTE` e `paginado` ~linhas 500–572; helper `janela` dentro de `montarPainel` ~linhas 734–745; fim de `montarPainel`, antes do `return`)
- Create: `src/lib/admin-painel-contrato.test.ts`

**Interfaces:**

- Consumes: `lerJanela`, `filtroCursor` (Task 1).
- Produces: nenhuma assinatura pública nova. `paginado` deixa de existir em `admin-dados.ts`.

- [ ] **Step 1: Escrever o teste de contrato**

`src/lib/admin-painel-contrato.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/admin-painel-contrato.test.ts`
Expected: FAIL nos três (`.range(` presente, `lerJanela<` ausente, log ausente).

- [ ] **Step 3: Trocar a leitura**

Em `src/lib/admin-dados.ts`:

1. Import no topo, junto dos outros:

```ts
import { filtroCursor, lerJanela } from "@/lib/ler-janela";
```

2. Apagar `const PAGINA = 1000;`, o bloco de comentário e `const LOTE = 12;`,
   e a função `paginado` inteira, com o JSDoc dela. O comentário acima de
   `type Lead` que termina em "Toda leitura de série do painel passa por
   aqui." continua verdadeiro: passa a valer para `lerJanela`.

3. Dentro de `montarPainel`, trocar o helper `janela` (o bloco que começa em
   `// A ordenação por \`id\` não é enfeite`) por:

```ts
// Cada janela é lida em fatias de um dia, por cursor `(created_at, id)`
// (`ler-janela.ts`). A ordem de exibição continua reconstruída em JS depois.
const janela = <T extends { id: string; created_at: string }>(tabela: string, colunas: string) =>
  lerJanela<T>(
    ({ desde: d, ate: a, cursor, limite }) => {
      const base = db.from(tabela).select(colunas).gte("created_at", d).lt("created_at", a);
      const comCursor = cursor ? base.or(filtroCursor(cursor)) : base;
      return comCursor.order("created_at").order("id").limit(limite) as never;
    },
    inicio,
    fim,
  );
```

(Encadeado sem reatribuir de propósito: `let q = ...; q = q.or(...)` briga
com os tipos do supabase-js, que mudam a cada `select`.)

4. Medir o tempo. Na primeira linha de `montarPainel`, antes de
   `const db = supabaseAdmin();`:

```ts
const t0 = Date.now();
```

Logo depois do `await Promise.all([...])` das quatro leituras:

```ts
const msLeituras = Date.now() - t0;
```

Logo depois do `await db.rpc("admin_eventos_resumo", ...)`:

```ts
const msEventos = Date.now() - t0 - msLeituras;
```

E imediatamente antes do `return {` final de `montarPainel`:

```ts
// UMA linha por painel, legível nos logs da Vercel. Sem e-mail, sem id, sem
// valor: só onde foi o tempo. É ela que diz se 90 dias pede o próximo passo.
console.log(
  `[admin] painel ${dias}d ${filtro}: leituras ${msLeituras}ms · eventos ${msEventos}ms · total ${Date.now() - t0}ms`,
);
```

- [ ] **Step 4: Rodar contrato, suíte e tipos**

Run: `npx vitest run src/lib/admin-painel-contrato.test.ts`
Expected: PASS, 3 testes.

Run: `npm test > /tmp/painel-suite.txt 2>&1; echo "saida=$?"; tail -15 /tmp/painel-suite.txt`
Expected: tudo verde, exceto falha que JÁ existia antes deste plano. Se houver
vermelho, conferir com `git stash; npm test; git stash pop` que ele é
pré-existente, e registrar o nome dele no ledger.

Run: `npm run typecheck > /tmp/painel-tipos.txt 2>&1; echo "saida=$?"; grep "admin-dados\|ler-janela" /tmp/painel-tipos.txt`
Expected: nenhum erro em `admin-dados.ts` nem em `ler-janela.ts`. Erros em
outros arquivos que já existiam antes do plano não bloqueiam; anotar no ledger
quantos eram (`git stash; npm run typecheck | grep -c "error TS"; git stash pop`).

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/admin-dados.ts src/lib/admin-painel-contrato.test.ts
npx prettier --check src/lib/admin-dados.ts src/lib/admin-painel-contrato.test.ts
git add src/lib/admin-dados.ts src/lib/admin-painel-contrato.test.ts
git commit -m "fix(admin): painel le por cursor em fatias de 1 dia e loga os tempos"
```

---

### Task 3: o comparativo espera o núcleo

**Files:**

- Modify: `src/routes/admin.tsx` (o `useQuery` do `comparativo`, ~linha 427)
- Modify: `src/lib/admin-painel-contrato.test.ts`

**Interfaces:**

- Consumes: nada novo.
- Produces: nada novo.

- [ ] **Step 1: Teste de contrato**

Acrescentar em `src/lib/admin-painel-contrato.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/admin-painel-contrato.test.ts`
Expected: FAIL em "o comparativo só dispara…".

- [ ] **Step 3: Implementar**

Em `src/routes/admin.tsx`, o `useQuery` do comparativo vira:

```tsx
// DEPOIS DO NÚCLEO, nunca junto. O comparativo é um painel inteiro da
// janela anterior; disparado ao mesmo tempo, pedir 30 dias fazia o banco
// processar 60 de uma vez (02/10/2026). O `!isPlaceholderData` é o que
// segura a troca de período: com `keepPreviousData` o núcleo continua
// `isSuccess` enquanto busca o recorte novo.
const comparativo = useQuery({
  queryKey: ["painel", "comparativo", ...janelaKey],
  queryFn: () => carregarComparativo({ data: args }),
  enabled: nucleo.isSuccess && !nucleo.isPlaceholderData,
  ...comum,
});
```

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/lib/admin-painel-contrato.test.ts`
Expected: PASS, 4 testes.

Run: `npm run typecheck > /tmp/painel-tipos.txt 2>&1; grep "admin.tsx" /tmp/painel-tipos.txt`
Expected: nada.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/routes/admin.tsx src/lib/admin-painel-contrato.test.ts
npx prettier --check src/routes/admin.tsx src/lib/admin-painel-contrato.test.ts
git add src/routes/admin.tsx src/lib/admin-painel-contrato.test.ts
git commit -m "fix(admin): comparativo so busca depois do nucleo"
```

### ⛔ Ponto de parada: deploy da Parte A

Parar e pedir ao dono:

1. Colar `supabase/migrations/20261002000000_painel_indices.sql` no SQL
   Editor da Serenata e no da Ballad.
2. OK para `git pull --rebase && git push`.
3. Depois do deploy: `curl -X PUT https://serenata.../api/inngest` e o da
   Ballad (rotina de todo deploy, CLAUDE.md).
4. O dono abre o painel em 7, 30 e 90 dias. Ler os logs com
   `vercel logs <url-do-deploy> | grep "\[admin\] painel"` e registrar os
   tempos no ledger. Eles dizem se a Parte B precisa de mais alguma coisa.

A Parte B segue mesmo que a A já resolva 30 dias: é ela que tira o funil de 90
dias do estouro.

---

# PARTE B — resumo diário do funil (segundo deploy)

### Task 4: janela fatiada e soma de resumos (puro)

**Files:**

- Create: `src/lib/painel-resumo.ts`
- Create: `src/lib/painel-resumo.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces:
  - `type FiltroFunil = "todos" | "pt" | "es"`, `FILTROS: readonly FiltroFunil[]`
  - `type EventosResumo` (mesmo formato de hoje em `admin-dados.ts`)
  - `type Faixa = { inicio: Date; fim: Date }`
  - `diaBr(t: number): string` → `"YYYY-MM-DD"`
  - `limitesDoDia(dia: string): Faixa`
  - `fatiarJanela(inicio: Date, fim: Date, agora: number): { dias: string[]; vivas: Faixa[] }`
  - `faixasVivas(plano: { dias: string[]; vivas: Faixa[] }, existentes: ReadonlySet<string>): { faixas: Faixa[]; faltando: string[] }`
  - `resumoVazio(): EventosResumo`
  - `somarResumos(partes: EventosResumo[]): EventosResumo`

- [ ] **Step 1: Testes**

`src/lib/painel-resumo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  diaBr,
  faixasVivas,
  fatiarJanela,
  limitesDoDia,
  resumoVazio,
  somarResumos,
  type EventosResumo,
} from "./painel-resumo";

// O RESUMO DIÁRIO DO FUNIL. Dia fechado vem da tabela; as pontas da janela
// (que começa e termina no meio de um dia) vêm ao vivo.

const t = (iso: string) => new Date(iso);
const iso = (f: { inicio: Date; fim: Date }) => [f.inicio.toISOString(), f.fim.toISOString()];

describe("diaBr e limitesDoDia", () => {
  it("02h em UTC ainda é o dia anterior no Brasil", () => {
    expect(diaBr(Date.parse("2026-10-02T02:59:00.000Z"))).toBe("2026-10-01");
    expect(diaBr(Date.parse("2026-10-02T03:00:00.000Z"))).toBe("2026-10-02");
  });

  it("o dia vai de 03:00 UTC a 03:00 UTC do dia seguinte", () => {
    expect(iso(limitesDoDia("2026-10-01"))).toEqual([
      "2026-10-01T03:00:00.000Z",
      "2026-10-02T03:00:00.000Z",
    ]);
  });
});

describe("fatiarJanela", () => {
  // 01/10 22:38 no Brasil.
  const agora = Date.parse("2026-10-02T01:38:00.000Z");

  it("7 dias móveis: ponta inicial viva, 6 dias da tabela, hoje vivo", () => {
    const fim = new Date(agora);
    const inicio = new Date(agora - 7 * 86_400_000);
    const r = fatiarJanela(inicio, fim, agora);
    expect(r.dias).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
    ]);
    expect(r.vivas.map(iso)).toEqual([
      ["2026-09-25T01:38:00.000Z", "2026-09-25T03:00:00.000Z"],
      ["2026-10-01T03:00:00.000Z", "2026-10-02T01:38:00.000Z"],
    ]);
  });

  it("um dia fechado escolhido por data: só tabela, nada vivo", () => {
    const { inicio, fim } = limitesDoDia("2026-09-28");
    const r = fatiarJanela(inicio, fim, agora);
    expect(r).toEqual({ dias: ["2026-09-28"], vivas: [] });
  });

  it("só hoje: tudo vivo", () => {
    const { inicio } = limitesDoDia("2026-10-01");
    const r = fatiarJanela(inicio, new Date(agora), agora);
    expect(r.dias).toEqual([]);
    expect(r.vivas.map(iso)).toEqual([["2026-10-01T03:00:00.000Z", "2026-10-02T01:38:00.000Z"]]);
  });

  it("vira o mês sem pular dia", () => {
    const r = fatiarJanela(
      limitesDoDia("2026-09-29").inicio,
      limitesDoDia("2026-10-01").inicio,
      agora,
    );
    expect(r.dias).toEqual(["2026-09-29", "2026-09-30"]);
  });

  it("janela anterior do comparativo, terminando no meio de ontem: a ponta final é viva", () => {
    // 7 dias, deslocados 7 dias pra trás: termina 24/09 22:38 no Brasil.
    const fim = new Date(agora - 7 * 86_400_000);
    const inicio = new Date(agora - 14 * 86_400_000);
    const r = fatiarJanela(inicio, fim, agora);
    expect(r.dias[r.dias.length - 1]).toBe("2026-09-23");
    expect(r.vivas.map(iso)[1]).toEqual(["2026-09-24T03:00:00.000Z", "2026-09-25T01:38:00.000Z"]);
  });

  it("janela vazia não tem nada", () => {
    expect(fatiarJanela(new Date(agora), new Date(agora), agora)).toEqual({ dias: [], vivas: [] });
  });
});

describe("faixasVivas", () => {
  const plano = {
    dias: ["2026-09-26", "2026-09-27", "2026-09-28"],
    vivas: [
      { inicio: t("2026-09-25T20:00:00.000Z"), fim: t("2026-09-26T03:00:00.000Z") },
      { inicio: t("2026-09-29T03:00:00.000Z"), fim: t("2026-09-29T10:00:00.000Z") },
    ],
  };

  it("com todos os dias na tabela, só as pontas vão ao banco", () => {
    const r = faixasVivas(plano, new Set(plano.dias));
    expect(r.faltando).toEqual([]);
    expect(r.faixas).toHaveLength(2);
  });

  it("dia faltando vira faixa viva, colada na vizinha", () => {
    const r = faixasVivas(plano, new Set(["2026-09-27", "2026-09-28"]));
    expect(r.faltando).toEqual(["2026-09-26"]);
    // A ponta inicial e o dia 26 se tocam: uma chamada só.
    expect(r.faixas.map(iso)).toEqual([
      ["2026-09-25T20:00:00.000Z", "2026-09-27T03:00:00.000Z"],
      ["2026-09-29T03:00:00.000Z", "2026-09-29T10:00:00.000Z"],
    ]);
  });

  it("tabela vazia: a janela inteira numa faixa só, como era antes", () => {
    const r = faixasVivas(plano, new Set());
    expect(r.faixas.map(iso)).toEqual([["2026-09-25T20:00:00.000Z", "2026-09-29T10:00:00.000Z"]]);
  });
});

describe("somarResumos", () => {
  const a: EventosResumo = {
    visitantes: 10,
    sessoes_abertura: 6,
    sessoes_oferta: 3,
    sessoes_checkout: 2,
    contagens: { musica_play: 4 },
    por_entrada: [
      { caminho: "/", visitantes: 7, quiz: 3, letras: 2, vendas: 1 },
      { caminho: "/criar", visitantes: 3, quiz: 3, letras: 1, vendas: 0 },
    ],
  };
  const b: EventosResumo = {
    visitantes: 5,
    sessoes_oferta: 1,
    sessoes_checkout: 0,
    contagens: { musica_play: 1, letra_refacao: 2 },
    por_entrada: [{ caminho: "/criar", visitantes: 5, quiz: 4, letras: 2, vendas: 1 }],
  };

  it("soma os números e as contagens, mesmo com chaves diferentes", () => {
    const s = somarResumos([a, b]);
    expect(s.visitantes).toBe(15);
    expect(s.sessoes_abertura).toBe(6); // ausente em `b` conta zero
    expect(s.sessoes_oferta).toBe(4);
    expect(s.contagens).toEqual({ musica_play: 5, letra_refacao: 2 });
  });

  it("soma as entradas por caminho e reordena por visitantes", () => {
    expect(somarResumos([a, b]).por_entrada).toEqual([
      { caminho: "/criar", visitantes: 8, quiz: 7, letras: 3, vendas: 1 },
      { caminho: "/", visitantes: 7, quiz: 3, letras: 2, vendas: 1 },
    ]);
  });

  it("nada pra somar devolve o resumo zerado, nunca undefined", () => {
    expect(somarResumos([])).toEqual(resumoVazio());
  });

  it("não muda as partes", () => {
    const copia = JSON.parse(JSON.stringify(a));
    somarResumos([a, b]);
    expect(a).toEqual(copia);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/painel-resumo.test.ts`
Expected: FAIL — `Failed to resolve import "./painel-resumo"`.

- [ ] **Step 3: Implementar**

`src/lib/painel-resumo.ts`:

```ts
// O RESUMO DIÁRIO DO FUNIL (02/10/2026).
//
// Agregar `funnel_events` é o que estoura o tempo do banco: 3,3s por dia
// medidos em 28/08, e a tabela só cresce. Um dia que já terminou não muda
// mais (ou quase), então ele é agregado UMA vez pelo cron
// (`api/painel-resumo.ts`) e guardado em `painel_eventos_dia`. O painel soma
// os dias prontos e calcula ao vivo só as pontas.
//
// O que vai na tabela é a saída de `admin_eventos_resumo` sem tirar nem pôr.
// A mesma função alimenta o vivo e o resumo: não existe segunda versão do que
// é visitante, abertura ou checkout.
//
// Puro e sem `@/`: o cron em `api/` importa daqui.
//
// DUAS COISAS MUDAM DE SIGNIFICADO, e estão escritas na tela:
//   1. Sessão que atravessa a meia-noite conta uma vez em CADA dia.
//   2. Venda por página de entrada só conta compra no mesmo dia da visita.

export type FiltroFunil = "todos" | "pt" | "es";
export const FILTROS: readonly FiltroFunil[] = ["todos", "pt", "es"];

/** O que `admin_eventos_resumo` devolve (migration 20260817000000). */
export type EventosResumo = {
  visitantes: number;
  /** Opcional: some se o painel subir antes da migration 20260817110000. */
  sessoes_abertura?: number;
  sessoes_oferta: number;
  sessoes_checkout: number;
  contagens: Record<string, number>;
  por_entrada: Array<{
    caminho: string;
    visitantes: number;
    quiz: number;
    letras: number;
    vendas: number;
  }>;
};

export type Faixa = { inicio: Date; fim: Date };

const DIA_MS = 86_400_000;
/** Brasília, sem horário de verão. O mesmo `OFFSET_BR` de `admin-dados.ts`. */
const OFFSET_BR_MS = 3 * 3_600_000;

/** O dia do Brasil em que o instante cai, `YYYY-MM-DD`. */
export function diaBr(t: number): string {
  return new Date(t - OFFSET_BR_MS).toISOString().slice(0, 10);
}

/** Meia-noite a meia-noite, no Brasil. */
export function limitesDoDia(dia: string): Faixa {
  const inicio = new Date(Date.parse(`${dia}T00:00:00.000Z`) + OFFSET_BR_MS);
  return { inicio, fim: new Date(inicio.getTime() + DIA_MS) };
}

const meiaNoiteDe = (t: number) => limitesDoDia(diaBr(t)).inicio.getTime();

/**
 * Divide a janela em DIAS FECHADOS INTEIROS (que vêm da tabela) e até duas
 * FAIXAS VIVAS: a ponta inicial (a janela móvel de "7 dias" começa no meio de
 * um dia) e a ponta final (hoje até agora, ou o meio de um dia passado, no
 * comparativo).
 *
 * Hoje nunca é dia fechado, mesmo que a janela o cubra inteiro: ainda está
 * acontecendo.
 */
export function fatiarJanela(
  inicio: Date,
  fim: Date,
  agora: number,
): { dias: string[]; vivas: Faixa[] } {
  const ini = inicio.getTime();
  const fimT = fim.getTime();
  if (ini >= fimT) return { dias: [], vivas: [] };

  let primeiro = meiaNoiteDe(ini);
  if (primeiro < ini) primeiro += DIA_MS;
  const limite = Math.min(fimT, meiaNoiteDe(agora));

  const dias: string[] = [];
  let t = primeiro;
  while (t + DIA_MS <= limite) {
    dias.push(diaBr(t));
    t += DIA_MS;
  }
  if (!dias.length) return { dias: [], vivas: [{ inicio, fim }] };

  const vivas: Faixa[] = [];
  if (ini < primeiro) vivas.push({ inicio, fim: new Date(primeiro) });
  if (t < fimT) vivas.push({ inicio: new Date(t), fim });
  return { dias, vivas };
}

/**
 * O que vai ao banco ao vivo: as pontas, mais os dias que deveriam estar na
 * tabela e não estão (cron atrasado, migration não aplicada).
 *
 * Faixas que se tocam viram UMA chamada. No pior caso — tabela vazia — sai a
 * janela inteira numa faixa só, que é exatamente o painel de antes.
 */
export function faixasVivas(
  plano: { dias: string[]; vivas: Faixa[] },
  existentes: ReadonlySet<string>,
): { faixas: Faixa[]; faltando: string[] } {
  const faltando = plano.dias.filter((d) => !existentes.has(d));
  const todas = [...plano.vivas, ...faltando.map(limitesDoDia)].sort(
    (a, b) => a.inicio.getTime() - b.inicio.getTime(),
  );
  const faixas: Faixa[] = [];
  for (const f of todas) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && ultima.fim.getTime() >= f.inicio.getTime()) {
      if (f.fim.getTime() > ultima.fim.getTime()) ultima.fim = new Date(f.fim.getTime());
    } else {
      faixas.push({ inicio: new Date(f.inicio.getTime()), fim: new Date(f.fim.getTime()) });
    }
  }
  return { faixas, faltando };
}

export function resumoVazio(): EventosResumo {
  return {
    visitantes: 0,
    sessoes_abertura: 0,
    sessoes_oferta: 0,
    sessoes_checkout: 0,
    contagens: {},
    por_entrada: [],
  };
}

/**
 * Junta resumos de pedaços diferentes da janela num resumo só, no formato que
 * o resto de `montarPainel` já lê.
 */
export function somarResumos(partes: EventosResumo[]): EventosResumo {
  const total = resumoVazio();
  const entradas = new Map<string, EventosResumo["por_entrada"][number]>();
  for (const p of partes) {
    total.visitantes += Number(p.visitantes ?? 0);
    total.sessoes_abertura = (total.sessoes_abertura ?? 0) + Number(p.sessoes_abertura ?? 0);
    total.sessoes_oferta += Number(p.sessoes_oferta ?? 0);
    total.sessoes_checkout += Number(p.sessoes_checkout ?? 0);
    for (const [nome, n] of Object.entries(p.contagens ?? {})) {
      total.contagens[nome] = (total.contagens[nome] ?? 0) + Number(n);
    }
    for (const e of p.por_entrada ?? []) {
      const ja = entradas.get(e.caminho);
      if (ja) {
        ja.visitantes += e.visitantes;
        ja.quiz += e.quiz;
        ja.letras += e.letras;
        ja.vendas += e.vendas;
      } else {
        entradas.set(e.caminho, { ...e });
      }
    }
  }
  total.por_entrada = [...entradas.values()].sort(
    (x, y) => y.visitantes - x.visitantes || x.caminho.localeCompare(y.caminho),
  );
  return total;
}
```

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/lib/painel-resumo.test.ts`
Expected: PASS, 15 testes.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/painel-resumo.ts src/lib/painel-resumo.test.ts
npx prettier --check src/lib/painel-resumo.ts src/lib/painel-resumo.test.ts
git add src/lib/painel-resumo.ts src/lib/painel-resumo.test.ts
git commit -m "feat(admin): janela fatiada em dias e soma de resumos do funil"
```

---

### Task 5: regra de venda e planejador do cron (puro)

**Files:**

- Modify: `src/lib/painel-resumo.ts`
- Modify: `src/lib/painel-resumo.test.ts`

**Interfaces:**

- Consumes: `FILTROS`, `FiltroFunil`, `diaBr`, `limitesDoDia` (Task 4).
- Produces:
  - `type PedidoVenda = { quiz_response_id: string | null; status: string; dinheiro_entrou?: boolean | null }`
  - `type LeadSessao = { id: string; session_id: string | null; locale: string | null }`
  - `ehVenda(p: PedidoVenda): boolean`
  - `sessoesQueCompraram(pedidos: PedidoVenda[], leads: LeadSessao[], filtro: FiltroFunil): string[]`
  - `type LinhaResumoDia = { dia: string; filtro: string; atualizado_em: string }`
  - `diasAFazer(linhas: LinhaResumoDia[], primeiroDia: string, agora: number): string[]`
  - constantes `RECENTE_H = 72`, `REFAZER_H = 6`

- [ ] **Step 1: Testes**

Acrescentar ao import de `src/lib/painel-resumo.test.ts`:
`diasAFazer, ehVenda, sessoesQueCompraram, type LinhaResumoDia` e, no fim do
arquivo:

```ts
describe("ehVenda", () => {
  it("pago é venda; cortesia (dinheiro_entrou = false) não; pendente não", () => {
    expect(ehVenda({ quiz_response_id: "q", status: "pago" })).toBe(true);
    expect(ehVenda({ quiz_response_id: "q", status: "pago", dinheiro_entrou: null })).toBe(true);
    expect(ehVenda({ quiz_response_id: "q", status: "pago", dinheiro_entrou: false })).toBe(false);
    expect(ehVenda({ quiz_response_id: "q", status: "pendente" })).toBe(false);
  });
});

describe("sessoesQueCompraram", () => {
  const leads = [
    { id: "q1", session_id: "s1", locale: "pt" },
    { id: "q2", session_id: "s2", locale: "es" },
    { id: "q3", session_id: null, locale: "pt" },
    { id: "q4", session_id: "s4", locale: "en" },
  ];
  const pedidos = [
    { quiz_response_id: "q1", status: "pago" },
    { quiz_response_id: "q1", status: "pago" }, // upsell: mesma sessão
    { quiz_response_id: "q2", status: "pago" },
    { quiz_response_id: "q3", status: "pago" }, // lead sem sessão
    { quiz_response_id: "q4", status: "pago", dinheiro_entrou: false }, // cortesia
    { quiz_response_id: "qX", status: "pago" }, // lead fora da janela
  ];

  it("todos: sessões distintas que pagaram de verdade", () => {
    expect(sessoesQueCompraram(pedidos, leads, "todos").sort()).toEqual(["s1", "s2"]);
  });

  it("filtro por funil: es separado, en e pt caem em pt", () => {
    expect(sessoesQueCompraram(pedidos, leads, "es")).toEqual(["s2"]);
    expect(sessoesQueCompraram(pedidos, leads, "pt")).toEqual(["s1"]);
  });
});

describe("diasAFazer", () => {
  // 02/10 10:00 no Brasil.
  const agora = Date.parse("2026-10-02T13:00:00.000Z");
  const linhas = (
    dia: string,
    atualizado_em: string,
    filtros = ["todos", "pt", "es"],
  ): LinhaResumoDia[] => filtros.map((filtro) => ({ dia, filtro, atualizado_em }));

  it("faltando, do mais antigo ao mais novo; hoje nunca entra", () => {
    expect(diasAFazer([], "2026-09-29", agora)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
  });

  it("dia com um filtro faltando conta como faltando", () => {
    const l = [
      ...linhas("2026-09-29", "2026-09-30T12:00:00.000Z", ["todos", "pt"]),
      ...linhas("2026-09-30", "2026-10-02T10:00:00.000Z"),
      ...linhas("2026-10-01", "2026-10-02T10:00:00.000Z"),
    ];
    expect(diasAFazer(l, "2026-09-29", agora)).toEqual(["2026-09-29"]);
  });

  it("recente vencido entra depois dos faltando; recente fresco não", () => {
    const l = [
      ...linhas("2026-09-30", "2026-10-01T04:00:00.000Z"), // fechou há 34h, feito há 33h: vencido
      ...linhas("2026-10-01", "2026-10-02T10:00:00.000Z"), // feito há 3h: fresco
    ];
    expect(diasAFazer(l, "2026-09-29", agora)).toEqual(["2026-09-29", "2026-09-30"]);
  });

  it("dia fechado há mais de 72h não é refeito", () => {
    const l = linhas("2026-09-25", "2026-09-26T04:00:00.000Z");
    expect(diasAFazer(l, "2026-09-25", Date.parse("2026-10-02T13:00:00.000Z"))).not.toContain(
      "2026-09-25",
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/painel-resumo.test.ts`
Expected: FAIL — `ehVenda`, `sessoesQueCompraram` e `diasAFazer` não exportados.

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `src/lib/painel-resumo.ts`:

```ts
// ── A REGRA DE VENDA, EM UM LUGAR SÓ ─────────────────────────────

export type PedidoVenda = {
  quiz_response_id: string | null;
  status: string;
  dinheiro_entrou?: boolean | null;
};
export type LeadSessao = { id: string; session_id: string | null; locale: string | null };

/**
 * O que conta como venda. Liberação manual sem dinheiro (cortesia, teste) fica
 * `pago` pra música chegar no cliente, mas não é faturamento: `dinheiro_entrou`
 * só é `false` quando alguém disse que foi cortesia.
 */
export function ehVenda(p: PedidoVenda): boolean {
  return p.status === "pago" && p.dinheiro_entrou !== false;
}

/**
 * As sessões que compraram, pro `p_sessoes_venda` de `admin_eventos_resumo`.
 *
 * Só conta pedido cujo lead está na mesma janela (é o lead que dá a sessão e o
 * idioma). `en` (Ballad) e `pt` caem no filtro "pt", como em `montarPainel`.
 */
export function sessoesQueCompraram(
  pedidos: PedidoVenda[],
  leads: LeadSessao[],
  filtro: FiltroFunil,
): string[] {
  const porId = new Map(leads.map((l) => [l.id, l]));
  const sessoes = new Set<string>();
  for (const p of pedidos) {
    if (!ehVenda(p)) continue;
    const lead = p.quiz_response_id ? porId.get(p.quiz_response_id) : undefined;
    if (!lead?.session_id) continue;
    const locale = lead.locale === "es" ? "es" : "pt";
    if (filtro !== "todos" && locale !== filtro) continue;
    sessoes.add(lead.session_id);
  }
  return [...sessoes];
}

// ── O PLANEJADOR DO CRON ─────────────────────────────────────────

export type LinhaResumoDia = { dia: string; filtro: string; atualizado_em: string };

/** Por quantas horas depois de fechar um dia ainda vale refazê-lo. */
export const RECENTE_H = 72;
/** Idade mínima da linha pra um dia recente ser refeito. */
export const REFAZER_H = 6;

/**
 * Os dias que o cron tem que (re)fazer, em ordem: primeiro os FALTANDO (algum
 * dos três filtros sem linha), do mais antigo ao mais novo; depois os RECENTES
 * VENCIDOS — fechados há menos de 72h com linha de mais de 6h. Isso pega
 * evento que chega atrasado e PIX pago depois da meia-noite.
 *
 * Hoje nunca entra: ainda está acontecendo.
 */
export function diasAFazer(linhas: LinhaResumoDia[], primeiroDia: string, agora: number): string[] {
  const hoje = diaBr(agora);
  const porDia = new Map<string, LinhaResumoDia[]>();
  for (const l of linhas) {
    const lista = porDia.get(l.dia) ?? [];
    lista.push(l);
    porDia.set(l.dia, lista);
  }

  const faltando: string[] = [];
  const vencidos: string[] = [];
  for (let t = limitesDoDia(primeiroDia).inicio.getTime(); diaBr(t) < hoje; t += DIA_MS) {
    const dia = diaBr(t);
    const doDia = porDia.get(dia) ?? [];
    if (!FILTROS.every((f) => doDia.some((l) => l.filtro === f))) {
      faltando.push(dia);
      continue;
    }
    const fechouHa = agora - limitesDoDia(dia).fim.getTime();
    const maisVelha = Math.min(...doDia.map((l) => Date.parse(l.atualizado_em)));
    if (fechouHa < RECENTE_H * 3_600_000 && agora - maisVelha > REFAZER_H * 3_600_000) {
      vencidos.push(dia);
    }
  }
  return [...faltando, ...vencidos];
}
```

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/lib/painel-resumo.test.ts`
Expected: PASS, 22 testes.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/painel-resumo.ts src/lib/painel-resumo.test.ts
npx prettier --check src/lib/painel-resumo.ts src/lib/painel-resumo.test.ts
git add src/lib/painel-resumo.ts src/lib/painel-resumo.test.ts
git commit -m "feat(admin): regra de venda num lugar so e planejador do resumo diario"
```

---

### Task 6: `fecharDias`, o laço do cron

**Files:**

- Create: `src/lib/painel-fechar.ts`
- Create: `src/lib/painel-fechar.test.ts`

**Interfaces:**

- Consumes: `FILTROS`, `limitesDoDia`, `sessoesQueCompraram`, tipos `EventosResumo`, `Faixa`, `FiltroFunil`, `LeadSessao`, `PedidoVenda` (Tasks 4–5).
- Produces:
  - `type DepsFechamento = { lerLeads(f: Faixa): Promise<LeadSessao[]>; lerPedidos(f: Faixa): Promise<PedidoVenda[]>; resumir(f: Faixa, filtro: FiltroFunil, sessoesVenda: string[]): Promise<EventosResumo>; gravar(dia: string, filtro: FiltroFunil, resumo: EventosResumo): Promise<void>; agora(): number }`
  - `type RelatorioFechamento = { feitos: string[]; falhas: Array<{ dia: string; erro: string }>; pendentes: string[] }`
  - `fecharDias(deps: DepsFechamento, dias: string[], prazoMs: number): Promise<RelatorioFechamento>`

- [ ] **Step 1: Testes**

`src/lib/painel-fechar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fecharDias, type DepsFechamento } from "./painel-fechar";
import { resumoVazio, type FiltroFunil } from "./painel-resumo";

// O LAÇO DO CRON. Banco e relógio injetados: o que se testa é a ordem, o
// prazo e o que acontece quando um dia dá errado.

function deps(
  opcoes: { falharEm?: { dia?: string; filtro?: FiltroFunil }; passoMs?: number } = {},
) {
  let relogio = 0;
  const gravados: string[] = [];
  const pedidosSessao: Record<string, string[]> = {};
  const d: DepsFechamento = {
    agora: () => relogio,
    lerLeads: async () => [
      { id: "q1", session_id: "s1", locale: "pt" },
      { id: "q2", session_id: "s2", locale: "es" },
    ],
    lerPedidos: async () => [
      { quiz_response_id: "q1", status: "pago" },
      { quiz_response_id: "q2", status: "pago" },
    ],
    resumir: async (f, filtro, sessoes) => {
      relogio += opcoes.passoMs ?? 1;
      const dia = f.inicio.toISOString().slice(0, 10);
      pedidosSessao[`${dia}:${filtro}`] = sessoes;
      const falha = opcoes.falharEm;
      if (
        falha &&
        (!falha.filtro || falha.filtro === filtro) &&
        (!falha.dia || f.inicio.toISOString().startsWith(falha.dia))
      ) {
        throw new Error("statement timeout");
      }
      return resumoVazio();
    },
    gravar: async (dia, filtro) => {
      gravados.push(`${dia}:${filtro}`);
    },
  };
  return { d, gravados, pedidosSessao };
}

describe("fecharDias", () => {
  it("grava os três filtros de cada dia, com as sessões compradoras de cada filtro", async () => {
    const { d, gravados, pedidosSessao } = deps();
    const r = await fecharDias(d, ["2026-09-30", "2026-10-01"], 200_000);
    expect(r).toEqual({ feitos: ["2026-09-30", "2026-10-01"], falhas: [], pendentes: [] });
    expect(gravados).toEqual([
      "2026-09-30:todos",
      "2026-09-30:pt",
      "2026-09-30:es",
      "2026-10-01:todos",
      "2026-10-01:pt",
      "2026-10-01:es",
    ]);
    expect(pedidosSessao["2026-09-30:es"]).toEqual(["s2"]);
    expect(pedidosSessao["2026-09-30:pt"]).toEqual(["s1"]);
  });

  it("um dia que falha é registrado e o laço segue pro próximo", async () => {
    const { d, gravados } = deps({ falharEm: { dia: "2026-09-30" } });
    const r = await fecharDias(d, ["2026-09-30", "2026-10-01"], 200_000);
    expect(r.feitos).toEqual(["2026-10-01"]);
    expect(r.falhas).toEqual([{ dia: "2026-09-30", erro: "statement timeout" }]);
    expect(gravados.filter((g) => g.startsWith("2026-09-30"))).toEqual([]);
  });

  it("falha no terceiro filtro deixa o dia incompleto, e ele não conta como feito", async () => {
    const { d, gravados } = deps({ falharEm: { dia: "2026-09-30", filtro: "es" } });
    const r = await fecharDias(d, ["2026-09-30"], 200_000);
    expect(r.feitos).toEqual([]);
    expect(gravados).toEqual(["2026-09-30:todos", "2026-09-30:pt"]);
  });

  it("passado o prazo, não começa dia novo e devolve o resto como pendente", async () => {
    // Cada resumir anda 50 no relógio: 3 filtros = 150 por dia.
    const { d } = deps({ passoMs: 50 });
    const r = await fecharDias(d, ["2026-09-28", "2026-09-29", "2026-09-30"], 200);
    expect(r.feitos).toEqual(["2026-09-28", "2026-09-29"]);
    expect(r.pendentes).toEqual(["2026-09-30"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/painel-fechar.test.ts`
Expected: FAIL — `Failed to resolve import "./painel-fechar"`.

- [ ] **Step 3: Implementar**

`src/lib/painel-fechar.ts`:

```ts
// O LAÇO DO CRON DO RESUMO DIÁRIO.
//
// Separado de `api/painel-resumo.ts` pra poder ser testado: banco e relógio
// entram por `deps`. Sem `@/`, porque o handler em `api/` importa daqui.

import {
  FILTROS,
  limitesDoDia,
  sessoesQueCompraram,
  type EventosResumo,
  type Faixa,
  type FiltroFunil,
  type LeadSessao,
  type PedidoVenda,
} from "./painel-resumo.js";

export type DepsFechamento = {
  lerLeads(f: Faixa): Promise<LeadSessao[]>;
  lerPedidos(f: Faixa): Promise<PedidoVenda[]>;
  resumir(f: Faixa, filtro: FiltroFunil, sessoesVenda: string[]): Promise<EventosResumo>;
  gravar(dia: string, filtro: FiltroFunil, resumo: EventosResumo): Promise<void>;
  agora(): number;
};

export type RelatorioFechamento = {
  feitos: string[];
  falhas: Array<{ dia: string; erro: string }>;
  pendentes: string[];
};

/**
 * Fecha os dias em ordem, os três filtros de cada um.
 *
 * Passado `prazoMs`, não começa dia novo: o próximo ciclo do cron continua dali.
 * Um dia que falha é registrado e o laço segue — um dia ruim não trava a fila.
 * Um dia que falha NO MEIO fica com filtro faltando, e `diasAFazer` o devolve
 * como faltando no ciclo seguinte.
 */
export async function fecharDias(
  deps: DepsFechamento,
  dias: string[],
  prazoMs: number,
): Promise<RelatorioFechamento> {
  const comeco = deps.agora();
  const relatorio: RelatorioFechamento = { feitos: [], falhas: [], pendentes: [] };

  for (let i = 0; i < dias.length; i++) {
    if (deps.agora() - comeco >= prazoMs) {
      relatorio.pendentes = dias.slice(i);
      break;
    }
    const dia = dias[i];
    const faixa = limitesDoDia(dia);
    try {
      const [leads, pedidos] = await Promise.all([deps.lerLeads(faixa), deps.lerPedidos(faixa)]);
      for (const filtro of FILTROS) {
        const resumo = await deps.resumir(
          faixa,
          filtro,
          sessoesQueCompraram(pedidos, leads, filtro),
        );
        await deps.gravar(dia, filtro, resumo);
      }
      relatorio.feitos.push(dia);
    } catch (e) {
      relatorio.falhas.push({ dia, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return relatorio;
}
```

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/lib/painel-fechar.test.ts`
Expected: PASS, 4 testes.

Nota sobre o teste de prazo: o relógio começa em 0. Dia 1 anda até 150, e
150 < 200, então começa o dia 2, que anda até 300; 300 ≥ 200, então o dia 3 fica
pendente. Se o resultado divergir, o erro é do `>=`, não do teste.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/painel-fechar.ts src/lib/painel-fechar.test.ts
npx prettier --check src/lib/painel-fechar.ts src/lib/painel-fechar.test.ts
git add src/lib/painel-fechar.ts src/lib/painel-fechar.test.ts
git commit -m "feat(admin): laco do cron que fecha o resumo diario do funil"
```

---

### Task 7: tabela, handler do cron e `vercel.json`

**Files:**

- Create: `supabase/migrations/20261002010000_painel_eventos_dia.sql`
- Create: `api/painel-resumo.ts`
- Modify: `vercel.json` (`functions` e `crons`)
- Modify: `src/lib/admin-painel-contrato.test.ts`

**Interfaces:**

- Consumes: `fecharDias` (Task 6); `diasAFazer`, `diaBr`, `EventosResumo`, `LinhaResumoDia` (Tasks 4–5); `lerJanela`, `filtroCursor` (Task 1); `segredoConfere` (`api/lib/segredo.js`).
- Produces: endpoint `GET /api/painel-resumo` (Bearer `CRON_SECRET`) → JSON `{ feitos: number, falhas: Array<{dia, erro}>, pendentes: number }`.

- [ ] **Step 1: Teste de contrato**

Acrescentar em `src/lib/admin-painel-contrato.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/admin-painel-contrato.test.ts`
Expected: FAIL — `ENOENT: api/painel-resumo.ts`.

- [ ] **Step 3: Migration**

`supabase/migrations/20261002010000_painel_eventos_dia.sql`:

```sql
-- PAINEL RÁPIDO, PARTE B (02/10/2026): o resumo diário do funil.
--
-- Uma linha por dia (fuso de Brasília) e por filtro de funil, com a saída de
-- `admin_eventos_resumo` pra aquele dia, sem tirar nem pôr. Quem escreve é o
-- cron `api/painel-resumo.ts`, de hora em hora; quem lê é `montarPainel`, que
-- soma os dias fechados e calcula ao vivo só as pontas da janela.
--
-- Só o service_role toca: RLS ligado e nenhuma policy, como o resto do painel.
-- Aplicar na Serenata E na Ballad.

create table if not exists public.painel_eventos_dia (
  dia           date        not null,
  filtro        text        not null check (filtro in ('todos', 'pt', 'es')),
  resumo        jsonb       not null,
  atualizado_em timestamptz not null default now(),
  primary key (dia, filtro)
);

alter table public.painel_eventos_dia enable row level security;
revoke all on table public.painel_eventos_dia from anon, authenticated;
```

- [ ] **Step 4: Handler**

`api/painel-resumo.ts`:

```ts
// O CRON DO RESUMO DIÁRIO DO FUNIL (02/10/2026).
//
// De hora em hora, fecha os dias que faltam em `painel_eventos_dia` e refaz os
// recentes (`diasAFazer`). Depois do deploy, o histórico inteiro se completa
// sozinho em poucas horas, sem script e sem chave na máquina de ninguém.
//
// Roda nos DOIS projetos da Vercel (o `vercel.json` é um só), e cada um
// escreve no próprio banco.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { segredoConfere } from "./lib/segredo.js";
import { filtroCursor, lerJanela } from "../src/lib/ler-janela.js";
import {
  diaBr,
  diasAFazer,
  type EventosResumo,
  type LinhaResumoDia,
} from "../src/lib/painel-resumo.js";
import { fecharDias } from "../src/lib/painel-fechar.js";

/** Depois disso não começa dia novo; a função tem 300s. */
const PRAZO_MS = 200_000;

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function autorizado(req: IncomingMessage): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const cabecalho = String(req.headers.authorization ?? "");
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : cabecalho;
  return segredoConfere(token, esperado);
}

function responder(res: ServerResponse, status: number, corpo: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(corpo));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!autorizado(req)) return responder(res, 401, { erro: "nao autorizado" });

  try {
    const sb = db();

    // O primeiro dia com evento neste banco (Serenata: julho; Ballad: 29/09).
    const { data: primeiro, error: erroPrimeiro } = await sb
      .from("funnel_events")
      .select("created_at")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (erroPrimeiro) throw new Error(erroPrimeiro.message);
    if (!primeiro) return responder(res, 200, { feitos: 0, falhas: [], pendentes: 0 });

    // O que já existe. Mais de 1000 linhas depois de um ano: pagina.
    const linhas: LinhaResumoDia[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb
        .from("painel_eventos_dia")
        .select("dia, filtro, atualizado_em")
        .order("dia")
        .order("filtro")
        .range(de, de + 999);
      if (error) throw new Error(error.message);
      linhas.push(...((data ?? []) as LinhaResumoDia[]));
      if ((data ?? []).length < 1000) break;
    }

    const agora = Date.now();
    const dias = diasAFazer(linhas, diaBr(Date.parse(String(primeiro.created_at))), agora);

    const lerDaJanela =
      <T extends { id: string; created_at: string }>(tabela: string, colunas: string) =>
      (f: { inicio: Date; fim: Date }) =>
        lerJanela<T>(
          ({ desde, ate, cursor, limite }) => {
            const base = sb
              .from(tabela)
              .select(colunas)
              .gte("created_at", desde)
              .lt("created_at", ate);
            const comCursor = cursor ? base.or(filtroCursor(cursor)) : base;
            return comCursor.order("created_at").order("id").limit(limite) as never;
          },
          f.inicio,
          f.fim,
        );

    const relatorio = await fecharDias(
      {
        agora: () => Date.now(),
        lerLeads: lerDaJanela("quiz_responses", "id, session_id, locale, created_at"),
        lerPedidos: lerDaJanela(
          "pedidos",
          "id, quiz_response_id, status, dinheiro_entrou, created_at",
        ),
        resumir: async (f, filtro, sessoesVenda) => {
          const { data, error } = await sb.rpc("admin_eventos_resumo", {
            p_desde: f.inicio.toISOString(),
            p_ate: f.fim.toISOString(),
            p_filtro: filtro,
            p_sessoes_venda: sessoesVenda,
          });
          if (error) throw new Error(error.message);
          return data as EventosResumo;
        },
        gravar: async (dia, filtro, resumo) => {
          const { error } = await sb
            .from("painel_eventos_dia")
            .upsert(
              { dia, filtro, resumo, atualizado_em: new Date().toISOString() },
              { onConflict: "dia,filtro" },
            );
          if (error) throw new Error(error.message);
        },
      },
      dias,
      PRAZO_MS,
    );

    for (const f of relatorio.falhas) console.error(`[painel-resumo] ${f.dia} falhou: ${f.erro}`);
    console.log(
      `[painel-resumo] feitos ${relatorio.feitos.length} · falhas ${relatorio.falhas.length} · pendentes ${relatorio.pendentes.length}`,
    );
    return responder(res, 200, {
      feitos: relatorio.feitos.length,
      falhas: relatorio.falhas,
      pendentes: relatorio.pendentes.length,
    });
  } catch (e) {
    console.error("[painel-resumo] falhou:", e);
    return responder(res, 500, { erro: e instanceof Error ? e.message : String(e) });
  }
}
```

(As linhas de `lerLeads`/`lerPedidos` precisam de `id` e `created_at` no select
porque o cursor anda por eles. `LeadSessao`/`PedidoVenda` ignoram o resto.)

- [ ] **Step 5: `vercel.json`**

Em `functions`, acrescentar:

```json
    "api/painel-resumo.ts": {
      "maxDuration": 300
    }
```

Em `crons`, acrescentar:

```json
{
  "path": "/api/painel-resumo",
  "schedule": "7 * * * *"
}
```

- [ ] **Step 6: Rodar contrato, suíte e tipos**

Run: `npx vitest run src/lib/admin-painel-contrato.test.ts`
Expected: PASS, 7 testes.

Run: `npm run typecheck > /tmp/painel-tipos.txt 2>&1; grep "painel-resumo\|painel-fechar\|ler-janela" /tmp/painel-tipos.txt`
Expected: nada (o `tsconfig.json` inclui `api/**/*.ts`, então o handler é
checado junto).

- [ ] **Step 7: Commit**

```bash
npx prettier --write api/painel-resumo.ts vercel.json src/lib/admin-painel-contrato.test.ts
npx prettier --check api/painel-resumo.ts vercel.json src/lib/admin-painel-contrato.test.ts
git add supabase/migrations/20261002010000_painel_eventos_dia.sql api/painel-resumo.ts vercel.json src/lib/admin-painel-contrato.test.ts
git commit -m "feat(admin): tabela e cron do resumo diario do funil"
```

---

### Task 8: o painel lê o resumo, `?vivo=1` e a nota em Visitantes

**Files:**

- Modify: `src/lib/admin-dados.ts` (`type EventosResumo` ~linha 468; `ArgsPainel` ~linha 574; `pagos` e `sessoesVenda` em `montarPainel` ~linhas 850 e 916–935; o bloco do `rpc` e do `avisoResumo` ~linhas 929–965)
- Modify: `src/routes/admin.tsx` (`validateSearch`, `args`, `janelaKey`, cartão Visitantes ~linha 1037)
- Modify: `src/lib/admin-painel-contrato.test.ts`

**Interfaces:**

- Consumes: `fatiarJanela`, `faixasVivas`, `somarResumos`, `ehVenda`, `sessoesQueCompraram`, tipo `EventosResumo` (Tasks 4–5).
- Produces: `ArgsPainel.vivo?: boolean`; rota `/admin` aceita `?vivo=1`.

- [ ] **Step 1: Teste de contrato**

Acrescentar em `src/lib/admin-painel-contrato.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/admin-painel-contrato.test.ts`
Expected: FAIL nos cinco testes novos.

- [ ] **Step 3: `admin-dados.ts`: tipos, regra de venda, argumentos**

1. Import:

```ts
import {
  ehVenda,
  faixasVivas,
  fatiarJanela,
  sessoesQueCompraram,
  somarResumos,
  type EventosResumo,
} from "@/lib/painel-resumo";
```

2. Apagar o `type EventosResumo = { ... }` local, com o JSDoc dele (agora vem
   de `painel-resumo.ts`, com o mesmo formato).

3. `ArgsPainel` ganha `vivo`:

```ts
type ArgsPainel = {
  dias?: number;
  de?: string;
  ate?: string;
  funil?: FunilFiltro;
  /** `?vivo=1`: ignora o resumo diário e calcula tudo no banco. Auditoria. */
  vivo?: boolean;
};
```

4. `pagos` passa a usar a regra única. A linha

```ts
const pagos = pedidosF.filter((p) => p.status === "pago" && p.dinheiro_entrou !== false);
```

vira

```ts
const pagos = pedidosF.filter(ehVenda);
```

(O comentário de cima, sobre a cortesia de 12/08, continua.) Fazer o mesmo
em `serieAnterior`: `(pedidos ?? []).filter(ehVenda)`.

5. `sessoesVenda` passa a sair de `sessoesQueCompraram`. Trocar o bloco
   `const sessoesVenda = [ ...new Set( pagos.map(...)... ) ];` por:

```ts
const sessoesVenda = sessoesQueCompraram(pedidos, leadsCru, filtro);
```

(É a mesma conta: pedido pago e não cortesia, lead na janela e no filtro.
`painel-resumo.test.ts` cobre os casos.)

- [ ] **Step 4: `admin-dados.ts`: ler o resumo**

Acima de `montarPainel`, nova função:

```ts
/**
 * O RESUMO DE EVENTOS DA JANELA, sem agregar `funnel_events` inteiro.
 *
 * Dia fechado vem de `painel_eventos_dia` (o cron `api/painel-resumo.ts`
 * preenche). As pontas da janela, e qualquer dia que ainda não esteja lá,
 * vão ao vivo para `admin_eventos_resumo`, a MESMA função que o cron usa.
 *
 * Tabela inexistente ou ilegível cai no caminho de antes: tudo ao vivo.
 */
async function lerResumoEventos(
  db: ReturnType<typeof supabaseAdmin>,
  { inicio, fim }: { inicio: Date; fim: Date },
  filtro: FunilFiltro,
  sessoesVenda: string[],
  vivo: boolean,
): Promise<{
  resumo: EventosResumo | null;
  erro: string | null;
  doResumo: number;
  faixas: number;
  faltando: number;
}> {
  const plano = fatiarJanela(inicio, fim, Date.now());
  const prontos = new Map<string, EventosResumo>();

  if (!vivo && plano.dias.length) {
    const { data, error } = await db
      .from("painel_eventos_dia")
      .select("dia, resumo")
      .eq("filtro", filtro)
      .in("dia", plano.dias);
    if (error) console.error("[admin] resumo diário ilegível, indo ao vivo:", error.message);
    for (const linha of data ?? []) prontos.set(String(linha.dia), linha.resumo as EventosResumo);
  }

  const { faixas, faltando } = faixasVivas(plano, new Set(prontos.keys()));
  const vivas = await Promise.all(
    faixas.map((f) =>
      db.rpc("admin_eventos_resumo", {
        p_desde: f.inicio.toISOString(),
        p_ate: f.fim.toISOString(),
        p_filtro: filtro,
        p_sessoes_venda: sessoesVenda,
      }),
    ),
  );
  const falha = vivas.find((v) => v.error);
  const contagem = {
    doResumo: prontos.size,
    faixas: faixas.length,
    faltando: vivo ? 0 : faltando.length,
  };
  if (falha?.error) return { resumo: null, erro: falha.error.message, ...contagem };

  return {
    resumo: somarResumos([...prontos.values(), ...vivas.map((v) => v.data as EventosResumo)]),
    erro: null,
    ...contagem,
  };
}
```

Em `montarPainel`, trocar o `const { data: resumoCru, error: erroResumo } =
await db.rpc("admin_eventos_resumo", {...});` e o bloco do `avisoResumo` até
`const resumo = (resumoCru ?? {}) as EventosResumo;` por:

```ts
const lido = await lerResumoEventos(db, { inicio, fim }, filtro, sessoesVenda, Boolean(data.vivo));
const msEventos = Date.now() - t0 - msLeituras;

// ── QUANDO O RESUMO NÃO VEM ──────────────────────────────────
//
// (O porquê de não lançar continua o de 27/08: tela pendurada é pior que
// zeros E pior que erro. O painel abre com o que tem e diz o que falta.)
const avisos: string[] = [];
if (lido.erro) {
  console.error("[admin] resumo de eventos falhou:", lido.erro);
  avisos.push(
    `Os números de FUNIL (visitantes, passos, taxas) não carregaram nesta janela ` +
      `de ${dias} dias: a consulta passou do tempo no banco. Faturamento, vendas e ` +
      `campanhas abaixo estão corretos. Escolha um período menor para ver o funil.`,
  );
} else if (lido.faltando > 0) {
  avisos.push(
    `${lido.faltando} ${lido.faltando === 1 ? "dia" : "dias"} deste período ainda sem ` +
      `resumo diário: o funil desses dias foi calculado ao vivo.`,
  );
}
const avisoResumo = avisos.length ? avisos.join(" ") : null;
const resumo = (lido.resumo ?? {}) as EventosResumo;
```

E a linha do log (Task 2) passa a contar os dias:

```ts
console.log(
  `[admin] painel ${dias}d ${filtro}: leituras ${msLeituras}ms · eventos ${msEventos}ms ` +
    `(${lido.doResumo} dias do resumo, ${lido.faixas} faixas ao vivo${data.vivo ? ", vivo=1" : ""}) · total ${Date.now() - t0}ms`,
);
```

Apagar a linha `const msEventos = ...` que a Task 2 tinha posto depois do
`rpc` antigo (agora ela está logo depois de `lerResumoEventos`). Conferir que
`inicio` e `fim` são os nomes desestruturados na assinatura de `montarPainel`
(`{ inicio, fim, dias }: Janela`). São.

- [ ] **Step 5: `admin.tsx`: `?vivo=1` e a nota**

1. Em `validateSearch`, depois de `funil`:

```tsx
    // Auditoria do resumo diário: `?vivo=1` calcula o funil inteiro no banco,
    // ignorando `painel_eventos_dia`. Só pra janela curta: em 30 dias ao vivo
    // volta a estourar.
    vivo: z.coerce.number().optional(),
```

2. `const { dias, de, ate, funil, aba } = Route.useSearch();` vira
   `const { dias, de, ate, funil, aba, vivo } = Route.useSearch();`

3. `args` e `janelaKey`:

```tsx
const aoVivo = vivo === 1 ? { vivo: true } : {};
const args = usandoDatas
  ? { de, ate, funil: filtro, ...aoVivo }
  : { dias: periodo, funil: filtro, ...aoVivo };
```

```tsx
const janelaKey = [periodo, de ?? null, ate ?? null, filtro, vivo === 1] as const;
```

4. Cartão Visitantes:

```tsx
<Cartao
  rotulo="Visitantes"
  valor={String(t.visitantes)}
  apoio={
    dados.periodoDias > 1
      ? `${t.quizIniciados} começaram o quiz · somados dia a dia`
      : `${t.quizIniciados} começaram o quiz`
  }
  atual={t.visitantes}
  anterior={a?.visitantes}
/>
```

(Se `dados` não estiver no escopo desse JSX, usar o nome com que o
componente recebe o painel — o mesmo que dá `t = <painel>.topo`.)

- [ ] **Step 6: Rodar contrato, suíte e tipos**

Run: `npx vitest run src/lib/admin-painel-contrato.test.ts`
Expected: PASS, 12 testes.

Run: `npm test > /tmp/painel-suite.txt 2>&1; echo "saida=$?"; tail -15 /tmp/painel-suite.txt`
Expected: verde, exceto o que já falhava antes do plano (nome no ledger).

Run: `npm run typecheck > /tmp/painel-tipos.txt 2>&1; grep "admin-dados\|admin.tsx\|painel-" /tmp/painel-tipos.txt`
Expected: nada.

- [ ] **Step 7: Commit**

```bash
npx prettier --write src/lib/admin-dados.ts src/routes/admin.tsx src/lib/admin-painel-contrato.test.ts
npx prettier --check src/lib/admin-dados.ts src/routes/admin.tsx src/lib/admin-painel-contrato.test.ts
git add src/lib/admin-dados.ts src/routes/admin.tsx src/lib/admin-painel-contrato.test.ts
git commit -m "feat(admin): funil do painel soma o resumo diario e calcula so as pontas ao vivo"
```

---

### Task 9: CLAUDE.md

**Files:**

- Modify: `CLAUDE.md` (nova seção logo depois de "## GA4 (01/10/2026)")

**Interfaces:** nenhuma.

- [ ] **Step 1: Escrever a seção**

```markdown
## Painel rápido (02/10/2026)

O `/admin` parou de abrir até em 7 dias (`statement timeout`). Desenho em
`docs/superpowers/specs/2026-10-02-painel-rapido-design.md`.

- **Leitura por cursor, nunca por OFFSET.** `lerJanela` (`ler-janela.ts`)
  lê em fatias de 1 dia, cada uma por `(created_at, id)`. A paginação antiga
  ordenava a janela inteira por uuid a cada página, 12 páginas de uma vez.
  Tabela nova que o painel leia precisa do índice `(created_at, id)`.
- **O comparativo espera o núcleo** (`isSuccess && !isPlaceholderData`).
  Disparados juntos, 30 dias viravam 60 no banco.
- **O funil vem de `painel_eventos_dia`**, preenchida pelo cron
  `api/painel-resumo.ts` (de hora em hora, nos dois projetos). O resumo é a
  saída de `admin_eventos_resumo` por dia: mexeu na função, os dias antigos
  ficam com a versão velha até alguém apagar as linhas (`delete from
painel_eventos_dia`) e o cron refazer.
- **Visitante é a soma dos dias**, e venda por página de entrada só conta
  compra no mesmo dia da visita. Escrito no cartão.
- **A regra de venda mora em `ehVenda`** (`painel-resumo.ts`). O painel e o
  cron usam a mesma.
- **`?vivo=1`** no `/admin` ignora o resumo. Pra conferir um dia, não pra 30.
- Cada painel loga `[admin] painel …` com os tempos nos logs da Vercel.
```

- [ ] **Step 2: Commit**

```bash
npx prettier --check CLAUDE.md || npx prettier --write CLAUDE.md
git add CLAUDE.md
git commit -m "docs(admin): painel rapido no CLAUDE.md"
```

### ⛔ Ponto de parada: deploy da Parte B

Pedir ao dono, nesta ordem:

1. Colar `supabase/migrations/20261002010000_painel_eventos_dia.sql` no SQL
   Editor da Serenata e no da Ballad.
2. Conferir que `CRON_SECRET` existe no projeto `balladgift` da Vercel. O dono
   confere no painel da Vercel; o valor nunca vem pro chat.
3. OK para `git pull --rebase && git push`. Depois, o `PUT /api/inngest` dos
   dois.
4. Depois de 1–2 horas: `vercel logs` com `grep "\[painel-resumo\]"` deve
   mostrar `feitos N` subindo até `pendentes 0`.
5. O dono abre 7, 30 e 90 dias. O log `[admin] painel` deve mostrar
   `N dias do resumo, ≤2 faixas ao vivo`.
6. O dono abre `?de=<um dia fechado>&ate=<o mesmo dia>` com e sem `&vivo=1`.
   Visitantes, passos e entradas devem bater exatamente: é o mesmo dia, pela
   mesma função.
