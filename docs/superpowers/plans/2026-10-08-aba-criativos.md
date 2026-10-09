# Aba Criativos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma aba "Criativos" no `/admin` com o ranking de vídeos e anúncios do Google Ads por venda real, e de títulos, descrições e imagens pela conversão do Google.

**Architecture:** Um job Inngest (`puxarCriativosAds`, de hora em hora, nas duas marcas) lê a API do Google Ads e grava em 5 tabelas; liga cada venda ao anúncio pelo `gclid` via `click_view`. A aba só lê o banco, por uma server fn própria, e a conta é a função pura `montarCriativos`. Uma sonda (`criativos/sonda`) mede, ANTES do resto, se o `click_view` acha os cliques de vídeo/Demand Gen.

**Tech Stack:** TanStack Start (server fn), Supabase, Inngest v4, Google Ads API v25 (REST `googleAds:search`), Vitest (`src/**/*.test.ts`, node), React 19 + Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-08-aba-criativos-design.md`

## Global Constraints

- Google Ads API **v25**, `https://googleads.googleapis.com/v25`, mesmas envs do `puxarMetricasAds`: `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
- Ids do Google como TEXTO (passam de 2^53), em todo lugar.
- Migration só com DDL simples, sem função e sem `$$` (o SQL Editor parte nos `;`). Roda nos DOIS Supabase. RLS ligado e sem política.
- Imports em `api/` e `inngest/` são relativos COM `.js`; em `src/` usam `@/lib/...`.
- `click_view` só alcança 90 dias: o job consulta cliques de até **89** dias.
- Venda = `ehVenda` (`status = 'pago'` e `dinheiro_entrou !== false`), `paid_at` no período, com upsell. Venda com cupom ou e-mail CONTA pro anúncio.
- Receita em real; pedido de quiz `locale` `es` ou `en` é dólar × `cambioDoDia()`.
- Métrica que o Google não devolveu é `null` e a tela mostra "—", nunca 0.
- `/admin` é rota sensível: miniatura com `referrerPolicy="no-referrer"`.
- Nada de push sem o dono: o push publica as DUAS marcas. **Pré-requisito do primeiro push:** o dono já rodou `alter table public.pedidos add column if not exists cupom text; alter table public.pedidos add column if not exists veio_de text;` nos dois Supabase (há commits locais que leem essas colunas).

## Review Focus

- Venda cujo `gclid` o `click_view` não achou, ou que ainda não foi consultada: tem de aparecer na linha "sem anúncio identificado", não sumir.
- Anúncio com mais de um vídeo: a venda NÃO pode entrar em nenhum vídeo (nem duplicada em todos).
- Período sem nenhuma métrica, ou anúncio com venda e sem impressão no período: a tela não quebra; CPA com gasto 0 é "—", não 0 nem infinito.
- `captured_at` ausente ou inválido no quiz: a venda não entra na consulta (não trava o job), e conta em "sem anúncio".
- Resposta da API paginada (mais de 10.000 linhas): o job lê todas as páginas, não só a primeira. (É rede, sem teste unitário: `consultarGoogleAds` segue o `nextPageToken`; o revisor confere na leitura do código.)

---

### Task 1: Leitura pura das respostas do Google e do dia do clique

**Files:**
- Create: `src/lib/dia-do-clique.ts`, `src/lib/dia-do-clique.test.ts`
- Create: `src/lib/ler-criativos-google.ts`, `src/lib/ler-criativos-google.test.ts`

**Interfaces:**
- Produces:
  - `diaNoFuso(iso: string, fuso: string): string | null` → `"2026-10-08"`
  - `diaAnterior(dia: string): string`
  - `type VendaComClique = { gclid: string; capturadoEm: string | null }`
  - `planejarConsultas(vendas: VendaComClique[], fuso: string, agora: Date, maxDias?: number): { dia: string; gclids: string[] }[]` — por dia desc, só cliques de até 89 dias, no máximo `maxDias` (padrão 30) dias.
  - `idDoAnuncio(recurso: string | null | undefined): string | null` (`customers/1/adGroupAds/111~222` → `"222"`)
  - `type Clique = { gclid: string; anuncioId: string | null; grupoId: string | null; campanhaId: string | null; tipoCampanha: string | null; dia: string | null }`
  - `lerClique(r: Linha): Clique | null`
  - `type Linha = Record<string, unknown>`

- [ ] **Step 1: Teste do dia do clique**

```ts
// src/lib/dia-do-clique.test.ts
import { describe, expect, it } from "vitest";
import { diaAnterior, diaNoFuso, planejarConsultas } from "./dia-do-clique";

describe("diaNoFuso", () => {
  it("usa o fuso da conta, não UTC", () => {
    expect(diaNoFuso("2026-10-08T02:30:00.000Z", "America/Sao_Paulo")).toBe("2026-10-07");
    expect(diaNoFuso("2026-10-08T03:30:00.000Z", "America/Sao_Paulo")).toBe("2026-10-08");
  });
  it("data inválida ou vazia é null", () => {
    expect(diaNoFuso("", "America/Sao_Paulo")).toBeNull();
    expect(diaNoFuso("ontem", "America/Sao_Paulo")).toBeNull();
  });
});

it("diaAnterior atravessa o mês", () => {
  expect(diaAnterior("2026-10-01")).toBe("2026-09-30");
});

describe("planejarConsultas", () => {
  const agora = new Date("2026-10-08T15:00:00Z");
  const fuso = "America/Sao_Paulo";
  it("agrupa por dia, do mais novo pro mais velho, sem repetir gclid", () => {
    expect(
      planejarConsultas(
        [
          { gclid: "a", capturadoEm: "2026-10-07T12:00:00Z" },
          { gclid: "b", capturadoEm: "2026-10-05T12:00:00Z" },
          { gclid: "c", capturadoEm: "2026-10-07T20:00:00Z" },
          { gclid: "a", capturadoEm: "2026-10-07T12:00:00Z" },
        ],
        fuso,
        agora,
      ),
    ).toEqual([
      { dia: "2026-10-07", gclids: ["a", "c"] },
      { dia: "2026-10-05", gclids: ["b"] },
    ]);
  });
  it("fora: clique com mais de 89 dias e captured_at ausente", () => {
    expect(
      planejarConsultas(
        [
          { gclid: "velho", capturadoEm: "2026-07-01T12:00:00Z" },
          { gclid: "sem", capturadoEm: null },
        ],
        fuso,
        agora,
      ),
    ).toEqual([]);
  });
  it("no máximo maxDias dias por execução", () => {
    const vendas = [1, 2, 3].map((d) => ({ gclid: `g${d}`, capturadoEm: `2026-10-0${d}T12:00:00Z` }));
    expect(planejarConsultas(vendas, fuso, agora, 2).map((x) => x.dia)).toEqual(["2026-10-03", "2026-10-02"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dia-do-clique.test.ts`
Expected: FAIL (módulo `./dia-do-clique` não existe)

- [ ] **Step 3: Implementar**

```ts
// src/lib/dia-do-clique.ts
// O DIA DO CLIQUE, no fuso da conta de anúncios. O `click_view` do Google só
// aceita UM dia por consulta (`segments.date = '...'`) e só alcança 90 dias.
// O dia vem de `attribution.captured_at`, gravado segundos depois do clique:
// perto da meia-noite pode cair no dia seguinte, por isso o job tenta também
// `diaAnterior`. Sem imports: roda no Inngest e no teste.

export const DIAS_CLICK_VIEW = 89;

export function diaNoFuso(iso: string, fuso: string): string | null {
  const t = Date.parse(iso);
  if (!iso || Number.isNaN(t)) return null;
  // en-CA escreve AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

export function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type VendaComClique = { gclid: string; capturadoEm: string | null };

export function planejarConsultas(
  vendas: VendaComClique[],
  fuso: string,
  agora: Date,
  maxDias = 30,
): { dia: string; gclids: string[] }[] {
  const limite = diaNoFuso(new Date(agora.getTime() - DIAS_CLICK_VIEW * 86400000).toISOString(), fuso) ?? "";
  const porDia = new Map<string, Set<string>>();
  for (const v of vendas) {
    if (!v.gclid || !v.capturadoEm) continue;
    const dia = diaNoFuso(v.capturadoEm, fuso);
    if (!dia || dia < limite) continue;
    const s = porDia.get(dia) ?? new Set<string>();
    s.add(v.gclid);
    porDia.set(dia, s);
  }
  return [...porDia.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, maxDias)
    .map(([dia, s]) => ({ dia, gclids: [...s] }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dia-do-clique.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 5: Teste da leitura do clique**

```ts
// src/lib/ler-criativos-google.test.ts
import { describe, expect, it } from "vitest";
import { idDoAnuncio, lerClique } from "./ler-criativos-google";

describe("idDoAnuncio", () => {
  it("tira o id do anúncio do recurso", () => {
    expect(idDoAnuncio("customers/692/adGroupAds/1771~7123456789012")).toBe("7123456789012");
  });
  it("recurso estranho é null", () => {
    expect(idDoAnuncio(undefined)).toBeNull();
    expect(idDoAnuncio("customers/692/adGroups/1771")).toBeNull();
  });
});

