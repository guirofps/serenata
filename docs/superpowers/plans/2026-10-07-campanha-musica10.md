# Campanha MUSICA10 — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cupom `MUSICA10` (R$ 10 em qualquer compra da Serenata, 7 dias) + e-mail elegante em duas versões, enviado em levas pra toda a base `pt` que deixou e-mail.

**Architecture:**
- **Cupom:** catálogo puro em `src/lib/cupom.ts`, sem imports, lido por site, server functions, webhooks e Inngest. Toda rota que cobra recalcula o valor no servidor a partir do código. O pedido grava o cupom, e é por ele que o webhook confere o valor do upsell.
- **Base:** a base vira uma fila (`campanha_envios`), montada uma vez por uma função SQL.
- **Envio:** um job do Inngest de hora em hora drena 300 por rodada, em lotes de 100 pelo `resend.batch` com chave de idempotência. Um freio por taxa de bounce e reclamação para o envio sozinho.

**Tech Stack:**
- TanStack Start (React 19) + Supabase (PostgREST + SQL) + Inngest v4.
- Resend 6.x + Vitest 3 (`environment: node`, só `src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-07-campanha-musica10-design.md`

## Global Constraints

- Só Serenata, só funil `pt`. Ballad (`MARCA_ATIVA.chave === "ballad"`) e `/es` não mudam em comportamento.
- **O preço nunca vem do cliente.** Só o CÓDIGO do cupom viaja; o valor sai do catálogo + `centavosComCupom`, no servidor.
- `MUSICA10`: `tipo: "fixo"`, `centavos: 1000`. Piso `PISO_CENTAVOS = 500`; nunca sobe o preço.
- **Cupom e convite não somam.** Vale o desenho que já existe: com cupom aplicado, o convite nem é consultado.
- A oferta da recuperação (`criar-pix-oferta.ts`, `/oferta/<token>`), o Stripe e a Perfect Pay não recebem cupom.
- `cupom.ts` e `campanha-musica10.ts` não importam nada com alias `@`: o Inngest roda como ESM puro e não resolve alias. Imports relativos usam `.js`.
- **A migration é aplicada ANTES do deploy.** O código novo grava `pedidos.cupom`, e sem a coluna o cartão do upsell recusa cobrar.
- **O envio só liga com o "pode mandar" do dono**, uma aprovação SEPARADA desta implementação. O interruptor é a env `CAMPANHA_MUSICA10_ON=1`, que o dono põe na Vercel.
- **Regras da casa:**
  - nunca imprimir valor de segredo;
  - nunca `git push --force`; sempre `git pull --rebase`;
  - não commitar o diff do `package-lock` onde o npm local remove `libc`.
- **Copy:** sem número inventado, sem depoimento fabricado, sem "60 segundos". Prazo de entrega: "em minutos".
- **Git nesta pasta do Google Drive:** em 07/10 o `git` falhava com `mmap failed: Operation timed out`. Antes do Task 1, o dono marca a pasta como "Disponível off-line" no Google Drive. Conferir com `git log --oneline -1`. Sem git funcionando, não começar.

## Review Focus

1. **Lead com sessão antiga não paga** volta pelo link e cai no checkout da música ANTIGA, com o mesmo `quiz.id`. A referência do PIX tem que mudar com o cupom (`:d`), senão o gateway recusa um valor diferente na mesma referência. Teste no Task 2.
2. **PIX do upsell gerado com cupom às 23h50 do último dia e pago às 00h10 do dia seguinte:** tem que liberar. O webhook confere pela data de CRIAÇÃO do pedido. Teste no Task 1 (`valorEsperadoDoUpsell`).
3. **Visitante do braço E** (R$ 54,90, preso no navegador) com cupom: tela e cobrança dizem R$ 44,90, não R$ 28. Teste no Task 1.
4. **`?cupom=MUSICA10` aberto no `/es` ou na Ballad:** nenhum desconto aparece e nenhum é cobrado. Teste no Task 1 (`descontoNaTela` com `es`/`en`).
5. **Retentativa do step do Inngest depois de o Resend aceitar o lote:** ninguém recebe duas vezes. Coberto pela chave de idempotência de 24h + `enviado_em`; checar na revisão, porque não tem teste unitário possível.

---

### Task 1: Catálogo de cupons com valor fixo

**Files:**
- Modify: `src/lib/cupom.ts` (reescrita inteira)
- Modify: `src/lib/cupom.test.ts` (os 4 testes atuais continuam)

**Interfaces:**
- Produces, todos exportados de `src/lib/cupom.ts`:
  - `type Alvo = "musica" | "extra" | "tres" | "quadro" | "video"`
  - `type Cupom = { codigo: string; texto: string; de: string; por: string }` (sem mudança)
  - `const MUSICA10 = "MUSICA10"`
  - `const MUSICA10_VALE_ATE: string` (ISO `AAAA-MM-DD`)
  - `const PISO_CENTAVOS = 500`
  - `cupomAtivo(locale, agora?) → Cupom | null` (sem mudança de assinatura; só os de preço final)
  - `centavosComCupom(baseCentavos: number, codigo: string | null | undefined, agora?: Date, alvo?: Alvo) → number`
  - `codigoAplicado(baseCentavos, codigo, agora?, alvo?) → string | null` (código normalizado, só se baixou o preço)
  - `descontoNaTela(codigo, locale, baseCentavos, alvo?, agora?) → (Cupom & { porCentavos: number | null }) | null`
  - `valorEsperadoDoUpsell(precoCatalogoCentavos: number, alvo: Alvo, pedido: { cupom?: string | null; created_at?: string | null } | null) → number`
  - `validadeCurta(codigo: string) → string` (`"20/10"`)

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `src/lib/cupom.test.ts`, sem apagar o que existe:

```ts
import {
  MUSICA10,
  MUSICA10_VALE_ATE,
  codigoAplicado,
  descontoNaTela,
  valorEsperadoDoUpsell,
  validadeCurta,
} from "./cupom";

// Um instante seguramente dentro da validade do MUSICA10 e um fora.
const dentro = new Date(`${MUSICA10_VALE_ATE}T12:00:00-03:00`);
const ultimoMinuto = new Date(`${MUSICA10_VALE_ATE}T23:59:00-03:00`);
const depois = new Date(new Date(`${MUSICA10_VALE_ATE}T23:59:59-03:00`).getTime() + 2000);

describe("MUSICA10 (R$ 10 fixos)", () => {
  it("tira R$ 10 da música, do extra, do quadro e do vídeo", () => {
    expect(centavosComCupom(3800, "MUSICA10", dentro, "musica")).toBe(2800);
    expect(centavosComCupom(2800, "MUSICA10", dentro, "extra")).toBe(1800);
    expect(centavosComCupom(2490, "MUSICA10", dentro, "quadro")).toBe(1490);
    expect(centavosComCupom(2490, "MUSICA10", dentro, "video")).toBe(1490);
  });
  it("vale sobre o braço da pessoa, não sobre um preço fixo", () => {
    expect(centavosComCupom(5490, "MUSICA10", dentro)).toBe(4490);
  });
  it("respeita o piso de R$ 5 e nunca sobe o preço", () => {
    expect(centavosComCupom(1200, "MUSICA10", dentro)).toBe(500);
    expect(centavosComCupom(400, "MUSICA10", dentro)).toBe(400);
  });
  it("minúsculas e espaços tanto faz", () => {
    expect(centavosComCupom(3800, "  musica10 ", dentro)).toBe(2800);
  });
  it("vale até 23h59 de Brasília do último dia, e não depois", () => {
    expect(centavosComCupom(3800, MUSICA10, ultimoMinuto)).toBe(2800);
    expect(centavosComCupom(3800, MUSICA10, depois)).toBe(3800);
  });
  it("o SRN27 continua só na música", () => {
    const antes = new Date("2026-09-26T12:00:00Z");
    expect(centavosComCupom(2800, "SRN27", antes, "extra")).toBe(2800);
  });
  it("codigoAplicado só devolve quando baixou o preço", () => {
    expect(codigoAplicado(3800, " musica10", dentro)).toBe("MUSICA10");
    expect(codigoAplicado(3800, "NADA", dentro)).toBeNull();
    expect(codigoAplicado(400, "MUSICA10", dentro)).toBeNull();
  });
});

describe("descontoNaTela", () => {
  it("monta de/por a partir do preço da pessoa", () => {
    expect(descontoNaTela("MUSICA10", "pt", 3800, "musica", dentro)).toEqual({
      codigo: "MUSICA10",
      texto: "R$ 10",
      de: "R$ 38",
      por: "R$ 28",
      porCentavos: 2800,
    });
    expect(descontoNaTela("MUSICA10", "pt", 2490, "quadro", dentro)?.por).toBe("R$ 14,90");
  });
  it("não vale no espanhol nem no inglês", () => {
    expect(descontoNaTela("MUSICA10", "es", 3800, "musica", dentro)).toBeNull();
    expect(descontoNaTela("MUSICA10", "en", 3800, "musica", dentro)).toBeNull();
  });
  it("código desconhecido ou vazio não mostra nada", () => {
    expect(descontoNaTela("XPTO", "pt", 3800, "musica", dentro)).toBeNull();
    expect(descontoNaTela(null, "pt", 3800, "musica", dentro)).toBeNull();
  });
});

describe("valorEsperadoDoUpsell", () => {
  it("sem cupom no pedido, é o catálogo", () => {
    expect(valorEsperadoDoUpsell(2800, "extra", null)).toBe(2800);
    expect(valorEsperadoDoUpsell(2800, "extra", { cupom: null })).toBe(2800);
  });
  it("com cupom, vale a data em que o pedido NASCEU, não a do pagamento", () => {
    const criado = ultimoMinuto.toISOString();
    expect(valorEsperadoDoUpsell(2800, "extra", { cupom: "MUSICA10", created_at: criado })).toBe(1800);
  });
});

it("validadeCurta escreve dia/mês", () => {
  const [, m, d] = MUSICA10_VALE_ATE.split("-");
  expect(validadeCurta(MUSICA10)).toBe(`${d}/${m}`);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/cupom.test.ts`
Expected: FAIL — `MUSICA10` / `descontoNaTela` / `valorEsperadoDoUpsell` não exportados.

- [ ] **Step 3: Reescrever `src/lib/cupom.ts`**

Manter o cabeçalho de comentário atual (linhas 1-26) e trocar o resto por:

```ts
export type Alvo = "musica" | "extra" | "tres" | "quadro" | "video";

export type Cupom = { codigo: string; texto: string; de: string; por: string };

// DOIS JEITOS DE DESCONTAR, e eles não são o mesmo cupom com outro número.
//
// `preco_final` é o da recuperação: o preço VIRA o "por" (R$ 38 → R$ 28), e só
// na música. `fixo` é o da campanha MUSICA10 (07/10): tira um valor de
// QUALQUER compra (música, extra, quadro, vídeo), sobre o preço que aquela
// pessoa pagaria. Quem está preso no braço de R$ 54,90 paga R$ 44,90, não R$ 28.
type CupomPrecoFinal = {
  tipo: "preco_final";
  codigo: string;
  locale: "pt" | "es";
  texto: string;
  de: string;
  por: string;
  valeAte: string;
};
type CupomFixo = {
  tipo: "fixo";
  codigo: string;
  locale: "pt";
  texto: string;
  centavos: number;
  valeAte: string;
};
type DefCupom = CupomPrecoFinal | CupomFixo;

export const MUSICA10 = "MUSICA10";

/**
 * Último dia do MUSICA10, inclusive (23h59 de Brasília). É a MESMA data que o
 * e-mail escreve (`validadeCurta`): mudou aqui, o e-mail muda junto.
 * Decidida ao ligar o envio: 7 dias depois do fim previsto das levas.
 */
export const MUSICA10_VALE_ATE = "2026-10-20";

/** Nenhum produto sai abaixo disto com cupom fixo. */
export const PISO_CENTAVOS = 500;

const CUPONS: DefCupom[] = [
  { tipo: "preco_final", codigo: "SRN27", locale: "pt", texto: "R$ 10", de: "R$ 38", por: "R$ 28", valeAte: "2026-10-13" },
  { tipo: "preco_final", codigo: "SRN7", locale: "es", texto: "20%", de: "US$ 9,90", por: "US$ 7,92", valeAte: "2026-10-13" },
  { tipo: "fixo", codigo: MUSICA10, locale: "pt", texto: "R$ 10", centavos: 1000, valeAte: MUSICA10_VALE_ATE },
];

/** Vale até 23h59min59s de Brasília do `valeAte`. */
function vale(c: DefCupom, agora: Date): boolean {
  return agora.getTime() <= Date.parse(`${c.valeAte}T23:59:59-03:00`);
}

function acharCupom(codigo: string | null | undefined, agora: Date): DefCupom | null {
  const k = String(codigo ?? "").trim().toUpperCase();
  if (!k) return null;
  const c = CUPONS.find((x) => x.codigo === k);
  return c && vale(c, agora) ? c : null;
}

function centavosDoTexto(t: string): number {
  return Math.round(Number(t.replace(/[^\d,]/g, "").replace(",", ".")) * 100);
}

/** "R$ 38", "R$ 14,90": o formato do resto do site. */
function reais(centavos: number): string {
  const s = (centavos / 100).toFixed(2).replace(".", ",");
  return `R$ ${s.endsWith(",00") ? s.slice(0, -3) : s}`;
}

/** O cupom de PREÇO FINAL do idioma (o da recuperação). Assinatura de sempre. */
export function cupomAtivo(locale: Locale, agora = new Date()): Cupom | null {
  if (locale === "en") return null;
  const c = CUPONS.find(
    (x): x is CupomPrecoFinal => x.tipo === "preco_final" && x.locale === locale && vale(x, agora),
  );
  return c ? { codigo: c.codigo, texto: c.texto, de: c.de, por: c.por } : null;
}

/**
 * O preço com cupom, no servidor. Só em real (o Asaas não cobra dólar), só
 * código vigente, e nunca SOBE o preço.
 */
export function centavosComCupom(
  baseCentavos: number,
  codigo: string | null | undefined,
  agora = new Date(),
  alvo: Alvo = "musica",
): number {
  const c = acharCupom(codigo, agora);
  if (!c || c.locale !== "pt") return baseCentavos;
  if (c.tipo === "preco_final") {
    if (alvo !== "musica") return baseCentavos;
    const por = centavosDoTexto(c.por);
    return por > 0 ? Math.min(baseCentavos, por) : baseCentavos;
  }
  if (baseCentavos <= PISO_CENTAVOS) return baseCentavos;
  return Math.max(baseCentavos - c.centavos, PISO_CENTAVOS);
}

/** O código normalizado, SÓ quando ele baixou o preço. É o que vai pro pedido. */
export function codigoAplicado(
  baseCentavos: number,
  codigo: string | null | undefined,
  agora = new Date(),
  alvo: Alvo = "musica",
): string | null {
  if (centavosComCupom(baseCentavos, codigo, agora, alvo) >= baseCentavos) return null;
  return acharCupom(codigo, agora)?.codigo ?? null;
}

/**
 * O desconto que a TELA mostra. Mesma conta da cobrança, então o número que
 * a pessoa lê é o que o QR cobra. Fora do português, só o cupom da
 * recuperação daquele idioma (o checkout dele é outro), com `porCentavos` nulo.
 */
export function descontoNaTela(
  codigo: string | null | undefined,
  locale: Locale,
  baseCentavos: number,
  alvo: Alvo = "musica",
  agora = new Date(),
): (Cupom & { porCentavos: number | null }) | null {
  if (locale !== "pt") {
    const c = cupomAtivo(locale, agora);
    const k = String(codigo ?? "").trim().toUpperCase();
    return c && k === c.codigo ? { ...c, porCentavos: null } : null;
  }
  const por = centavosComCupom(baseCentavos, codigo, agora, alvo);
  if (por >= baseCentavos) return null;
  const c = acharCupom(codigo, agora);
  if (!c) return null;
  return { codigo: c.codigo, texto: c.texto, de: reais(baseCentavos), por: reais(por), porCentavos: por };
}

/**
 * O valor que o webhook do upsell aceita. Com cupom, vale a data em que o
 * PEDIDO NASCEU: quem gerou o PIX às 23h50 do último dia e pagou à 00h10 pagou
 * o preço que a tela prometeu, e tem que receber.
 */
export function valorEsperadoDoUpsell(
  precoCatalogoCentavos: number,
  alvo: Alvo,
  pedido: { cupom?: string | null; created_at?: string | null } | null,
): number {
  if (!pedido?.cupom) return precoCatalogoCentavos;
  const quando = pedido.created_at ? new Date(pedido.created_at) : new Date();
  return centavosComCupom(precoCatalogoCentavos, pedido.cupom, quando, alvo);
}

/** "20/10": a validade como o e-mail escreve. */
export function validadeCurta(codigo: string): string {
  const c = CUPONS.find((x) => x.codigo === codigo.trim().toUpperCase());
  if (!c) return "";
  const [, m, d] = c.valeAte.split("-");
  return `${d}/${m}`;
}
```

Atualizar o parágrafo "A VALIDADE VIVE NO PAINEL DA PERFECT PAY" do cabeçalho: desde 26/09 a validade é a daqui (`valeAte` por cupom).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/cupom.test.ts`
Expected: PASS (os 4 antigos + os novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cupom.ts src/lib/cupom.test.ts
git commit -m "feat(cupom): catálogo com cupom fixo MUSICA10 (R\$ 10 em qualquer compra)"
```

---

### Task 2: A música cobra com MUSICA10

**Files:**
- Modify: `src/lib/bump.ts:66-72` (`referenciaComItem`)
- Create: `src/lib/bump-cupom.test.ts`
- Modify: `src/lib/criar-pix.ts:267` e `:376`, e o upsert em `:456-500`
- Modify: `src/lib/criar-cartao.ts:210` e o upsert em `:331-351`

**Interfaces:**
- Consumes: `centavosComCupom`, `codigoAplicado` (Task 1)
- Produces: `referenciaComItem(quizId, item, convite = false, cupom = false) → string`, que acrescenta `:d` quando `cupom`. Pedido com coluna `cupom` preenchida quando o cupom baixou o preço (a coluna nasce no Task 6).

- [ ] **Step 1: Teste que falha**

`src/lib/bump-cupom.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { itemDaReferencia, referenciaComItem } from "./bump";

describe("referência com cupom", () => {
  it("cupom muda a referência (o gateway recusa outro valor na mesma)", () => {
    expect(referenciaComItem("abc", null)).toBe("serenata:abc");
    expect(referenciaComItem("abc", null, false, true)).toBe("serenata:abc:d");
    expect(referenciaComItem("abc", null, true, true)).toBe("serenata:abc:i:d");
  });
  it("o sufixo do cupom não confunde a leitura do item", () => {
    expect(itemDaReferencia("serenata:abc:d")).toBeNull();
    expect(itemDaReferencia(referenciaComItem("abc", "quadro", false, true))).toBe("quadro");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/bump-cupom.test.ts`
Expected: FAIL — `"serenata:abc"` recebido no lugar de `"serenata:abc:d"`.

- [ ] **Step 3: Implementar em `bump.ts`**

```ts
export function referenciaComItem(
  quizId: string,
  item: ItemBump | null,
  convite = false,
  /** Cupom aplicado (07/10): outro valor, então outra referência. */
  cupom = false,
): string {
  return `serenata:${quizId}${item ? `:${BUMPS[item].sufixo}` : ""}${convite ? ":i" : ""}${cupom ? ":d" : ""}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/bump-cupom.test.ts src/lib/resumo-bump.test.ts`
Expected: PASS.

- [ ] **Step 5: Ligar no `criar-pix.ts`**

Import: `import { centavosComCupom, codigoAplicado } from "@/lib/cupom";`

Trocar a linha 267:

```ts
    const agora = new Date();
    const base = centavosComCupom(semCupom, data.cupom, agora, "musica");
    const cupomAplicado = codigoAplicado(semCupom, data.cupom, agora, "musica");
```

Trocar a linha 376:

```ts
    const referencia = referenciaComItem(String(quiz.id), item, Boolean(convite), Boolean(cupomAplicado));
```

No upsert de `pedidos`, logo depois do bloco `...(convite ? {...} : {})`:

```ts
        // O cupom que BAIXOU o preço, normalizado. É o que mede a campanha e o
        // que o webhook do upsell confere. Só quando existe, como o convite.
        ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
```

Atualizar o comentário do validator (`cupom?: string`): "Cupom (recuperação ou campanha). Só o CÓDIGO".

- [ ] **Step 6: Ligar no `criar-cartao.ts`**

Import: `import { centavosComCupom, codigoAplicado } from "@/lib/cupom";`

Trocar a linha 210:

```ts
    const agora = new Date();
    const base = centavosComCupom(semCupom, data.cupom, agora, "musica");
    const cupomAplicado = codigoAplicado(semCupom, data.cupom, agora, "musica");
```

No upsert de `pedidos` (`:331`), depois do bloco do convite:

```ts
        ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
```

(A referência do cartão é `serenata:${quiz.id}` e não muda: o cartão não reaproveita cobrança.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bump.ts src/lib/bump-cupom.test.ts src/lib/criar-pix.ts src/lib/criar-cartao.ts
git commit -m "feat(cupom): música cobra com MUSICA10 e grava o cupom no pedido"
```

---

### Task 3: Os extras cobram com MUSICA10, e o webhook libera

**Files:**
- Modify: `src/lib/criar-pix-upsell.ts` (`gerarCobranca` + as duas portas)
- Modify: `src/lib/criar-cartao-upsell.ts` (`cobrar` + as duas portas)
- Modify: `api/webhook/asaas.ts:105-114` e a leitura `:211-214`
- Modify: `api/webhook/woovi.ts:120-136`

**Interfaces:**
- Consumes: `centavosComCupom`, `codigoAplicado`, `valorEsperadoDoUpsell`, `Alvo` (Task 1)
- Produces: as server functions aceitam `cupom?: string`:
  - `criarPixUpsell({ data: { token, ofertaId, cpf?, cupom? } })`
  - `criarPixUpsellPorToken({ data: { tokenEdicao, ofertaId, cpf?, cupom? } })`
  - `cobrarCartaoUpsell({ data: { token, ofertaId, cartao, titular, cupom? } })`
  - `cobrarCartaoUpsellPorToken({ data: { tokenEdicao, ofertaId, cartao, titular, cupom? } })`

- [ ] **Step 1: `criar-pix-upsell.ts`**

Import: `import { centavosComCupom, codigoAplicado, type Alvo } from "@/lib/cupom";`

`gerarCobranca` ganha o último parâmetro `cupom?: string`, e a linha 106 vira:

```ts
    const catalogo = Math.round(oferta.precoBrl * 100);
    const agora = new Date();
    // O CUPOM, recalculado aqui (07/10). O navegador manda o código; o valor
    // sai do catálogo. A busca do PIX vivo logo abaixo já filtra por
    // `valor_centavos`, então um PIX de R$ 28 nunca é devolvido pra quem
    // agora tem cupom, nem o contrário.
    const valorCentavos = centavosComCupom(catalogo, cupom, agora, oferta.id as Alvo);
    const cupomAplicado = codigoAplicado(catalogo, cupom, agora, oferta.id as Alvo);
```

No `upsert` de `pedidos` (`:183`), depois de `pix_url`:

```ts
        ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
```

Nas duas portas:
- validator: `(data: { token: string; ofertaId: string; cpf?: string; cupom?: string }) => data`
- e `(data: { tokenEdicao: string; ofertaId: string; cpf?: string; cupom?: string }) => data`
- chamadas: `gerarCobranca(email, data.ofertaId, data.cpf, undefined, data.cupom)` (porta 1) e `gerarCobranca(email, data.ofertaId, data.cpf, m.id as string, data.cupom)` (porta 2).

- [ ] **Step 2: `criar-cartao-upsell.ts`**

Import: `import { centavosComCupom, codigoAplicado, type Alvo } from "@/lib/cupom";`

- `args` de `cobrar` ganha `cupom?: string`.
- A linha 79 vira:

```ts
  const catalogo = Math.round(oferta.precoBrl * 100);
  const agora = new Date();
  const valorCentavos = centavosComCupom(catalogo, args.cupom, agora, oferta.id as Alvo);
  const cupomAplicado = codigoAplicado(catalogo, args.cupom, agora, oferta.id as Alvo);
```

- No `insert` do pedido pendente (`:104`), depois de `titular_pix`:

```ts
      ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
```

- `type Entrada = { ofertaId: string; cartao: DadosCartao; titular: TitularCartao; cupom?: string };`. As duas portas já repassam `data` inteiro.

- [ ] **Step 3: Webhook do Asaas**

Import: `import { valorEsperadoDoUpsell, type Alvo } from "../../src/lib/cupom.js";`

- A leitura de idempotência (`:213`) acrescenta `cupom, created_at` ao `select`.
- O tipo do `pendente` em `pagarUpsell` vira `{ id: string; email: string | null; cupom?: string | null; created_at?: string | null } | null`.
- A trava (`:105-106`) vira:

```ts
  // O valor tem que bater com o que NÓS cobramos: o catálogo, ou o catálogo
  // com o cupom que o PRÓPRIO pedido gravou ao nascer (07/10). Continua sendo
  // a trava contra pagar R$ 1 num crédito de R$ 28: o cupom vem da nossa
  // linha, nunca do gateway.
  const esperado = valorEsperadoDoUpsell(Math.round(oferta.precoBrl * 100), oferta.id as Alvo, pendente);
```

- [ ] **Step 4: Webhook da Woovi**

Import: `import { valorEsperadoDoUpsell, type Alvo } from "../../src/lib/cupom.js";`

Em `pagarUpsell`, mover a leitura do `pendente` para ANTES da trava de valor, acrescentando `cupom, created_at` ao `select`, e trocar `esperado`:

```ts
  const { data: pendente } = await sb
    .from("pedidos")
    .select("id, email, status, cupom, created_at")
    .eq("payment_id", paymentId)
    .maybeSingle();

  // O VALOR TEM QUE BATER com o catálogo (ou o catálogo com o cupom que o
  // pedido gravou ao nascer, 07/10), e não com o que a Woovi ecoa.
  const esperado = valorEsperadoDoUpsell(
    Math.round(oferta.precoBrl * 100),
    oferta.id as Alvo,
    pendente as { cupom?: string | null; created_at?: string | null } | null,
  );
```

O resto da função (e-mail do `pendente`, upsert, crédito) não muda.

- [ ] **Step 5: Typecheck e testes**

Run: `npm run typecheck && npx vitest run src/lib/cupom.test.ts`
Expected: sem erros; PASS (o caso "23h50 → 00h10" de `valorEsperadoDoUpsell` cobre a regra que os webhooks usam).

- [ ] **Step 6: Commit**

```bash
git add src/lib/criar-pix-upsell.ts src/lib/criar-cartao-upsell.ts api/webhook/asaas.ts api/webhook/woovi.ts
git commit -m "feat(cupom): extras cobram com MUSICA10 e o webhook confere pelo cupom do pedido"
```

---

### Task 4: O cupom chega pelo link e sobrevive ao funil

**Files:**
- Create: `src/lib/cupom-url.ts`
- Create: `src/lib/cupom-url.test.ts`
- Create: `src/lib/quiz-store-cupom.test.ts`
- Modify: `src/lib/quiz-store.ts:56-64` (comentário) e `:118` (`reset`)
- Modify: `src/routes/__root.tsx:390-396`

**Interfaces:**
- Produces:
  - `separarCupomDaUrl(href: string) → { cupom: string | null; semCupom: string | null }` (`semCupom` nulo quando a URL não tinha `cupom`)
  - `guardarCupomDaUrl(setCupom: (c: string) => void) → void`
  - `useQuizStore.reset()` passa a PRESERVAR `cupom`.

- [ ] **Step 1: Testes que falham**

`src/lib/cupom-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { separarCupomDaUrl } from "./cupom-url";

describe("separarCupomDaUrl", () => {
  it("tira o cupom e mantém as UTMs", () => {
    const r = separarCupomDaUrl("https://serenatagift.com/criar?cupom=musica10&utm_source=email");
    expect(r.cupom).toBe("MUSICA10");
    expect(r.semCupom).toBe("https://serenatagift.com/criar?utm_source=email");
  });
  it("sem cupom na URL, não mexe em nada", () => {
    expect(separarCupomDaUrl("https://serenatagift.com/criar?step=oferta")).toEqual({ cupom: null, semCupom: null });
  });
  it("lixo vira nada, mas sai da URL igual", () => {
    const r = separarCupomDaUrl("https://serenatagift.com/?cupom=%3Cscript%3E");
    expect(r.cupom).toBe("SCRIPT");
    const vazio = separarCupomDaUrl("https://serenatagift.com/?cupom=%20");
    expect(vazio.cupom).toBeNull();
    expect(vazio.semCupom).toBe("https://serenatagift.com/");
  });
});
```

`src/lib/quiz-store-cupom.test.ts`:

```ts
import { expect, it } from "vitest";
import { useQuizStore } from "./quiz-store";

it("reset() apaga o quiz mas guarda o cupom (quem comprou e volta pra criar outra)", () => {
  useQuizStore.getState().setCupom("MUSICA10");
  useQuizStore.getState().setEmail("a@b.com");
  useQuizStore.getState().reset();
  expect(useQuizStore.getState().email).toBeNull();
  expect(useQuizStore.getState().cupom).toBe("MUSICA10");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/cupom-url.test.ts src/lib/quiz-store-cupom.test.ts`
Expected: FAIL — módulo `./cupom-url` não existe; `cupom` vira `null` depois do `reset()`.

- [ ] **Step 3: `src/lib/cupom-url.ts`**

```ts
// O CUPOM QUE CHEGA PELO LINK (campanha MUSICA10, 07/10).
//
// Qualquer página que abra com `?cupom=` guarda o código na store do quiz e
// TIRA o parâmetro da URL: link copiado, print e compartilhamento não levam o
// cupom adiante. Quem decide se ele vale é o servidor, na cobrança; aqui só se
// guarda o código, limpo (letras e números, até 20).

export function separarCupomDaUrl(href: string): { cupom: string | null; semCupom: string | null } {
  const u = new URL(href);
  const bruto = u.searchParams.get("cupom");
  if (bruto === null) return { cupom: null, semCupom: null };
  u.searchParams.delete("cupom");
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  return { cupom: limpo || null, semCupom: u.toString() };
}

export function guardarCupomDaUrl(setCupom: (c: string) => void): void {
  try {
    const { cupom, semCupom } = separarCupomDaUrl(window.location.href);
    if (cupom) setCupom(cupom);
    if (semCupom) window.history.replaceState(window.history.state, "", semCupom);
  } catch {
    // Navegação privada / URL estranha: segue sem cupom, nunca quebra a página.
  }
}
```

- [ ] **Step 4: `quiz-store.ts`**

- `reset` vira `reset: () => set({ respostas: {}, email: null, whatsapp: null, letraFinal: null }),`.
- O comentário do campo `cupom` ganha o parágrafo:

```ts
   *
   * Desde 07/10 também vem de `?cupom=` em qualquer página (campanha
   * MUSICA10, `cupom-url.ts`) e SOBREVIVE ao `reset()`: quem já comprou e volta
   * pelo e-mail pra criar outra passa pelo reset do `Quiz.tsx`, e perder o
   * cupom ali seria quebrar a promessa do e-mail no primeiro passo. Validade
   * e valor são do servidor; código vencido guardado não desconta nada.
```

- [ ] **Step 5: `__root.tsx`**

Imports:

```ts
import { guardarCupomDaUrl } from "@/lib/cupom-url";
import { useQuizStore } from "@/lib/quiz-store";
```

(Se `useQuizStore` já estiver importado, não duplicar.)

Logo depois de `captureFirstTouchAttribution();` (`:395`):

```ts
    // Depois da atribuição (que lê as UTMs da mesma URL), antes do page_view.
    guardarCupomDaUrl((c) => useQuizStore.getState().setCupom(c));
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/cupom-url.test.ts src/lib/quiz-store-cupom.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cupom-url.ts src/lib/cupom-url.test.ts src/lib/quiz-store-cupom.test.ts src/lib/quiz-store.ts src/routes/__root.tsx
git commit -m "feat(cupom): ?cupom= em qualquer página guarda o código e sobrevive ao reset"
```

---

### Task 5: As telas mostram o preço com cupom

**Files:**
- Modify: `src/components/quiz/TelaOferta.tsx:19`, `:547-550`, `:914-930`
- Modify: `src/components/quiz/PrecoDaOferta.tsx:39-47`
- Modify: `src/components/conta/FolhaPixUpsell.tsx`

**Interfaces:**
- Consumes: `descontoNaTela`, `Alvo` (Task 1); `useQuizStore` com `cupom` (Task 4); as server functions com `cupom?` (Task 3); `reaisDeCentavos` de `@/lib/indicacao`.

- [ ] **Step 1: `TelaOferta.tsx`**

- Trocar o import da linha 19 por `import { descontoNaTela } from "@/lib/cupom";`.
- Trocar as linhas 547-550 por:

```tsx
  // O DESCONTO SAI DA MESMA CONTA DA COBRANÇA (`descontoNaTela`), sobre o
  // braço desta pessoa: o número que ela lê é o que o QR cobra. Vale o cupom
  // da recuperação (SRN27) e o da campanha (MUSICA10, 07/10); código
  // desconhecido ou vencido não muda nada na tela, nem no servidor.
  const baseDaPessoaC = Math.round((Number(meuPlano(locale).valor) || 0) * 100);
  const descontado = descontoNaTela(cupom, locale, baseDaPessoaC);
```

- No `checkout`, trocar o `if (comConvite) {...} else {...}` (`:914-930`) por:

```tsx
      if (descontado && descontado.porCentavos) {
        // COM CUPOM, A FOLHA JÁ ABRE NO PREÇO COM DESCONTO. Antes ela mostrava
        // o preço do braço até o QR chegar com o valor do servidor.
        setPagandoComPix({
          texto: descontado.por,
          ancora: descontado.de,
          valor: descontado.porCentavos / 100,
        });
      } else if (comConvite) {
        const baseC = Math.round((Number(plano.valor) || 0) * 100);
        const finalC = baseC - descontoDoConvite(baseC);
        setPagandoComPix({
          texto: reaisDeCentavos(finalC),
          ancora: plano.texto,
          valor: finalC / 100,
        });
      } else {
        setPagandoComPix({
          texto: plano.texto,
          ancora: plano.ancora,
          valor: Number(plano.valor) || 0,
        });
      }
```

(O selo "Cupom X aplicado: R$ 10 de desconto" em `:1085-1091` já lê `descontado.codigo`/`.texto` e serve sem mudança.)

- [ ] **Step 2: `PrecoDaOferta.tsx`**

No ramo `if (descontado)` de `PrecoDaOferta`, a âncora vira o preço REAL da pessoa no português (no espanhol fica o de sempre):

```tsx
        <p className="text-sm text-muted-foreground">
          <span className="line-through">{locale === "pt" ? descontado.de : planoControle(locale).texto}</span>{" "}
          {hojePor}
        </p>
```

- [ ] **Step 3: `FolhaPixUpsell.tsx`**

Imports:

```tsx
import { useQuizStore } from "@/lib/quiz-store";
import { OFERTAS } from "@/lib/creditos";
import { descontoNaTela, type Alvo } from "@/lib/cupom";
import { reaisDeCentavos } from "@/lib/indicacao";
```

Logo depois de `const [fase, setFase] = useState<Fase>(...)`:

```tsx
  // O CUPOM DA CAMPANHA (MUSICA10) vale nos extras também (dono, 07/10). A
  // folha mostra o preço com desconto e manda SÓ o código; o servidor
  // recalcula do catálogo. Sem cupom, nada muda.
  const cupom = useQuizStore((s) => s.cupom);
  const catalogoC = Math.round((OFERTAS.find((o) => o.id === ofertaId)?.precoBrl ?? 0) * 100);
  const desconto = descontoNaTela(cupom, "pt", catalogoC, ofertaId as Alvo);
  const precoMostrado = desconto?.por ?? precoTexto;
  const cupomDaCompra = desconto?.codigo;
```

- As quatro chamadas de servidor ganham `cupom: cupomDaCompra`:
  - `cobrarCartaoUpsellPorToken({ data: { tokenEdicao, ofertaId, cupom: cupomDaCompra, ...dados } })`
  - `cobrarCartaoUpsell({ data: { token, ofertaId, cupom: cupomDaCompra, ...dados } })`
  - `criarPixUpsellPorToken({ data: { tokenEdicao, ofertaId, cpf: cpf || undefined, cupom: cupomDaCompra } })`
  - `criarPixUpsell({ data: { token, ofertaId, cpf: cpf || undefined, cupom: cupomDaCompra } })`
- No resumo, trocar `<p className="text-center font-display text-3xl font-semibold">{precoTexto}</p>` por:

```tsx
            {desconto ? (
              <div className="text-center">
                <p className="text-sm text-[var(--tinta-fraca)] line-through">{precoTexto}</p>
                <p className="font-display text-3xl font-semibold">{precoMostrado}</p>
                <p className="mt-2 inline-block rounded-full bg-[var(--acento)]/10 px-3 py-1 text-xs font-semibold text-[var(--acento)]">
                  Cupom {desconto.codigo} · −{desconto.texto}
                </p>
              </div>
            ) : (
              <p className="text-center font-display text-3xl font-semibold">{precoTexto}</p>
            )}
```

- `FormularioCartao precoTexto={precoMostrado}`.
- `PixPagamento valorTexto={reaisDeCentavos(fase.dados.valorCentavos)}`: o valor que o servidor cobrou de fato.

- [ ] **Step 4: Typecheck e verificação no navegador**

Run: `npm run typecheck`
Expected: sem erros.

Depois, no preview local (`preview_start`, config do dev da Serenata no `.claude/launch.json`):
- abrir `/criar?cupom=MUSICA10` e conferir que a URL fica sem `cupom`;
- no console, `JSON.parse(localStorage.mp_quiz).state.cupom === "MUSICA10"`;
- numa sessão com música até a oferta, conferir "R$ 38" riscado, "R$ 28" e o selo;
- abrir a folha do PIX e conferir que ela abre em R$ 28.

Sem sessão com música no local, conferir pelo menos o primeiro e o segundo ponto, e anotar.

- [ ] **Step 5: Commit**

```bash
git add src/components/quiz/TelaOferta.tsx src/components/quiz/PrecoDaOferta.tsx src/components/conta/FolhaPixUpsell.tsx
git commit -m "feat(cupom): oferta e folhas dos extras mostram o preço com cupom"
```

---

### Task 6: Banco — coluna do cupom, fila da campanha e reclamação vira descadastro

**Files:**
- Create: `supabase/migrations/20261007000000_campanha_musica10.sql`
- Modify: `api/webhook/resend.ts` (bloco novo depois do bloco `email.bounced` → `emails_mortos`, perto da linha 279)

**Interfaces:**
- Produces:
  - `pedidos.cupom text`
  - tabela `campanha_envios(campanha, email, versao, quiz_response_id, nome, criado_em, enviado_em, email_id, pulado)`, PK `(campanha, email)`
  - `montar_campanha(p_campanha text) → integer` (linhas inseridas)
  - `taxas_campanha(p_campanha text, p_desde timestamptz) → table(enviados bigint, bounces bigint, reclamacoes bigint)`
  - reclamação do Resend grava `descadastros(email, motivo = 'complaint')`

- [ ] **Step 1: A migration**

```sql
-- CAMPANHA MUSICA10 (07/10/2026). Ver docs/superpowers/specs/2026-10-07-campanha-musica10-design.md

-- O cupom que BAIXOU o preço, normalizado. Mede a campanha sem adivinhar pelo
-- valor, e é o que o webhook do upsell confere (`valorEsperadoDoUpsell`).
alter table public.pedidos add column if not exists cupom text;

-- A FILA. Montada UMA vez (`montar_campanha`) e drenada pelo job
-- `campanhaMusica10`. `enviado_em` é a trava: linha enviada nunca volta pra fila.
create table if not exists public.campanha_envios (
  campanha text not null,
  email text not null,
  versao text not null check (versao in ('comprador', 'lead')),
  quiz_response_id uuid,
  nome text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  email_id text,
  pulado text,
  primary key (campanha, email)
);
create index if not exists campanha_envios_fila
  on public.campanha_envios (campanha, versao, email)
  where enviado_em is null and pulado is null;
create index if not exists campanha_envios_enviado
  on public.campanha_envios (campanha, enviado_em);
-- Sem política: só o service role lê e escreve.
alter table public.campanha_envios enable row level security;

-- QUEM RECEBE: um envio por E-MAIL (o quiz mais recente dele), só `pt`, fora
-- descadastrados, mortos (bounce não liberado), excluídos e memorial.
-- `comprador` = tem pedido pago com dinheiro entrando; senão `lead`.
create or replace function public.montar_campanha(p_campanha text)
returns integer
language plpgsql
security definer
set search_path = public
set statement_timeout = '120s'
as $$
declare n integer;
begin
  with compradores as (
    select distinct lower(trim(email)) as email
    from pedidos
    where status = 'pago' and dinheiro_entrou is not false and email is not null
  ),
  candidatos as (
    select distinct on (lower(trim(q.email)))
      lower(trim(q.email)) as email,
      q.id as quiz_id,
      nullif(trim(q.nome_comprador), '') as nome,
      coalesce(q.respostas->>'ocasiao', '') as ocasiao
    from quiz_responses q
    where q.email is not null
      and coalesce(q.locale, 'pt') = 'pt'
      and position('@' in q.email) > 1
    order by lower(trim(q.email)), q.created_at desc
  )
  insert into campanha_envios (campanha, email, versao, quiz_response_id, nome)
  select
    p_campanha,
    c.email,
    case when exists (select 1 from compradores b where b.email = c.email) then 'comprador' else 'lead' end,
    c.quiz_id,
    c.nome
  from candidatos c
  where c.ocasiao not ilike '%memorial%'
    and not exists (select 1 from descadastros d where lower(d.email) = c.email)
    and not exists (select 1 from excluidos_email x where lower(x.email) = c.email)
    and not exists (
      select 1 from emails_mortos m where lower(m.email) = c.email and m.liberado_em is null
    )
  on conflict (campanha, email) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.montar_campanha(text) from public, anon, authenticated;

-- O FREIO: dos enviados desde `p_desde`, quantos voltaram (bounce depois do
-- envio) e quantos reclamaram (descadastro por 'complaint' depois do envio).
create or replace function public.taxas_campanha(p_campanha text, p_desde timestamptz)
returns table (enviados bigint, bounces bigint, reclamacoes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*),
    count(*) filter (where exists (
      select 1 from emails_mortos m where m.email = e.email and m.ultimo_em >= e.enviado_em
    )),
    count(*) filter (where exists (
      select 1 from descadastros d
      where d.email = e.email and d.motivo = 'complaint' and d.created_at >= e.enviado_em
    ))
  from campanha_envios e
  where e.campanha = p_campanha and e.enviado_em >= p_desde;
$$;
revoke all on function public.taxas_campanha(text, timestamptz) from public, anon, authenticated;
```

- [ ] **Step 2: Reclamação vira descadastro, no `api/webhook/resend.ts`**

Logo depois do bloco `if (tipo === "email.bounced" && para) { ... emails_mortos ... }`:

```ts
  // RECLAMAÇÃO DE SPAM VIRA DESCADASTRO (07/10). Antes ela só ia pro
  // `funnel_events`, e nada impedia o próximo e-mail de marketing de chegar em
  // quem já tinha apertado "spam". `bloqueados()` lê `descadastros`, então
  // todas as réguas passam a respeitar. `ignoreDuplicates`: quem já se
  // descadastrou antes mantém o motivo original.
  if (tipo === "email.complained" && para) {
    try {
      const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        await createClient(url, key, { auth: { persistSession: false } })
          .from("descadastros")
          .upsert({ email: para.toLowerCase(), motivo: "complaint" }, { onConflict: "email", ignoreDuplicates: true });
      }
    } catch (err) {
      console.error("[resend] descadastro por reclamação falhou:", err);
    }
  }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261007000000_campanha_musica10.sql api/webhook/resend.ts
git commit -m "feat(campanha): fila da MUSICA10, pedidos.cupom e reclamação vira descadastro"
```

(A migration é APLICADA no Task 9, antes do deploy. Até lá, nada aqui vai pro ar.)

---

### Task 7: O e-mail, em duas versões

**Files:**
- Create: `emails/campanha-musica10.ts`
- Create: `src/lib/campanha-musica10-email.test.ts`
- Create: `scratch/campanha-musica10/previa.mts`

**Interfaces:**
- Produces:
  - `type VersaoCampanha = "comprador" | "lead"`
  - `assuntoCampanhaMusica10(versao: VersaoCampanha, nome: string | null) → string`
  - `emailCampanhaMusica10(args: { versao: VersaoCampanha; nome: string | null; linkCriar: string; linkExemplo: string; linkDescadastro: string; valeAte: string }) → string`

- [ ] **Step 1: Testes que falham**

`src/lib/campanha-musica10-email.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assuntoCampanhaMusica10, emailCampanhaMusica10 } from "../../emails/campanha-musica10";

const base = {
  linkCriar: "https://serenatagift.com/criar?cupom=MUSICA10&utm_content=comprador",
  linkExemplo: "https://serenatagift.com/p/533db522753f423e8b2227",
  linkDescadastro: "https://serenatagift.com/api/descadastro?e=a%40b.com&t=x",
  valeAte: "20/10",
};

describe("e-mail MUSICA10", () => {
  for (const versao of ["comprador", "lead"] as const) {
    it(`${versao}: tem botão, cupom, validade, exemplo, descadastro e CNPJ`, () => {
      const html = emailCampanhaMusica10({ ...base, versao, nome: "Maria" });
      expect(html).toContain(base.linkCriar.replace(/&/g, "&amp;"));
      expect(html).toContain(base.linkExemplo);
      expect(html).toContain(base.linkDescadastro.replace(/&/g, "&amp;"));
      expect(html).toContain("MUSICA10");
      expect(html).toContain("20/10");
      expect(html).toContain("45.835.258/0001-46");
      expect(html).toContain("Maria");
    });
    it(`${versao}: sem nome, não escreve null nem undefined`, () => {
      const html = emailCampanhaMusica10({ ...base, versao, nome: null });
      expect(html).not.toMatch(/null|undefined/);
    });
    it(`${versao}: o único preço citado é o desconto de R$ 10`, () => {
      const html = emailCampanhaMusica10({ ...base, versao, nome: null });
      const precos = html.match(/R\$\s?[\d.,]+/g) ?? [];
      expect(precos.length).toBeGreaterThan(0);
      expect(precos.every((p) => /R\$\s?10$/.test(p))).toBe(true);
      expect(html).not.toMatch(/60 segundos/i);
    });
  }
  it("escapa o nome (vem de campo livre)", () => {
    const html = emailCampanhaMusica10({ ...base, versao: "lead", nome: "<b>Ana</b>" });
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
  });
  it("assunto com e sem nome", () => {
    expect(assuntoCampanhaMusica10("comprador", "Maria")).toBe("Maria, quem merece a próxima música?");
    expect(assuntoCampanhaMusica10("comprador", null)).toBe("Quem merece a próxima música?");
    expect(assuntoCampanhaMusica10("lead", "Maria")).toBe("Maria, a sua história ainda pode virar música");
    expect(assuntoCampanhaMusica10("lead", null)).toBe("A sua história ainda pode virar música");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/campanha-musica10-email.test.ts`
Expected: FAIL — módulo `../../emails/campanha-musica10` não existe.

- [ ] **Step 3: `emails/campanha-musica10.ts`**

```ts
// O E-MAIL DA CAMPANHA MUSICA10 (07/10/2026): a base inteira que deixou
// e-mail, com R$ 10 de desconto em qualquer música ou extra, por 7 dias.
//
// Duas versões, um layout. Quem JÁ COMPROU conhece a entrega e confia na
// marca: o e-mail fala da PRÓXIMA pessoa. Quem só fez a letra nunca ouviu a
// música cantada: o e-mail fala da história dele. Nenhuma das duas cita a
// pessoa homenageada pelo nome: na base tem memorial e tem casal que acabou,
// e um nome errado ali estraga o e-mail inteiro.
//
// O cupom é o bloco central, com a validade REAL (a data sai de `cupom.ts`).
// Nada de "últimas horas" inventado: a urgência permitida é a que existe.

export type VersaoCampanha = "comprador" | "lead";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COPY: Record<
  VersaoCampanha,
  {
    assunto: (nome: string | null) => string;
    preheader: (valeAte: string) => string;
    titulo: string;
    saudacao: (nome: string | null) => string;
    texto: string[];
  }
> = {
  comprador: {
    assunto: (n) => (n ? `${n}, quem merece a próxima música?` : "Quem merece a próxima música?"),
    preheader: (d) => `R$ 10 de desconto em qualquer música ou extra, até ${d}.`,
    titulo: 'Você já emocionou alguém uma vez. <em style="color:#7d2b3a;">Quem é o próximo?</em>',
    saudacao: (n) => (n ? `Oi, ${n}.` : "Oi."),
    texto: [
      "Uma música sua já tocou num aniversário, num jantar, numa chamada de vídeo. Alguém ouviu a própria história cantada e não esqueceu.",
      "Tem mais gente na sua vida que nunca teve uma música: a mãe, o pai, um filho, a amiga de sempre. Pra quem já é da casa, um presente nosso:",
    ],
  },
  lead: {
    assunto: (n) => (n ? `${n}, a sua história ainda pode virar música` : "A sua história ainda pode virar música"),
    preheader: (d) => `R$ 10 de desconto em qualquer música ou extra, até ${d}.`,
    titulo: 'Tem uma música <em style="color:#7d2b3a;">esperando por você.</em>',
    saudacao: (n) => (n ? `Oi, ${n}.` : "Oi."),
    texto: [
      "Você começou a contar uma história pra gente, e a letra ficou pronta. A música é o que falta: a mesma história, cantada, com o nome de quem você ama.",
      "Pode ser aquela pessoa ou outra. Você conta, lê a letra na hora e de graça, e só paga se quiser ouvir cantada. E agora com um presente nosso:",
    ],
  },
};

export function assuntoCampanhaMusica10(versao: VersaoCampanha, nome: string | null): string {
  return COPY[versao].assunto(nome);
}

export function emailCampanhaMusica10(args: {
  versao: VersaoCampanha;
  nome: string | null;
  linkCriar: string;
  linkExemplo: string;
  linkDescadastro: string;
  valeAte: string;
}): string {
  const C = COPY[args.versao];
  const nome = args.nome ? esc(args.nome) : null;
  const criar = esc(args.linkCriar);
  const exemplo = esc(args.linkExemplo);
  const sair = esc(args.linkDescadastro);
  const sans = "Helvetica,Arial,sans-serif";
  const serif = "Georgia,'Times New Roman',serif";

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(C.assunto(args.nome))}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:${serif};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${C.preheader(esc(args.valeAte))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:#7d2b3a;background:linear-gradient(90deg,#7d2b3a,#c9a227);font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 30px 32px;">
          <p style="margin:0 0 22px;text-align:center;font-size:12px;letter-spacing:4px;color:#7d2b3a;font-family:${sans};">SERENATA</p>

          <h1 style="margin:0 0 22px;font-size:28px;line-height:1.3;color:#2a1518;font-weight:normal;text-align:center;font-family:${serif};">
            ${C.titulo}
          </h1>

          <div style="font-size:15px;line-height:1.7;color:rgba(42,21,24,0.82);font-family:${sans};">
            <p style="margin:0 0 14px;">${C.saudacao(nome)}</p>
            ${C.texto.map((t) => `<p style="margin:0 0 14px;">${t}</p>`).join("\n            ")}
          </div>

          <!-- O PRESENTE: o cupom como bloco central, com a validade real. -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;">
            <tr><td align="center" style="border:1px dashed #c9a227;border-radius:14px;background-color:#fffaf2;padding:22px 18px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:rgba(42,21,24,0.55);font-family:${sans};">SEU CUPOM</p>
              <p style="margin:0 0 8px;font-size:30px;letter-spacing:4px;color:#7d2b3a;font-family:${serif};">MUSICA10</p>
              <p style="margin:0 0 4px;font-size:15px;color:#2a1518;font-family:${sans};"><strong>R$ 10 de desconto</strong> em qualquer música ou extra</p>
              <p style="margin:0;font-size:12px;color:rgba(42,21,24,0.55);font-family:${sans};">Válido até ${esc(args.valeAte)} · já aplicado no botão abaixo</p>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;text-align:center;">
            <a href="${criar}" style="display:inline-block;padding:16px 34px;border-radius:999px;background:#7d2b3a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.4px;font-family:${sans};">Criar uma música nova</a>
          </p>
          <p style="margin:14px 0 0;text-align:center;font-size:13px;font-family:${sans};">
            <a href="${exemplo}" style="color:#7d2b3a;">Ouvir um exemplo: “Domingo na Casa da Eva”</a>
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-top:1px solid rgba(42,21,24,0.10);">
            <tr>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">1</span>Você conta a história</td>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">2</span>Lê a letra na hora, de graça</td>
              <td width="33%" valign="top" style="padding:18px 6px 0;text-align:center;font-size:12px;line-height:1.5;color:rgba(42,21,24,0.7);font-family:${sans};"><span style="display:block;font-size:20px;color:#7d2b3a;font-family:${serif};">3</span>Ouve cantada e decide</td>
            </tr>
          </table>

          <p style="margin:30px 0 0;padding-top:20px;border-top:1px solid rgba(42,21,24,0.10);text-align:center;font-size:12px;line-height:1.6;color:rgba(42,21,24,0.5);font-family:${sans};">
            Serenata · música feita da história de quem você ama<br>
            CNPJ 45.835.258/0001-46<br>
            <a href="${sair}" style="color:rgba(42,21,24,0.5);">Não quero mais estes e-mails</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/campanha-musica10-email.test.ts`
Expected: PASS.

- [ ] **Step 5: Prévia pro dono**

`scratch/campanha-musica10/previa.mts`:

```ts
import { writeFileSync, mkdirSync } from "node:fs";
import { emailCampanhaMusica10 } from "../../emails/campanha-musica10.ts";
import { MUSICA10, validadeCurta } from "../../src/lib/cupom.ts";

mkdirSync("scratch/campanha-musica10", { recursive: true });
for (const versao of ["comprador", "lead"] as const) {
  for (const nome of ["Maria", null]) {
    const html = emailCampanhaMusica10({
      versao,
      nome,
      linkCriar: `https://serenatagift.com/criar?cupom=MUSICA10&utm_source=email&utm_medium=campanha&utm_campaign=musica10&utm_content=${versao}`,
      linkExemplo: "https://serenatagift.com/p/533db522753f423e8b2227",
      linkDescadastro: "https://serenatagift.com/descadastrar",
      valeAte: validadeCurta(MUSICA10),
    });
    writeFileSync(`scratch/campanha-musica10/previa-${versao}${nome ? "" : "-sem-nome"}.html`, html);
  }
}
console.log("prévias em scratch/campanha-musica10/");
```

Run: `npx tsx scratch/campanha-musica10/previa.mts`
Expected: 4 arquivos `.html`.

Abrir `previa-comprador.html` e `previa-lead.html` no navegador do app, a 600px e a 375px. Tirar screenshot das duas e mandar pro dono (`SendUserFile`), pedindo o ok do texto ANTES do Task 9.

- [ ] **Step 6: Commit**

```bash
git add emails/campanha-musica10.ts src/lib/campanha-musica10-email.test.ts
git commit -m "feat(campanha): e-mail MUSICA10 em duas versões (comprador e lead)"
```

---

### Task 8: O job que envia em levas

**Files:**
- Create: `src/lib/campanha-musica10.ts`
- Create: `src/lib/campanha-musica10.test.ts`
- Create: `inngest/functions/campanhaMusica10.ts`
- Modify: `api/inngest.ts` (import + lista da Serenata, NUNCA `DA_BALLAD`)

**Interfaces:**
- Consumes: `emailCampanhaMusica10`, `assuntoCampanhaMusica10` (Task 7); `MUSICA10`, `validadeCurta` (Task 1); RPCs `montar_campanha` e `taxas_campanha` e a tabela `campanha_envios` (Task 6)
- Produces, todos de `src/lib/campanha-musica10.ts`:
  - `CAMPANHA = "musica10"`, `POR_RODADA = 300`, `LOTE = 100`
  - `freioAcionado(t: { enviados: number; bounces: number; reclamacoes: number }) → string | null`
  - `emLotes<T>(xs: T[], n?: number) → T[][]`
  - `linkCriarCampanha(site: string, versao: "comprador" | "lead") → string`
  - `templateDoEnvio(versao) → string`
- Produces também a função Inngest `campanhaMusica10` (id `campanha-musica10`): cron `20 12-23 * * *` + evento `campanha/musica10.teste` (`data: { para }`).

- [ ] **Step 1: Testes que falham**

`src/lib/campanha-musica10.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { emLotes, freioAcionado, linkCriarCampanha, templateDoEnvio } from "./campanha-musica10";

