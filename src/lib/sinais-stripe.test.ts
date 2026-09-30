import { describe, expect, it } from "vitest";
import { FOLGA_STRIPE_MIN, stripeMudo } from "./sinais-stripe";

// O VIGIA DO STRIPE (Ballad Gift). Ver o porquê em `sinais-stripe.ts`.
const t = (iso: string) => new Date(iso).getTime();
const agora = t("2026-09-30T15:00:00Z");
const min = (n: number) => agora - n * 60000;

describe("stripeMudo", () => {
  it("cala num dia normal: toda venda teve o webhook falando depois dela", () => {
    // O caso real de 29/09: a /obrigado confirmou às 16:34:41.004 e o webhook
    // gravou `stripe_webhook` 0,8s depois.
    const r = stripeMudo({ vendas: [min(90), min(40)], ultimaFala: min(40) + 800, agora });
    expect(r.avisar).toBe(false);
    expect(r.semVoz).toBe(0);
  });

  it("acende quando a venda passou da folga e o webhook não disse nada desde ela", () => {
    const r = stripeMudo({ vendas: [min(35)], ultimaFala: min(300), agora });
    expect(r.avisar).toBe(true);
    expect(r.semVoz).toBe(1);
    expect(r.minutosMudo).toBe(300);
  });

  it("venda dentro da folga ainda não prova nada", () => {
    const r = stripeMudo({ vendas: [min(FOLGA_STRIPE_MIN - 1)], ultimaFala: min(300), agora });
    expect(r.avisar).toBe(false);
  });

  it("respeita a fronteira da folga", () => {
    expect(stripeMudo({ vendas: [min(FOLGA_STRIPE_MIN)], ultimaFala: min(300), agora }).avisar).toBe(true);
  });

  it("DORME sem venda: pedido pendente não entra, formulário aberto não é pagamento", () => {
    expect(stripeMudo({ vendas: [], ultimaFala: min(3000), agora }).avisar).toBe(false);
    expect(stripeMudo({ vendas: [], ultimaFala: null, agora }).avisar).toBe(false);
  });

  it("webhook que nunca falou, com venda madura, acende", () => {
    const r = stripeMudo({ vendas: [min(60)], ultimaFala: null, agora });
    expect(r.avisar).toBe(true);
    expect(r.minutosMudo).toBeNull();
  });

  it("data ilegível não vira venda", () => {
    expect(stripeMudo({ vendas: [Number.NaN], ultimaFala: null, agora }).avisar).toBe(false);
  });
});