describe("lerClique", () => {
  it("lê a linha do click_view (camelCase da API REST)", () => {
    expect(
      lerClique({
        clickView: { gclid: "Cj0K", adGroupAd: "customers/1/adGroupAds/55~66" },
        adGroup: { id: "55" },
        campaign: { id: "44", advertisingChannelType: "DEMAND_GEN" },
        segments: { date: "2026-10-07" },
      }),
    ).toEqual({ gclid: "Cj0K", anuncioId: "66", grupoId: "55", campanhaId: "44", tipoCampanha: "DEMAND_GEN", dia: "2026-10-07" });
  });
  it("sem gclid não é clique", () => {
    expect(lerClique({ clickView: {} })).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/lib/ler-criativos-google.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 7: Implementar**

```ts
// src/lib/ler-criativos-google.ts
// A LEITURA DAS RESPOSTAS DA API DO GOOGLE ADS (REST v25, chaves em camelCase,
// número inteiro como string). Pura e sem imports: o job grava o que sai daqui
// e o teste prende o formato. Os nomes de campo de vídeo mudam entre versões
// da API; se o Google renomear, o teste com a resposta gravada acusa.

export type Linha = Record<string, unknown>;

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function texto(v: unknown): string | null {
  return v === undefined || v === null || v === "" ? null : String(v);
}

export function idDoAnuncio(recurso: string | null | undefined): string | null {
  const m = /\/adGroupAds\/\d+~(\d+)$/.exec(String(recurso ?? ""));
  return m ? m[1] : null;
}

export type Clique = {
  gclid: string;
  anuncioId: string | null;
  grupoId: string | null;
  campanhaId: string | null;
  tipoCampanha: string | null;
  dia: string | null;
};

export function lerClique(r: Linha): Clique | null {
  const cv = obj(r.clickView);
  const gclid = texto(cv.gclid);
  if (!gclid) return null;
  return {
    gclid,
    anuncioId: idDoAnuncio(texto(cv.adGroupAd)),
    grupoId: texto(obj(r.adGroup).id),
    campanhaId: texto(obj(r.campaign).id),
    tipoCampanha: texto(obj(r.campaign).advertisingChannelType),
    dia: texto(obj(r.segments).date),
  };
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/lib/ler-criativos-google.test.ts src/lib/dia-do-clique.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/dia-do-clique.ts src/lib/dia-do-clique.test.ts src/lib/ler-criativos-google.ts src/lib/ler-criativos-google.test.ts
git commit -m "feat(criativos): dia do clique e leitura do click_view (puros)"
```

---

### Task 2: Cliente do Google Ads e a SONDA do click_view (portão)

**Files:**
- Create: `inngest/lib/google-ads.ts`
- Create: `inngest/functions/puxarCriativosAds.ts` (só a sonda nesta task)
- Modify: `inngest/functions/puxarMetricasAds.ts` (usar `tokenGoogleAds` do lib novo; apagar a `token()` local)
- Modify: `api/inngest.ts` (registrar `puxarCriativosAds` nas DUAS listas)

**Interfaces:**
- Consumes: `planejarConsultas`, `lerClique`, `diaAnterior` (Task 1)
- Produces:
  - `tokenGoogleAds(): Promise<string>`
  - `consultarGoogleAds(gaql: string): Promise<Linha[]>` — lê todas as páginas (`nextPageToken`).
  - `fusoDaConta(): Promise<string>`
  - `lerVendasComClique(db, desdeIso): Promise<{ gclid: string; capturadoEm: string | null; utmCampaign: string | null }[]>`
  - `consultarCliques(dia: string, gclids: string[], acesso: string): Promise<Clique[]>` (lotes de 100)

- [ ] **Step 1: O cliente**

```ts
// inngest/lib/google-ads.ts
// O CLIENTE DA API DO GOOGLE ADS, usado pelo `puxarMetricasAds` e pelo
// `puxarCriativosAds`. Cada deploy (Serenata, Ballad) usa as próprias envs.
import type { Linha } from "../../src/lib/ler-criativos-google.js";

export const API = "https://googleads.googleapis.com/v25";

export async function tokenGoogleAds(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const j = (await r.json()) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error("OAuth do Google Ads falhou: " + (j.error_description ?? "sem token"));
  return j.access_token;
}

/** Todas as páginas de uma consulta GAQL (a API devolve 10.000 por página). */
export async function consultarGoogleAds(gaql: string, acesso?: string): Promise<Linha[]> {
  const cid = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!cid) throw new Error("sem GOOGLE_ADS_CUSTOMER_ID");
  const H: Record<string, string> = {
    Authorization: `Bearer ${acesso ?? (await tokenGoogleAds())}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    "content-type": "application/json",
  };
  const mcc = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (mcc) H["login-customer-id"] = mcc;
  const todas: Linha[] = [];
  let pageToken: string | undefined;
  for (let pagina = 0; pagina < 50; pagina++) {
    const r = await fetch(`${API}/customers/${cid}/googleAds:search`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ query: gaql, ...(pageToken ? { pageToken } : {}) }),
    });
    const j = (await r.json()) as { results?: Linha[]; nextPageToken?: string; error?: { message?: string } };
    if (j.error) throw new Error("Google Ads: " + (j.error.message ?? "erro"));
    todas.push(...(j.results ?? []));
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return todas;
}

export async function fusoDaConta(acesso?: string): Promise<string> {
  const [l] = await consultarGoogleAds("SELECT customer.time_zone FROM customer", acesso);
  const fuso = (l?.customer as { timeZone?: string } | undefined)?.timeZone;
  return fuso || "America/Sao_Paulo";
}
```

- [ ] **Step 2: `puxarMetricasAds` usa o token do lib**

Em `inngest/functions/puxarMetricasAds.ts`: apagar a função `async function token()` inteira, acrescentar `import { tokenGoogleAds } from "../lib/google-ads.js";` e trocar `const acesso = await token();` por `const acesso = await tokenGoogleAds();`. Nada mais muda nesse arquivo.

Run: `npx tsc --noEmit -p .`
Expected: sem erro

- [ ] **Step 3: A sonda**

```ts
// inngest/functions/puxarCriativosAds.ts
// OS CRIATIVOS DO GOOGLE ADS, PRO RANKING DA ABA "CRIATIVOS" (08/10).
// Spec: docs/superpowers/specs/2026-10-08-aba-criativos-design.md
//
// Nesta primeira versão, só a SONDA (`criativos/sonda`): mede se o
// `click_view` acha os cliques das vendas por tipo de campanha, sem gravar
// nada. Se vídeo/Demand Gen não aparecer, o desenho muda (plano B da spec).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "../client.js";
import { consultarGoogleAds, fusoDaConta, tokenGoogleAds } from "../lib/google-ads.js";
import { diaAnterior, planejarConsultas } from "../../src/lib/dia-do-clique.js";
import { lerClique, type Clique } from "../../src/lib/ler-criativos-google.js";

/** Vendas pagas desde `desdeIso` cujo quiz tem gclid, com a hora da captura. */
export async function lerVendasComClique(
  db: SupabaseClient,
  desdeIso: string,
): Promise<{ gclid: string; capturadoEm: string | null; utmCampaign: string | null }[]> {
  const quizIds = new Set<string>();
  let cursor: { paid_at: string; id: string } | null = null;
  for (;;) {
    let q = db
      .from("pedidos")
      .select("id, quiz_response_id, paid_at, status, dinheiro_entrou")
      .eq("status", "pago")
      .gte("paid_at", desdeIso);
    if (cursor) q = q.or(`paid_at.gt."${cursor.paid_at}",and(paid_at.eq."${cursor.paid_at}",id.gt.${cursor.id})`);
    const { data, error } = await q.order("paid_at").order("id").limit(1000);
    if (error) throw new Error("pedidos: " + error.message);
    for (const p of data ?? []) if (p.dinheiro_entrou !== false && p.quiz_response_id) quizIds.add(String(p.quiz_response_id));
    if (!data || data.length < 1000) break;
    const u = data[data.length - 1];
    cursor = { paid_at: String(u.paid_at), id: String(u.id) };
  }
  const ids = [...quizIds];
  const saida: { gclid: string; capturadoEm: string | null; utmCampaign: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("quiz_responses")
      .select("id, gclid:attribution->>gclid, capturado:attribution->>captured_at, campanha:attribution->>utm_campaign")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error("quiz_responses: " + error.message);
    for (const q of (data ?? []) as Array<Record<string, string | null>>) {
      if (q.gclid) saida.push({ gclid: q.gclid, capturadoEm: q.capturado ?? null, utmCampaign: q.campanha ?? null });
    }
  }
  return saida;
}

const aspas = (s: string) => `'${s.replace(/[^A-Za-z0-9_-]/g, "")}'`;

/** click_view de UM dia pros gclids pedidos, em lotes de 100. */
export async function consultarCliques(dia: string, gclids: string[], acesso: string): Promise<Clique[]> {
  const achados: Clique[] = [];
  for (let i = 0; i < gclids.length; i += 100) {
    const lote = gclids.slice(i, i + 100).map(aspas).join(", ");
    const linhas = await consultarGoogleAds(
      `SELECT click_view.gclid, click_view.ad_group_ad, ad_group.id, campaign.id,
              campaign.advertising_channel_type, segments.date
       FROM click_view
       WHERE segments.date = '${dia}' AND click_view.gclid IN (${lote})`,
      acesso,
    );
    for (const l of linhas) {
      const c = lerClique(l);
      if (c) achados.push(c);
    }
  }
  return achados;
}

export const puxarCriativosAds = inngest.createFunction(
  { id: "puxar-criativos-ads", retries: 2, concurrency: 1, triggers: [{ event: "criativos/sonda" }] },
  async ({ step }) => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !process.env.GOOGLE_ADS_CUSTOMER_ID) return { pulado: "sem credenciais" };
    const db = createClient(url, key, { auth: { persistSession: false } });

    return step.run("sonda", async () => {
      const acesso = await tokenGoogleAds();
      const fuso = await fusoDaConta(acesso);
      const vendas = await lerVendasComClique(db, new Date(Date.now() - 7 * 86400000).toISOString());
      const plano = planejarConsultas(vendas, fuso, new Date(), 8);
      const achados = new Map<string, Clique>();
      for (const { dia, gclids } of plano) {
        for (const c of await consultarCliques(dia, gclids, acesso)) achados.set(c.gclid, c);
        const faltam = gclids.filter((g) => !achados.has(g));
        if (faltam.length) for (const c of await consultarCliques(diaAnterior(dia), faltam, acesso)) achados.set(c.gclid, c);
      }
      // Quem NÃO foi achado, pelo tipo da campanha da utm (tabela `campanhas`).
      const { data: camps } = await db.from("campanhas").select("id, tipo");
      const tipoDe = new Map((camps ?? []).map((c) => [String(c.id), String(c.tipo)]));
      const porTipo: Record<string, { achados: number; faltando: number }> = {};
      const conta = (tipo: string, campo: "achados" | "faltando") => {
        porTipo[tipo] ??= { achados: 0, faltando: 0 };
        porTipo[tipo][campo]++;
      };
      const vistos = new Set<string>();
      for (const v of vendas) {
        if (vistos.has(v.gclid)) continue;
        vistos.add(v.gclid);
        const c = achados.get(v.gclid);
        if (c) conta(c.tipoCampanha ?? "?", "achados");
        else conta(tipoDe.get(v.utmCampaign ?? "") ?? "sem campanha conhecida", "faltando");
      }
      const resumo = { fuso, vendasComGclid: vistos.size, diasConsultados: plano.length, porTipo };
      console.log("[criativos] sonda", JSON.stringify(resumo));
      return resumo;
    });
  },
);
```

- [ ] **Step 4: Registrar nas duas listas**

Em `api/inngest.ts`: acrescentar `import { puxarCriativosAds } from "../inngest/functions/puxarCriativosAds.js";` junto dos outros imports, e `puxarCriativosAds,` logo depois de `puxarMetricasAds,` nas DUAS listas (a da Ballad tem o comentário "O gasto do Google pro painel"; a da Serenata é a lista simples).

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: tsc sem erro; suíte verde (fora o `google-ads.test.ts`, que precisa de `jsdom` e já falhava antes)

- [ ] **Step 5: Commit**

```bash
git add inngest/lib/google-ads.ts inngest/functions/puxarCriativosAds.ts inngest/functions/puxarMetricasAds.ts api/inngest.ts
git commit -m "feat(criativos): sonda do click_view (criativos/sonda) e cliente do Google Ads"
```

- [ ] **Step 6: PORTÃO — publicar e o dono rodar a sonda**

Parar e pedir ao dono: (1) confirmar que o SQL de `cupom`/`veio_de` já rodou nos dois Supabase; (2) aprovar o push. Depois do push: `curl -X PUT https://www.serenatagift.com/api/inngest` e `curl -X PUT https://www.balladgift.com/api/inngest`. O dono manda o evento `criativos/sonda` com `{}` no painel do Inngest (app Serenata) e cola o resultado (`porTipo`).

