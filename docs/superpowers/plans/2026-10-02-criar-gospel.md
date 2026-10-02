# /criar gospel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/criar?t=gospel` abre o quiz da Serenata em versão gospel (louvor pra Deus ou presente com fé), com 5 estilos gospel, letra própria e uma tabela "Gospel" no `/admin`.

**Architecture:** O tema (`"gospel"`) entra pela URL, fica gravado em `respostas.tema` (store persistido) e em `attribution.tema`. O quiz gospel é o `QUIZ_FLOW_PT` com uma camada por cima (`comGospel`, padrão de `quiz-flow-ar.ts`): um passo `tipo` novo, passos `_louvor` exclusivos por `SKIP_GOSPEL`, redação nova em estilo/voz/histórias. O prompt muda só na mensagem do usuário (`buildUserMessage`); o painel agrega leads e vendas por tema numa função pura.

**Tech Stack:** TanStack Start + React 19, zustand (persist), vitest (ambiente node, sem render: UI é coberta por teste de contrato lendo o fonte), Supabase (só leitura no painel).

**Spec:** `docs/superpowers/specs/2026-10-02-criar-gospel-design.md`

## Global Constraints

- Sem `t=gospel` (e sem `respostas.tema === "gospel"`), fluxo, prompt e painel ficam como hoje. A mensagem do prompt normal sai idêntica (snapshot na Task 4).
- Só o funil `pt` da Serenata. `locale` `es` ou `en` com `?t=gospel` ignora o tema.
- O system prompt (`LETRA_SYSTEM`) NÃO muda (é cacheado).
- O quiz gospel é sobreposição de `QUIZ_FLOW_PT`, nunca cópia.
- Versos da primeira tela: literais de "Mulher de Palavra" (`/p/2459f4b76e1b49c58be203`), refrão:
  "Denise, mulher de palavra e de fé" / "Batalhadora que nunca soltou minha mão" / "Nos dias mais difíceis foi você quem me ouviu" / "E me ensinou que não se desiste, não".
- Copy da primeira tela: título "Crie o seu próprio " + **louvor**; explicação "Você conta o que Deus fez na sua vida. Fica pronto em 1 minuto, de graça."; CTA "CRIAR MEU LOUVOR GRÁTIS".
- Valores gravados no banco: `tema = "gospel"`, `tipo ∈ {"louvor","presente"}`, `relacao = "deus"`, `nome = "Deus"`, ocasiões `gratidao|testemunho|clamor|adoracao|igreja`, estilos `gospel_adoracao|gospel_tradicional|gospel_pentecostal|gospel_sertanejo|gospel_pop`, tom `reverente`.
- Arquivos importados por `api/` ou `inngest/` não usam o alias `@/` (import relativo `.js`). `generos.ts` e `letra-prompt.ts` já seguem a regra de cada um; não trocar imports existentes.
- Não rodar `prettier --write` em arquivo inteiro (CLAUDE.md e outros nunca seguiram o prettier). Editar só as linhas da tarefa.
- `npm test` hoje termina com 1 erro pré-existente ("Cannot find package 'jsdom'"); o critério é todos os testes passarem e nenhum erro NOVO.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Trocar de tipo no meio do quiz** (escolheu louvor, voltou e escolheu presente, ou o contrário): o presente não pode ficar com `nome = "Deus"`/`relacao = "deus"`, e uma ocasião do outro tipo não pode passar como respondida. Testes de `aplicarTipo` na Task 3.
2. **Numeração do funil**: lead gospel tem que gravar `furthest_step` na MESMA escala do funil normal (contato = 9, ocasião = 3), senão o funil do painel mistura passos. O passo `tipo` não grava lead (como a abertura). Testes de `numeroCanonico` na Task 3 e contrato na Task 5.
3. **Ballad e espanhol com `?t=gospel`**: tema ignorado, fluxo igual ao de hoje. Testes nas Tasks 1, 3 e 4.
4. **Respostas forjadas pelo cliente** (`tema: "Gospel"`, `tipo: "x"`, `filhos` presente num louvor): só `tema === "gospel"` exato ativa; só `tipo === "louvor"` vira louvor; louvor nunca leva linha de filhos ao prompt. Testes na Task 4.
5. **Revisita sem `t`** (reload em `?step=historia1_louvor` com o store vazio): o passo não existe no fluxo normal e `indexOfId` cai na abertura em vez de quebrar. Teste na Task 3. E o tema gravado antes da reidratação da store se perderia no passo 2: contrato na Task 5 (`onFinishHydration`).

---

### Task 1: O tema

**Files:**
- Create: `src/lib/tema.ts`
- Modify: `src/lib/session-context.ts` (tipo `Attribution`, logo depois de `ref_em?: string;`)
- Test: `src/lib/tema.test.ts`

**Interfaces:**
- Produces:
  - `type Tema = "gospel"`
  - `temaDoParametro(valor: string | null | undefined): Tema | null`
  - `temaEfetivo(daUrl: Tema | null, respostas: Record<string, unknown>, locale: string): Tema | null`
  - `comTema(attr: Record<string, unknown>, tema: Tema): Record<string, unknown>`
  - `carimbarTema(tema: Tema): void` (escreve `mp_attribution`)

- [ ] **Step 1: Write the failing test**

`src/lib/tema.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { comTema, temaDoParametro, temaEfetivo } from "./tema";

describe("tema", () => {
  it("aceita só gospel, sem diferenciar maiúscula", () => {
    expect(temaDoParametro("gospel")).toBe("gospel");
    expect(temaDoParametro("GOSPEL")).toBe("gospel");
    expect(temaDoParametro("Gospel ")).toBe("gospel");
    expect(temaDoParametro("louvor")).toBeNull();
    expect(temaDoParametro("")).toBeNull();
    expect(temaDoParametro(undefined)).toBeNull();
  });

  it("URL vence, depois as respostas, depois nada", () => {
    expect(temaEfetivo("gospel", {}, "pt")).toBe("gospel");
    expect(temaEfetivo(null, { tema: "gospel" }, "pt")).toBe("gospel");
    expect(temaEfetivo(null, {}, "pt")).toBeNull();
  });

  it("valor forjado nas respostas não ativa", () => {
    expect(temaEfetivo(null, { tema: "Gospel" }, "pt")).toBeNull();
    expect(temaEfetivo(null, { tema: ["gospel"] }, "pt")).toBeNull();
  });

  it("só o funil português tem tema", () => {
    expect(temaEfetivo("gospel", { tema: "gospel" }, "es")).toBeNull();
    expect(temaEfetivo("gospel", { tema: "gospel" }, "en")).toBeNull();
  });

  it("comTema preserva o resto da atribuição", () => {
    const attr = { utm_source: "google", exp: { preco: "A" }, captured_at: "x" };
    expect(comTema(attr, "gospel")).toEqual({ ...attr, tema: "gospel" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tema.test.ts`
Expected: FAIL, "Failed to resolve import "./tema"".

- [ ] **Step 3: Write minimal implementation**

`src/lib/tema.ts`:
```ts
// O TEMA DO FUNIL (02/10/2026). Hoje só existe um: "gospel".
//
// Entra pela URL (`/criar?t=gospel`, a porta dos anúncios gospel) e fica em
// dois lugares: `respostas.tema` (o quiz troca a URL a cada passo e o `t`
// some; nas respostas ele chega também ao prompt da letra) e
// `attribution.tema` (é de onde o painel lê). Desenho em
// `docs/superpowers/specs/2026-10-02-criar-gospel-design.md`.

export type Tema = "gospel";

export function temaDoParametro(valor: string | null | undefined): Tema | null {
  return String(valor ?? "").trim().toLowerCase() === "gospel" ? "gospel" : null;
}

/** URL > respostas salvas > nada. Só o funil português tem tema. */
export function temaEfetivo(
  daUrl: Tema | null,
  respostas: Record<string, unknown>,
  locale: string,
): Tema | null {
  if (locale !== "pt") return null;
  if (daUrl) return daUrl;
  return respostas.tema === "gospel" ? "gospel" : null;
}

export function comTema(attr: Record<string, unknown>, tema: Tema): Record<string, unknown> {
  return { ...attr, tema };
}

/**
 * Grava o tema na atribuição guardada. Mesmo formato de `carimbarExperimentos`:
 * um stub sem toque capturado é mesclado por `captureFirstTouchAttribution`,
 * então o tema sobrevive à captura do first-touch.
 */
export function carimbarTema(tema: Tema): void {
  if (typeof window === "undefined") return;
  try {
    const cru = localStorage.getItem("mp_attribution");
    const atual = cru ? (JSON.parse(cru) as Record<string, unknown>) : {};
    if (atual.tema === tema) return;
    localStorage.setItem(
      "mp_attribution",
      JSON.stringify(
        comTema({ ...atual, captured_at: atual.captured_at ?? new Date().toISOString() }, tema),
      ),
    );
  } catch {
    // Modo anônimo: o tema ainda vale na tela, só não é medido.
  }
}
```

Em `src/lib/session-context.ts`, no tipo `Attribution`, depois de `ref_em?: string;`:
```ts
  /** O tema do funil (`tema.ts`), carimbado no início do quiz. */
  tema?: "gospel";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tema.test.ts && npm run typecheck`
