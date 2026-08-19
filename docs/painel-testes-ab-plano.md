# Painel de testes A/B — plano de implementação

> **Para quem executa:** use `superpowers:executing-plans` (ou
> `subagent-driven-development`, se o dono autorizar subagentes) pra tocar
> tarefa por tarefa. Os passos usam `- [ ]` pra marcar progresso.

**Objetivo:** tirar a configuração dos experimentos do código e levá-la pro
painel — ligar/desligar, fatia do tráfego que participa, peso de cada versão
e, no experimento de preço, preço e link de checkout de cada versão.

**Arquitetura:** a config vive numa tabela do Supabase e é lida pra um
snapshot em memória do servidor, mantido fresco por um `requestMiddleware` com
*stale-while-revalidate*. `scriptExperimentos()` e `cssExperimentos()`
continuam **síncronas**, lendo o snapshot — o mecanismo de sorteio, provado e
verificado no navegador, não é reescrito. O array em código vira o fallback.

**Stack:** TanStack Start (React 19) + Vite 7 + Tailwind v4 + Supabase.
Vitest entra neste plano, só pra lógica de sorteio.

**Spec:** `docs/painel-testes-ab.md` — leia antes. O plano argumenta a partir
dela.

## Restrições globais

- **Todo experimento no array em código fica `ativo: false`.** Não é higiene,
  é o que mantém o pré-render da home seguro (spec, "A home é pré-renderizada").
  O banco é quem liga.
- **Desligar é sempre a direção segura.** Qualquer falha — banco fora, JSON
  inválido, variante desconhecida — resolve pro controle, nunca pra uma
  variante em teste.
- **Toda trava é revalidada no servidor.** Trava só no front é trava que
  `curl` ignora (CLAUDE.md, erros herdados).
- **A primeira variante da lista é sempre o controle.**
- **`fora` é palavra reservada** pra quem não entrou no teste. Nenhuma
  variante pode se chamar assim.
- Comentários e nomes em português, como o resto do repo. Comentário explica
  **por quê**, não o quê.
- Nada de rodar `prettier --write` em arquivo existente: o repo inteiro
  diverge do prettier e isso produziria diff gigante sem relação com a tarefa.

---

### Task 1: Vitest e o sorteio sob teste

O sorteio é a única peça onde errar custa dinheiro e não dá pra ver olhando a
tela. É o primeiro a ganhar rede.

**A decisão que importa:** o teste avalia a **string de JavaScript que
`scriptExperimentos()` gera de verdade**, num ambiente falso, em vez de testar
uma cópia em TypeScript da mesma lógica. Cópia diverge do original em silêncio,
e aí o teste passa enquanto o site erra.

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/experimentos.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: `scriptExperimentos()`, `cssExperimentos()`, `EXPERIMENTOS` de `src/lib/experimentos.ts` (assinaturas atuais, sem mudança nesta tarefa).
- Produces: o helper de teste `rodarScript(cfgHtml, opcoes)` usado pelas tarefas 4 e 5.

- [ ] **Passo 1: instalar o vitest**

```bash
npm install -D vitest@^3
```

- [ ] **Passo 2: criar `vitest.config.ts`**

```ts
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// SÓ a lógica pura. Nada de jsdom, nada de render de componente: o que este
// projeto precisa cobrir é o sorteio, e o resto continua verificado à mão no
// navegador (que é como a tela foi conferida em 18 e 19/08).
export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Passo 3: acrescentar o script em `package.json`**

Dentro de `"scripts"`, depois de `"typecheck"`:

```json
"test": "vitest run",
```

- [ ] **Passo 4: escrever o teste que falha**

Crie `src/lib/experimentos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scriptExperimentos, cssExperimentos } from "./experimentos";

/**
 * Roda a string que vai de verdade pro <head>, num mundo de mentira.
 *
 * Testar uma cópia em TypeScript da mesma lógica seria mais confortável e
 * mais inútil: a cópia diverge do original em silêncio, e aí o teste passa
 * enquanto o site erra.
 */
export function rodarScript(
  script: string,
  opcoes: { aleatorios: number[]; guardado?: Record<string, string>; busca?: string } = {
    aleatorios: [0.5],
  },
): { atributos: Record<string, string>; guardado: Record<string, string> } {
  const atributos: Record<string, string> = {};
  const guardado: Record<string, string> = { ...(opcoes.guardado ?? {}) };
  let i = 0;

  const contexto = {
    document: {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          atributos[k] = v;
        },
      },
    },
    localStorage: {
      getItem: (k: string) => guardado[k] ?? null,
      setItem: (k: string, v: string) => {
        guardado[k] = v;
      },
    },
    location: { search: opcoes.busca ?? "" },
    Math: { ...Math, random: () => opcoes.aleatorios[i++ % opcoes.aleatorios.length] },
    URLSearchParams,
  };

  const chaves = Object.keys(contexto);
  const valores = Object.values(contexto);
  // eslint-disable-next-line no-new-func
  new Function(...chaves, script)(...valores);
  return { atributos, guardado };
}

import type { ExperimentoConfig } from "./experimentos";

/** Uma config de teste. Todos os casos partem daqui. */
export const cfg = (over: Partial<ExperimentoConfig> = {}): ExperimentoConfig[] => [
  {
    id: "preco",
    ativo: true,
    exposicaoPct: 100,
    nota: "",
    variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 1 }],
    ...over,
  },
];

describe("scriptExperimentos", () => {
  it("config vazia produz script inerte", () => {
    // É o que protege o pré-render da home: no build não existe banco, o
    // fallback tem tudo desligado, e o script congelado no HTML estático não
    // pode sortear ninguém com config velha.
    expect(scriptExperimentos([])).toBe("");
  });

  it("respeita a escolha já guardada no navegador", () => {
    const { atributos } = rodarScript(scriptExperimentos(cfg()), {
      aleatorios: [0.99],
      guardado: { "mp_exp:preco": "A" },
    });
    expect(atributos["data-exp-preco"]).toBe("A");
  });
});
```

- [ ] **Passo 5: rodar e ver falhar**

Run: `npm test`
Expected: FAIL nos dois — `scriptExperimentos` ainda não aceita config, então
nem compila. É a Task 4 que entrega a assinatura.

Os dois testes são escritos contra a assinatura FINAL de propósito: um teste
escrito contra a assinatura velha teria que ser reescrito na Task 4, e teste
reescrito no meio do caminho não prova nada.

- [ ] **Passo 6: commit do arranjo de teste**

```bash
git add vitest.config.ts src/lib/experimentos.test.ts package.json package-lock.json
git commit -m "test: vitest entra, e o sorteio passa a ser testado pela string que vai pro <head>"
```

O teste vermelho fica no repo até a Task 4, que é quem entrega a assinatura
nova. Commitar vermelho aqui é deliberado: separa "montar a rede" de "mudar o
comportamento", e as duas coisas merecem revisão diferente.

---

### Task 2: A tabela e o seed

**Files:**
- Create: `supabase/migrations/20260819000000_experimentos.sql`

**Interfaces:**
- Produces: tabela `public.experimentos` com colunas `id`, `ativo`, `exposicao_pct`, `nota`, `variantes` (jsonb), `atualizado_em`.

- [ ] **Passo 1: escrever a migration**

```sql
-- A CONFIGURAÇÃO DOS TESTES A/B, que até 19/08 morava num array em código.
--
-- Sai do código porque matar um teste ruim não pode depender de deploy. O que
-- NÃO sai é o mecanismo: o sorteio continua sendo o script síncrono no <head>,
-- que só passa a ler daqui.
--
-- ── POR QUE `variantes` É JSONB E NÃO UMA TABELA FILHA ──────────
--
-- A lista é ordenada (a primeira é o controle), é lida sempre inteira, e
-- nunca é consultada por dentro — ninguém vai fazer `where variante = 'B'`.
-- Uma tabela filha custaria um join no caminho mais quente do site pra
-- resolver um problema que não existe.