describe("freio", () => {
  it("não decide com amostra pequena", () => {
    expect(freioAcionado({ enviados: 150, bounces: 50, reclamacoes: 5 })).toBeNull();
  });
  it("para com bounce acima de 4%", () => {
    expect(freioAcionado({ enviados: 1000, bounces: 41, reclamacoes: 0 })).toMatch(/bounce/);
    expect(freioAcionado({ enviados: 1000, bounces: 40, reclamacoes: 0 })).toBeNull();
  });
  it("para com reclamação acima de 0,1%", () => {
    expect(freioAcionado({ enviados: 1000, bounces: 0, reclamacoes: 2 })).toMatch(/reclama/);
    expect(freioAcionado({ enviados: 1000, bounces: 0, reclamacoes: 1 })).toBeNull();
  });
});

it("emLotes corta em 100", () => {
  const xs = Array.from({ length: 250 }, (_, i) => i);
  expect(emLotes(xs).map((l) => l.length)).toEqual([100, 100, 50]);
});

it("link aplica o cupom e marca a versão", () => {
  expect(linkCriarCampanha("https://serenatagift.com", "lead")).toBe(
    "https://serenatagift.com/criar?cupom=MUSICA10&utm_source=email&utm_medium=campanha&utm_campaign=musica10&utm_content=lead",
  );
});