Expected: 5 passed; tsc sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tema.ts src/lib/tema.test.ts src/lib/session-context.ts
git commit -m "feat(gospel): tema do funil pela URL, nas respostas e na atribuicao

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Os 5 estilos gospel

**Files:**
- Modify: `src/lib/generos.ts` (nova lista antes de `const TODAS`; `TODAS` ganha `gospel_pt`; nova função depois de `generos()`)
- Test: `src/lib/generos.test.ts` (novo `describe` no fim)

**Interfaces:**
- Produces: `generosGospel(): Genero[]` (5 itens, na ordem da tabela)

- [ ] **Step 1: Write the failing test**

No fim de `src/lib/generos.test.ts` (ajustar o import do topo para `import { generos, acharGenero, generosGospel, estiloParaSuno } from "./generos";`):
```ts
describe("estilos gospel", () => {
  const VALORES = [
    "gospel_adoracao",
    "gospel_tradicional",
    "gospel_pentecostal",
    "gospel_sertanejo",
    "gospel_pop",
  ];

  it("são os cinco, nesta ordem", () => {
    expect(generosGospel().map((g) => g.value)).toEqual(VALORES);
  });

  it("o job da música acha cada um", () => {
    for (const v of VALORES) expect(acharGenero(v)?.value).toBe(v);
  });

  it("não aparecem na lista normal do português", () => {
    const normais = generos("pt").map((g) => g.value);
    for (const v of VALORES) expect(normais).not.toContain(v);
    expect(normais).toContain("gospel");
  });

  it("cabem no limite do Suno com a voz", () => {
    for (const v of VALORES) {
      const s = estiloParaSuno({ genero: v, voz: "feminina", estiloDoModelo: "voz feminina suave e calorosa" });
      expect(s.length).toBeLessThanOrEqual(190);
      expect(s.startsWith(acharGenero(v)!.estiloSuno)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/generos.test.ts`
Expected: FAIL, "generosGospel is not a function" (ou erro de import).

- [ ] **Step 3: Write minimal implementation**

Em `src/lib/generos.ts`, logo antes do comentário que precede `const TODAS`:
```ts
// ── GOSPEL (só no `/criar?t=gospel`, 02/10/2026) ──────────────────
// Fora da lista normal de propósito: quem não veio pelo anúncio gospel
// continua vendo o `gospel` de sempre entre os treze. Aqui o estilo É a
// escolha principal, então ele se abre em cinco climas.
const GOSPEL_PT: Genero[] = [
  { value: "gospel_adoracao", label: "Adoração", emoji: "🙌",
    rotuloPrompt: "gospel de adoração (worship)",
    estiloSuno: "worship brasileiro, pads de teclado, guitarra com delay, bateria crescendo, clima de adoração congregacional" },
  { value: "gospel_tradicional", label: "Gospel tradicional", emoji: "📖",
    rotuloPrompt: "gospel tradicional, de hino",
    estiloSuno: "gospel brasileiro tradicional, piano e órgão, coral, clima reverente de hino" },
  { value: "gospel_pentecostal", label: "Pentecostal animado", emoji: "🔥",
    rotuloPrompt: "gospel pentecostal animado",
    estiloSuno: "gospel pentecostal brasileiro, teclado e metais, bateria animada, palmas, clima de celebração" },
  { value: "gospel_sertanejo", label: "Sertanejo gospel", emoji: "🤠",
    rotuloPrompt: "sertanejo gospel",
    estiloSuno: "sertanejo gospel, violão e viola caipira, sanfona leve, dueto, clima de fé e gratidão" },
  { value: "gospel_pop", label: "Pop gospel", emoji: "🎧",
    rotuloPrompt: "pop gospel",
    estiloSuno: "pop gospel brasileiro, violão e piano, batida pop suave, refrão marcante, clima inspirador" },
];
```

Em `const TODAS`, depois de `en: EN,`:
```ts
  // Não é idioma: está aqui só pro `acharGenero` (job da música, página
  // presente) achar os estilos gospel. `generos()` nunca devolve esta chave.
  gospel_pt: GOSPEL_PT,
```

Depois da função `generos()`:
```ts
/** Os estilos do quiz gospel (`quiz-flow-gospel.ts`). */
export function generosGospel(): Genero[] {
  return GOSPEL_PT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/generos.test.ts`
Expected: todos passam, incluindo o teste antigo "nenhum value repetido entrega estilos DIFERENTES".

- [ ] **Step 5: Commit**

```bash
git add src/lib/generos.ts src/lib/generos.test.ts
git commit -m "feat(gospel): cinco estilos gospel no catalogo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: O quiz gospel

**Files:**
- Create: `src/lib/quiz-flow-gospel.ts`
- Modify: `src/lib/quiz-flow.ts` (`quizFlow` ganha `tema`; nova `skipDoFluxo`)
- Test: `src/lib/quiz-flow-gospel.test.ts`

**Interfaces:**
- Consumes: `Tema` (Task 1), `generosGospel()` (Task 2)
- Produces:
  - `comGospel(flow: FlowStep[]): FlowStep[]`
  - `SKIP_GOSPEL: SkipMap`
  - `OCASIOES_LOUVOR: readonly string[]`
  - `aplicarTipo(respostas: Record<string, unknown>, tipo: string): Record<string, string | string[]>`
  - `numeroCanonico(canon: FlowStep[], step: FlowStep): number`
  - em `quiz-flow.ts`: `quizFlow(locale: Locale, tema?: Tema | null): FlowStep[]` e `skipDoFluxo(tema?: Tema | null): SkipMap`

- [ ] **Step 1: Write the failing test**

`src/lib/quiz-flow-gospel.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { quizFlow, QUIZ_SKIP, skipDoFluxo } from "@/lib/quiz-flow";
import { QUIZ_FLOW_EN } from "@/lib/quiz-flow-en";
import { aplicarTipo, numeroCanonico, OCASIOES_LOUVOR } from "@/lib/quiz-flow-gospel";
import { indexOfId, isQuestion, nextVisibleIndex, type FlowStep } from "@/lib/flow-engine";

const PT = quizFlow("pt");
const G = quizFlow("pt", "gospel");

/** Percorre o fluxo do jeito que o `Quiz` faz: de visível em visível. */
function caminho(flow: FlowStep[], respostas: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (let i = 0; i !== -1; i = nextVisibleIndex(flow, i, respostas, skipDoFluxo("gospel"))) {
    ids.push(flow[i].id);
  }
  return ids;
}
const opcoes = (flow: FlowStep[], id: string) =>
  (flow.find((s) => s.id === id) as { options?: { value: string }[] }).options!.map((o) => o.value);

describe("quiz gospel", () => {
  it("sem tema, o fluxo e a pulagem são os de hoje", () => {
    expect(quizFlow("pt", null)).toBe(PT);
    expect(skipDoFluxo(null)).toBe(QUIZ_SKIP);
    expect(PT.some((s) => s.id.endsWith("_louvor") || s.id === "tipo")).toBe(false);
  });

  it("espanhol e inglês ignoram o tema", () => {
    expect(quizFlow("en", "gospel")).toBe(QUIZ_FLOW_EN);
    expect(quizFlow("es", "gospel")).toBe(quizFlow("es"));
  });

  it("tipo é o segundo passo", () => {
    expect(G[0].id).toBe("abertura");
    expect(G[1].id).toBe("tipo");
    expect(opcoes(G, "tipo")).toEqual(["louvor", "presente"]);
  });

  it("o louvor pula pra quem e nome e usa os próprios passos", () => {
    expect(caminho(G, { tipo: "louvor" })).toEqual([
      "abertura", "tipo", "ocasiao_louvor", "prova1", "estilo", "voz",
      "historia1_louvor", "historia2_louvor", "recado_louvor",
      "contato", "revisao", "reveal", "oferta",
    ]);
  });

  it("o presente percorre os passos de sempre", () => {
    expect(caminho(G, { tipo: "presente" })).toEqual([
      "abertura", "tipo", "relacao", "nome", "ocasiao", "prova1", "estilo", "voz",
      "historia1", "historia2", "recado", "contato", "revisao", "reveal", "oferta",
    ]);
  });

  it("estilo oferece os cinco gospel; tom troca romântica e divertida por reverente", () => {
    expect(opcoes(G, "estilo")).toEqual([
      "gospel_adoracao", "gospel_tradicional", "gospel_pentecostal", "gospel_sertanejo", "gospel_pop",
    ]);
    const voz = G.find((s) => s.id === "voz") as { extraChips: { options: { value: string }[] } };
    expect(voz.extraChips.options.map((o) => o.value)).toEqual(["reverente", "emocionante", "animada"]);
  });

  it("ocasiões do louvor", () => {
    expect(opcoes(G, "ocasiao_louvor")).toEqual([...OCASIOES_LOUVOR]);
  });

  it("o recado do louvor não pergunta de filhos; o do presente continua perguntando", () => {
    expect((G.find((s) => s.id === "recado_louvor") as { extra?: unknown }).extra).toBeUndefined();
    expect((G.find((s) => s.id === "recado") as { extra?: unknown }).extra).toBeDefined();
  });

  it("não mexe no array do português", () => {
    expect(opcoes(PT, "estilo")).toContain("gospel");
    expect(opcoes(PT, "estilo")).not.toContain("gospel_pop");
  });

  it("passo gospel aberto sem tema cai na abertura", () => {
    expect(indexOfId(PT, "historia1_louvor")).toBe(0);
  });
});