- Se `DEMAND_GEN`/`VIDEO` aparecem em `achados` (e o `faltando` desses tipos é pequeno): seguir pra Task 3.
- Se NÃO: parar o plano. Ruling com o dono sobre o plano B da spec (`utm_content={creative}` no sufixo da conta). As Tasks 3–8 mudam no passo 3 do job; não seguir sem decidir.

---

### Task 3: Tabelas (migration)

**Files:**
- Create: `supabase/migrations/20261008100000_criativos_ads.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- ABA CRIATIVOS (08/10/2026). Spec: docs/superpowers/specs/2026-10-08-aba-criativos-design.md
-- Gravadas pelo job `puxarCriativosAds`, lidas só pelo painel (service role).
-- Ids do Google como texto: passam de 2^53.

create table if not exists public.anuncios_ads (
  id text primary key,
  campanha_id text,
  grupo_id text,
  nome text,
  tipo text,
  status text,
  -- ids de ASSET dos vídeos do anúncio; o YouTube de cada um está em criativos_ads
  videos text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

create table if not exists public.criativos_ads (
  id text primary key,
  tipo text not null check (tipo in ('video', 'imagem', 'texto', 'outro')),
  texto text,
  youtube_id text,
  imagem_url text,
  nome text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.metricas_anuncio (
  dia date not null,
  anuncio_id text not null,
  custo_brl numeric not null default 0,
  impressoes bigint not null default 0,
  cliques bigint not null default 0,
  views bigint,
  p25 numeric,
  p50 numeric,
  p75 numeric,
  p100 numeric,
  conversoes_google numeric not null default 0,
  valor_conv_google numeric not null default 0,
  primary key (dia, anuncio_id)
);

create table if not exists public.metricas_criativo (
  dia date not null,
  criativo_id text not null,
  campo text not null,
  custo_brl numeric,
  impressoes bigint,
  cliques bigint,
  conversoes_google numeric,
  valor_conv_google numeric,
  primary key (dia, criativo_id, campo)
);

create table if not exists public.cliques_anuncio (
  gclid text primary key,
  anuncio_id text,
  grupo_id text,
  campanha_id text,
  dia date,
  tentado_em timestamptz not null default now()
);

create index if not exists pedidos_paid_at_id on public.pedidos (paid_at, id);

alter table public.anuncios_ads enable row level security;
alter table public.criativos_ads enable row level security;
alter table public.metricas_anuncio enable row level security;
alter table public.metricas_criativo enable row level security;
alter table public.cliques_anuncio enable row level security;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261008100000_criativos_ads.sql
git commit -m "feat(criativos): tabelas dos criativos do Google Ads"
```

- [ ] **Step 3: PORTÃO — o dono roda o SQL**

Pedir ao dono pra rodar o arquivo inteiro no SQL Editor dos DOIS Supabase (Serenata e Ballad). Se o editor perguntar sobre RLS, "Run and enable RLS". Conferir com:

```sql
select count(*) as tabelas from information_schema.tables
where table_schema = 'public'
  and table_name in ('anuncios_ads','criativos_ads','metricas_anuncio','metricas_criativo','cliques_anuncio')
```
Expected: `tabelas = 5` nos dois.

---

### Task 4: Leitura pura de anúncios e recursos

**Files:**
- Modify: `src/lib/ler-criativos-google.ts`
- Modify: `src/lib/ler-criativos-google.test.ts`

**Interfaces:**
- Produces:
  - `type AnuncioLido = { id: string; campanha_id: string | null; grupo_id: string | null; nome: string | null; tipo: string | null; status: string | null; videos: string[] }`
  - `type MetricaAnuncioLida = { dia: string; anuncio_id: string; custo_brl: number; impressoes: number; cliques: number; views: number | null; p25: number | null; p50: number | null; p75: number | null; p100: number | null; conversoes_google: number; valor_conv_google: number }`
  - `lerLinhaAnuncio(r: Linha): { anuncio: AnuncioLido; metrica: MetricaAnuncioLida | null } | null`
  - `type CriativoLido = { id: string; tipo: "video" | "imagem" | "texto" | "outro"; texto: string | null; youtube_id: string | null; imagem_url: string | null; nome: string | null }`
  - `type MetricaCriativoLida = { dia: string; criativo_id: string; campo: string; custo_brl: number | null; impressoes: number | null; cliques: number | null; conversoes_google: number | null; valor_conv_google: number | null }`
  - `lerAsset(r: Linha): CriativoLido | null`
  - `lerLinhaCriativo(r: Linha): { criativo: CriativoLido; metrica: MetricaCriativoLida | null } | null`
  - `somarMetricasCriativo(ms: MetricaCriativoLida[]): MetricaCriativoLida[]` (soma por dia+criativo+campo; null + null = null, null + n = n)

- [ ] **Step 1: Testes**

Acrescentar a `src/lib/ler-criativos-google.test.ts`:

```ts
import { lerAsset, lerLinhaAnuncio, lerLinhaCriativo, somarMetricasCriativo } from "./ler-criativos-google";

describe("lerLinhaAnuncio", () => {
  const base = {
    adGroupAd: {
      status: "ENABLED",
      ad: {
        id: "777",
        name: "Video Fone",
        type: "DEMAND_GEN_VIDEO_RESPONSIVE_AD",
        demandGenVideoResponsiveAd: { videos: [{ asset: "customers/1/assets/901" }] },
      },
    },
    campaign: { id: "44" },
    adGroup: { id: "55" },
    segments: { date: "2026-10-07" },
    metrics: {
      costMicros: "12500000",
      impressions: "1000",
      clicks: "20",
      videoTrueviewViews: "300",
      videoQuartileP25Rate: 0.5,
      videoQuartileP50Rate: 0.3,
      videoQuartileP75Rate: 0.2,
      videoQuartileP100Rate: 0.1,
      conversions: 2.5,
      conversionsValue: 95,
    },
  };
  it("lê anúncio, vídeos e métrica do dia", () => {
    expect(lerLinhaAnuncio(base)).toEqual({
      anuncio: { id: "777", campanha_id: "44", grupo_id: "55", nome: "Video Fone", tipo: "DEMAND_GEN_VIDEO_RESPONSIVE_AD", status: "ENABLED", videos: ["901"] },
      metrica: {
        dia: "2026-10-07", anuncio_id: "777", custo_brl: 12.5, impressoes: 1000, cliques: 20,
        views: 300, p25: 0.5, p50: 0.3, p75: 0.2, p100: 0.1, conversoes_google: 2.5, valor_conv_google: 95,
      },
    });
  });
  it("anúncio de vídeo in-stream e responsivo de vídeo também dão o asset", () => {
    const videoAd = { ...base, adGroupAd: { ad: { id: "1", videoAd: { video: { asset: "customers/1/assets/5" } } } } };
    expect(lerLinhaAnuncio(videoAd)?.anuncio.videos).toEqual(["5"]);
    const resp = { ...base, adGroupAd: { ad: { id: "2", videoResponsiveAd: { videos: [{ asset: "customers/1/assets/6" }, { asset: "customers/1/assets/7" }] } } } };
    expect(lerLinhaAnuncio(resp)?.anuncio.videos).toEqual(["6", "7"]);
  });
  it("sem métrica de vídeo, views e quartis são null", () => {
    const busca = { ...base, metrics: { costMicros: "0", impressions: "5", clicks: "1" } };
    const m = lerLinhaAnuncio(busca)?.metrica;
    expect(m?.views).toBeNull();
    expect(m?.p25).toBeNull();
    expect(m?.conversoes_google).toBe(0);
  });
  it("sem id não é anúncio", () => {
    expect(lerLinhaAnuncio({ adGroupAd: { ad: {} } })).toBeNull();
  });
});

describe("lerAsset", () => {
  it("vídeo do YouTube, imagem e texto", () => {
    expect(lerAsset({ asset: { id: "901", type: "YOUTUBE_VIDEO", youtubeVideoAsset: { youtubeVideoId: "abc123", youtubeVideoTitle: "Fone" } } }))
      .toEqual({ id: "901", tipo: "video", texto: null, youtube_id: "abc123", imagem_url: null, nome: "Fone" });
    expect(lerAsset({ asset: { id: "8", type: "IMAGE", name: "capa", imageAsset: { fullSize: { url: "https://tpc.googlesyndication.com/x.jpg" } } } }))
      .toEqual({ id: "8", tipo: "imagem", texto: null, youtube_id: null, imagem_url: "https://tpc.googlesyndication.com/x.jpg", nome: "capa" });
    expect(lerAsset({ asset: { id: "9", type: "TEXT", textAsset: { text: "Uma música só dela" } } }))
      .toEqual({ id: "9", tipo: "texto", texto: "Uma música só dela", youtube_id: null, imagem_url: null, nome: null });
  });
});

describe("lerLinhaCriativo", () => {
  it("lê o recurso e a métrica pelo campo", () => {
    const r = lerLinhaCriativo({
      adGroupAdAssetView: { fieldType: "HEADLINE" },
      asset: { id: "9", type: "TEXT", textAsset: { text: "Presente que emociona" } },
      segments: { date: "2026-10-07" },
      metrics: { impressions: "100", clicks: "3", costMicros: "2000000", conversions: 1 },
    });
    expect(r?.metrica).toEqual({
      dia: "2026-10-07", criativo_id: "9", campo: "HEADLINE", custo_brl: 2, impressoes: 100, cliques: 3,
      conversoes_google: 1, valor_conv_google: null,
    });
  });
});

it("somarMetricasCriativo junta o mesmo recurso de anúncios diferentes", () => {
  const m = (c: number | null, i: number | null) => ({
    dia: "2026-10-07", criativo_id: "9", campo: "HEADLINE", custo_brl: c, impressoes: i, cliques: null,
    conversoes_google: 1, valor_conv_google: null,
  });
  expect(somarMetricasCriativo([m(1, 10), m(null, 5)])).toEqual([
    { dia: "2026-10-07", criativo_id: "9", campo: "HEADLINE", custo_brl: 1, impressoes: 15, cliques: null, conversoes_google: 2, valor_conv_google: null },
  ]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/ler-criativos-google.test.ts`
Expected: FAIL (`lerLinhaAnuncio` não existe)

- [ ] **Step 3: Implementar**