it("template por versão", () => {
  expect(templateDoEnvio("comprador")).toBe("campanha_musica10_comprador");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/campanha-musica10.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: `src/lib/campanha-musica10.ts`**

```ts
// AS REGRAS DA CAMPANHA MUSICA10, puras: o job do Inngest e os testes leem
// daqui. Sem imports com `@` (o Inngest roda como ESM puro).

export const CAMPANHA = "musica10";

/** ~300 por hora, 12 rodadas por dia: uns 3.600/dia sem pico que assine lista comprada. */
export const POR_RODADA = 300;
/** O teto do `resend.batch`. */
export const LOTE = 100;

/** Abaixo disto, uma reclamação sozinha decidiria a campanha. */
export const AMOSTRA_MINIMA = 200;
export const BOUNCE_MAX = 0.04;
export const RECLAMACAO_MAX = 0.001;

export type VersaoEnvio = "comprador" | "lead";

/** Motivo da parada, ou null pra seguir. Olha as últimas 24h. */
export function freioAcionado(t: { enviados: number; bounces: number; reclamacoes: number }): string | null {
  if (t.enviados < AMOSTRA_MINIMA) return null;
  const b = t.bounces / t.enviados;
  if (b > BOUNCE_MAX) return `bounce de ${(b * 100).toFixed(1)}% nas últimas 24h (teto ${BOUNCE_MAX * 100}%)`;
  const r = t.reclamacoes / t.enviados;
  if (r > RECLAMACAO_MAX) return `reclamação de spam em ${(r * 100).toFixed(2)}% nas últimas 24h (teto ${RECLAMACAO_MAX * 100}%)`;
  return null;
}

export function emLotes<T>(xs: T[], n = LOTE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export function linkCriarCampanha(site: string, versao: VersaoEnvio): string {
  return `${site}/criar?cupom=MUSICA10&utm_source=email&utm_medium=campanha&utm_campaign=musica10&utm_content=${versao}`;
}

export function templateDoEnvio(versao: VersaoEnvio): string {
  return `campanha_musica10_${versao}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/campanha-musica10.test.ts`
Expected: PASS.

- [ ] **Step 5: Conferir o formato do `resend.batch.send`**

Run: `/usr/bin/grep -rn "idempotencyKey\|CreateBatchSuccessResponse" node_modules/resend/dist/index.d.ts | head`
Expected: `batch.send(payload, options?: { idempotencyKey?: string })`, com `data: { data: { id: string }[] }`. Se o formato for outro, ajustar a leitura de `ids` no Step 6 e registrar `Ruling:` no ledger.

- [ ] **Step 6: `inngest/functions/campanhaMusica10.ts`**

```ts
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { inngest } from "../client.js";
import { cabecalhosDescadastro, linkDescadastroUmClique } from "../lib/descadastro.js";
import { bloqueados } from "../lib/emails-mortos.js";
import { REMETENTE_RECUPERACAO, RESPONDER_PARA } from "../../emails/remetentes.js";
import { assuntoCampanhaMusica10, emailCampanhaMusica10 } from "../../emails/campanha-musica10.js";
import { registrarEnvio } from "../../src/lib/registro-email.js";
import { primeiroNome } from "../../src/lib/ocasioes.js";
import { MUSICA10, validadeCurta } from "../../src/lib/cupom.js";
import {
  CAMPANHA,
  POR_RODADA,
  emLotes,
  freioAcionado,
  linkCriarCampanha,
  templateDoEnvio,
  type VersaoEnvio,
} from "../../src/lib/campanha-musica10.js";
import { avisarDonos } from "../../src/lib/avisar-donos.js";
import { MARCA_ATIVA } from "../../src/lib/marca-identidade.js";

// A CAMPANHA MUSICA10 (07/10/2026): a base `pt` inteira, em levas.
//
// ── POR QUE FILA, E NÃO CONSULTA A CADA RODADA ───────────────────
//
// A base passa de dezenas de milhares de quizzes. Reler tudo de hora em hora
// (paginando de mil em mil, como o PostgREST exige) seria o `statement
// timeout` do painel de 02/10 de novo. A fila é montada UMA vez por SQL
// (`montar_campanha`) e cada rodada só pega as próximas 300.
//
// ── AS TRÊS TRAVAS CONTRA MANDAR DUAS VEZES ──────────────────────
//
//   `enviado_em`           linha enviada não volta pra fila;
//   chave de idempotência  o Resend devolve o mesmo resultado por 24h se o
//                          step for repetido depois de ele ter aceitado;
//   `concurrency: 1`       duas rodadas nunca montam o mesmo lote.
//
// ── LIGA SÓ COM O DONO ───────────────────────────────────────────
//
// Sem `CAMPANHA_MUSICA10_ON=1` o cron sai sem fazer nada. O evento de teste
// funciona sempre, e só manda pro endereço que vier nele.

const SITE = process.env.VITE_APP_URL?.startsWith("http") ? process.env.VITE_APP_URL : MARCA_ATIVA.url;

/** "Domingo na Casa da Eva" (mãe), de `exemplos-pt.ts`: quem fez pra esposa vê a próxima pessoa. */
const LINK_EXEMPLO = `${SITE}/p/533db522753f423e8b2227`;

type Linha = { email: string; versao: VersaoEnvio; quiz_response_id: string | null; nome: string | null };

function db() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

function montarEmail(l: Linha) {
  const nome = primeiroNome(l.nome);
  return {
    from: REMETENTE_RECUPERACAO,
    replyTo: RESPONDER_PARA,
    to: l.email,
    headers: cabecalhosDescadastro(l.email),
    subject: assuntoCampanhaMusica10(l.versao, nome),
    html: emailCampanhaMusica10({
      versao: l.versao,
      nome,
      linkCriar: linkCriarCampanha(SITE, l.versao),
      linkExemplo: LINK_EXEMPLO,
      linkDescadastro: linkDescadastroUmClique(l.email) ?? `${SITE}/descadastrar`,
      valeAte: validadeCurta(MUSICA10),
    }),
  };
}

export const campanhaMusica10 = inngest.createFunction(
  {
    id: "campanha-musica10",
    concurrency: { limit: 1 },
    retries: 1,
    // 9h20 às 20h20 de Brasília, como os outros e-mails de marketing.
    triggers: [{ cron: "20 12-23 * * *" }, { event: "campanha/musica10.teste" }],
  },
  async ({ event, step }) => {
    // ── TESTE: as duas versões pra UM endereço, com [TESTE] no assunto ──
    if (event?.name === "campanha/musica10.teste") {
      const para = String((event.data as { para?: string } | undefined)?.para ?? "").trim().toLowerCase();
      if (!para.includes("@")) return { erro: "evento sem `para`" };
      return step.run("teste", async () => {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const out: Array<{ versao: VersaoEnvio; id: string | null; erro: string | null }> = [];
        for (const versao of ["comprador", "lead"] as const) {
          const e = montarEmail({ email: para, versao, quiz_response_id: null, nome: "Maria" });
          const r = await resend.emails.send({ ...e, subject: `[TESTE] ${e.subject}` });
          out.push({ versao, id: r.data?.id ?? null, erro: r.error?.message ?? null });
        }
        return out;
      });
    }

    if (process.env.CAMPANHA_MUSICA10_ON !== "1") return { desligado: true };

    const total = await step.run("montar-fila-se-vazia", async () => {
      const sb = db();
      const { count, error } = await sb
        .from("campanha_envios")
        .select("email", { count: "exact", head: true })
        .eq("campanha", CAMPANHA);
      if (error) throw new Error(error.message);
      if ((count ?? 0) > 0) return count ?? 0;
      const r = await sb.rpc("montar_campanha", { p_campanha: CAMPANHA });
      if (r.error) throw new Error(r.error.message);
      return Number(r.data ?? 0);
    });

    const parado = await step.run("freio", async () => {
      const sb = db();
      const r = await sb.rpc("taxas_campanha", {
        p_campanha: CAMPANHA,
        p_desde: new Date(Date.now() - 86_400_000).toISOString(),
      });
      if (r.error) throw new Error(r.error.message);
      const t = (r.data as Array<{ enviados: number; bounces: number; reclamacoes: number }> | null)?.[0];
      const taxas = { enviados: Number(t?.enviados ?? 0), bounces: Number(t?.bounces ?? 0), reclamacoes: Number(t?.reclamacoes ?? 0) };
      const motivo = freioAcionado(taxas);
      if (!motivo) return null;
      // Avisa só na rodada em que PAROU (houve envio na última hora); nas
      // seguintes, parada já avisada, fica quieto. Volta sozinho quando a
      // janela de 24h sai do vermelho.
      const hora = await sb
        .from("campanha_envios")
        .select("email", { count: "exact", head: true })
        .eq("campanha", CAMPANHA)
        .gte("enviado_em", new Date(Date.now() - 70 * 60_000).toISOString());
      if ((hora.count ?? 0) > 0) {
        await avisarDonos({
          assunto: "Campanha MUSICA10 parou sozinha",
          html:
            `<p>${motivo}.</p>` +
            `<p>Últimas 24h: ${taxas.enviados} enviados, ${taxas.bounces} bounces, ${taxas.reclamacoes} reclamações.</p>` +
            `<p>Ela volta sozinha quando a taxa das últimas 24h cair. Pra parar de vez: tirar CAMPANHA_MUSICA10_ON na Vercel.</p>`,
        });
      }
      return motivo;
    });
    if (parado) return { parado, total };

    const fila = await step.run("pegar-fila", async () => {
      const { data, error } = await db()
        .from("campanha_envios")
        .select("email, versao, quiz_response_id, nome")
        .eq("campanha", CAMPANHA)
        .is("enviado_em", null)
        .is("pulado", null)
        // Compradores primeiro: lista quente abre mais, e a reputação do
        // domínio se forma nas primeiras rodadas.
        .order("versao", { ascending: true })
        .order("email", { ascending: true })
        .limit(POR_RODADA);
      if (error) throw new Error(error.message);
      return (data ?? []) as Linha[];
    });
    if (!fila.length) return { terminou: true, total };

    let enviados = 0;
    let pulados = 0;
    for (const [i, lote] of emLotes(fila).entries()) {
      const r = await step.run(`lote-${i}-${lote[0].email}`, async () => {
        const sb = db();
        // Rechecagem NA HORA: quem se descadastrou ou voltou desde a montagem.
        const fora = await bloqueados(sb, lote.map((l) => l.email));
        if (fora.size) {
          await sb.from("campanha_envios").update({ pulado: "bloqueado" }).eq("campanha", CAMPANHA).in("email", [...fora]);
        }
        const vivos = lote.filter((l) => !fora.has(l.email));
        if (!vivos.length) return { enviados: 0, pulados: fora.size };

        const chave = createHash("sha256").update(vivos.map((l) => l.email).join(",")).digest("hex").slice(0, 40);
        const resend = new Resend(process.env.RESEND_API_KEY);
        const resp = await resend.batch.send(vivos.map(montarEmail), { idempotencyKey: `musica10-${chave}` });
        if (resp.error) {
          // Sem marcar: a próxima rodada tenta de novo. Lançar derrubaria os outros lotes.
          console.error("[campanha] resend recusou o lote:", resp.error.message);
          return { enviados: 0, pulados: fora.size };
        }
        const ids = resp.data?.data ?? [];
        const agora = new Date().toISOString();
        const { error: erroMarca } = await sb.from("campanha_envios").upsert(
          vivos.map((l, k) => ({ ...l, campanha: CAMPANHA, enviado_em: agora, email_id: ids[k]?.id ?? null })),
          { onConflict: "campanha,email" },
        );
        if (erroMarca) {
          // O Resend JÁ mandou. A chave de idempotência segura a repetição por
          // 24h; isto aqui precisa de gente olhando antes disso.
          console.error("[campanha] ENVIADO e não marcado:", erroMarca.message, vivos[0].email);
          await avisarDonos({ assunto: "Campanha MUSICA10: lote enviado e não marcado", html: `<p>${erroMarca.message}</p>` });
        }
        for (const [k, l] of vivos.entries()) {
          await registrarEnvio(sb, { emailId: ids[k]?.id, template: templateDoEnvio(l.versao), para: l.email, quizResponseId: l.quiz_response_id });
        }
        return { enviados: vivos.length, pulados: fora.size };
      });
      enviados += r.enviados;
      pulados += r.pulados;
    }

    console.log(`[campanha] musica10 enviados=${enviados} pulados=${pulados} total=${total}`);
    return { enviados, pulados, total };
  },
);
```

- [ ] **Step 7: Registrar na lista da Serenata (`api/inngest.ts`)**

Import, depois de `lembrarDatas`:

```ts
import { campanhaMusica10 } from "../inngest/functions/campanhaMusica10.js";
```

Na lista da Serenata (o array depois de `MARCA_ATIVA.chave === "ballad" ? DA_BALLAD :`), acrescentar `campanhaMusica10,` depois de `lembrarDatas,`. NÃO acrescentar em `DA_BALLAD`.

- [ ] **Step 8: Typecheck + suíte inteira**

Run: `npm run typecheck && npm test`
Expected: sem erros de tipo; suíte verde. Falha preexistente que não seja deste trabalho vai pro relatório pelo nome.

- [ ] **Step 9: Commit**

```bash
git add src/lib/campanha-musica10.ts src/lib/campanha-musica10.test.ts inngest/functions/campanhaMusica10.ts api/inngest.ts
git commit -m "feat(campanha): job MUSICA10 em levas de 300/h com freio e evento de teste"
```

---

### Task 9: Documentar e ligar (com o dono)

**Files:**
- Modify: `docs/superpowers/specs/2026-10-07-campanha-musica10-design.md`
- Modify: `CLAUDE.md` (tabela "Testes em andamento" + seção curta)
- Modify (só se a contagem pedir): `src/lib/cupom.ts` (`MUSICA10_VALE_ATE`)

- [ ] **Step 1: Alinhar a spec com o que foi construído**

Na spec, trocar:
- **Seção 2:** "chave PRÓPRIA (`mp_cupom`)" vira "o `cupom` da store `mp_quiz`, que o `reset()` deixou de apagar". É a mesma garantia com um lugar de armazenamento só.
- **Seção 4, "Quem recebe":** a seleção acontece UMA vez, por `montar_campanha` (SQL), numa fila `campanha_envios`. A rodada só drena. Explicar o motivo: reler a base a cada hora repetiria o `statement timeout` de 02/10.
- **Seção 1, "Onde ele é aplicado":** acrescentar que os webhooks do Asaas e da Woovi conferiam o upsell contra o PREÇO DE TABELA. Passaram a conferir contra `valorEsperadoDoUpsell` (catálogo + cupom gravado no pedido, na data em que o pedido nasceu).
- **Seção 4, "Quem fica de fora":** reclamação de spam passa a gravar `descadastros` (motivo `complaint`), em vez de consultar `funnel_events`.

- [ ] **Step 2: CLAUDE.md**

Linha nova na tabela "Testes em andamento":

```
| Campanha MUSICA10 (e-mail pra base + cupom de R$ 10) | ao ligar | Não é A/B: campanha. Base `pt` inteira em 2 versões (comprador × lead), 300/h, fila `campanha_envios`, job `campanhaMusica10` (liga com `CAMPANHA_MUSICA10_ON=1`). Cupom vale em música, extra, quadro e vídeo até `MUSICA10_VALE_ATE` | abertura/clique por versão, vendas com `pedidos.cupom = 'MUSICA10'`, receita, bounce e reclamação | 3 e 7 dias depois do último envio | não (só Serenata) |
```

E, depois da seção "Blog", uma seção curta "## Campanha MUSICA10 (07/10/2026)" com as invariantes:
- O webhook do upsell confere o valor pelo cupom do PRÓPRIO pedido, nunca pelo gateway.
- O cupom fica na store e sobrevive ao `reset()`.
- A fila é montada uma vez por SQL.
- Reclamação de spam vira descadastro.
- A data da validade mora em `cupom.ts` e o e-mail lê de lá.

- [ ] **Step 3: Commit da documentação**

```bash
git add docs/superpowers/specs/2026-10-07-campanha-musica10-design.md CLAUDE.md
git commit -m "docs: campanha MUSICA10 na spec e no CLAUDE.md"
```

- [ ] **Step 4: Aplicar a migration (dono ou credencial dele)**

Rodar `supabase/migrations/20261007000000_campanha_musica10.sql` no projeto Serenata (`ouwijepgctgtfzrrwpvt`). Dois caminhos:
- o dono cola no SQL Editor do Supabase;
- ou, com `supabase login` feito por ele no terminal: `supabase db query --project-ref ouwijepgctgtfzrrwpvt < supabase/migrations/20261007000000_campanha_musica10.sql`.

Expected: `ALTER TABLE`, `CREATE TABLE`, `CREATE FUNCTION` sem erro. **Só depois disso o deploy.**

- [ ] **Step 5: Deploy**

```bash
git pull --rebase && git push
```

Depois do deploy da Vercel, registrar o job:

```bash
curl -s -X PUT https://serenatagift.com/api/inngest
```

Expected: `"Successfully registered"`; a função `campanha-musica10` aparece no painel do Inngest.

- [ ] **Step 6: Teste de ponta a ponta, sem base**

- O dono manda o evento `campanha/musica10.teste` com `{ "para": "<e-mail dele>" }` pelo painel do Inngest ("Send event") e confere as duas versões na caixa de entrada: Gmail, aba e visual.
- Clicar no botão do e-mail e conferir:
  - `/criar` abre sem `cupom` na URL;
  - na oferta aparece R$ 38 riscado e R$ 28;
  - o QR do PIX sai por R$ 28.
- NÃO pagar.

- [ ] **Step 7: Tamanho da base e validade**

O dono roda no SQL Editor:

```sql
select montar_campanha('musica10');
select versao, count(*) from campanha_envios where campanha = 'musica10' group by 1;
```

Com o total `N`:
- dias de envio = `ceil(N / 3600)`;
- `MUSICA10_VALE_ATE` = data de início + dias de envio + 7 dias.

Se a data mudou: editar `src/lib/cupom.ts`, rodar `npx vitest run src/lib/cupom.test.ts` (os testes usam a constante, então continuam valendo), commit `chore(cupom): validade do MUSICA10 pelo tamanho da base`, push e esperar o deploy.

- [ ] **Step 8: Ligar — SÓ com o "pode mandar" do dono, dado no chat**

O dono põe `CAMPANHA_MUSICA10_ON=1` nas envs de Production do projeto da Serenata na Vercel e faz redeploy. Na primeira rodada cheia, conferir nos logs da Vercel a linha `[campanha] musica10 enviados=… pulados=… total=…` e relatar ao dono o total real.

---

## Self-review

- **Cobertura da spec:**
  - cupom fixo, piso, validade e não-soma: T1, T2 e T3;
  - aplicação nas 4 rotas que cobram: T2 e T3;
  - não muda oferta/Stripe/Perfect Pay: Global Constraints;
  - registro `pedidos.cupom`: T2, T3 e T6;
  - link aplica e sobrevive: T4;
  - telas e defeito da folha: T5;
  - e-mail em 2 versões, remetente e descadastro: T7 e T8;
  - levas, interruptor, exclusões, trava, freio e relatório: T6 e T8;
  - prévia e teste pro dono: T7 e T9;
  - medição: T9.
- **Desvios da spec, todos registrados no T9 Step 1:**
  - `mp_cupom` virou a store `mp_quiz`;
  - seleção por fila SQL em vez de releitura por rodada;
  - reclamação lida de `descadastros` em vez de `funnel_events`;
  - correção dos webhooks do upsell, que a spec não previa e sem a qual nenhum extra com cupom seria liberado.
- **Tipos conferidos entre tasks:**
  - `Alvo`, `centavosComCupom`, `codigoAplicado`, `descontoNaTela`, `valorEsperadoDoUpsell`, `validadeCurta`, `MUSICA10`;
  - `referenciaComItem(…, cupom)`;
  - `separarCupomDaUrl` / `guardarCupomDaUrl`;
  - `emailCampanhaMusica10` / `assuntoCampanhaMusica10`;
  - `CAMPANHA`, `POR_RODADA`, `emLotes`, `freioAcionado`, `linkCriarCampanha`, `templateDoEnvio`.
