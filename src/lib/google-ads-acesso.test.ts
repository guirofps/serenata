import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarGoogleAds } from "../../inngest/lib/google-ads";

// 18/10: o login de produção não enxerga a conta nova pela MCC Falkland
// ("The caller does not have permission") e o painel ficou sem o gasto do
// Google. Convidado direto na conta, ele só entra SEM o login-customer-id.
function respostas(...corpos: unknown[]) {
  const chamadas: Array<Record<string, string>> = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
    chamadas.push({ ...init.headers });
    return { json: async () => corpos.shift() } as Response;
  }));
  return chamadas;
}
const SEM_PERMISSAO = { error: { message: "The caller does not have permission" } };

afterEach(() => vi.unstubAllGlobals());

describe("consultarGoogleAds — acesso direto quando a MCC recusa", () => {
  it("tenta de novo sem login-customer-id e devolve as linhas", async () => {
    const chamadas = respostas(SEM_PERMISSAO, { results: [{ x: 1 }] });
    const linhas = await consultarGoogleAds("SELECT 1", "token", { id: "1", login: "9" });
    expect(linhas).toEqual([{ x: 1 }]);
    expect(chamadas[0]["login-customer-id"]).toBe("9");
    expect(chamadas[1]["login-customer-id"]).toBeUndefined();
  });

  it("outro erro não ganha segunda tentativa", async () => {
    const chamadas = respostas({ error: { message: "Invalid query" } });
    await expect(consultarGoogleAds("SELECT 1", "token", { id: "1", login: "9" })).rejects.toThrow(/Invalid query/);
    expect(chamadas).toHaveLength(1);
  });

  it("sem login configurado, a recusa é a resposta final", async () => {
    const chamadas = respostas(SEM_PERMISSAO);
    await expect(consultarGoogleAds("SELECT 1", "token", { id: "1" })).rejects.toThrow(/permission/);
    expect(chamadas).toHaveLength(1);
  });
});
