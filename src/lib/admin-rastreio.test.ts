import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encaminharGa4 } from "./ga4";

// O PAINEL É RASTREADO SÓ NO BANCO PRÓPRIO.
//
// Decisão do dono em 01/10: `/admin` mostra nome, telefone, e-mail e status
// de pagamento de clientes, e JS de terceiro ali lê o DOM inteiro. Os eventos
// do painel vão pro `funnel_events` e nunca pro GA4.

afterEach(() => vi.unstubAllGlobals());

describe("rastreio do painel", () => {
  it("o painel rastreia aba, sub-aba e saque resolvido", () => {
    const admin = readFileSync("src/routes/admin.tsx", "utf8");
    const indicacoes = readFileSync("src/components/admin/AbaIndicacoes.tsx", "utf8");
    expect(admin).toMatch(/trackEvent\("admin_aba", \{ aba: aba \?\? null \}\)/);
    expect(indicacoes).toMatch(/trackEvent\("admin_sub_aba", \{ sub \}\)/);
    expect(indicacoes).toMatch(/trackEvent\("admin_saque_resolvido", \{ status \}\)/);
  });

  it("evento do painel nunca chega ao GA4, nem com o gtag presente", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/admin" }, gtag });
    encaminharGa4("admin_aba", { aba: "indicacoes" });
    encaminharGa4("admin_saque_resolvido", { status: "pago" });
    expect(gtag).not.toHaveBeenCalled();
  });
});