create table if not exists public.experimentos (
  -- A mesma string do `data-exp-<id>` no <html>. Trocar isto embaralha quem
  -- já foi sorteado com quem chegou agora.
  id text primary key,

  ativo boolean not null default false,

  -- Que fatia das visitas ENTRA no teste. Quem fica fora é carimbado `fora`
  -- e vê o controle — é a linha de referência que serve de canário quando a
  -- base cede por baixo (foi o que matou a leitura do experimento `abertura`).
  exposicao_pct int not null default 100 check (exposicao_pct between 0 and 100),

  -- O que está sendo testado e por quê. Aparece no painel.
  nota text not null default '',

  -- [{ nome, peso, plano? }]. Ordenada: a primeira é SEMPRE o controle.
  -- `plano` só existe em experimento de preço: { texto, valor, ancora, checkout }.
  variantes jsonb not null default '[]'::jsonb,

  atualizado_em timestamptz not null default now()
);

-- SEM POLICY ANON, de propósito. Só o service role lê e escreve, pelas server
-- functions autenticadas com `exigirAdmin()`. A config carrega link de
-- checkout e preço que ainda não foi decidido; nada disso é leitura pública.
alter table public.experimentos enable row level security;

-- O SEED É O QUE JÁ ESTAVA VENDENDO, e entra DESLIGADO.
--
-- Os cinco planos foram conferidos abrindo o checkout em 19/08: o "Total
-- Hoje" de cada tela bate com o `texto` daqui.
insert into public.experimentos (id, ativo, exposicao_pct, nota, variantes)
values (
  'preco',
  false,
  100,
  'Quanto custa a música. A=38 (controle), B=19, C=9, D=29, E=54,90. Receita por lead é o que decide, não conversão: preço mais alto converte pior por definição e ainda pode faturar mais.',
  '[
    {"nome":"A","peso":1,"plano":{"texto":"R$ 38","valor":38,"ancora":"R$ 97","checkout":"https://go.perfectpay.com.br/PPU38CQER4D"}},
    {"nome":"B","peso":1,"plano":{"texto":"R$ 19","valor":19,"ancora":"R$ 97","checkout":"https://go.perfectpay.com.br/PPU38CQFF7H"}},
    {"nome":"C","peso":1,"plano":{"texto":"R$ 9","valor":9,"ancora":"R$ 49,90","checkout":"https://go.perfectpay.com.br/PPU38CQFF7I"}},
    {"nome":"D","peso":1,"plano":{"texto":"R$ 29","valor":29,"ancora":"R$ 97","checkout":"https://go.perfectpay.com.br/PPU38CQFF7J"}},
    {"nome":"E","peso":1,"plano":{"texto":"R$ 54,90","valor":54.9,"ancora":"R$ 97","checkout":"https://go.perfectpay.com.br/PPU38CQFF7K"}}
  ]'::jsonb
)
on conflict (id) do nothing;
```

- [ ] **Passo 2: aplicar no Supabase**

Cole o arquivo no SQL Editor do projeto e rode. Confirme com:

```sql
select id, ativo, exposicao_pct, jsonb_array_length(variantes) from public.experimentos;
```

Expected: uma linha, `preco | false | 100 | 5`.

- [ ] **Passo 3: commit**

```bash
git add supabase/migrations/20260819000000_experimentos.sql
git commit -m "feat: a config dos testes A/B ganha tabela, com o seed desligado"
```

---

### Task 3: O snapshot e o middleware

**Files:**
- Create: `src/lib/experimentos-config.server.ts`
- Modify: `src/start.ts`

**Interfaces:**
- Consumes: `EXPERIMENTOS`, e os tipos `Variante` / `ExperimentoConfig` / `Plano`, todos de `src/lib/experimentos.ts`; `supabaseAdmin()` de `src/lib/supabase-admin.ts`.
- Produces:
  - `configAtual(): ExperimentoConfig[]` — síncrona, lê o snapshot.
  - `garantirConfig(): Promise<void>` — usada pelo middleware.
  - `lerConfigFresca(): Promise<ExperimentoConfig[]>` — ignora o cache; o painel usa.
  - `invalidarConfig(): void` — chamada após salvar.

- [ ] **Passo 1: mover os tipos pra `src/lib/experimentos.ts`**

Os tipos têm que morar no arquivo **sem import de servidor**, senão nasce um
ciclo: `experimentos-config.server.ts` precisa de `EXPERIMENTOS`, e
`experimentos.ts` precisaria do tipo de volta. Pior, `preco.ts` (que roda no
cliente) importa `experimentos.ts` — encostar num `.server.ts` a partir dali é
o caminho pro service role vazar pro bundle.

Acrescente em `src/lib/experimentos.ts`, e **mova `Plano` pra cá**, deixando
`preco.ts` reexportando (`export type { Plano } from "@/lib/experimentos";`)
pra não quebrar quem já importa de lá:

```ts
/** O preço como número, como texto e como link. Um objeto só, de propósito. */
export type Plano = {
  texto: string;
  valor: number;
  ancora: string;
  checkout: string;
};

export type Variante = { nome: string; peso: number; plano?: Plano };

export type ExperimentoConfig = {
  id: string;
  ativo: boolean;
  exposicaoPct: number;
  nota: string;
  variantes: Variante[];
};
```

- [ ] **Passo 2: criar `src/lib/experimentos-config.server.ts`**

```ts
import { EXPERIMENTOS, type ExperimentoConfig, type Variante } from "@/lib/experimentos";
import { supabaseAdmin } from "@/lib/supabase-admin";

// A CONFIGURAÇÃO VIVA DOS EXPERIMENTOS.
//
// `.server.ts` de propósito: importa o cliente com service role, que nunca
// pode entrar no bundle do cliente.
//
// ── POR QUE UM SNAPSHOT E NÃO UMA CONSULTA POR REQUISIÇÃO ────────
//
// `scriptExperimentos()` e `cssExperimentos()` escrevem o <script> e o <style>
// que abrem o <head> de TODA página do site, antes do primeiro pixel, e são
// síncronas. Consultar o banco ali significaria +10 a 20ms em toda visita
// (inclusive a do anúncio, onde velocidade é dinheiro) e faria o Supabase
// virar dependência de o site abrir.
//
// O snapshot troca isso por até 60s de defasagem, que é a decisão registrada
// na spec.