Acrescentar a `src/lib/ler-criativos-google.ts`:

```ts
function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function idDoAsset(recurso: unknown): string | null {
  const m = /\/assets\/(\d+)$/.exec(String(recurso ?? ""));
  return m ? m[1] : null;
}

export type AnuncioLido = {
  id: string; campanha_id: string | null; grupo_id: string | null; nome: string | null;
  tipo: string | null; status: string | null; videos: string[];
};
export type MetricaAnuncioLida = {
  dia: string; anuncio_id: string; custo_brl: number; impressoes: number; cliques: number;
  views: number | null; p25: number | null; p50: number | null; p75: number | null; p100: number | null;
  conversoes_google: number; valor_conv_google: number;
};

export function lerLinhaAnuncio(r: Linha): { anuncio: AnuncioLido; metrica: MetricaAnuncioLida | null } | null {
  const aga = obj(r.adGroupAd);
  const ad = obj(aga.ad);
  const id = texto(ad.id);
  if (!id) return null;
  const listas = [obj(ad.demandGenVideoResponsiveAd).videos, obj(ad.videoResponsiveAd).videos];
  const videos: string[] = [];
  for (const l of listas) if (Array.isArray(l)) for (const v of l) { const a = idDoAsset(obj(v).asset); if (a) videos.push(a); }
  const avulso = idDoAsset(obj(obj(ad.videoAd).video).asset);
  if (avulso) videos.push(avulso);
  const anuncio: AnuncioLido = {
    id,
    campanha_id: texto(obj(r.campaign).id),
    grupo_id: texto(obj(r.adGroup).id),
    nome: texto(ad.name),
    tipo: texto(ad.type),
    status: texto(aga.status),
    videos: [...new Set(videos)],
  };
  const dia = texto(obj(r.segments).date);
  const m = obj(r.metrics);
  const metrica: MetricaAnuncioLida | null = dia
    ? {
        dia,
        anuncio_id: id,
        custo_brl: (num(m.costMicros) ?? 0) / 1e6,
        impressoes: num(m.impressions) ?? 0,
        cliques: num(m.clicks) ?? 0,
        views: num(m.videoTrueviewViews),
        p25: num(m.videoQuartileP25Rate),
        p50: num(m.videoQuartileP50Rate),
        p75: num(m.videoQuartileP75Rate),
        p100: num(m.videoQuartileP100Rate),
        conversoes_google: num(m.conversions) ?? 0,
        valor_conv_google: num(m.conversionsValue) ?? 0,
      }
    : null;
  return { anuncio, metrica };
}

export type CriativoLido = {
  id: string; tipo: "video" | "imagem" | "texto" | "outro"; texto: string | null;
  youtube_id: string | null; imagem_url: string | null; nome: string | null;
};
export type MetricaCriativoLida = {
  dia: string; criativo_id: string; campo: string; custo_brl: number | null; impressoes: number | null;
  cliques: number | null; conversoes_google: number | null; valor_conv_google: number | null;
};

export function lerAsset(r: Linha): CriativoLido | null {
  const a = obj(r.asset);
  const id = texto(a.id);
  if (!id) return null;
  const t = String(a.type ?? "");
  const yt = obj(a.youtubeVideoAsset);
  return {
    id,
    tipo: t === "YOUTUBE_VIDEO" ? "video" : t === "IMAGE" ? "imagem" : t === "TEXT" ? "texto" : "outro",
    texto: texto(obj(a.textAsset).text),
    youtube_id: texto(yt.youtubeVideoId),
    imagem_url: texto(obj(obj(a.imageAsset).fullSize).url),
    nome: texto(yt.youtubeVideoTitle) ?? texto(a.name),
  };
}

export function lerLinhaCriativo(r: Linha): { criativo: CriativoLido; metrica: MetricaCriativoLida | null } | null {
  const criativo = lerAsset(r);
  if (!criativo) return null;
  const dia = texto(obj(r.segments).date);
  const campo = texto(obj(r.adGroupAdAssetView).fieldType);
  const m = obj(r.metrics);
  const custo = num(m.costMicros);
  return {
    criativo,
    metrica:
      dia && campo
        ? {
            dia, criativo_id: criativo.id, campo,
            custo_brl: custo === null ? null : custo / 1e6,
            impressoes: num(m.impressions),
            cliques: num(m.clicks),
            conversoes_google: num(m.conversions),
            valor_conv_google: num(m.conversionsValue),
          }
        : null,
  };
}

const soma = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : a + b);

export function somarMetricasCriativo(ms: MetricaCriativoLida[]): MetricaCriativoLida[] {
  const por = new Map<string, MetricaCriativoLida>();
  for (const m of ms) {
    const k = `${m.dia}|${m.criativo_id}|${m.campo}`;
    const a = por.get(k);
    por.set(
      k,
      a
        ? {
            ...a,
            custo_brl: soma(a.custo_brl, m.custo_brl),
            impressoes: soma(a.impressoes, m.impressoes),
            cliques: soma(a.cliques, m.cliques),
            conversoes_google: soma(a.conversoes_google, m.conversoes_google),
            valor_conv_google: soma(a.valor_conv_google, m.valor_conv_google),
          }
        : { ...m },
    );
  }
  return [...por.values()];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/ler-criativos-google.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ler-criativos-google.ts src/lib/ler-criativos-google.test.ts
git commit -m "feat(criativos): leitura pura de anúncios, assets e métricas do Google"
```

---

### Task 5: O job grava anúncios, recursos e cliques

**Files:**
- Modify: `inngest/functions/puxarCriativosAds.ts`

**Interfaces:**
- Consumes: Task 1, 2 e 4 (`lerLinhaAnuncio`, `lerAsset`, `lerLinhaCriativo`, `somarMetricasCriativo`, `consultarGoogleAds`, `consultarCliques`, `lerVendasComClique`, `planejarConsultas`, `diaAnterior`, `fusoDaConta`, `tokenGoogleAds`)
- Produces: tabelas `anuncios_ads`, `criativos_ads`, `metricas_anuncio`, `metricas_criativo`, `cliques_anuncio` preenchidas de hora em hora.

- [ ] **Step 1: Cron, passos 1–3 e a sonda continua**

Em `inngest/functions/puxarCriativosAds.ts`:

1. Trocar os imports de leitura por:
```ts
import {
  lerAsset, lerClique, lerLinhaAnuncio, lerLinhaCriativo, somarMetricasCriativo,
  type AnuncioLido, type Clique, type CriativoLido, type MetricaAnuncioLida, type MetricaCriativoLida,
} from "../../src/lib/ler-criativos-google.js";
```
2. Acrescentar, antes do `export const puxarCriativosAds`:
```ts
const DIAS = 7;
/** `2026-10-08` no fuso da conta, `desloc` dias atrás. */
function diaDaConta(fuso: string, desloc: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() - desloc * 86400000));
}

async function gravarEmLotes(db: SupabaseClient, tabela: string, linhas: object[], onConflict: string) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db.from(tabela).upsert(linhas.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${tabela}: ${error.message}`);
  }
}
```
3. Trocar o `triggers` por `[{ cron: "50 * * * *" }, { event: "criativos/sonda" }]` e o handler por `async ({ event, step }) => {`. Manter o corpo da sonda inteiro dentro de `if (event.name === "criativos/sonda") { return step.run("sonda", ...) }`. Depois dele, o caminho do cron:

```ts
    const fuso = await step.run("fuso", async () => fusoDaConta());
    const de = diaDaConta(fuso, DIAS - 1);
    const ate = diaDaConta(fuso, 0);
    const agoraIso = () => new Date().toISOString();

    const anuncios = await step.run("anuncios", async () => {
      const linhas = await consultarGoogleAds(`
        SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status,
               ad_group_ad.ad.video_ad.video.asset,
               ad_group_ad.ad.video_responsive_ad.videos,
               ad_group_ad.ad.demand_gen_video_responsive_ad.videos,
               campaign.id, ad_group.id, segments.date,
               metrics.cost_micros, metrics.impressions, metrics.clicks,
               metrics.video_trueview_views,
               metrics.video_quartile_p25_rate, metrics.video_quartile_p50_rate,
               metrics.video_quartile_p75_rate, metrics.video_quartile_p100_rate,
               metrics.conversions, metrics.conversions_value
        FROM ad_group_ad
        WHERE segments.date BETWEEN '${de}' AND '${ate}'`);
      const porId = new Map<string, AnuncioLido>();
      const metricas: MetricaAnuncioLida[] = [];
      for (const l of linhas) {
        const x = lerLinhaAnuncio(l);
        if (!x) continue;
        porId.set(x.anuncio.id, x.anuncio);
        if (x.metrica) metricas.push(x.metrica);
      }
      await gravarEmLotes(db, "anuncios_ads", [...porId.values()].map((a) => ({ ...a, atualizado_em: agoraIso() })), "id");
      await gravarEmLotes(db, "metricas_anuncio", metricas, "dia,anuncio_id");
      return { anuncios: porId.size, metricas: metricas.length };
    });

    const criativos = await step.run("criativos", async () => {
      const porId = new Map<string, CriativoLido>();
      for (const l of await consultarGoogleAds(`
        SELECT asset.id, asset.type, asset.name,
               asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title
        FROM asset WHERE asset.type = 'YOUTUBE_VIDEO'`)) {
        const a = lerAsset(l);
        if (a) porId.set(a.id, a);
      }
      const metricas: MetricaCriativoLida[] = [];
      for (const l of await consultarGoogleAds(`
        SELECT ad_group_ad_asset_view.field_type,
               asset.id, asset.type, asset.name, asset.text_asset.text,
               asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title,
               asset.image_asset.full_size.url,
               segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.conversions_value
        FROM ad_group_ad_asset_view
        WHERE segments.date BETWEEN '${de}' AND '${ate}'`)) {
        const x = lerLinhaCriativo(l);
        if (!x) continue;
        porId.set(x.criativo.id, x.criativo);
        if (x.metrica) metricas.push(x.metrica);
      }
      const somadas = somarMetricasCriativo(metricas);
      await gravarEmLotes(db, "criativos_ads", [...porId.values()].map((c) => ({ ...c, atualizado_em: agoraIso() })), "id");
      await gravarEmLotes(db, "metricas_criativo", somadas, "dia,criativo_id,campo");
      return { criativos: porId.size, metricas: somadas.length };
    });

    const cliques = await step.run("cliques", async () => {
      const acesso = await tokenGoogleAds();
      const vendas = await lerVendasComClique(db, new Date(Date.now() - 89 * 86400000).toISOString());
      // Já resolvido, ou tentado nas últimas 24h: não consulta de novo.
      const conhecidos = new Set<string>();
      const gclids = [...new Set(vendas.map((v) => v.gclid))];
      const ontem = Date.now() - 86400000;
      for (let i = 0; i < gclids.length; i += 200) {
        const { data, error } = await db
          .from("cliques_anuncio")
          .select("gclid, anuncio_id, tentado_em")
          .in("gclid", gclids.slice(i, i + 200));
        if (error) throw new Error("cliques_anuncio: " + error.message);
        for (const c of data ?? []) {
          if (c.anuncio_id || Date.parse(String(c.tentado_em)) > ontem) conhecidos.add(String(c.gclid));
        }
      }
      const plano = planejarConsultas(vendas.filter((v) => !conhecidos.has(v.gclid)), fuso, new Date(), 30);
      let achados = 0;
      let faltando = 0;
      let falhas = 0;
      for (const { dia, gclids: doDia } of plano) {
        try {
          const vistos = new Map<string, Clique>();
          for (const c of await consultarCliques(dia, doDia, acesso)) vistos.set(c.gclid, c);
          const resto = doDia.filter((g) => !vistos.has(g));
          if (resto.length) for (const c of await consultarCliques(diaAnterior(dia), resto, acesso)) vistos.set(c.gclid, c);
          const linhas = doDia.map((g) => {
            const c = vistos.get(g);
            return {
              gclid: g,
              anuncio_id: c?.anuncioId ?? null,
              grupo_id: c?.grupoId ?? null,
              campanha_id: c?.campanhaId ?? null,
              dia: c?.dia ?? dia,
              tentado_em: agoraIso(),
            };
          });
          await gravarEmLotes(db, "cliques_anuncio", linhas, "gclid");
          achados += linhas.filter((l) => l.anuncio_id).length;
          faltando += linhas.filter((l) => !l.anuncio_id).length;
        } catch (err) {
          // Um dia que falha não derruba os outros: tenta de novo na próxima hora.
          falhas++;
          console.error("[criativos] click_view do dia", dia, "falhou:", err);
        }
      }
      return { dias: plano.length, achados, faltando, falhas };
    });

    console.log("[criativos]", JSON.stringify({ anuncios, criativos, cliques }));
    return { anuncios, criativos, cliques };
```

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: tsc sem erro; suíte verde (fora `google-ads.test.ts`/jsdom)

- [ ] **Step 2: Commit**

```bash
git add inngest/functions/puxarCriativosAds.ts
git commit -m "feat(criativos): job grava anúncios, recursos, métricas e cliques de hora em hora"
```

- [ ] **Step 3: PORTÃO — publicar e conferir a primeira execução**

Só depois da Task 3 rodada nos dois bancos. Pedir ao dono o ok pro push; depois `curl -X PUT` nas duas marcas. Esperar o `:50` da hora (ou o dono clicar "Invoke" na função `puxar-criativos-ads` no Inngest). Conferir no Inngest (o dono cola o resultado) que os três passos retornaram contagens > 0 e `falhas: 0`. Se um passo voltar `Google Ads: Unrecognized field ...`, o nome do campo mudou na v25: corrigir o campo na GAQL e a chave correspondente em `ler-criativos-google.ts` + o teste, e repetir.

---

### Task 6: A conta da aba (`montarCriativos`, pura)

**Files:**
- Create: `src/lib/criativos.ts`, `src/lib/criativos.test.ts`

**Interfaces:**
- Produces:
  - `type VendaLigada = { anuncioId: string | null; valorBrl: number }`
  - `type EntradaCriativos = { anuncios: AnuncioLido[]; criativos: CriativoLido[]; metricasAnuncio: MetricaAnuncioLida[]; metricasCriativo: MetricaCriativoLida[]; vendas: VendaLigada[]; nomeCampanha: Record<string, string> }`
  - `type LinhaVenda = { id: string; titulo: string; extra: string | null; miniaturas: string[]; link: string | null; vendas: number; receitaBrl: number; gastoBrl: number; cpaBrl: number | null; roas: number | null; impressoes: number; cliques: number; ctr: number | null; views: number | null; assistido: { p25: number; p50: number; p75: number; p100: number } | null }`
  - `type LinhaGoogle = { id: string; campo: string; titulo: string; longo: boolean; miniatura: string | null; conversoes: number | null; valorConv: number | null; gastoBrl: number | null; custoPorConv: number | null; impressoes: number | null; cliques: number | null; ctr: number | null }`
  - `type Criativos = { videos: LinhaVenda[]; anuncios: LinhaVenda[]; titulos: LinhaGoogle[]; descricoes: LinhaGoogle[]; imagens: LinhaGoogle[]; semAnuncio: number }`
  - `montarCriativos(e: EntradaCriativos): Criativos`
  - `miniaturaYoutube(id: string): string`

- [ ] **Step 1: Testes**

```ts
// src/lib/criativos.test.ts
import { describe, expect, it } from "vitest";
import { montarCriativos, miniaturaYoutube, type EntradaCriativos } from "./criativos";

const anuncio = (id: string, videos: string[], nome = `ad ${id}`) => ({
  id, campanha_id: "c1", grupo_id: "g1", nome, tipo: "DEMAND_GEN_VIDEO_RESPONSIVE_AD", status: "ENABLED", videos,
});
const met = (anuncio_id: string, dia: string, custo: number, imp: number, extra: Partial<Record<string, number | null>> = {}) => ({
  dia, anuncio_id, custo_brl: custo, impressoes: imp, cliques: imp / 10, views: null, p25: null, p50: null, p75: null, p100: null,
  conversoes_google: 0, valor_conv_google: 0, ...extra,
});
const video = (id: string, yt: string) => ({ id, tipo: "video" as const, texto: null, youtube_id: yt, imagem_url: null, nome: `vídeo ${yt}` });

function entrada(p: Partial<EntradaCriativos>): EntradaCriativos {
  return { anuncios: [], criativos: [], metricasAnuncio: [], metricasCriativo: [], vendas: [], nomeCampanha: { c1: "CAMPEÃO 1#" }, ...p };
}

describe("anúncios (venda real)", () => {
  it("soma gasto e vendas, calcula CPA, ROAS e CTR", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", ["v1"])],
      criativos: [video("v1", "YT1")],
      metricasAnuncio: [met("a1", "2026-10-06", 60, 1000), met("a1", "2026-10-07", 40, 1000)],
      vendas: [{ anuncioId: "a1", valorBrl: 38 }, { anuncioId: "a1", valorBrl: 38 }],
    }));
    expect(r.anuncios[0]).toMatchObject({
      id: "a1", titulo: "ad a1", extra: "CAMPEÃO 1#", vendas: 2, receitaBrl: 76, gastoBrl: 100,
      cpaBrl: 50, roas: 0.76, impressoes: 2000, cliques: 200, ctr: 0.1, miniaturas: [miniaturaYoutube("YT1")],
    });
  });
  it("sem venda, CPA é null; sem gasto, ROAS é null", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", []), anuncio("a2", [])],
      metricasAnuncio: [met("a1", "2026-10-07", 50, 100)],
      vendas: [{ anuncioId: "a2", valorBrl: 38 }],
    }));
    const a1 = r.anuncios.find((x) => x.id === "a1");
    const a2 = r.anuncios.find((x) => x.id === "a2");
    expect(a1?.cpaBrl).toBeNull();
    expect(a2?.gastoBrl).toBe(0);
    expect(a2?.roas).toBeNull();
    expect(a2?.cpaBrl).toBeNull();
  });
  it("% assistido é a média ponderada pelas impressões", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", ["v1"])],
      criativos: [video("v1", "YT1")],
      metricasAnuncio: [
        met("a1", "2026-10-06", 1, 100, { p25: 0.8, p50: 0.4, p75: 0.2, p100: 0.1, views: 10 }),
        met("a1", "2026-10-07", 1, 300, { p25: 0.4, p50: 0.2, p75: 0.1, p100: 0.05, views: 20 }),
      ],
    }));
    const q = r.anuncios[0].assistido!;
    expect(q.p25).toBeCloseTo(0.5);
    expect(q.p50).toBeCloseTo(0.25);
    expect(q.p75).toBeCloseTo(0.125);
    expect(q.p100).toBeCloseTo(0.0625);
    expect(r.anuncios[0].views).toBe(30);
  });
  it("ordena por vendas, desempate pelo gasto, e esconde quem não teve impressão nem venda", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", []), anuncio("a2", []), anuncio("a3", []), anuncio("a4", [])],
      metricasAnuncio: [met("a1", "2026-10-07", 10, 100), met("a2", "2026-10-07", 90, 100), met("a3", "2026-10-07", 5, 100)],
      vendas: [{ anuncioId: "a3", valorBrl: 38 }],
    }));
    expect(r.anuncios.map((x) => x.id)).toEqual(["a3", "a2", "a1"]);
  });
  it("venda sem anúncio identificado vai pro rodapé", () => {
    const r = montarCriativos(entrada({ vendas: [{ anuncioId: null, valorBrl: 38 }, { anuncioId: "x", valorBrl: 38 }] }));
    expect(r.semAnuncio).toBe(1);
  });
});

describe("vídeos (venda real)", () => {
  it("junta os anúncios que têm o vídeo como ÚNICO vídeo", () => {
    const r = montarCriativos(entrada({
      anuncios: [anuncio("a1", ["v1"]), anuncio("a2", ["v1"]), anuncio("a3", ["v1", "v2"])],
      criativos: [video("v1", "YT1"), video("v2", "YT2")],
      metricasAnuncio: [met("a1", "2026-10-07", 10, 100), met("a2", "2026-10-07", 20, 100), met("a3", "2026-10-07", 70, 100)],
      vendas: [{ anuncioId: "a1", valorBrl: 38 }, { anuncioId: "a3", valorBrl: 38 }],
    }));
    expect(r.videos).toHaveLength(1);
    expect(r.videos[0]).toMatchObject({ id: "v1", titulo: "vídeo YT1", vendas: 1, gastoBrl: 30, link: "https://www.youtube.com/watch?v=YT1" });
  });
});