describe("aplicarTipo", () => {
  it("louvor preenche Deus e tira os filhos", () => {
    expect(aplicarTipo({ filhos: "Ana", estilo: "gospel_pop" }, "louvor")).toEqual({
      tipo: "louvor", relacao: "deus", nome: "Deus", estilo: "gospel_pop",
    });
  });

  it("voltar do louvor pro presente limpa Deus e a ocasião do louvor", () => {
    const louvor = aplicarTipo({ ocasiao: "gratidao" }, "louvor");
    expect(aplicarTipo(louvor, "presente")).toEqual({ tipo: "presente" });
  });

  it("presente não apaga a pessoa que já foi escolhida", () => {
    expect(aplicarTipo({ relacao: "mae", nome: "Rosa", ocasiao: "aniversario" }, "presente")).toEqual({
      tipo: "presente", relacao: "mae", nome: "Rosa", ocasiao: "aniversario",
    });
  });

  it("ir pro louvor descarta ocasião de presente", () => {
    expect(aplicarTipo({ ocasiao: "declaracao" }, "louvor").ocasiao).toBeUndefined();
    expect(aplicarTipo({ ocasiao: "clamor" }, "louvor").ocasiao).toBe("clamor");
  });
});

describe("numeroCanonico (escala do funil no banco)", () => {
  const n = (id: string) => numeroCanonico(PT, G.find((s) => s.id === id)!);
  it("cada passo gospel tem o número do passo normal de mesmo campo", () => {
    expect(n("tipo")).toBe(0);
    expect(n("relacao")).toBe(1);
    expect(n("ocasiao_louvor")).toBe(3);
    expect(n("historia1_louvor")).toBe(6);
    expect(n("recado_louvor")).toBe(8);
  });
  it("no fluxo normal é igual ao questionNumber", () => {
    PT.forEach((s, i) => {
      if (isQuestion(s)) expect(numeroCanonico(PT, s)).toBe(PT.slice(0, i + 1).filter(isQuestion).length);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quiz-flow-gospel.test.ts`
Expected: FAIL, "Failed to resolve import "@/lib/quiz-flow-gospel"".

- [ ] **Step 3: Write minimal implementation**

`src/lib/quiz-flow-gospel.ts`:
```ts
import { isQuestion, questionNumber, type FlowStep, type SkipMap } from "@/lib/flow-engine";
import { generosGospel } from "@/lib/generos";

// O QUIZ GOSPEL (`/criar?t=gospel`, 02/10/2026).
//
// Camada sobre o `QUIZ_FLOW_PT`, no padrão do `quiz-flow-ar.ts`: o que é
// estrutura (ordem, `value` gravado no banco, contato, revisão, oferta) é
// compartilhado; aqui mora só o que o gospel muda. Melhoria no quiz principal
// aparece neste sozinha.
//
// Três mudanças:
//   1. Um passo novo, `tipo`, logo depois da abertura: louvor pra Deus ou
//      presente pra alguém, com fé.
//   2. Passos próprios do louvor (`*_louvor`), com o MESMO `field` dos
//      originais. Cada par é exclusivo pelo `SKIP_GOSPEL`.
//   3. Redação nova em estilo, tom e exemplos das histórias.
//
// Desenho: `docs/superpowers/specs/2026-10-02-criar-gospel-design.md`.

export const OCASIOES_LOUVOR = ["gratidao", "testemunho", "clamor", "adoracao", "igreja"] as const;

const TIPO: FlowStep = {
  id: "tipo",
  kind: "question",
  block: "Pra quem",
  text: "O que você quer criar?",
  field: "tipo",
  input: "chips",
  options: [
    { value: "louvor", label: "Um louvor pra Deus", emoji: "🙏" },
    { value: "presente", label: "Um presente pra alguém, com fé", emoji: "🎁" },
  ],
};

/** Os passos do louvor, entrando logo depois do original de mesmo `field`. */
const DO_LOUVOR: Record<string, FlowStep> = {
  ocasiao: {
    id: "ocasiao_louvor",
    kind: "question",
    block: "A ocasião",
    text: "Qual é o motivo do seu louvor?",
    field: "ocasiao",
    input: "chips",
    options: [
      { value: "gratidao", label: "Gratidão", emoji: "🙌" },
      { value: "testemunho", label: "Testemunho de uma vitória", emoji: "🏆" },
      { value: "clamor", label: "Um momento difícil", emoji: "🕊️" },
      { value: "adoracao", label: "Adoração", emoji: "🎶" },
      { value: "igreja", label: "Pra minha igreja", emoji: "⛪" },
    ],
  },
  historia1: {
    id: "historia1_louvor",
    kind: "question",
    block: "A história",
    text: "O que Deus fez na sua vida?",
    subtext: "Escreva do seu jeito. Quanto mais real, mais seu fica o louvor.",
    field: "historia1",
    input: "story",
    placeholder: "Ex: eu estava desempregado havia oito meses quando...",
    minChars: 60,
    allowAudio: true,
    triggers: [
      { rotulo: "quando eu…", inicio: "Quando eu " },
      { rotulo: "o que Ele fez", inicio: "O que Deus fez por mim foi " },
      { rotulo: "minha família", inicio: "Na minha família, Deus " },
      { rotulo: "uma oração respondida", inicio: "Eu orei por " },
      { rotulo: "como eu era antes", inicio: "Antes de conhecer Jesus, eu " },
    ],
  },
  historia2: {
    id: "historia2_louvor",
    kind: "question",
    block: "A história",
    text: "Me conta um momento em que você sentiu Deus perto",
    subtext: "Um lugar, um dia, uma frase. Não precisa ser bonito, precisa ser verdade.",
    field: "historia2",
    input: "story",
    placeholder: "Foi na madrugada do hospital, quando...",
    minChars: 60,
    allowAudio: true,
    permitePular: true,
    triggers: [
      { rotulo: "um lugar", inicio: "Foi em " },
      { rotulo: "um versículo", inicio: "O versículo que me sustentou foi " },
      { rotulo: "um louvor", inicio: "Tem um louvor que me lembra esse dia: " },
      { rotulo: "uma pessoa", inicio: "Deus usou " },
    ],
  },
  recado: {
    id: "recado_louvor",
    kind: "question",
    block: "A história",
    text: "Se você pudesse dizer UMA frase a Deus no refrão, qual seria?",
    subtext: "Opcional, mas costuma virar a parte mais forte.",
    field: "recado",
    input: "text",
    placeholder: "A frase que você quer cantar pra Deus",
    maxLength: 120,
    opcional: true,
    triggers: [
      { rotulo: "obrigado, Senhor", inicio: "Obrigado, Senhor, por " },
      { rotulo: "eu te entrego", inicio: "Eu te entrego " },
      { rotulo: "Tu és", inicio: "Tu és " },
      { rotulo: "nunca me deixou", inicio: "Mesmo quando eu " },
    ],
  },
};

/** Redação gospel por cima dos passos comuns. Sobreposição rasa, por `id`. */
const GOSPEL: Record<string, Record<string, unknown>> = {
  estilo: {
    text: "Qual o estilo da música?",
    subtext: "É o clima da música. Dá pra mudar depois.",
    options: generosGospel().map((g) => ({ value: g.value, label: g.label, emoji: g.emoji })),
  },
  voz: {
    extraChips: {
      field: "tom",
      pergunta: "E o tom? (opcional)",
      options: [
        { value: "reverente", label: "Reverente", emoji: "🙏" },
        { value: "emocionante", label: "Emocionante", emoji: "🥹" },
        { value: "animada", label: "Celebração", emoji: "🎉" },
      ],
    },
  },
  historia1: { placeholder: "Ex: minha mãe sempre orou por cada um de nós, de joelhos, toda noite..." },
  historia2: { placeholder: "Ela canta hino lavando a louça e..." },
};

export function comGospel(flow: FlowStep[]): FlowStep[] {
  const out: FlowStep[] = [];
  for (const passo of flow) {
    const troca = GOSPEL[passo.id];
    out.push(troca ? ({ ...passo, ...troca } as FlowStep) : passo);
    if (passo.id === "abertura") out.push(TIPO);
    const louvor = DO_LOUVOR[passo.id];
    if (louvor) out.push(louvor);
  }
  return out;
}

const ehLouvor = (r: Record<string, unknown>) => r.tipo === "louvor";
const naoLouvor = (r: Record<string, unknown>) => !ehLouvor(r);

export const SKIP_GOSPEL: SkipMap = {
  relacao: ehLouvor,
  nome: ehLouvor,
  ocasiao: ehLouvor,
  historia1: ehLouvor,
  historia2: ehLouvor,
  recado: ehLouvor,
  ocasiao_louvor: naoLouvor,
  historia1_louvor: naoLouvor,
  historia2_louvor: naoLouvor,
  recado_louvor: naoLouvor,
};

/**
 * O que escolher o tipo faz nas respostas.
 *
 * Louvor: a música é pra Deus, então `relacao` e `nome` já ficam preenchidos
 * (são esses campos que a página presente e os e-mails leem) e os filhos
 * saem. Presente: só desfaz o que o louvor tinha posto. Nos dois, uma
 * ocasião que não existe no tipo novo sai — senão ela contaria como
 * respondida num passo cujos chips nem a mostram.
 */
export function aplicarTipo(
  respostas: Record<string, unknown>,
  tipo: string,
): Record<string, string | string[]> {
  const out = { ...respostas, tipo } as Record<string, string | string[]>;
  const ocasiaoDoLouvor = (OCASIOES_LOUVOR as readonly string[]).includes(String(out.ocasiao ?? ""));
  if (tipo === "louvor") {
    out.relacao = "deus";
    out.nome = "Deus";
    delete out.filhos;
    if (out.ocasiao !== undefined && !ocasiaoDoLouvor) delete out.ocasiao;
  } else {
    if (out.relacao === "deus") {
      delete out.relacao;
      delete out.nome;
    }
    if (ocasiaoDoLouvor) delete out.ocasiao;
  }
  return out;
}

/**
 * O número do passo na escala do funil NORMAL, que é a que o banco guarda
 * (`furthest_step`) e o painel lê. Passo gospel vale o do passo normal de
 * mesmo campo; `tipo` não existe lá e vale 0, como a abertura.
 */
export function numeroCanonico(canon: FlowStep[], step: FlowStep): number {
  const i = isQuestion(step)
    ? canon.findIndex((s) => isQuestion(s) && s.field === step.field)
    : canon.findIndex((s) => s.id === step.id);
  return i < 0 ? 0 : questionNumber(canon, i);
}
```

Em `src/lib/quiz-flow.ts`:
- imports, junto dos outros:
```ts
import { comGospel, SKIP_GOSPEL } from "@/lib/quiz-flow-gospel";
import type { Tema } from "@/lib/tema";
```
- trocar a função `quizFlow` inteira por:
```ts
// O quiz gospel é o português com a camada de `quiz-flow-gospel.ts`. Montado
// uma vez: o `Quiz` compara passos por referência entre renders.
const QUIZ_FLOW_GOSPEL = comGospel(QUIZ_FLOW_PT);

export function quizFlow(locale: Locale, tema?: Tema | null): FlowStep[] {
  if (locale === "pt" && tema === "gospel") return QUIZ_FLOW_GOSPEL;
  if (locale === "en") return QUIZ_FLOW_EN;
  if (locale !== "es") return QUIZ_FLOW_PT;
  // O MERCADO decide a redação, do mesmo jeito que já decide o prompt da letra
  // (`systemDaLetra`), os gêneros (`generos`) e o exemplo da abertura. Este era
  // o quarto lugar, e era o único que tinha ficado de fora.
  return ehArgentina() ? comVoseo(QUIZ_FLOW_ES) : QUIZ_FLOW_ES;
}

/** A pulagem do fluxo: a do gospel troca os passos do louvor pelos de presente. */
export function skipDoFluxo(tema?: Tema | null): SkipMap {
  return tema === "gospel" ? SKIP_GOSPEL : QUIZ_SKIP;
}
```
(`QUIZ_FLOW_GOSPEL` fica DEPOIS da declaração de `QUIZ_FLOW_PT` e de `QUIZ_SKIP`.)

Atenção: `comVoseo(QUIZ_FLOW_ES)` hoje é recalculado a cada chamada e devolve array novo; o teste "espanhol ignora o tema" compara `toBe(quizFlow("es"))` — no ambiente de teste o mercado não é Argentina, então devolve `QUIZ_FLOW_ES` (mesma referência). Se `mercadoEs` do ambiente de teste for Argentina, trocar o `toBe` por `toEqual`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/quiz-flow-gospel.test.ts src/lib/quiz-flow-ar.test.ts && npm run typecheck`
Expected: todos passam; tsc limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz-flow-gospel.ts src/lib/quiz-flow-gospel.test.ts src/lib/quiz-flow.ts
git commit -m "feat(gospel): quiz gospel como camada do portugues, louvor e presente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: A letra gospel

**Files:**
- Modify: `src/lib/letra-prompt.ts` (`RELACAO`, `OCASIAO`, `TOM`, nova constante `LOUVOR_INSTRUCOES`, `buildUserMessage`)
- Test: `src/lib/letra-prompt-gospel.test.ts` (+ snapshot `src/lib/__snapshots__/letra-prompt-gospel.test.ts.snap`)

**Interfaces:**
- Consumes: valores de `tipo`/`ocasiao`/`tom` da Task 3
- Produces: `LOUVOR_INSTRUCOES: string`; `buildUserMessage` com o comportamento gospel

- [ ] **Step 1: Congelar a mensagem de hoje ANTES de mexer**

`src/lib/letra-prompt-gospel.test.ts`, só o primeiro `describe` por enquanto:
```ts
import { describe, expect, it } from "vitest";
import { buildUserMessage } from "@/lib/letra-prompt";

const NORMAL = {
  relacao: "mae", nome: "Rosa", ocasiao: "aniversario", estilo: "gospel", voz: "feminina",
  tom: "emocionante", historia1: "Minha mãe criou a gente sozinha.", historia2: "Faz bolo de fubá.",
  recado: "Obrigado por tudo", filhos: "Pedro",
};

describe("mensagem sem tema", () => {
  it("é a mesma de antes do gospel", () => {
    expect(buildUserMessage(NORMAL, "pt")).toMatchSnapshot();
    expect(buildUserMessage({ ...NORMAL, tom: "" }, "pt")).toMatchSnapshot();
  });
});
```

Run: `npx vitest run src/lib/letra-prompt-gospel.test.ts`
Expected: PASS, "2 snapshots written". Conferir o `.snap`: começa com `Homenageado: Rosa` e tem `Filhos a citar pelo nome, exatamente como escrito: Pedro`.

```bash
git add src/lib/letra-prompt-gospel.test.ts src/lib/__snapshots__/letra-prompt-gospel.test.ts.snap
git commit -m "test(gospel): congela a mensagem da letra sem tema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the failing tests**

Acrescentar ao mesmo arquivo (e `LOUVOR_INSTRUCOES` no import):
```ts
const G = { ...NORMAL, tema: "gospel" };

describe("presente com fé", () => {
  it("é a mensagem de sempre mais a linha de fé", () => {
    const m = buildUserMessage({ ...G, tipo: "presente" }, "pt");
    expect(m).toContain("Fé: quem encomendou é evangélico(a). A letra pode falar de Deus, gratidão e bênção na vida de Rosa, sem pregar e sem tirar o foco de Rosa.");
    expect(m.replace(/\nFé: .*\n/, "\n")).toBe(buildUserMessage(NORMAL, "pt"));
  });
});

describe("louvor", () => {
  const L = { ...G, tipo: "louvor", relacao: "deus", nome: "Deus", ocasiao: "gratidao", tom: "reverente" };
  const m = buildUserMessage(L, "pt");

  it("é dirigido a Deus, com as instruções do louvor", () => {
    expect(m.startsWith("Destinatário: Deus. Isto é um LOUVOR, não um presente pra uma pessoa.")).toBe(true);
    expect(m).toContain(LOUVOR_INSTRUCOES);
    expect(m).toContain("Ocasião: louvor de gratidão");
    expect(m).toContain("Tom pedido: reverente");
    expect(m).toContain("Minha mãe criou a gente sozinha.");
  });

  it("não tem homenageado, direção nem filhos, mesmo se o cliente mandar", () => {
    expect(m).not.toContain("Homenageado");
    expect(m).not.toContain("quem encomendou PARA");
    expect(m).not.toContain("Pedro");
    expect(m).not.toContain("Filhos");
  });
});

describe("valores forjados não ativam", () => {
  it("tema diferente de 'gospel' exato é mensagem normal", () => {
    expect(buildUserMessage({ ...NORMAL, tema: "Gospel", tipo: "louvor" }, "pt")).toBe(buildUserMessage(NORMAL, "pt"));
  });
  it("tipo desconhecido é presente com fé", () => {
    expect(buildUserMessage({ ...G, tipo: "x" }, "pt")).toContain("Fé: ");
    expect(buildUserMessage({ ...G, tipo: "x" }, "pt")).toContain("Homenageado: Rosa");
  });
  it("fora do português não muda nada", () => {
    expect(buildUserMessage({ ...G, tipo: "louvor" }, "es")).toBe(buildUserMessage(NORMAL, "es"));
    expect(buildUserMessage({ ...G, tipo: "louvor" }, "en")).toBe(buildUserMessage(NORMAL, "en"));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/letra-prompt-gospel.test.ts`
Expected: FAIL nos novos (`LOUVOR_INSTRUCOES` indefinido / sem linha "Fé:"); os 2 snapshots continuam passando.

- [ ] **Step 4: Write minimal implementation**

Em `src/lib/letra-prompt.ts`:

No `RELACAO`, depois de `outro: "pessoa querida",`:
```ts
  // Só o louvor do quiz gospel grava isto (`aplicarTipo`). O prompt do louvor
  // não usa a linha de relação; o rótulo existe pra revisão e telas que leem
  // este mapa.
  deus: "Deus",
```

No `OCASIAO`, depois de `outro: "momento especial",`:
```ts
  // As ocasiões do louvor (quiz gospel, `quiz-flow-gospel.ts`).
  gratidao: "louvor de gratidão",
  testemunho: "testemunho de uma vitória",
  clamor: "clamor num momento difícil",
  adoracao: "adoração",
  igreja: "louvor pra cantar na igreja",
```

No `TOM`, depois do item `animada`:
```ts
  // Só aparece no quiz gospel.
  reverente: {
    pt: "reverente — adoração contemplativa, sem pressa",
    es: "reverente — adoración contemplativa, sin prisa",
  },
```

Logo antes de `export function sanitizeNome`:
```ts
/**
 * Como se escreve um LOUVOR (quiz gospel, tipo "louvor").
 *
 * Vai na mensagem do usuário, não no system prompt: o system é cacheado e o
 * funil normal não pode mudar uma vírgula por causa do gospel.
 */
export const LOUVOR_INSTRUCOES = `Como escrever este louvor:
- A letra fala COM Deus, em primeira pessoa ("eu", "Senhor", "Tu", "Te"). Não é uma música SOBRE Deus pra outra pessoa ouvir.
- Ela nasce do testemunho contado abaixo. Os detalhes concretos da história continuam sendo o que separa um louvor verdadeiro de um genérico: use no mínimo três.
- Vocabulário evangélico brasileiro: Senhor, Jesus, Pai, Espírito Santo, graça, fidelidade. Nada de santos, Maria ou terço. Nada de doutrina de denominação (dízimo, línguas, batismo).
- Não use como verso solto, sem um detalhe da história preso a ele: "Tu és fiel", "a vitória é certa", "nada é impossível pra Deus", "Rei dos reis", "derrama o Teu Espírito", "vaso nas mãos do oleiro", "deserto" como metáfora genérica.
- Só cite versículo se a pessoa citou na história. Nunca invente referência bíblica.
- Não cite filhos nem outras pessoas pelo nome, a não ser que estejam na história.`;
```

Em `buildUserMessage`, logo depois da linha `const linhaTom = ...;` (antes do comentário "QUEM FALA COM QUEM"):
```ts
  // O QUIZ GOSPEL (`quiz-flow-gospel.ts`). Só o português, e só com o valor
  // exato: o resto da mensagem de quem não é gospel não muda nada.
  const gospel = locale === "pt" && respostas.tema === "gospel";
  if (gospel && respostas.tipo === "louvor") {
    return `Destinatário: Deus. Isto é um LOUVOR, não um presente pra uma pessoa.
${LOUVOR_INSTRUCOES}

${L.ocasiao}: ${ocasiao}
${L.genero}: ${genero}
${L.voz}: ${voz}${linhaTom}

${L.historia}:
${historia}

${L.recado}:
${recado}`;
  }
  const linhaFe = gospel
    ? `
Fé: quem encomendou é evangélico(a). A letra pode falar de Deus, gratidão e bênção na vida de ${nome}, sem pregar e sem tirar o foco de ${nome}.`
    : "";
```

E no `return` final, trocar a linha `${L.voz}: ${voz}${linhaTom}` por `${L.voz}: ${voz}${linhaTom}${linhaFe}`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/letra-prompt-gospel.test.ts && npm run typecheck`
Expected: todos passam; os snapshots NÃO foram reescritos (`git diff --stat src/lib/__snapshots__` vazio).

- [ ] **Step 6: Commit**

```bash
git add src/lib/letra-prompt.ts src/lib/letra-prompt-gospel.test.ts
git commit -m "feat(gospel): letra de louvor e linha de fe no presente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: As telas (rota, quiz, abertura, revisão)

**Files:**
- Modify: `src/routes/criar.tsx`
- Modify: `src/components/quiz/Quiz.tsx`
- Modify: `src/components/quiz/AberturaPresente.tsx`
- Modify: `src/lib/quiz-store.ts` (ação `setRespostas`)
- Modify: `src/lib/textos.ts` (rótulo `tipo` no PT)
- Test: `src/lib/quiz-gospel-contrato.test.ts`

**Interfaces:**
- Consumes: `temaDoParametro`, `temaEfetivo`, `carimbarTema`, `Tema` (Task 1); `quizFlow(locale, tema)`, `skipDoFluxo(tema)`, `aplicarTipo`, `numeroCanonico` (Task 3)
- Produces: `Quiz` aceita `temaUrl?: Tema | null`; `AberturaPresente` aceita `tema?: Tema | null`; store ganha `setRespostas(respostas: Record<string, string | string[]>): void`

- [ ] **Step 1: Write the failing test**

`src/lib/quiz-gospel-contrato.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// O projeto não renderiza componente em teste (`vitest.config.ts`): o caminho
// das telas é garantido lendo o fonte, como em `admin-painel-contrato.test.ts`.
const ROTA = readFileSync("src/routes/criar.tsx", "utf8");
const QUIZ = readFileSync("src/components/quiz/Quiz.tsx", "utf8");
const ABERTURA = readFileSync("src/components/quiz/AberturaPresente.tsx", "utf8");
const STORE = readFileSync("src/lib/quiz-store.ts", "utf8");
const TEXTOS = readFileSync("src/lib/textos.ts", "utf8");

describe("telas do quiz gospel", () => {
  it("/criar aceita ?t e passa o tema ao quiz", () => {
    expect(ROTA).toMatch(/t: z\.string\(\)\.optional\(\)/);
    expect(ROTA).toMatch(/temaUrl=\{temaDoParametro\(t\)\}/);
  });

  it("o quiz monta fluxo e pulagem pelo tema", () => {
    expect(QUIZ).toMatch(/quizFlow\(locale, tema\)/);
    expect(QUIZ).toMatch(/skipDoFluxo\(tema\)/);
    expect(QUIZ).not.toMatch(/, QUIZ_SKIP\)/);
  });

  it("o tema é carimbado antes do quiz_started", () => {
    const carimbo = QUIZ.indexOf("carimbarTema(temaUrl)");
    const inicio = QUIZ.indexOf('trackEventOnce("quiz_started"');
    expect(carimbo).toBeGreaterThan(-1);
    expect(carimbo).toBeLessThan(inicio);
  });

  it("o tema só é gravado nas respostas depois da reidratação da store", () => {
    expect(QUIZ).toMatch(/onFinishHydration\(gravar\)/);
  });

  it("escolher o tipo passa por aplicarTipo", () => {
    expect(QUIZ).toMatch(/setRespostas\(aplicarTipo\(/);
    expect(STORE).toMatch(/setRespostas: \(respostas\) =>/);
  });

  it("o passo do funil gospel usa a escala normal e o tipo não grava lead", () => {
    expect(QUIZ).toMatch(/numeroCanonico\(quizFlow\(locale\), step\)/);
    expect(QUIZ).toMatch(/\(isQuestion\(step\) && qNum > 0\) \|\| isContact\(step\)/);
  });

  it("a revisão mostra o tipo e esconde Deus", () => {
    expect(QUIZ).toMatch(/const ordem = \["tipo", "relacao"/);
    expect(QUIZ).toMatch(/respostas\.tipo === "louvor" && \(k === "relacao" \|\| k === "nome"\)/);
    expect(TEXTOS).toMatch(/tipo: "O que é"/);
  });

  it("a abertura tem a copy gospel e o exemplo real", () => {
    expect(ABERTURA).toMatch(/const COPY_GOSPEL/);
    expect(ABERTURA).toContain("CRIAR MEU LOUVOR GRÁTIS");
    expect(ABERTURA).toContain("Denise, mulher de palavra e de fé");
    expect(ABERTURA).toContain('"denise"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quiz-gospel-contrato.test.ts`
Expected: FAIL em todos os 8.

- [ ] **Step 3: Store e textos**

`src/lib/quiz-store.ts`: no tipo do estado, depois de `setResposta: (field: string, value: string | string[]) => void;`:
```ts
  /** Troca as respostas inteiras (o `tipo` do quiz gospel mexe em vários campos). */
  setRespostas: (respostas: Record<string, string | string[]>) => void;
```
e na implementação, depois do bloco de `setResposta`:
```ts
      setRespostas: (respostas) => set({ respostas, letraFinal: null }),
```

`src/lib/textos.ts`, nos `rotulos` do PT (linha `relacao: "Pra quem", ...`), acrescentar no começo do objeto:
```ts
    tipo: "O que é",
```

- [ ] **Step 4: Rota**

`src/routes/criar.tsx`:
- import: `import { temaDoParametro } from "@/lib/tema";`
- `const searchSchema = z.object({ step: z.string().optional(), t: z.string().optional() });`
- comentário acima do schema, acrescentar: `// \`?t=gospel\` abre o quiz gospel (\`quiz-flow-gospel.ts\`).`
- componente:
```tsx
  component: function CriarPt() {
    const { step, t } = Route.useSearch();
    return <Quiz locale={LOCALE_PADRAO} stepId={step} temaUrl={temaDoParametro(t)} />;
  },
```

- [ ] **Step 5: Quiz.tsx**

Imports: trocar `import { quizFlow, QUIZ_SKIP } from "@/lib/quiz-flow";` por
```ts
import { quizFlow, skipDoFluxo } from "@/lib/quiz-flow";
import { aplicarTipo, numeroCanonico } from "@/lib/quiz-flow-gospel";
import { carimbarTema, temaEfetivo, type Tema } from "@/lib/tema";
```

Início do componente — substituir de `export function Quiz(` até `const total = ...` por:
```tsx
export function Quiz({
  locale,
  stepId,
  temaUrl = null,
}: {
  locale: Locale;
  stepId?: string;
  /** `?t=` da URL, só na primeira tela: depois o tema vive em `respostas.tema`. */
  temaUrl?: Tema | null;
}) {
  const navigate = useNavigate();
  const respostas = useQuizStore((s) => s.respostas);
  const setResposta = useQuizStore((s) => s.setResposta);
  const setRespostas = useQuizStore((s) => s.setRespostas);
  const email = useQuizStore((s) => s.email);
  const setEmail = useQuizStore((s) => s.setEmail);
  const reset = useQuizStore((s) => s.reset);
  // O TEMA (gospel). A URL decide a primeira tela, inclusive no servidor; do
  // passo 2 em diante o `?t=` some da URL e quem segura é `respostas.tema`.
  const tema = temaEfetivo(temaUrl, respostas, locale);
  const QUIZ_FLOW = quizFlow(locale, tema);
  const SKIP = skipDoFluxo(tema);
  const T = t(locale);
  const rota = caminho("/criar", locale);

  const idx = indexOfId(QUIZ_FLOW, stepId);
  const step = QUIZ_FLOW[idx];
  // O total é o do funil NORMAL mesmo no gospel: é a escala que o banco
  // guarda em `furthest_step` e que o painel lê.
  const total = useMemo(() => totalQuestions(quizFlow(locale)), []);
```
(As declarações antigas de `respostas`, `setResposta`, `email`, `setEmail`, `reset`, `T`, `rota` que ficavam depois saem — não duplicar.)

Trocar `const qNum = questionNumber(QUIZ_FLOW, idx);` por:
```tsx
  // No gospel, o número do passo normal de mesmo campo (`numeroCanonico`):
  // o `tipo` vale 0 como a abertura, e o louvor pula de 0 pra 3 em vez de
  // gravar números que no funil normal querem dizer outra pergunta.
  const qNum = tema ? numeroCanonico(quizFlow(locale), step) : questionNumber(QUIZ_FLOW, idx);
```

No `useEffect` de montagem, logo ANTES de `carimbarExperimentos();`:
```tsx
    // O tema vem antes do quiz_started pelo mesmo motivo da variante: o
    // primeiro evento da sessão é o que marca a entrada no funil.
    if (temaUrl && locale === "pt") carimbarTema(temaUrl);
```

Logo DEPOIS desse `useEffect` de montagem (depois do `}, []);` dele), novo efeito:
```tsx
  // Grava o tema nas respostas (é o que segura o gospel do passo 2 em diante e
  // leva o tema ao prompt) e na atribuição de quem o trouxe salvo. Depois do
  // efeito de montagem de propósito: lá o `reset()` de sessão gasta apagaria.
  // A comparação evita o `setResposta`, que zera a letra já escrita.
  // ESPERA A REIDRATAÇÃO, como o `decidirPasso` acima: gravar antes e a store
  // persistida chegar depois apagaria o tema, e o quiz viraria o normal no
  // passo 2, quando o `?t=` já saiu da URL.
  useEffect(() => {
    if (!tema) return;
    const gravar = () => {
      if (useQuizStore.getState().respostas.tema !== tema) setResposta("tema", tema);
      carimbarTema(tema);
    };
    if (useQuizStore.persist.hasHydrated()) gravar();
    else return useQuizStore.persist.onFinishHydration(gravar);
  }, [tema]); // eslint-disable-line react-hooks/exhaustive-deps
```

No efeito de captura de lead, trocar:
- `if (isQuestion(step) || isContact(step)) {` por `if ((isQuestion(step) && qNum > 0) || isContact(step)) {`
- `if (isIntro(step)) {` (o bloco que dispara `quiz_step` com `q: 0`) por `if (isIntro(step) || (isQuestion(step) && qNum === 0)) {`
e acrescentar acima do primeiro `if`:
```tsx
    // O `tipo` do gospel (qNum 0) é tratado como a abertura: mede, não grava
    // lead — senão ele gravaria o passo 1, que no banco quer dizer "pra quem".
```

`goNext`/`goPrev`: trocar os dois `QUIZ_SKIP` por `SKIP`.

Render da abertura:
```tsx
          <AberturaPresente
            locale={locale}
            tema={tema}
            aoComecar={() => {
              // O clique é a métrica desta tela. `quiz_step` diz quantos
              // CHEGARAM na abertura; este diz quantos ela convenceu.
              trackEvent("abertura_comecar", { locale, ...(tema ? { tema } : {}) });
              goNext();
            }}
          />
```

No `ChipsStep`, trocar a primeira linha do `onChange` (`setResposta(step.field, v);`) por:
```tsx
                  // O tipo do gospel mexe em vários campos de uma vez
                  // (`aplicarTipo`): louvor preenche Deus, presente desfaz.
                  if (step.field === "tipo") setRespostas(aplicarTipo(useQuizStore.getState().respostas, String(v)));
                  else setResposta(step.field, v);
```

`ReviewScreen`:
- depois de `const T = t(locale);`: `const tema = locale === "pt" && respostas.tema === "gospel" ? "gospel" : null;`
- `const ordem = ["tipo", "relacao", "nome", "filhos", "ocasiao", "estilo", "voz", "historia1", "historia2", "recado"];`
- `for (const passo of quizFlow(locale))` → `for (const passo of quizFlow(locale, tema))`
- `.filter((k) => respostas[k])` →
```tsx
          // No louvor, "Pra quem: Deus" e "Nome: Deus" repetem o que o tipo já diz.
          .filter((k) => respostas[k] && !(respostas.tipo === "louvor" && (k === "relacao" || k === "nome")))
```

Conferir com `grep -n "QUIZ_SKIP\|quizFlow(" src/components/quiz/Quiz.tsx` que não sobrou nenhum uso antigo.

- [ ] **Step 6: AberturaPresente.tsx**

Import: `import type { Tema } from "@/lib/tema";`

Logo depois do fechamento de `const COPY = { ... } as const;`... (o objeto `COPY` termina antes de `EXEMPLO_ES`; colocar depois dele):
```tsx
// A ABERTURA GOSPEL (`/criar?t=gospel`, 02/10/2026). A mesma tela, com a
// promessa do anúncio gospel. Os versos são o REFRÃO literal de "Mulher de
// Palavra" (`ExemplosReais`, token 2459f4b76e1b49c58be203): exemplo real,
// gospel, o mesmo trecho de áudio que a home toca. Nada escrito pra ilustrar.
const COPY_GOSPEL: (typeof COPY)["pt"] = {
  ...COPY.pt,
  tituloAntes: "Crie o seu próprio ",
  tituloOuro: "louvor",
  tituloDepois: "",
  explicacao: "Você conta o que Deus fez na sua vida. Fica pronto em 1 minuto, de graça.",
  cta: "CRIAR MEU LOUVOR GRÁTIS",
  nome: "Denise",
  foto: "/img/exemplos/denise.webp",
  versos: [
    "Denise, mulher de palavra e de fé",
    "Batalhadora que nunca soltou minha mão",
    "Nos dias mais difíceis foi você quem me ouviu",
    "E me ensinou que não se desiste, não",
  ],
};
```
Se o `tsc` reclamar do tipo `(typeof COPY)["pt"]` por causa do `as const`, usar `typeof COPY.pt` com os mesmos campos.

Props:
```tsx
export function AberturaPresente({
  locale = "pt",
  tema = null,
  aoComecar,
}: {
  locale?: Locale;
  tema?: Tema | null;
  aoComecar: () => void;
}) {
  const gospel = tema === "gospel" && locale === "pt";
```
`const C = ...` passa a começar com `gospel ? COPY_GOSPEL : ` na frente da expressão atual.
`const slug = ...` passa a começar com `gospel ? "denise" : ` na frente da expressão atual.
Nos três `trackEvent("abertura_play…", { locale })`, trocar o payload por `{ locale, ...(gospel ? { tema: "gospel" } : {}) }`.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run src/lib/quiz-gospel-contrato.test.ts src/lib/quiz-flow-gospel.test.ts && npm run typecheck`
Expected: 8 + todos passam; tsc limpo.

- [ ] **Step 8: Commit**

```bash
git add src/routes/criar.tsx src/components/quiz/Quiz.tsx src/components/quiz/AberturaPresente.tsx src/lib/quiz-store.ts src/lib/textos.ts src/lib/quiz-gospel-contrato.test.ts
git commit -m "feat(gospel): /criar?t=gospel, abertura de louvor e quiz pelo tema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: E-mail de ocasião pula o louvor

**Files:**
- Modify: `inngest/functions/ocasiaoCalendario.ts` (logo depois de `const relacao = String(respostas.relacao ?? "").toLowerCase();`)
- Test: `src/lib/quiz-gospel-contrato.test.ts` (novo `it`)

- [ ] **Step 1: Write the failing test**

No fim de `src/lib/quiz-gospel-contrato.test.ts`:
```ts
describe("e-mail de ocasião", () => {
  it("pula quem fez um louvor", () => {
    const fonte = readFileSync("inngest/functions/ocasiaoCalendario.ts", "utf8");
    expect(fonte).toMatch(/if \(relacao === "deus"\) continue;/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quiz-gospel-contrato.test.ts`
Expected: FAIL só no novo.

- [ ] **Step 3: Write minimal implementation**

Depois da linha `const relacao = ...`:
```ts
        // LOUVOR (quiz gospel): a música foi pra Deus. A oferta de ocasião
        // cita a música anterior pelo nome do homenageado, e "a música de
        // Deus" ali não faz sentido.
        if (relacao === "deus") continue;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/quiz-gospel-contrato.test.ts && npm run typecheck`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add inngest/functions/ocasiaoCalendario.ts src/lib/quiz-gospel-contrato.test.ts
git commit -m "feat(gospel): e-mail de ocasiao nao vai pra quem fez louvor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: O painel

**Files:**
- Create: `src/lib/admin-tema.ts`
- Modify: `src/lib/admin-dados.ts` (select dos leads; remontagem de `respostas`; tipo do retorno; cálculo; objeto de retorno)
- Modify: `src/routes/admin.tsx` (seção nova depois da "De onde vêm as vendas")
- Test: `src/lib/admin-tema.test.ts`; `src/lib/admin-painel-contrato.test.ts` (novo `it`)

**Interfaces:**
- Produces:
  - `type ChaveTema = "gospel · louvor" | "gospel · presente" | "gospel · sem tipo" | "resto"`
  - `type LinhaTema = { tema: ChaveTema; leads: number; letras: number; vendas: number; receitaBrl: number; conversaoPct: number; receitaPorLeadBrl: number }`
  - `chaveTema(l: LeadTema): ChaveTema`
  - `porTemaDe(leads: LeadTema[], vendas: VendaTema[], comMusica: Set<string | null>): LinhaTema[]`
  - `Painel.porTema: LinhaTema[]`

- [ ] **Step 1: Write the failing test**

`src/lib/admin-tema.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { chaveTema, porTemaDe } from "./admin-tema";

const lead = (id: string, tema?: string, tipo?: string, viaRespostas = false) => ({
  id,
  attribution: tema && !viaRespostas ? { tema } : {},
  respostas: { ...(tipo ? { tipo } : {}), ...(tema && viaRespostas ? { tema } : {}) },
});

describe("chaveTema", () => {
  it("separa louvor, presente, sem tipo e resto", () => {
    expect(chaveTema(lead("1", "gospel", "louvor"))).toBe("gospel · louvor");
    expect(chaveTema(lead("2", "gospel", "presente"))).toBe("gospel · presente");
    expect(chaveTema(lead("3", "gospel"))).toBe("gospel · sem tipo");
    expect(chaveTema(lead("4"))).toBe("resto");
  });
  it("aceita o tema pelas respostas quando a atribuição não tem", () => {
    expect(chaveTema(lead("5", "gospel", "louvor", true))).toBe("gospel · louvor");
  });
  it("valor diferente de 'gospel' é resto", () => {
    expect(chaveTema(lead("6", "Gospel", "louvor"))).toBe("resto");
  });
});

describe("porTemaDe", () => {
  const leads = [lead("a", "gospel", "louvor"), lead("b", "gospel", "louvor"), lead("c"), lead("d")];
  const vendas = [
    { quiz_response_id: "a", receitaBrl: 38 },
    { quiz_response_id: "c", receitaBrl: 38 },
    { quiz_response_id: "fora-do-periodo", receitaBrl: 38 },
  ];
  const linhas = porTemaDe(leads, vendas, new Set(["a", "c", "d"]));

  it("só mostra as linhas gospel que têm lead, e o resto", () => {
    expect(linhas.map((l) => l.tema)).toEqual(["gospel · louvor", "resto"]);
  });
  it("conta leads, letras, vendas e receita por lead", () => {
    expect(linhas[0]).toEqual({
      tema: "gospel · louvor", leads: 2, letras: 1, vendas: 1, receitaBrl: 38,
      conversaoPct: 50, receitaPorLeadBrl: 19,
    });
    // a venda sem lead no período cai no resto
    expect(linhas[1]).toMatchObject({ leads: 2, letras: 2, vendas: 2, receitaBrl: 76, receitaPorLeadBrl: 38 });
  });
  it("sem nenhum lead gospel devolve vazio (o cartão some)", () => {
    expect(porTemaDe([lead("x")], [], new Set())).toEqual([]);
  });
  it("sem lead não divide por zero", () => {
    const [g] = porTemaDe([], [{ quiz_response_id: null, receitaBrl: 0 }], new Set());
    expect(g).toBeUndefined();
  });
});
```

E em `src/lib/admin-painel-contrato.test.ts`, dentro do `describe("admin-dados", ...)` (ou num `describe` novo no fim, lendo `src/routes/admin.tsx` com `readFileSync`):
```ts
  it("painel separa o gospel (02/10)", () => {
    expect(DADOS).toMatch(/r_tipo:respostas->>tipo/);
    expect(DADOS).toMatch(/r_tema:respostas->>tema/);
    expect(DADOS).toMatch(/porTemaDe\(/);
    expect(readFileSync("src/routes/admin.tsx", "utf8")).toMatch(/dados\.porTema/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/admin-tema.test.ts src/lib/admin-painel-contrato.test.ts`
Expected: FAIL (import de `./admin-tema` não resolve; contrato novo falha).

- [ ] **Step 3: Write `admin-tema.ts`**

```ts
// O GOSPEL NO PAINEL (02/10/2026): leads, letras, vendas e receita por lead
// de quem entrou por `/criar?t=gospel`, separados em louvor e presente,
// contra o resto. Puro: `admin-dados.ts` passa as listas que já leu.

export type ChaveTema = "gospel · louvor" | "gospel · presente" | "gospel · sem tipo" | "resto";

export type LeadTema = {
  id: string;
  attribution: Record<string, unknown> | null;
  respostas: Record<string, unknown> | null;
};

/** Venda já filtrada por `ehVenda` e já convertida pra real. */
export type VendaTema = { quiz_response_id: string | null; receitaBrl: number };

export type LinhaTema = {
  tema: ChaveTema;
  leads: number;
  letras: number;
  vendas: number;
  receitaBrl: number;
  conversaoPct: number;
  receitaPorLeadBrl: number;
};

const ORDEM: ChaveTema[] = ["gospel · louvor", "gospel · presente", "gospel · sem tipo", "resto"];

export function chaveTema(l: LeadTema): ChaveTema {
  // Pela atribuição OU pelas respostas: a linha de lead de uma sessão que já
  // existia antes do anúncio gospel pode ter a atribuição antiga.
  const gospel = l.attribution?.tema === "gospel" || l.respostas?.tema === "gospel";
  if (!gospel) return "resto";
  const tipo = l.respostas?.tipo;
  return tipo === "louvor" ? "gospel · louvor" : tipo === "presente" ? "gospel · presente" : "gospel · sem tipo";
}

export function porTemaDe(
  leads: LeadTema[],
  vendas: VendaTema[],
  comMusica: Set<string | null>,
): LinhaTema[] {
  const acc = new Map<ChaveTema, { leads: number; letras: number; vendas: number; receitaBrl: number }>();
  const linha = (k: ChaveTema) => {
    const v = acc.get(k) ?? { leads: 0, letras: 0, vendas: 0, receitaBrl: 0 };
    acc.set(k, v);
    return v;
  };
  const chaveDoLead = new Map<string, ChaveTema>();
  for (const l of leads) {
    const k = chaveTema(l);
    chaveDoLead.set(l.id, k);
    const v = linha(k);
    v.leads++;
    if (comMusica.has(l.id)) v.letras++;
  }
  for (const venda of vendas) {
    const k = (venda.quiz_response_id && chaveDoLead.get(venda.quiz_response_id)) || "resto";
    const v = linha(k);
    v.vendas++;
    v.receitaBrl += venda.receitaBrl;
  }
  const temGospel = ORDEM.slice(0, 3).some((k) => (acc.get(k)?.leads ?? 0) > 0);
  if (!temGospel) return [];
  return ORDEM.filter((k) => k === "resto" || (acc.get(k)?.leads ?? 0) > 0).map((k) => {
    const v = acc.get(k) ?? { leads: 0, letras: 0, vendas: 0, receitaBrl: 0 };
    return {
      tema: k,
      ...v,
      conversaoPct: v.leads > 0 ? (v.vendas / v.leads) * 100 : 0,
      receitaPorLeadBrl: v.leads > 0 ? v.receitaBrl / v.leads : 0,
    };
  });
}
```

- [ ] **Step 4: Ligar em `admin-dados.ts`**

- import no topo: `import { porTemaDe, type LinhaTema } from "@/lib/admin-tema";`
- no tipo do retorno, logo depois do bloco do campo `porOrigem: Array<{ ... }>;`:
```ts
  /** Quem entrou por `/criar?t=gospel` contra o resto (`admin-tema.ts`). Vazio sem lead gospel. */
  porTema: LinhaTema[];
```
- no select dos leads, a string `"r_estilo:respostas->>estilo, r_ocasiao:respostas->>ocasiao"` vira
  `"r_estilo:respostas->>estilo, r_ocasiao:respostas->>ocasiao," + "r_tipo:respostas->>tipo, r_tema:respostas->>tema"`
- na remontagem de `respostas`, depois de `ocasiao: c.r_ocasiao ?? undefined,`:
```ts
          tipo: c.r_tipo ?? undefined,
          tema: c.r_tema ?? undefined,
```
- logo depois do bloco que monta `porOrigem` (o `.sort(...)` final dele):
```ts
  // O GOSPEL (`/criar?t=gospel`): mesma leitura do porOrigem, por tema.
  const porTema = porTemaDe(
    leads,
    pagos.map((p) => ({ quiz_response_id: p.quiz_response_id, receitaBrl: valorEmBrl(p) })),
    comMusica,
  );
```
- no objeto de retorno, depois de `porOrigem,`: `porTema,`

(Atualizar o comentário do tipo `Lead` que diz "Só tem `nome`, `relacao`, `estilo` e `ocasiao`" para incluir `tipo` e `tema`.)

- [ ] **Step 5: A seção em `admin.tsx`**

Logo depois do `</Secao>` que fecha "De onde vêm as vendas":
```tsx
          {/* O GOSPEL (02/10): só aparece com lead de `/criar?t=gospel` no
              período. Receita por lead é a coluna que decide se a porta
              gospel vale o anúncio. */}
          {dados.porTema?.length > 0 && (
            <Secao titulo="Gospel" sub="Quem entrou por /criar?t=gospel, contra o resto do funil">
              <Tabela cabecalho={["Tema", "Leads", "Letras", "Vendas", "Receita", "Conv.", "Receita/lead"]}>
                {dados.porTema.map((l) => (
                  <tr key={l.tema} className={cn(l.tema !== "resto" && "bg-[var(--acento)]/5")}>
                    <td className="px-3 py-2.5 font-medium">{l.tema}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{l.leads}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{l.letras}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{l.vendas}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {l.receitaBrl > 0 ? brl(l.receitaBrl) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{pc(l.conversaoPct)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {l.leads > 0 ? brl(l.receitaPorLeadBrl) : "—"}
                    </td>
                  </tr>
                ))}
              </Tabela>
            </Secao>
          )}
```
(`Secao`, `Tabela`, `cn`, `brl`, `pc` já existem no arquivo: conferir com `grep -n "function Secao\|function Tabela\|const brl\|const pc\|function brl\|function pc" src/routes/admin.tsx`.)

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/lib/admin-tema.test.ts src/lib/admin-painel-contrato.test.ts && npm run typecheck`
Expected: todos passam; tsc limpo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin-tema.ts src/lib/admin-tema.test.ts src/lib/admin-dados.ts src/routes/admin.tsx src/lib/admin-painel-contrato.test.ts
git commit -m "feat(gospel): tabela Gospel no painel, louvor e presente contra o resto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Registro (CLAUDE.md) e suíte inteira

**Files:**
- Modify: `CLAUDE.md` (seção nova antes de `## Riscos conhecidos`; linha nova na tabela de "Testes em andamento")

- [ ] **Step 1: Seção no CLAUDE.md**

Inserir, logo antes da linha `## Riscos conhecidos` (com Edit; sem prettier):
```markdown
## /criar gospel (02/10/2026)

`/criar?t=gospel` é a porta dos anúncios gospel. Desenho em
`docs/superpowers/specs/2026-10-02-criar-gospel-design.md`.

- **O tema mora em `respostas.tema` e `attribution.tema`** (`tema.ts`). O `?t=`
  só decide a primeira tela; o quiz troca a URL a cada passo e o tema segue
  pelas respostas. Só o funil `pt`: Ballad e `/es` ignoram.
- **O quiz gospel é camada** (`quiz-flow-gospel.ts` sobre o `QUIZ_FLOW_PT`).
  Passo `tipo` (louvor/presente); os passos `_louvor` gravam os MESMOS campos
  dos originais e são exclusivos pelo `SKIP_GOSPEL`. Louvor grava
  `relacao = "deus"` e `nome = "Deus"` (`aplicarTipo`).
- **`furthest_step` do gospel está na escala do funil normal**
  (`numeroCanonico`); o `tipo` vale 0 e não grava lead, como a abertura.
- **Os 5 estilos gospel** moram fora da lista normal (`generosGospel`), mas o
  `acharGenero` acha (chave `gospel_pt` do `TODAS`).
- **O prompt do louvor vai na mensagem do usuário** (`LOUVOR_INSTRUCOES`), não
  no system: o system é cacheado e o funil normal não muda.
  `letra-prompt-gospel.test.ts` congela a mensagem sem tema em snapshot.
- Oferta, e-mails e página presente NÃO mudaram (decisão do dono). O e-mail de
  ocasião pula quem fez louvor.
- Painel: seção "Gospel" (`admin-tema.ts`), só com lead gospel no período.
```

Na tabela de "Testes em andamento", nova linha antes de `| \`email_confirma\``:
```markdown
| `/criar?t=gospel` | 02/10 | Não é A/B: porta própria dos anúncios gospel (louvor pra Deus ou presente com fé, 5 estilos gospel). Comparado contra o resto do funil na seção "Gospel" do painel | receita por lead do gospel contra o resto; louvor × presente | 09/10 | não (só Serenata) |
```

- [ ] **Step 2: Suíte inteira e tipos**

Run: `npm test > .superpowers/gospel-suite.txt 2>&1; tail -15 .superpowers/gospel-suite.txt; npm run typecheck`
Expected: todos os testes passam; o único erro é o pré-existente "Cannot find package 'jsdom'"; tsc limpo.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(gospel): registro do /criar gospel no CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Publicar e conferir (PARA E PERGUNTA)

Esta tarefa tem efeitos fora do repositório. Cada passo marcado com ⛔ espera o "sim" do dono no chat.

- [ ] **Step 1: ⛔ Merge e push.** Perguntar ao dono. Com o sim: merge da branch no `master`, `git pull --rebase`, `git push` (nunca `--force`). Conferir que o `package-lock.json` não mudou só por `libc` (memória `lockfile-libc-npm-local`).

- [ ] **Step 2: Deploy pronto.**
Run: `vercel ls musica-personalizada --scope team_hEMUGcKgu8uIFM9yueV0K5si | head -5` e depois `vercel inspect <url> --scope team_hEMUGcKgu8uIFM9yueV0K5si`
Expected: status Ready (mesmo para `balladgift`).
Depois: `curl -s -X PUT https://www.serenatagift.com/api/inngest` e `curl -s -X PUT https://www.balladgift.com/api/inngest`
Expected: "Successfully registered" nos dois.

- [ ] **Step 3: Conferir no navegador (painel do Claude Browser), sem preencher formulário.**
  - `https://www.serenatagift.com/criar` → abertura de sempre ("Uma música feita da história de quem você ama", Isabela).
  - `https://www.serenatagift.com/criar?t=gospel` → `get_page_text` mostra "Crie o seu próprio louvor", "CRIAR MEU LOUVOR GRÁTIS" e o refrão da Denise; o play toca (`read_network_requests` mostra `denise.mp3` 200 depois do clique).
  - Clicar em começar → passo "O que você quer criar?" com os dois chips; escolher "Um louvor pra Deus" → "Qual é o motivo do seu louvor?"; voltar, escolher presente → "Pra quem é esse presente?".
  - Avançar até "Qual o estilo da música?" e conferir os 5 estilos.
  - `https://www.balladgift.com/criar?t=gospel` → abertura da Ballad de sempre.
  - Limpar o estado do navegador do painel depois (`localStorage.clear()` via javascript_tool), pra não deixar sessão gospel de teste.

- [ ] **Step 4: ⛔ Três louvores reais.** A geração da letra só existe em produção (esta máquina não tem as chaves, e o dono não quer chave fora da Vercel). Perguntar ao dono se ele faz os três pelo `/criar?t=gospel` (gratidão, momento difícil, testemunho) ou se autoriza preencher com um e-mail de teste dele. Ler as três letras e reportar: falam COM Deus em primeira pessoa, usam ≥3 detalhes da história, nenhum clichê da lista solto, nenhum versículo inventado.

- [ ] **Step 5: Interpolações com `nome = "Deus"`** (spec §6). Com uma das sessões de louvor do Step 4, abrir reveal, oferta e a página presente e listar as frases que leem errado (ex.: "da Deus"). Não corrigir: reportar ao dono.