const VALIDADE_MS = 60_000;

/** O que vale quando o banco não respondeu ainda. Tudo desligado. */
function doCodigo(): ExperimentoConfig[] {
  return EXPERIMENTOS.map((e) => ({
    id: e.id,
    ativo: false, // NUNCA true no fallback. Ver restrições globais do plano.
    exposicaoPct: 100,
    nota: e.nota,
    variantes: e.variantes.map((nome, i) => ({ nome, peso: e.peso?.[i] ?? 1 })),
  }));
}

let snapshot: ExperimentoConfig[] | null = null;
let lidoEm = 0;
let emVoo: Promise<void> | null = null;

/** Lê do banco, sem cache. O painel usa isto: quem edita não vê estado velho. */
export async function lerConfigFresca(): Promise<ExperimentoConfig[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("experimentos")
    .select("id, ativo, exposicao_pct, nota, variantes")
    .order("id");
  if (error) throw new Error(`config de experimentos: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    ativo: Boolean(r.ativo),
    exposicaoPct: Number(r.exposicao_pct ?? 100),
    nota: String(r.nota ?? ""),
    variantes: Array.isArray(r.variantes) ? (r.variantes as Variante[]) : [],
  }));
}

async function recarregar(): Promise<void> {
  try {
    const nova = await lerConfigFresca();
    snapshot = nova;
    lidoEm = Date.now();
  } catch (err) {
    // Falhou: o snapshot antigo continua valendo. Ficar sem config seria
    // tirar gente do teste em silêncio, que é pior que dado com 5 min.
    console.error("[experimentos] config não recarregada:", err);
    // Marca a tentativa mesmo assim, pra não martelar o banco a cada visita
    // enquanto ele estiver fora.
    lidoEm = Date.now();
  } finally {
    emVoo = null;
  }
}

/**
 * Garante que existe snapshot. Chamada pelo middleware, antes do render.
 *
 * Espera SÓ na instância fria. Depois disso, uma config velha é devolvida na
 * hora e a releitura acontece por trás — ninguém fica esperando por config.
 */
export async function garantirConfig(): Promise<void> {
  if (!snapshot) {
    emVoo = emVoo ?? recarregar();
    await emVoo;
    return;
  }
  if (Date.now() - lidoEm > VALIDADE_MS) {
    emVoo = emVoo ?? recarregar();
    // sem await: stale-while-revalidate
  }
}

/** O snapshot. Síncrona de propósito — é o que o <head> chama. */
export function configAtual(): ExperimentoConfig[] {
  return snapshot ?? doCodigo();
}

/** Depois de salvar no painel: a próxima visita já lê o novo. */
export function invalidarConfig(): void {
  lidoEm = 0;
}
```

- [ ] **Passo 3: pendurar no middleware, em `src/start.ts`**

Acrescente **antes** de `export const startInstance`:

```ts
// A CONFIG DOS EXPERIMENTOS, garantida antes de qualquer render.
//
// Roda em toda requisição e quase sempre não faz nada: só quando o snapshot
// está velho é que dispara a releitura, e mesmo aí sem esperar. A única
// espera é na instância fria, uma vez.
//
// Vem DEPOIS do errorMiddleware na lista: se a leitura da config explodir de
// um jeito não previsto, a página de erro ainda aparece.
const configMiddleware = createMiddleware().server(async ({ next }) => {
  const { garantirConfig } = await import("./lib/experimentos-config.server");
  await garantirConfig();
  return next();
});
```

E troque a lista:

```ts
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, configMiddleware],
}));
```

- [ ] **Passo 4: conferir que o site sobe**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erro. O `[prerender]` deve continuar imprimindo `- /`.

- [ ] **Passo 5: commit**

```bash
git add src/lib/experimentos.ts src/lib/preco.ts src/lib/experimentos-config.server.ts src/start.ts
git commit -m "feat: a config dos experimentos vira snapshot em memoria, garantido antes do render"
```

---

### Task 4: O sorteio passa a receber config, e ganha exposição

**Files:**
- Modify: `src/lib/experimentos.ts`
- Modify: `src/routes/__root.tsx:125-126`
- Modify: `src/lib/experimentos.test.ts`
- Modify: `vite.config.ts` (só um comentário de aviso)

**Interfaces:**
- Consumes: `ExperimentoConfig`, `configAtual()` da Task 3.
- Produces:
  - `scriptExperimentos(cfg: ExperimentoConfig[]): string`
  - `cssExperimentos(cfg: ExperimentoConfig[]): string`
  - `FORA = "fora"` exportada.

- [ ] **Passo 1: escrever os testes que faltam**

Acrescente em `src/lib/experimentos.test.ts`, dentro do `describe`:

O helper `cfg()` já existe no arquivo, criado na Task 1.

```ts
it("divide pelo peso", () => {
  // 0.2 do total 2 cai na primeira fatia; 0.9 na segunda.
  expect(rodarScript(scriptExperimentos(cfg()), { aleatorios: [0.2] }).atributos["data-exp-preco"]).toBe("A");
  expect(rodarScript(scriptExperimentos(cfg()), { aleatorios: [0.9] }).atributos["data-exp-preco"]).toBe("B");
});

it("peso desigual é respeitado", () => {
  const c = cfg({ variantes: [{ nome: "A", peso: 9 }, { nome: "B", peso: 1 }] });
  expect(rodarScript(scriptExperimentos(c), { aleatorios: [0.85] }).atributos["data-exp-preco"]).toBe("A");
  expect(rodarScript(scriptExperimentos(c), { aleatorios: [0.95] }).atributos["data-exp-preco"]).toBe("B");
});

it("exposição de 0% joga todo mundo pra fora", () => {
  const c = cfg({ exposicaoPct: 0 });
  expect(rodarScript(scriptExperimentos(c), { aleatorios: [0.01, 0.5] }).atributos["data-exp-preco"]).toBe("fora");
});

it("exposição de 100% nunca produz `fora`", () => {
  for (const r of [0.001, 0.5, 0.999]) {
    const v = rodarScript(scriptExperimentos(cfg()), { aleatorios: [r, r] }).atributos["data-exp-preco"];
    expect(v).not.toBe("fora");
  }
});

it("exposição parcial separa quem entra de quem fica fora", () => {
  const c = cfg({ exposicaoPct: 30 });
  // primeiro sorteio = exposição; 0.1 < 0.30 entra, 0.9 fica fora
  expect(rodarScript(scriptExperimentos(c), { aleatorios: [0.1, 0.2] }).atributos["data-exp-preco"]).toBe("A");
  expect(rodarScript(scriptExperimentos(c), { aleatorios: [0.9, 0.2] }).atributos["data-exp-preco"]).toBe("fora");
});

it("experimento desligado não carimba", () => {
  expect(rodarScript(scriptExperimentos(cfg({ ativo: false })), { aleatorios: [0.5] }).atributos).toEqual({});
});

it("?exp= força a variante", () => {
  const r = rodarScript(scriptExperimentos(cfg()), { aleatorios: [0.1], busca: "?exp=preco:b" });
  expect(r.atributos["data-exp-preco"]).toBe("B");
  expect(r.guardado["mp_exp:preco"]).toBe("B");
});
```

E os testes do CSS (fora do `describe` de cima):

```ts
describe("cssExperimentos", () => {
  it("esconde toda variante e revela `fora` como controle", () => {
    const css = cssExperimentos(cfg({ exposicaoPct: 30 }));
    expect(css).toContain('[data-v="preco:A"],[data-v="preco:B"]{display:none}');
    expect(css).toContain('html[data-exp-preco="fora"] [data-v="preco:A"]{display:contents}');
  });

  it("desligado deixa só o controle visível", () => {
    const css = cssExperimentos(cfg({ ativo: false }));
    expect(css).toContain('[data-v="preco:A"]{display:contents}');
    expect(css).not.toContain('html[data-exp-preco="B"]');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test`
Expected: FAIL — as funções ainda não aceitam config nem conhecem `fora`.

- [ ] **Passo 3: mudar `scriptExperimentos` e `cssExperimentos`**

Em `src/lib/experimentos.ts`:

Acrescente perto do topo, depois de `const CHAVE = "mp_exp:";`:

```ts
/**
 * Quem não entrou no teste.
 *
 * É carimbada como qualquer variante, e por isso vira linha própria no painel
 * sem nenhuma agregação nova. Serve de canário: se o controle DENTRO do teste
 * se comporta muito diferente de quem está fora, o problema não é a variante,
 * é a tela quebrada embaixo dela. Foi exatamente isso que impediu de ler o
 * experimento `abertura`.
 */
export const FORA = "fora";
```

Troque a assinatura e o corpo de `scriptExperimentos` para receber a config e
sortear a exposição antes do peso:

```ts
export function scriptExperimentos(cfg: ExperimentoConfig[]): string {
  const ativos = cfg.filter((e) => e.ativo && e.variantes.length > 0);
  if (!ativos.length) return "";
  const compacto = ativos.map((e) => ({
    id: e.id,
    v: e.variantes.map((v) => v.nome),
    p: e.variantes.map((v) => v.peso || 1),
    x: e.exposicaoPct,
  }));
  return `(function(){try{
var C=${JSON.stringify(compacto)},D=document.documentElement,U=new URLSearchParams(location.search),F=U.get("exp")||"";
for(var i=0;i<C.length;i++){var e=C[i],k="${CHAVE}"+e.id,v=null;
var m=F.split(",").map(function(s){return s.trim()}).filter(function(s){return s.indexOf(e.id+":")===0});
if(m.length){var f=m[0].split(":")[1];if(String(f).toLowerCase()==="${FORA}")v="${FORA}";for(var j=0;j<e.v.length;j++){if(e.v[j].toLowerCase()===String(f).toLowerCase())v=e.v[j];}}
if(!v){try{var s=localStorage.getItem(k);if(s==="${FORA}"||e.v.indexOf(s)>=0)v=s;}catch(_){}}
if(!v&&Math.random()*100>=e.x){v="${FORA}";}
if(!v){var t=0;for(var j=0;j<e.p.length;j++)t+=e.p[j];var r=Math.random()*t,a=0;v=e.v[0];
for(var j=0;j<e.v.length;j++){a+=e.p[j];if(r<a){v=e.v[j];break;}}}
try{localStorage.setItem(k,v);}catch(_){}
D.setAttribute("data-exp-"+e.id,v);}
}catch(_){}})();`;
}
```

Nota sobre a ordem: a exposição é sorteada **depois** de `?exp=` e do que está
guardado. Quem já foi sorteado nunca é reclassificado, e forçar variante pra
testar continua funcionando mesmo com exposição baixa.

Troque `cssExperimentos`:

```ts
export function cssExperimentos(cfg: ExperimentoConfig[]): string {
  const linhas: string[] = [];
  // TODOS os experimentos, não só os ativos. Descoberto do jeito ruim em
  // 10/08: ao desligar um experimento, as regras dele sumiam do CSS, e o
  // bloco da variante ficava SEM nenhuma regra de `display:none` — ou seja,
  // desligar publicava a variante pra 100% do tráfego.
  for (const e of cfg) {
    if (!e.variantes.length) continue;
    const nomes = e.variantes.map((v) => v.nome);
    const controle = nomes[0];
    linhas.push(nomes.map((v) => `[data-v="${e.id}:${v}"]`).join(",") + "{display:none}");

    if (!e.ativo) {
      linhas.push(`[data-v="${e.id}:${controle}"]{display:contents}`);
      continue;
    }
    for (const v of nomes) {
      linhas.push(`html[${atributoDe(e.id)}="${v}"] [data-v="${e.id}:${v}"]{display:contents}`);
    }
    // Quem ficou de fora do teste vê o CONTROLE. Sem esta regra, a tela dele
    // sairia sem preço nenhum.
    linhas.push(`html[${atributoDe(e.id)}="${FORA}"] [data-v="${e.id}:${controle}"]{display:contents}`);
    linhas.push(`html:not([${atributoDe(e.id)}]) [data-v="${e.id}:${controle}"]{display:contents}`);
  }
  return linhas.join("");
}
```

Marque `EXPERIMENTOS` como fallback, trocando o comentário do array:

```ts
/**
 * O CHÃO, não a verdade.
 *
 * A configuração viva mora na tabela `experimentos` e chega pelo snapshot
 * (`experimentos-config.server.ts`). Este array é o que vale quando o banco
 * não respondeu — e, por isso, TUDO AQUI FICA `ativo: false`. É também o que
 * mantém o pré-render da home seguro: no build não existe banco, então o
 * script pré-renderizado nasce inerte e o sorteio acontece em /criar.
 */
```

- [ ] **Passo 4: passar a config no `__root.tsx`**

Troque as duas linhas (hoje 125-126):

```tsx
        <script dangerouslySetInnerHTML={{ __html: scriptExperimentos(configAtual()) }} />
        <style dangerouslySetInnerHTML={{ __html: cssExperimentos(configAtual()) }} />
```

E o import, no topo:

```tsx
import { scriptExperimentos, cssExperimentos } from "@/lib/experimentos";
import { configAtual } from "@/lib/experimentos-config.server";
```

- [ ] **Passo 5: tirar o `abertura` do array**

Ele não tem mais onde renderizar: o bloco `AberturaProva` saiu do `Quiz.tsx`
quando a tela de abertura entrou. Deixá-lo no fallback faria o painel listar um
experimento que sorteia gente e não muda nada na tela — e a spec chama isso de
"botão que mente".

Apague o objeto `{ id: "abertura", ... }` de `EXPERIMENTOS`, deixando o array
só com `preco`. Nada mais precisa mudar: a migration da Task 2 já não semeou
`abertura`, e `porExperimento` (Task 6) percorre a config do banco.

- [ ] **Passo 6: avisar no `vite.config.ts`**

Acrescente ao comentário do bloco `prerender`, depois da linha do `filter`:

```ts
      //
      // ATENÇÃO, TESTE A/B: o <script> de sorteio da home fica CONGELADO
      // neste HTML, com a config que existia no build. Funciona porque o
      // array de fallback tem tudo desligado, então o script pré-renderizado
      // nasce inerte e quem chega é sorteado em /criar (que é SSR). No dia em
      // que a home ganhar conteúdo de variante, tire "/" daqui — senão o
      // teste falha em silêncio. Ver docs/painel-testes-ab.md.
```

- [ ] **Passo 7: rodar os testes**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: todos passam; o build imprime `[prerender] - /`.

- [ ] **Passo 8: conferir no navegador**

Suba o preview (`preview_start` com a config `serenata`), ligue o experimento
no banco (`update experimentos set ativo = true where id = 'preco'`), espere
60s ou reinicie o dev server, e abra:

- `/criar?step=oferta&exp=preco:C` → tela mostra R$ 9, barra mostra R$ 9.
- `/criar?step=oferta&exp=preco:fora` → tela mostra R$ 38 (o controle).
- No console: `JSON.parse(localStorage.mp_attribution).exp` → `{preco:"fora"}`.

Depois: `update experimentos set ativo = false where id = 'preco'`.

- [ ] **Passo 9: commit**

```bash
git add src/lib/experimentos.ts src/lib/experimentos.test.ts src/routes/__root.tsx vite.config.ts
git commit -m "feat: o sorteio le a config do banco e ganha fatia de exposicao"
```

---

### Task 5: O plano chega no navegador pela config

**Files:**
- Modify: `src/lib/experimentos.ts` (o script escreve `window.__SRN_EXP__`)
- Modify: `src/lib/preco.ts`
- Create: `src/lib/preco.test.ts`

**Interfaces:**
- Consumes: `FORA`, `scriptExperimentos` da Task 4.
- Produces: `planosDoNavegador(): Record<string, Record<string, Plano>> | null` em `preco.ts`; `PLANOS` continua exportado como fallback.

- [ ] **Passo 1: escrever o teste**

Crie `src/lib/preco.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { planoDe, PLANOS } from "./preco";

declare global {
  // eslint-disable-next-line no-var
  var __SRN_EXP__: unknown;
}

describe("planoDe", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__SRN_EXP__;
  });

  it("cai no catálogo do código quando não há config no navegador", () => {
    expect(planoDe("pt", "A").checkout).toBe(PLANOS.pt.A.checkout);
  });

  it("prefere o plano que veio do servidor", () => {
    (globalThis as Record<string, unknown>).__SRN_EXP__ = {
      preco: {
        variantes: [
          { nome: "A", plano: { texto: "R$ 41", valor: 41, ancora: "R$ 97", checkout: "https://exemplo/A41" } },
        ],
      },
    };
    expect(planoDe("pt", "A").texto).toBe("R$ 41");
    expect(planoDe("pt", "A").checkout).toBe("https://exemplo/A41");
  });

  it("variante sem plano na config cai no controle, nunca em preço vazio", () => {
    (globalThis as Record<string, unknown>).__SRN_EXP__ = {
      preco: { variantes: [{ nome: "A", plano: PLANOS.pt.A }] },
    };
    expect(planoDe("pt", "Z").texto).toBe(PLANOS.pt.A.texto);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npm test -- preco`
Expected: FAIL no segundo e terceiro testes — `planoDe` ainda só olha o código.

- [ ] **Passo 3: o script publica a config**

Em `scriptExperimentos`, dentro do `compacto`, acrescente os planos, e escreva
no `window` antes do laço. Troque o `compacto` e a primeira linha do corpo:

```ts
  const compacto = ativos.map((e) => ({
    id: e.id,
    v: e.variantes.map((v) => v.nome),
    p: e.variantes.map((v) => v.peso || 1),
    x: e.exposicaoPct,
    // O PLANO VIAJA JUNTO, e não numa requisição à parte: a tela precisa do
    // preço e o handler precisa do link, os dois no navegador. Como este
    // script já está no <head>, é ida zero.
    //
    // Só experimento ATIVO chega aqui (o filtro acima). Preço que ainda não
    // foi decidido não fica no fonte da página de todo visitante.
    n: e.variantes.map((v) => v.plano ?? null),
  }));
```

E logo depois de `var C=...`:

```
W.__SRN_EXP__={};for(var q=0;q<C.length;q++){W.__SRN_EXP__[C[q].id]={variantes:C[q].v.map(function(nm,ix){return {nome:nm,plano:C[q].n[ix]}})}}
```

declarando `W` junto: `var C=...,W=window,D=document.documentElement,...`.

- [ ] **Passo 4: `preco.ts` lê da config**

Acrescente antes de `planoControle`:

```ts
type ConfigNavegador = Record<string, { variantes: Array<{ nome: string; plano: Plano | null }> }>;

/**
 * Os planos que o servidor publicou no `<head>`.
 *
 * Existe porque a config passou a viver no banco: o catálogo em código não
 * sabe mais o preço de hoje. Devolve `null` no servidor e quando o
 * experimento está desligado — nos dois casos o catálogo em código é a
 * resposta certa, porque ele É o controle.
 */
function planosDoNavegador(): Record<string, Plano> | null {
  const w = globalThis as unknown as { __SRN_EXP__?: ConfigNavegador };
  const exp = w.__SRN_EXP__?.[EXP_PRECO];
  if (!exp?.variantes?.length) return null;
  const out: Record<string, Plano> = {};
  for (const v of exp.variantes) if (v.plano) out[v.nome] = v.plano;
  return Object.keys(out).length ? out : null;
}
```

Troque `planoDe` e `planoControle` para consultarem primeiro:

```ts
export function planoControle(locale: Locale = LOCALE_PADRAO): Plano {
  if (locale === "pt") {
    const daConfig = planosDoNavegador();
    // A primeira variante da config é sempre o controle.
    if (daConfig) return Object.values(daConfig)[0] ?? PLANOS.pt.A;
  }
  return (PLANOS[locale] ?? PLANOS.pt).A;
}

export function planoDe(locale: Locale, variante: string): Plano {
  if (locale === "pt") {
    const daConfig = planosDoNavegador();
    if (daConfig) return daConfig[variante] ?? planoControle(locale);
  }
  const doIdioma = PLANOS[locale] ?? PLANOS.pt;
  return doIdioma[variante] ?? doIdioma.A;
}
```

E `variantesComPlano`:

```ts
export function variantesComPlano(locale: Locale): string[] {
  if (locale === "pt") {
    const daConfig = planosDoNavegador();
    if (daConfig) return Object.keys(daConfig);
  }
  const planos = PLANOS[locale] ?? PLANOS.pt;
  const exp = EXPERIMENTOS.find((e) => e.id === EXP_PRECO);
  if (!exp) return ["A"];
  return exp.variantes.filter((v) => planos[v]);
}
```

- [ ] **Passo 5: rodar tudo**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: verde.

- [ ] **Passo 6: conferir no navegador**

Com o experimento ligado no banco, abra `/criar?step=oferta` e no console:

```js
JSON.stringify(window.__SRN_EXP__.preco.variantes.map(v => [v.nome, v.plano?.texto]))
```

Expected: `[["A","R$ 38"],["B","R$ 19"],["C","R$ 9"],["D","R$ 29"],["E","R$ 54,90"]]`

Depois mude um preço direto no banco, espere 60s, recarregue, e confirme que a
tela mudou sem deploy. É o teste que prova o objetivo do plano inteiro.

- [ ] **Passo 7: commit**

```bash
git add src/lib/experimentos.ts src/lib/preco.ts src/lib/preco.test.ts
git commit -m "feat: o preco e o link da tela passam a vir da config, sem requisicao nova"
```

---

### Task 6: O painel lê a config, e ganha a linha `fora`

**Files:**
- Modify: `src/lib/admin-dados.ts:884-...` (o bloco `porExperimento`) e o tipo `Painel`

**Interfaces:**
- Consumes: `lerConfigFresca()` da Task 3, `FORA` da Task 4 (importe de `@/lib/experimentos`).
- Produces: `Painel["porExperimento"]` com os campos novos `exposicaoPct`, `ehFora`, `variacaoVsControlePct`.

- [ ] **Passo 1: acrescentar os campos no tipo**

Dentro de `porExperimento`, no tipo `Painel`, acrescente ao objeto externo:

```ts
    /** Que fatia das visitas está entrando no teste. */
    exposicaoPct: number;
```

E dentro de cada variante:

```ts
      /** A linha de quem NÃO entrou no teste. Referência, não concorrente. */
      ehFora: boolean;
      /**
       * Quanto a receita por lead desta versão está acima ou abaixo do
       * controle, em %. É a leitura do teste em um número.
       *
       * `null` no próprio controle e quando o controle não tem lead — dividir
       * por zero produziria "∞% melhor", que é o tipo de número que faz
       * alguém trocar o preço do site inteiro por causa de uma venda.
       */
      variacaoVsControlePct: number | null;
```

- [ ] **Passo 2: trocar a fonte e acrescentar `fora`**

Antes do bloco `const porExperimento`, leia a config:

```ts
    // A CONFIGURAÇÃO VEM DO BANCO, não do array em código. Sem isto, uma
    // versão criada pelo painel não teria linha na tabela de resultado — o
    // painel deixaria criar algo que ele mesmo não sabe mostrar.
    const { lerConfigFresca } = await import("@/lib/experimentos-config.server");
    const configExp = await lerConfigFresca().catch((err) => {
      console.error("[admin] config de experimentos nao lida:", err);
      return [] as Awaited<ReturnType<typeof lerConfigFresca>>;
    });
```

Troque `EXPERIMENTOS.map((exp) => {` por `configExp.map((exp) => {` e o bloco
final do `map` por:

```ts
      const nomes = exp.variantes.map((v) => v.nome);
      const controleNome = nomes[0];
      const doControle = porVariante.get(controleNome);
      const rplControle = doControle?.leads ? doControle.receitaBrl / doControle.leads : 0;

      const montar = (v: string, ehFora: boolean) => {
        const d = porVariante.get(v)!;
        const rpl = d.leads ? d.receitaBrl / d.leads : 0;
        return {
          variante: v,
          controle: !ehFora && v === controleNome,
          ehFora,
          ...d,
          conversaoPct: pct(d.vendas, d.leads),
          receitaPorLeadBrl: rpl,
          variacaoVsControlePct:
            ehFora || v === controleNome || !rplControle ? null : ((rpl - rplControle) / rplControle) * 100,
        };
      };

      return {
        id: exp.id,
        nota: exp.nota,
        ativo: exp.ativo,
        exposicaoPct: exp.exposicaoPct,
        // A ORDEM É A DA CONFIGURAÇÃO, não a do resultado: o controle sempre
        // em cima, pra leitura ser sempre "B contra A". `fora` vai por último
        // e separada, porque não é uma versão em disputa.
        variantes: [
          ...nomes.filter((v) => porVariante.has(v)).map((v) => montar(v, false)),
          ...(porVariante.has(FORA) ? [montar(FORA, true)] : []),
        ],
      };
```

- [ ] **Passo 3: conferir**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erro.

- [ ] **Passo 4: commit**

```bash
git add src/lib/admin-dados.ts
git commit -m "feat: o resultado do teste sai da config do banco, com linha fora e variacao vs controle"
```

---

### Task 7: As server functions do painel

**Files:**
- Create: `src/lib/admin-experimentos.ts`

**Interfaces:**
- Consumes: `lerConfigFresca`, `invalidarConfig` da Task 3.
- Produces:
  - `carregarExperimentos()` → `Promise<ExperimentoConfig[]>`
  - `salvarExperimento({ id, ativo, exposicaoPct, nota, variantes })` → `Promise<{ ok: boolean; erro?: string }>`

- [ ] **Passo 1: criar o arquivo**

```ts
import { createServerFn } from "@tanstack/react-start";
import type { ExperimentoConfig, Variante } from "@/lib/experimentos";
import { supabaseAdmin } from "@/lib/supabase-admin";

// AS DUAS FUNÇÕES QUE O PAINEL USA.
//
// Separadas de `admin-dados.ts` de propósito: aquilo é leitura pesada de
// funil, isto é escrita de configuração. Misturar faria a tela de config
// carregar 180 mil eventos pra salvar um checkbox.

/** Lê SEM cache: quem está editando não pode ver estado velho. */
export const carregarExperimentos = createServerFn({ method: "POST" }).handler(
  async (): Promise<ExperimentoConfig[]> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const { lerConfigFresca } = await import("@/lib/experimentos-config.server");
    return lerConfigFresca();
  },
);

type Args = {
  id: string;
  ativo: boolean;
  exposicaoPct: number;
  nota: string;
  variantes: Variante[];
};

/**
 * Salva um experimento, com as travas que impedem estrago de um clique.
 *
 * TODAS as travas são revalidadas AQUI, contra o estado do banco, e não
 * confiam em nada que o navegador mandou. Trava só na tela é trava que `curl`
 * ignora — é um dos erros herdados listados no CLAUDE.md.
 */
export const salvarExperimento = createServerFn({ method: "POST" })
  .validator((data: Args) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; erro?: string }> => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const { invalidarConfig } = await import("@/lib/experimentos-config.server");
    const db = supabaseAdmin();

    const { data: atual } = await db
      .from("experimentos")
      .select("ativo, variantes")
      .eq("id", data.id)
      .maybeSingle();
    if (!atual) return { ok: false, erro: "experimento não existe" };

    const novas = data.variantes;
    if (!novas.length) return { ok: false, erro: "precisa de pelo menos uma versão" };
    if (novas.some((v) => v.nome === "fora")) {
      return { ok: false, erro: "`fora` é reservado pra quem não entra no teste" };
    }
    if (new Set(novas.map((v) => v.nome)).size !== novas.length) {
      return { ok: false, erro: "duas versões com o mesmo nome" };
    }

    // TRAVA 1 — preço e link são só-leitura enquanto o teste está no ar.
    //
    // Quem já foi sorteada pro B tem o preço antigo gravado no navegador. Ela
    // volta, lê outro, e os dois preços ficam embaixo do mesmo rótulo. A
    // comparação é contra o `ativo` DO BANCO, não contra o que veio na
    // requisição — senão bastaria mandar `ativo:false` junto pra furar.
    if (atual.ativo) {
      const antes = JSON.stringify(
        ((atual.variantes ?? []) as Variante[]).map((v) => [v.nome, v.plano ?? null]),
      );
      const depois = JSON.stringify(novas.map((v) => [v.nome, v.plano ?? null]));
      if (antes !== depois) {
        return {
          ok: false,
          erro: "desligue o teste pra mexer em preço, link ou nome de versão",
        };
      }
    }

    // TRAVA 2 — não liga com duas versões dividindo o mesmo checkout.
    //
    // É o defeito que o teste de preço inteiro existe pra impedir: a tela diz
    // um número e o caixa cobra outro.
    if (data.ativo) {
      const links = novas.map((v) => v.plano?.checkout).filter(Boolean);
      if (links.length !== new Set(links).size) {
        return { ok: false, erro: "duas versões apontam pro mesmo link de checkout" };
      }
      // TRAVA 3 — versão sem plano completo não entra no ar.
      const incompleta = novas.find(
        (v) => !v.plano?.checkout || !v.plano?.texto || !Number.isFinite(v.plano?.valor),
      );
      if (incompleta) {
        return { ok: false, erro: `a versão ${incompleta.nome} está sem preço ou link` };
      }
    }

    const exposicao = Math.max(0, Math.min(100, Math.round(data.exposicaoPct)));
    const { error } = await db
      .from("experimentos")
      .update({
        ativo: data.ativo,
        exposicao_pct: exposicao,
        nota: data.nota,
        variantes: novas.map((v) => ({ ...v, peso: Math.max(0, Number(v.peso) || 0) })),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) return { ok: false, erro: error.message };

    invalidarConfig();
    return { ok: true };
  });
```

- [ ] **Passo 2: conferir**

Run: `npx tsc --noEmit`
Expected: sem erro.

- [ ] **Passo 3: commit**

```bash
git add src/lib/admin-experimentos.ts
git commit -m "feat: server functions do painel de testes, com as travas no servidor"
```

---

### Task 8: A aba

**Files:**
- Create: `src/components/admin/AbaTestes.tsx`
- Modify: `src/routes/admin.tsx` (search schema, navegação, render)

**Interfaces:**
- Consumes: `carregarExperimentos`, `salvarExperimento` da Task 7; `Painel["porExperimento"]` da Task 6.
- Produces: `<AbaTestes resultados={dados.porExperimento} />`

- [ ] **Passo 1: a aba na URL**

Em `src/routes/admin.tsx`, no `validateSearch`, acrescente:

```ts
    aba: z.enum(["operacao", "testes"]).optional(),
```

- [ ] **Passo 2: a navegação**

Logo abaixo do cabeçalho do painel (antes do primeiro `<Secao>`), acrescente:

```tsx
      {/* AS ABAS na URL, como `dias` e `funil` já estão: reload e botão voltar
          funcionam, e dá pra mandar o link direto pra alguém. */}
      <div className="flex gap-1 rounded-full border border-[var(--tinta-fraca)]/40 p-1 text-sm">
        {([
          ["operacao", "Operação"],
          ["testes", "Testes A/B"],
        ] as const).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => navigate({ search: (s) => ({ ...s, aba: id }) as never })}
            className={cn(
              "rounded-full px-4 py-1.5 transition-colors",
              (aba ?? "operacao") === id
                ? "bg-[var(--acento)] text-white"
                : "text-[var(--tinta-suave)] hover:text-[var(--tinta)]",
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>
```

Leia `aba` junto dos outros: `const { dias, de, ate, funil, aba } = Route.useSearch();`

- [ ] **Passo 3: separar o conteúdo**

Envolva as `<Secao>` que existem hoje (da primeira até a de custos) em:

Concretamente: hoje o corpo do painel é uma sequência de `<Secao>` — os
cartões do topo, "Onde a pessoa desiste" (o funil), "Testes A/B", "De onde vêm
as vendas", "Vendas", "A máquina", os custos e os gastos. **Corte a `<Secao
titulo="Testes A/B">` inteira** (ela vira o componente novo) e envolva
**todas as outras**, na ordem em que já estão, no bloco condicional:

```tsx
      {(aba ?? "operacao") === "operacao" && (
        <>
          {/* da primeira <Secao> até a última, sem reordenar nem reescrever
              nenhuma: a aba é um envelope, não uma reforma. */}
        </>
      )}

      {aba === "testes" && <AbaTestes resultados={dados.porExperimento} />}
```

Conferência deste passo: `git diff --stat src/routes/admin.tsx` tem que
mostrar quase só indentação mudando, fora o bloco de Testes A/B que saiu. Se
aparecer mudança de conteúdo em alguma seção, algo foi reescrito sem querer.

- [ ] **Passo 4: o componente**

Crie `src/components/admin/AbaTestes.tsx`. O componente carrega a config
própria no mount (`carregarExperimentos`), guarda um rascunho por experimento,
e só grava quando clica em salvar.

```tsx
import { useEffect, useState } from "react";
import { carregarExperimentos, salvarExperimento } from "@/lib/admin-experimentos";
import type { ExperimentoConfig } from "@/lib/experimentos";
import type { Painel } from "@/lib/admin-dados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A ABA DE TESTES A/B.
//
// Os RESULTADOS vêm de fora, do painel que já carregou (`porExperimento`):
// aquela consulta já estourou o tempo uma vez com 180 mil eventos e não vai
// ganhar trabalho. A CONFIG é carregada aqui, sozinha e sem cache — quem
// edita não pode ver estado velho.
//
// SEM AUTOSAVE. Um clique errado num campo de preço que está vendendo é caro
// demais pra salvar sozinho.

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export function AbaTestes({ resultados }: { resultados: Painel["porExperimento"] }) {
  const [config, setConfig] = useState<ExperimentoConfig[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarExperimentos()
      .then(setConfig)
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)));
  }, []);

  if (erro) return <p className="text-sm text-amber-800">Config não carregou: {erro}</p>;
  if (!config) return <p className="text-sm text-[var(--tinta-suave)]">Carregando…</p>;

  return (
    <div className="space-y-8">
      {config.map((exp) => (
        <CartaoExperimento
          key={exp.id}
          exp={exp}
          resultado={resultados.find((r) => r.id === exp.id)}
          aoSalvar={(novo) =>
            setConfig((c) => (c ?? []).map((e) => (e.id === novo.id ? novo : e)))
          }
        />
      ))}
    </div>
  );
}
```

Continue no mesmo arquivo com `CartaoExperimento`, que renderiza as três
faixas descritas na spec:

```tsx
function CartaoExperimento({
  exp,
  resultado,
  aoSalvar,
}: {
  exp: ExperimentoConfig;
  resultado?: Painel["porExperimento"][number];
  aoSalvar: (e: ExperimentoConfig) => void;
}) {
  const [rascunho, setRascunho] = useState(exp);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Travado enquanto NO AR. A tela repete a trava do servidor pra a pessoa
  // entender por que não consegue digitar, não pra impedir: quem impede é o
  // servidor (ver `salvarExperimento`).
  const travado = exp.ativo;

  async function salvar() {
    setSalvando(true);
    setAviso(null);
    const r = await salvarExperimento({ data: rascunho });
    setSalvando(false);
    if (!r.ok) {
      setAviso(r.erro ?? "não deu pra salvar");
      return;
    }
    aoSalvar(rascunho);
    setAviso("salvo — vale no site em até 1 minuto");
  }

  const mudar = (p: Partial<ExperimentoConfig>) => setRascunho({ ...rascunho, ...p });
  const mudarPlano = (nome: string, campo: string, valor: string) =>
    setRascunho({
      ...rascunho,
      variantes: rascunho.variantes.map((v) =>
        v.nome === nome
          ? {
              ...v,
              plano: {
                ...(v.plano ?? { texto: "", valor: 0, ancora: "", checkout: "" }),
                [campo]: campo === "valor" ? Number(valor.replace(",", ".")) || 0 : valor,
              },
            }
          : v,
      ),
    });

  const somaPesos = rascunho.variantes.reduce((s, v) => s + (v.peso || 0), 0) || 1;

  return (
    <div className="space-y-5 rounded-2xl border border-[var(--tinta-fraca)]/40 p-5">
      {/* faixa 1: os botões */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{exp.id}</span>
        <button
          onClick={() => mudar({ ativo: !rascunho.ativo })}
          className={cn(
            "rounded-full px-3 py-1 text-xs",
            rascunho.ativo
              ? "bg-[var(--acento)] text-white"
              : "bg-[var(--tinta-fraca)]/20 text-[var(--tinta-suave)]",
          )}
        >
          {rascunho.ativo ? "no ar" : "desligado"}
        </button>
        <label className="flex items-center gap-2 text-xs text-[var(--tinta-suave)]">
          % das visitas no teste
          <Input
            className="h-8 w-20"
            type="number"
            min={0}
            max={100}
            value={rascunho.exposicaoPct}
            onChange={(e) => mudar({ exposicaoPct: Number(e.target.value) })}
          />
        </label>
      </div>

      {/* faixa 2: as versões */}
      {travado && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Preço, link e nome estão travados porque o teste está no ar. Quem já
          foi sorteada tem o preço antigo guardada no navegador: mudar agora
          faria dois preços virarem média debaixo do mesmo rótulo. Desligue,
          edite com um nome novo de versão, e ligue de novo.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">
            <tr>
              {["Versão", "Peso", "%", "Texto", "Valor", "Âncora", "Checkout"].map((c) => (
                <th key={c} className="px-2 py-2 text-left font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rascunho.variantes.map((v, i) => (
              <tr key={v.nome}>
                <td className="px-2 py-1.5">
                  {v.nome}
                  {i === 0 && <span className="ml-1 text-[10px] text-[var(--tinta-suave)]">controle</span>}
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    className="h-8 w-16"
                    type="number"
                    min={0}
                    value={v.peso}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        variantes: rascunho.variantes.map((x) =>
                          x.nome === v.nome ? { ...x, peso: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                </td>
                <td className="px-2 py-1.5 tabular-nums text-[var(--tinta-suave)]">
                  {Math.round(((v.peso || 0) / somaPesos) * 100)}%
                </td>
                {(["texto", "valor", "ancora", "checkout"] as const).map((campo) => (
                  <td key={campo} className="px-2 py-1.5">
                    <Input
                      className={cn("h-8", campo === "checkout" ? "w-72" : "w-24")}
                      disabled={travado}
                      value={String(v.plano?.[campo] ?? "")}
                      onChange={(e) => mudarPlano(v.nome, campo, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" disabled={salvando} onClick={salvar}>
          {salvando ? "salvando…" : "Salvar"}
        </Button>
        {aviso && <span className="text-xs text-[var(--tinta-suave)]">{aviso}</span>}
      </div>

      {/* faixa 3: o resultado */}
      {resultado && <TabelaResultado resultado={resultado} />}
    </div>
  );
}

function TabelaResultado({ resultado }: { resultado: Painel["porExperimento"][number] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--tinta-fraca)]/40">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-[var(--papel-fundo)] text-[11px] uppercase tracking-wider text-[var(--tinta-suave)]">
          <tr>
            {["Versão", "Leads", "Vendas", "Receita", "Conv.", "R$/lead", "vs controle"].map((c, i) => (
              <th key={c} className={cn("px-3 py-2 font-medium", i === 0 ? "text-left" : "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resultado.variantes.map((v) => (
            <tr
              key={v.variante}
              className={cn(v.controle && "bg-[var(--tinta-fraca)]/10", v.ehFora && "italic text-[var(--tinta-suave)]")}
            >
              <td className="px-3 py-2">
                {v.ehFora ? "fora do teste" : v.variante}
                {v.controle && <span className="ml-2 text-[10px]">controle</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{v.leads}</td>
              <td className="px-3 py-2 text-right tabular-nums">{v.vendas}</td>
              <td className="px-3 py-2 text-right tabular-nums">{v.receitaBrl > 0 ? brl(v.receitaBrl) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{v.conversaoPct.toFixed(1)}%</td>
              {/* A COLUNA QUE DECIDE. Conversão sozinha mente em teste de
                  preço: o preço mais caro converte pior por definição e ainda
                  pode faturar mais. */}
              <td className="px-3 py-2 text-right font-medium tabular-nums text-[var(--acento)]">
                {brl(v.receitaPorLeadBrl)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {v.variacaoVsControlePct == null
                  ? "—"
                  : `${v.variacaoVsControlePct > 0 ? "+" : ""}${v.variacaoVsControlePct.toFixed(0)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {resultado.variantes.some((v) => !v.ehFora && v.leads < 200) && (
        <p className="px-3 py-2 text-[11px] text-[var(--tinta-suave)]">
          Amostra pequena: com menos de ~200 leads por lado, a diferença ainda
          pode ser sorteio. Deixe rodar.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Passo 5: conferir**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: verde.

- [ ] **Passo 6: conferir no navegador**

Suba o preview, entre em `/admin?aba=testes`, e confirme, nesta ordem:

1. A tabela de versões aparece **editável** (o teste está desligado).
2. Mude o preço do B, salve, recarregue: o valor novo continua lá.
3. Ligue o teste e salve. Os campos de preço/link ficam **cinza**.
4. Tente salvar um preço diferente com o teste ligado: tem que recusar com
   "desligue o teste pra mexer em preço, link ou nome de versão".
5. Cole o mesmo link de checkout em duas versões e tente ligar: tem que
   recusar com "duas versões apontam pro mesmo link".
6. Abra `/criar?step=oferta` numa aba anônima e confirme que o preço na tela
   é o que o painel diz.
7. Desligue o teste no painel antes de sair.

- [ ] **Passo 7: commit**

```bash
git add src/components/admin/AbaTestes.tsx src/routes/admin.tsx
git commit -m "feat: a aba de testes A/B, com os botoes, as versoes e o resultado"
```

---

## Depois do plano

Rodar `npm test`, `npx tsc --noEmit`, `npm run build`, subir, e então ligar o
experimento **pelo painel** — não pelo código. Se ligar pelo código funcionar,
alguma coisa deste plano não foi feita.