describe("títulos, descrições e imagens (conversão do Google)", () => {
  const texto = (id: string, t: string) => ({ id, tipo: "texto" as const, texto: t, youtube_id: null, imagem_url: null, nome: null });
  const mc = (criativo_id: string, campo: string, conv: number | null, custo: number | null, imp: number | null) => ({
    dia: "2026-10-07", criativo_id, campo, custo_brl: custo, impressoes: imp, cliques: imp === null ? null : imp / 20,
    conversoes_google: conv, valor_conv_google: null,
  });
  it("separa por campo, marca título longo e mantém null como null", () => {
    const r = montarCriativos(entrada({
      criativos: [texto("t1", "Presente que emociona"), texto("t2", "A história de vocês em música"), texto("d1", "Letra grátis"),
        { id: "i1", tipo: "imagem", texto: null, youtube_id: null, imagem_url: "https://x/i.jpg", nome: "capa" }],
      metricasCriativo: [
        mc("t1", "HEADLINE", 2, 20, 1000), mc("t2", "LONG_HEADLINE", 5, null, 500),
        mc("d1", "DESCRIPTION", null, null, null), mc("i1", "MARKETING_IMAGE", 1, 10, 200), mc("i1", "BUSINESS_LOGO", 9, 1, 1),
      ],
    }));
    expect(r.titulos.map((t) => [t.id, t.longo])).toEqual([["t2", true], ["t1", false]]);
    expect(r.titulos[0]).toMatchObject({ titulo: "A história de vocês em música", gastoBrl: null, custoPorConv: null, ctr: 0.05 });
    expect(r.titulos[1]).toMatchObject({ custoPorConv: 10 });
    expect(r.descricoes).toEqual([]);
    expect(r.imagens.map((i) => i.id)).toEqual(["i1"]);
    expect(r.imagens[0].miniatura).toBe("https://x/i.jpg");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/criativos.test.ts`
Expected: FAIL (módulo `./criativos` não existe)

- [ ] **Step 3: Implementar**

```ts
// src/lib/criativos.ts
// A CONTA DA ABA "CRIATIVOS" (08/10). Pura: recebe as linhas já lidas do
// banco e devolve os rankings. Spec: docs/superpowers/specs/2026-10-08-aba-criativos-design.md
//
// Dois números, de propósito: vídeo e anúncio pela VENDA REAL (pedido pago,
// ligado ao anúncio pelo gclid); título, descrição e imagem pela conversão
// que o GOOGLE atribui, porque o gclid não diz qual título apareceu.
import type {
  AnuncioLido, CriativoLido, MetricaAnuncioLida, MetricaCriativoLida,
} from "./ler-criativos-google";

export type VendaLigada = { anuncioId: string | null; valorBrl: number };
export type EntradaCriativos = {
  anuncios: AnuncioLido[];
  criativos: CriativoLido[];
  metricasAnuncio: MetricaAnuncioLida[];
  metricasCriativo: MetricaCriativoLida[];
  vendas: VendaLigada[];
  nomeCampanha: Record<string, string>;
};
export type LinhaVenda = {
  id: string; titulo: string; extra: string | null; miniaturas: string[]; link: string | null;
  vendas: number; receitaBrl: number; gastoBrl: number; cpaBrl: number | null; roas: number | null;
  impressoes: number; cliques: number; ctr: number | null; views: number | null;
  assistido: { p25: number; p50: number; p75: number; p100: number } | null;
};
export type LinhaGoogle = {
  id: string; campo: string; titulo: string; longo: boolean; miniatura: string | null;
  conversoes: number | null; valorConv: number | null; gastoBrl: number | null; custoPorConv: number | null;
  impressoes: number | null; cliques: number | null; ctr: number | null;
};
export type Criativos = {
  videos: LinhaVenda[]; anuncios: LinhaVenda[]; titulos: LinhaGoogle[]; descricoes: LinhaGoogle[];
  imagens: LinhaGoogle[]; semAnuncio: number;
};

export const miniaturaYoutube = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

type Acumulado = {
  vendas: number; receita: number; gasto: number; imp: number; cliques: number;
  views: number | null; pesoQ: number; q: { p25: number; p50: number; p75: number; p100: number };
};
const vazio = (): Acumulado => ({ vendas: 0, receita: 0, gasto: 0, imp: 0, cliques: 0, views: null, pesoQ: 0, q: { p25: 0, p50: 0, p75: 0, p100: 0 } });

function juntar(a: Acumulado, b: Acumulado): Acumulado {
  return {
    vendas: a.vendas + b.vendas, receita: a.receita + b.receita, gasto: a.gasto + b.gasto,
    imp: a.imp + b.imp, cliques: a.cliques + b.cliques,
    views: a.views === null ? b.views : b.views === null ? a.views : a.views + b.views,
    pesoQ: a.pesoQ + b.pesoQ,
    q: { p25: a.q.p25 + b.q.p25, p50: a.q.p50 + b.q.p50, p75: a.q.p75 + b.q.p75, p100: a.q.p100 + b.q.p100 },
  };
}

const visivel = (a: Acumulado) => a.imp > 0 || a.vendas > 0;
const porVendas = (x: LinhaVenda, y: LinhaVenda) => y.vendas - x.vendas || y.gastoBrl - x.gastoBrl;

function linhaVenda(
  id: string, titulo: string, extra: string | null, miniaturas: string[], link: string | null, a: Acumulado,
): LinhaVenda {
  return {
    id, titulo, extra, miniaturas, link,
    vendas: a.vendas, receitaBrl: a.receita, gastoBrl: a.gasto,
    cpaBrl: a.vendas > 0 && a.gasto > 0 ? a.gasto / a.vendas : null,
    roas: a.gasto > 0 ? a.receita / a.gasto : null,
    impressoes: a.imp, cliques: a.cliques, ctr: a.imp > 0 ? a.cliques / a.imp : null,
    views: a.views,
    assistido: a.pesoQ > 0
      ? { p25: a.q.p25 / a.pesoQ, p50: a.q.p50 / a.pesoQ, p75: a.q.p75 / a.pesoQ, p100: a.q.p100 / a.pesoQ }
      : null,
  };
}

const ehImagem = (campo: string) => campo.endsWith("IMAGE") && !campo.includes("LOGO");

export function montarCriativos(e: EntradaCriativos): Criativos {
  const criativoPorId = new Map(e.criativos.map((c) => [c.id, c]));
  const anuncioPorId = new Map(e.anuncios.map((a) => [a.id, a]));

  // ── por anúncio ──
  const acc = new Map<string, Acumulado>();
  const pegar = (id: string) => acc.get(id) ?? vazio();
  for (const m of e.metricasAnuncio) {
    const a = pegar(m.anuncio_id);
    a.gasto += m.custo_brl;
    a.imp += m.impressoes;
    a.cliques += m.cliques;
    if (m.views !== null) a.views = (a.views ?? 0) + m.views;
    if (m.p25 !== null && m.impressoes > 0) {
      a.pesoQ += m.impressoes;
      a.q.p25 += (m.p25 ?? 0) * m.impressoes;
      a.q.p50 += (m.p50 ?? 0) * m.impressoes;
      a.q.p75 += (m.p75 ?? 0) * m.impressoes;
      a.q.p100 += (m.p100 ?? 0) * m.impressoes;
    }
    acc.set(m.anuncio_id, a);
  }
  let semAnuncio = 0;
  for (const v of e.vendas) {
    if (!v.anuncioId) { semAnuncio++; continue; }
    const a = pegar(v.anuncioId);
    a.vendas++;
    a.receita += v.valorBrl;
    acc.set(v.anuncioId, a);
  }

  const youtubeDe = (assetId: string) => criativoPorId.get(assetId)?.youtube_id ?? null;
  const anuncios = [...acc.entries()]
    .filter(([, a]) => visivel(a))
    .map(([id, a]) => {
      const ad = anuncioPorId.get(id);
      const yts = (ad?.videos ?? []).map(youtubeDe).filter((y): y is string => !!y);
      return linhaVenda(
        id, ad?.nome || `Anúncio ${id}`, ad?.campanha_id ? e.nomeCampanha[ad.campanha_id] ?? ad.campanha_id : null,
        yts.map(miniaturaYoutube), null, a,
      );
    })
    .sort(porVendas);

  // ── por vídeo: só anúncio com UM vídeo, pra não inventar divisão ──
  const porVideo = new Map<string, Acumulado>();
  for (const [id, a] of acc) {
    const vids = anuncioPorId.get(id)?.videos ?? [];
    if (vids.length !== 1) continue;
    porVideo.set(vids[0], juntar(porVideo.get(vids[0]) ?? vazio(), a));
  }
  const videos = [...porVideo.entries()]
    .filter(([, a]) => visivel(a))
    .map(([assetId, a]) => {
      const c = criativoPorId.get(assetId);
      const yt = c?.youtube_id ?? null;
      return linhaVenda(
        assetId, c?.nome || yt || `Vídeo ${assetId}`, null, yt ? [miniaturaYoutube(yt)] : [],
        yt ? `https://www.youtube.com/watch?v=${yt}` : null, a,
      );
    })
    .sort(porVendas);

  // ── recursos pelo Google ──
  const somaN = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : a + b);
  const porRecurso = new Map<string, MetricaCriativoLida>();
  for (const m of e.metricasCriativo) {
    const k = `${m.criativo_id}|${m.campo}`;
    const a = porRecurso.get(k);
    porRecurso.set(k, a ? {
      ...a,
      custo_brl: somaN(a.custo_brl, m.custo_brl), impressoes: somaN(a.impressoes, m.impressoes),
      cliques: somaN(a.cliques, m.cliques), conversoes_google: somaN(a.conversoes_google, m.conversoes_google),
      valor_conv_google: somaN(a.valor_conv_google, m.valor_conv_google),
    } : { ...m });
  }
  const linhasGoogle = [...porRecurso.values()]
    .filter((m) => (m.impressoes ?? 0) > 0 || (m.conversoes_google ?? 0) > 0)
    .map((m): LinhaGoogle => {
      const c = criativoPorId.get(m.criativo_id);
      return {
        id: m.criativo_id, campo: m.campo,
        titulo: c?.texto || c?.nome || `Recurso ${m.criativo_id}`,
        longo: m.campo === "LONG_HEADLINE",
        miniatura: c?.imagem_url ?? null,
        conversoes: m.conversoes_google, valorConv: m.valor_conv_google, gastoBrl: m.custo_brl,
        custoPorConv: m.custo_brl !== null && m.custo_brl > 0 && (m.conversoes_google ?? 0) > 0
          ? m.custo_brl / (m.conversoes_google as number) : null,
        impressoes: m.impressoes, cliques: m.cliques,
        ctr: m.impressoes && m.cliques !== null ? m.cliques / m.impressoes : null,
      };
    })
    .sort((x, y) => (y.conversoes ?? 0) - (x.conversoes ?? 0) || (y.gastoBrl ?? 0) - (x.gastoBrl ?? 0));

  return {
    videos,
    anuncios,
    titulos: linhasGoogle.filter((l) => l.campo === "HEADLINE" || l.campo === "LONG_HEADLINE"),
    descricoes: linhasGoogle.filter((l) => l.campo === "DESCRIPTION" || l.campo === "LONG_DESCRIPTION"),
    imagens: linhasGoogle.filter((l) => ehImagem(l.campo)),
    semAnuncio,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/criativos.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/criativos.ts src/lib/criativos.test.ts
git commit -m "feat(criativos): montarCriativos, a conta pura da aba"
```

---

### Task 7: A leitura do banco pra aba (server fn)

**Files:**
- Create: `src/lib/admin-criativos.server.ts`
- Modify: `src/lib/admin-dados.ts` (exportar a server fn `carregarAbaCriativos`, ao lado de `carregarAutomacoes`)

**Interfaces:**
- Consumes: `montarCriativos`, `VendaLigada`, `Criativos` (Task 6); `janelaDo`, `ArgsPainel` (já em `admin-dados.ts`); `ehVenda` (`@/lib/painel-resumo`); `cambioDoDia` (`@/lib/cambio`)
- Produces: `carregarAbaCriativos({ data: { dias?: number; de?: string; ate?: string } }): Promise<Criativos & { atualizadoEm: string | null }>`

- [ ] **Step 1: A leitura**

```ts
// src/lib/admin-criativos.server.ts
// A LEITURA DA ABA "CRIATIVOS": só banco, nunca o Google (quem fala com o
// Google é o job `puxarCriativosAds`). A conta é `montarCriativos`.
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ehVenda } from "@/lib/painel-resumo";
import { cambioDoDia } from "@/lib/cambio";
import { montarCriativos, type Criativos, type VendaLigada } from "@/lib/criativos";
import type {
  AnuncioLido, CriativoLido, MetricaAnuncioLida, MetricaCriativoLida,
} from "@/lib/ler-criativos-google";

type Db = ReturnType<typeof supabaseAdmin>;
const diaBr = (d: Date) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);

async function emLotes<T>(ids: string[], ler: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const saida: T[] = [];
  for (let i = 0; i < ids.length; i += 200) saida.push(...(await ler(ids.slice(i, i + 200))));
  return saida;
}

/** Uma tabela por dia (cada dia é pequeno), página de 1000 dentro do dia. */
async function porDia<T>(db: Db, tabela: string, dias: string[]): Promise<T[]> {
  const partes = await Promise.all(
    dias.map(async (dia) => {
      const linhas: T[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await db.from(tabela).select("*").eq("dia", dia).range(de, de + 999);
        if (error) throw new Error(`${tabela}: ${error.message}`);
        linhas.push(...((data ?? []) as T[]));
        if (!data || data.length < 1000) break;
      }
      return linhas;
    }),
  );
  return partes.flat();
}

export async function carregarCriativos(janela: { inicio: Date; fim: Date }): Promise<Criativos & { atualizadoEm: string | null }> {
  const db = supabaseAdmin();
  const dias: string[] = [];
  for (let d = diaBr(janela.inicio); d <= diaBr(new Date(janela.fim.getTime() - 1)); ) {
    dias.push(d);
    const x = new Date(`${d}T12:00:00Z`);
    x.setUTCDate(x.getUTCDate() + 1);
    d = x.toISOString().slice(0, 10);
  }

  // Vendas pagas no período, por cursor (paid_at, id).
  type Ped = { id: string; quiz_response_id: string | null; valor_centavos: number | null; status: string; dinheiro_entrou: boolean | null; paid_at: string };
  const pagos: Ped[] = [];
  let cursor: { paid_at: string; id: string } | null = null;
  for (;;) {
    let q = db
      .from("pedidos")
      .select("id, quiz_response_id, valor_centavos, status, dinheiro_entrou, paid_at")
      .eq("status", "pago")
      .gte("paid_at", janela.inicio.toISOString())
      .lt("paid_at", janela.fim.toISOString());
    if (cursor) q = q.or(`paid_at.gt."${cursor.paid_at}",and(paid_at.eq."${cursor.paid_at}",id.gt.${cursor.id})`);
    const { data, error } = await q.order("paid_at").order("id").limit(1000);
    if (error) throw new Error("pedidos: " + error.message);
    const pagina = (data ?? []) as Ped[];
    pagos.push(...pagina.filter(ehVenda));
    if (pagina.length < 1000) break;
    const u = pagina[pagina.length - 1];
    cursor = { paid_at: u.paid_at, id: u.id };
  }

  const quizIds = [...new Set(pagos.map((p) => p.quiz_response_id).filter((q): q is string => !!q))];
  const quizzes = await emLotes(quizIds, async (lote) => {
    const { data, error } = await db.from("quiz_responses").select("id, locale, gclid:attribution->>gclid").in("id", lote);
    if (error) throw new Error("quiz_responses: " + error.message);
    return (data ?? []) as Array<{ id: string; locale: string | null; gclid: string | null }>;
  });
  const quizPorId = new Map(quizzes.map((q) => [q.id, q]));
  const cambio = await cambioDoDia();

  const gclids = [...new Set(quizzes.map((q) => q.gclid).filter((g): g is string => !!g))];
  const cliques = await emLotes(gclids, async (lote) => {
    const { data, error } = await db.from("cliques_anuncio").select("gclid, anuncio_id").in("gclid", lote);
    if (error) throw new Error("cliques_anuncio: " + error.message);
    return (data ?? []) as Array<{ gclid: string; anuncio_id: string | null }>;
  });
  const anuncioDoGclid = new Map(cliques.map((c) => [c.gclid, c.anuncio_id]));

  const vendas: VendaLigada[] = [];
  for (const p of pagos) {
    const q = p.quiz_response_id ? quizPorId.get(p.quiz_response_id) : undefined;
    if (!q?.gclid) continue;
    const dolar = q.locale === "es" || q.locale === "en";
    vendas.push({
      anuncioId: anuncioDoGclid.get(q.gclid) ?? null,
      valorBrl: ((p.valor_centavos ?? 0) / 100) * (dolar ? cambio : 1),
    });
  }

  const [metricasAnuncio, metricasCriativo] = await Promise.all([
    porDia<MetricaAnuncioLida>(db, "metricas_anuncio", dias),
    porDia<MetricaCriativoLida>(db, "metricas_criativo", dias),
  ]);
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const mAnuncio = metricasAnuncio.map((m) => ({
    ...m, custo_brl: Number(m.custo_brl), impressoes: Number(m.impressoes), cliques: Number(m.cliques),
    views: num(m.views), p25: num(m.p25), p50: num(m.p50), p75: num(m.p75), p100: num(m.p100),
    conversoes_google: Number(m.conversoes_google), valor_conv_google: Number(m.valor_conv_google),
  }));
  const mCriativo = metricasCriativo.map((m) => ({
    ...m, custo_brl: num(m.custo_brl), impressoes: num(m.impressoes), cliques: num(m.cliques),
    conversoes_google: num(m.conversoes_google), valor_conv_google: num(m.valor_conv_google),
  }));

  const idsAnuncio = [...new Set([...mAnuncio.map((m) => m.anuncio_id), ...vendas.map((v) => v.anuncioId).filter((a): a is string => !!a)])];
  const anuncios = await emLotes(idsAnuncio, async (lote) => {
    const { data, error } = await db.from("anuncios_ads").select("id, campanha_id, grupo_id, nome, tipo, status, videos, atualizado_em").in("id", lote);
    if (error) throw new Error("anuncios_ads: " + error.message);
    return (data ?? []) as Array<AnuncioLido & { atualizado_em: string }>;
  });
  const idsCriativo = [...new Set([...mCriativo.map((m) => m.criativo_id), ...anuncios.flatMap((a) => a.videos ?? [])])];
  const criativos = await emLotes(idsCriativo, async (lote) => {
    const { data, error } = await db.from("criativos_ads").select("id, tipo, texto, youtube_id, imagem_url, nome").in("id", lote);
    if (error) throw new Error("criativos_ads: " + error.message);
    return (data ?? []) as CriativoLido[];
  });
  const idsCampanha = [...new Set(anuncios.map((a) => a.campanha_id).filter((c): c is string => !!c))];
  const campanhas = await emLotes(idsCampanha, async (lote) => {
    const { data, error } = await db.from("campanhas").select("id, nome").in("id", lote);
    if (error) throw new Error("campanhas: " + error.message);
    return (data ?? []) as Array<{ id: string; nome: string }>;
  });

  const atualizadoEm = anuncios.reduce<string | null>((m, a) => (!m || a.atualizado_em > m ? a.atualizado_em : m), null);
  return {
    ...montarCriativos({
      anuncios: anuncios.map((a) => ({ ...a, videos: a.videos ?? [] })),
      criativos,
      metricasAnuncio: mAnuncio,
      metricasCriativo: mCriativo,
      vendas,
      nomeCampanha: Object.fromEntries(campanhas.map((c) => [String(c.id), c.nome])),
    }),
    atualizadoEm,
  };
}
```

- [ ] **Step 2: A server fn**

Em `src/lib/admin-dados.ts`, logo depois de `export const carregarAutomacoes = ...;`:

```ts
/** A aba "Criativos": ranking do Google Ads por venda real e por conversão do Google. */
export const carregarAbaCriativos = createServerFn({ method: "POST" })
  .validator((data: ArgsPainel) => data)
  .handler(async ({ data }) => {
    const { exigirAdmin } = await import("@/lib/admin-auth.server");
    exigirAdmin();
    const { carregarCriativos } = await import("@/lib/admin-criativos.server");
    return carregarCriativos(janelaDo(data));
  });
```

Run: `npx tsc --noEmit -p .`
Expected: sem erro

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin-criativos.server.ts src/lib/admin-dados.ts
git commit -m "feat(criativos): leitura do banco pra aba (carregarAbaCriativos)"
```

---

### Task 8: A aba na tela

**Files:**
- Create: `src/components/admin/AbaCriativos.tsx`
- Modify: `src/routes/admin.tsx` (enum `aba` ~l.60, lista de abas ~l.796, render ~l.837, `precisaDoNucleo` ~l.630)

**Interfaces:**
- Consumes: `carregarAbaCriativos` (Task 7), tipos `Criativos`, `LinhaVenda`, `LinhaGoogle` (Task 6)

- [ ] **Step 1: O componente**

```tsx
// src/components/admin/AbaCriativos.tsx
// A ABA "CRIATIVOS" (08/10). Como a de Automações, carrega a própria consulta
// no período do seletor e NÃO usa `dados`. Spec:
// docs/superpowers/specs/2026-10-08-aba-criativos-design.md
import { useEffect, useState, type ReactNode } from "react";
import { carregarAbaCriativos } from "@/lib/admin-dados";
import type { Criativos, LinhaGoogle, LinhaVenda } from "@/lib/criativos";
import { cn } from "@/lib/utils";

type Args = { dias?: number; de?: string; ate?: string };
type Dados = Criativos & { atualizadoEm: string | null };

const brl = (v: number | null) =>
  v === null ? "—" : "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (v: number | null) => (v === null ? "—" : Math.round(v).toLocaleString("pt-BR"));
const pc = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const PRIMEIROS = 20;

function Miniatura({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <div className="h-9 w-16 shrink-0 rounded bg-[var(--tinta-fraca)]/30" />;
  return (
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer"
      className="h-9 w-16 shrink-0 rounded object-cover" />
  );
}

function Secao({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="text-xs text-[var(--tinta-suave)]">{sub}</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--tinta-fraca)]/40">{children}</div>
    </section>
  );
}

function useLista<T>(linhas: T[]) {
  const [todos, setTodos] = useState(false);
  return { visiveis: todos ? linhas : linhas.slice(0, PRIMEIROS), sobra: linhas.length - PRIMEIROS, todos, setTodos };
}

function VerTodos({ sobra, todos, alternar }: { sobra: number; todos: boolean; alternar: () => void }) {
  if (sobra <= 0) return null;
  return (
    <button onClick={alternar} className="w-full px-3 py-2 text-xs text-[var(--acento)]">
      {todos ? "mostrar só os 20 primeiros" : `ver todos (+${sobra})`}
    </button>
  );
}

const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

function TabelaVenda({ linhas, vazio }: { linhas: LinhaVenda[]; vazio: string }) {
  const l = useLista(linhas);
  return (
    <>
      <table className="w-full text-sm">
        <thead className="text-xs text-[var(--tinta-suave)]">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Criativo</th>
            <th className={th}>Vendas</th><th className={th}>Receita</th><th className={th}>Gasto</th>
            <th className={th}>CPA</th><th className={th}>ROAS</th><th className={th}>Impr.</th>
            <th className={th}>Cliques</th><th className={th}>CTR</th><th className={th}>Views</th>
            <th className={th}>Assistido 25/50/75/100</th>
          </tr>
        </thead>
        <tbody>
          {l.visiveis.length === 0 ? (
            <tr><td colSpan={11} className="px-3 py-6 text-center text-[var(--tinta-suave)]">{vazio}</td></tr>
          ) : (
            l.visiveis.map((x) => (
              <tr key={x.id} className={cn("border-t border-[var(--tinta-fraca)]/25", x.vendas > 0 && "bg-[var(--acento)]/5")}>
                <td className="px-3 py-2">
                  <div className="flex min-w-[220px] items-center gap-2">
                    <div className="flex gap-1">
                      {(x.miniaturas.length ? x.miniaturas.slice(0, 3) : [null]).map((m, i) => (
                        <Miniatura key={i} src={m} alt={x.titulo} />
                      ))}
                    </div>
                    <div className="min-w-0">
                      {x.link ? (
                        <a href={x.link} target="_blank" rel="noreferrer noopener" className="font-medium underline-offset-2 hover:underline">{x.titulo}</a>
                      ) : (
                        <span className="font-medium">{x.titulo}</span>
                      )}
                      {x.extra && <span className="block text-[11px] text-[var(--tinta-suave)]">{x.extra}</span>}
                    </div>
                  </div>
                </td>
                <td className={cn(td, "font-medium")}>{x.vendas}</td>
                <td className={td}>{brl(x.receitaBrl)}</td>
                <td className={td}>{brl(x.gastoBrl)}</td>
                <td className={td}>{brl(x.cpaBrl)}</td>
                <td className={cn(td, x.roas !== null && x.roas < 1 && "text-red-600")}>{x.roas === null ? "—" : `${x.roas.toFixed(2)}x`}</td>
                <td className={td}>{n(x.impressoes)}</td>
                <td className={td}>{n(x.cliques)}</td>
                <td className={td}>{pc(x.ctr)}</td>
                <td className={td}>{n(x.views)}</td>
                <td className={td}>
                  {x.assistido
                    ? [x.assistido.p25, x.assistido.p50, x.assistido.p75, x.assistido.p100].map((v) => `${Math.round(v * 100)}`).join(" / ")
                    : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <VerTodos sobra={l.sobra} todos={l.todos} alternar={() => l.setTodos(!l.todos)} />
    </>
  );
}

function TabelaGoogle({ linhas, imagem }: { linhas: LinhaGoogle[]; imagem?: boolean }) {
  const l = useLista(linhas);
  return (
    <>
      <table className="w-full text-sm">
        <thead className="text-xs text-[var(--tinta-suave)]">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{imagem ? "Imagem" : "Texto"}</th>
            <th className={th}>Conv. Google</th><th className={th}>Valor conv.</th><th className={th}>Gasto</th>
            <th className={th}>Custo/conv.</th><th className={th}>Impr.</th><th className={th}>Cliques</th><th className={th}>CTR</th>
          </tr>
        </thead>
        <tbody>
          {l.visiveis.length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--tinta-suave)]">Nada no período.</td></tr>
          ) : (
            l.visiveis.map((x) => (
              <tr key={`${x.id}|${x.campo}`} className="border-t border-[var(--tinta-fraca)]/25">
                <td className="px-3 py-2">
                  <div className="flex min-w-[220px] items-center gap-2">
                    {imagem && <Miniatura src={x.miniatura} alt={x.titulo} />}
                    <span className={cn(!imagem && "font-medium")}>{x.titulo}</span>
                    {x.longo && <span className="text-[10px] uppercase tracking-wide opacity-60">longo</span>}
                  </div>
                </td>
                <td className={cn(td, "font-medium")}>{x.conversoes === null ? "—" : x.conversoes.toFixed(1)}</td>
                <td className={td}>{brl(x.valorConv)}</td>
                <td className={td}>{brl(x.gastoBrl)}</td>
                <td className={td}>{brl(x.custoPorConv)}</td>
                <td className={td}>{n(x.impressoes)}</td>
                <td className={td}>{n(x.cliques)}</td>
                <td className={td}>{pc(x.ctr)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <VerTodos sobra={l.sobra} todos={l.todos} alternar={() => l.setTodos(!l.todos)} />
    </>
  );
}

export function AbaCriativos({ args }: { args: Args }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro(null);
    carregarAbaCriativos({ data: args })
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "não deu pra carregar"));
    return () => {
      vivo = false;
    };
    // `args` é objeto novo a cada render do pai: compara pelo conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.dias, args.de, args.ate]);

  if (erro) {
    return <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">{erro}</div>;
  }
  if (!dados) return <p className="text-sm text-[var(--tinta-suave)]">Carregando os criativos…</p>;

  const venda = "Venda real: pedido pago ligado ao anúncio clicado (gclid). Venda com cupom ou que voltou por e-mail conta pro anúncio que trouxe a pessoa.";
  const google = "Conversão do Google, não venda real: o clique não diz qual título ou imagem apareceu.";
  return (
    <div className="space-y-8">
      <p className="text-xs text-[var(--tinta-suave)]">
        Google Ads, PMAX fora (medida por grupo em "De onde vem").
        {dados.atualizadoEm && ` Coletado às ${new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.`}
      </p>
      <Secao titulo="Vídeos" sub={`${venda} Só anúncios com um vídeo só.`}>
        <TabelaVenda linhas={dados.videos} vazio="Nenhum vídeo com impressão ou venda no período." />
      </Secao>
      <Secao titulo="Anúncios" sub={venda}>
        <TabelaVenda linhas={dados.anuncios} vazio="Nenhum anúncio com impressão ou venda no período." />
        {dados.semAnuncio > 0 && (
          <p className="border-t border-[var(--tinta-fraca)]/25 px-3 py-2 text-xs text-[var(--tinta-suave)]">
            {dados.semAnuncio} {dados.semAnuncio === 1 ? "venda" : "vendas"} do Google sem anúncio identificado (clique com mais de 90 dias, ainda não consultado ou não encontrado).
          </p>
        )}
      </Secao>
      <Secao titulo="Títulos" sub={google}><TabelaGoogle linhas={dados.titulos} /></Secao>
      <Secao titulo="Descrições" sub={google}><TabelaGoogle linhas={dados.descricoes} /></Secao>
      <Secao titulo="Imagens" sub={google}><TabelaGoogle linhas={dados.imagens} imagem /></Secao>
    </div>
  );
}
```

- [ ] **Step 2: Ligar no `/admin`**

Em `src/routes/admin.tsx`:
1. `import { AbaCriativos } from "@/components/admin/AbaCriativos";` junto dos outros `Aba*`.
2. No `z.enum([...])` da `aba`, acrescentar `"criativos",` depois de `"origem",`.
3. Na lista de abas, acrescentar `["criativos", "Criativos"],` depois de `["origem", "De onde vem"],`.
4. `const precisaDoNucleo = aba !== "automacoes" && aba !== "financeiro" && aba !== "indicacoes" && aba !== "criativos";`
5. Logo antes de `{aba === "financeiro" && <AbaFinanceiro />}`:
```tsx
        {/* Como Automações: carrega a própria consulta, no período do seletor. */}
        {aba === "criativos" && (
          <AbaCriativos args={usandoDatas ? { de, ate } : { dias: periodo }} />
        )}
```
6. Se existir um `CorpoEsqueleto` com `switch`/condição por `aba` que não aceite `"criativos"`, o `tsc` acusa: tratar `"criativos"` como as abas que não usam o núcleo.

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: tsc sem erro; suíte verde (fora `google-ads.test.ts`/jsdom)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AbaCriativos.tsx src/routes/admin.tsx
git commit -m "feat(criativos): aba Criativos no painel"
```

---

### Task 9: Documentação e publicação

**Files:**
- Modify: `CLAUDE.md` (seção "Painel rápido" e a tabela "Testes em andamento")

- [ ] **Step 1: CLAUDE.md**

Acrescentar ao fim da lista da seção "## Painel rápido (02/10/2026)":

```markdown
- **Aba Criativos (08/10)**: vídeo e anúncio do Google Ads por VENDA REAL
  (gclid → `click_view` → anúncio, em `cliques_anuncio`), título, descrição e
  imagem pela CONVERSÃO DO GOOGLE. Job `puxarCriativosAds` (de hora em hora,
  nas duas marcas, 7 dias reescritos; `click_view` só alcança 89 dias). A
  aba só lê o banco (`admin-criativos.server.ts`, conta em `criativos.ts`).
  Vídeo só soma anúncio com UM vídeo. Venda com cupom/e-mail conta pro
  anúncio (não bate com o cartão "Vendas Google", de propósito). Sonda:
  evento `criativos/sonda`. Spec: `docs/superpowers/specs/2026-10-08-aba-criativos-design.md`.
```

E uma linha na tabela "Testes em andamento":

```markdown
| Aba Criativos | 08/10 | Não é A/B: leitura nova. Ranking de vídeo/anúncio por venda real e de título/descrição/imagem pela conversão do Google | se os vídeos campeões batem com o que o dono vê nos testes; quantas vendas ficam "sem anúncio identificado" | 15/10 | sim (mesmo código, conta da Ballad) |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: aba Criativos no CLAUDE.md"
```

- [ ] **Step 3: PORTÃO — publicar**

Pedir o ok do dono. `git pull --rebase origin master`, `npx tsc --noEmit -p . && npx vitest run`, `git push origin master`, depois `curl -X PUT https://www.serenatagift.com/api/inngest` e `curl -X PUT https://www.balladgift.com/api/inngest`. O dono abre `/admin?aba=criativos` e confere: vídeos com miniatura, vendas > 0 nos campeões, linha de "sem anúncio identificado" plausível.
