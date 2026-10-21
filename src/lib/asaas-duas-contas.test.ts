import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chamarAsaas, lerEmQualquerConta, listarEmTodasAsContas, temContaAntiga } from "./asaas";

// Troca de conta do Asaas (21/10/2026): com ASAAS_API_KEY_NOVA, cobrança nasce
// na nova e a de sempre vira a "antiga", que continua sendo lida.
const NOVA = "$aact_prod_nova";
const ANTIGA = "$aact_prod_antiga";

function respostas(porChave: Record<string, (url: string) => { status: number; corpo: unknown }>) {
  const chamadas: Array<{ chave: string; url: string }> = [];
  vi.stubGlobal("fetch", async (url: string, init: { headers: Record<string, string> }) => {
    const chave = init.headers.access_token;
    chamadas.push({ chave, url });
    const r = porChave[chave](url);
    return { ok: r.status < 400, status: r.status, text: async () => JSON.stringify(r.corpo) };
  });
  return chamadas;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("ASAAS_API_KEY_SANDBOX", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Asaas com duas contas", () => {
  it("sem a chave nova, tudo como sempre: uma conta só", async () => {
    vi.stubEnv("ASAAS_API_KEY", ANTIGA);
    const chamadas = respostas({ [ANTIGA]: () => ({ status: 200, corpo: { id: "pay_1" } }) });
    expect(temContaAntiga()).toBe(false);
    await chamarAsaas("/payments", { method: "POST" });
    expect(chamadas.map((c) => c.chave)).toEqual([ANTIGA]);
  });

  it("com a chave nova, cobrança NASCE na nova", async () => {
    vi.stubEnv("ASAAS_API_KEY", ANTIGA);
    vi.stubEnv("ASAAS_API_KEY_NOVA", NOVA);
    const chamadas = respostas({ [NOVA]: () => ({ status: 200, corpo: { id: "pay_2" } }), [ANTIGA]: () => ({ status: 500, corpo: {} }) });
    await chamarAsaas("/payments", { method: "POST" });
    expect(chamadas.map((c) => c.chave)).toEqual([NOVA]);
  });

  it("PIX gerado na conta antiga ainda é achado (404 na nova → pergunta na antiga)", async () => {
    vi.stubEnv("ASAAS_API_KEY", ANTIGA);
    vi.stubEnv("ASAAS_API_KEY_NOVA", NOVA);
    respostas({
      [NOVA]: () => ({ status: 404, corpo: { errors: [{ description: "não encontrado" }] } }),
      [ANTIGA]: () => ({ status: 200, corpo: { id: "pay_velho", status: "RECEIVED" } }),
    });
    const p = await lerEmQualquerConta<{ status: string }>("/payments/pay_velho");
    expect(p.status).toBe("RECEIVED");
  });

  it("erro que não é 'não conheço' (500) não vira consulta na antiga", async () => {
    vi.stubEnv("ASAAS_API_KEY", ANTIGA);
    vi.stubEnv("ASAAS_API_KEY_NOVA", NOVA);
    const chamadas = respostas({ [NOVA]: () => ({ status: 500, corpo: {} }), [ANTIGA]: () => ({ status: 200, corpo: {} }) });
    await expect(lerEmQualquerConta("/payments/pay_x")).rejects.toThrow();
    expect(chamadas.map((c) => c.chave)).toEqual([NOVA]);
  });

  it("listagem soma as duas contas e marca a origem; antiga fora do ar não derruba", async () => {
    vi.stubEnv("ASAAS_API_KEY", ANTIGA);
    vi.stubEnv("ASAAS_API_KEY_NOVA", NOVA);
    respostas({
      [NOVA]: () => ({ status: 200, corpo: { data: [{ id: "pay_n" }] } }),
      [ANTIGA]: () => ({ status: 200, corpo: { data: [{ id: "pay_a" }] } }),
    });
    expect(await listarEmTodasAsContas<{ id: string }>("/payments?externalReference=x")).toEqual([
      { id: "pay_n", conta: "principal" },
      { id: "pay_a", conta: "antiga" },
    ]);
    respostas({ [NOVA]: () => ({ status: 200, corpo: { data: [{ id: "pay_n" }] } }), [ANTIGA]: () => ({ status: 503, corpo: {} }) });
    expect(await listarEmTodasAsContas<{ id: string }>("/payments?externalReference=x")).toEqual([{ id: "pay_n", conta: "principal" }]);
  });
});
