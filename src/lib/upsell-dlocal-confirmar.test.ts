import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O DINHEIRO DO TESTE `upsell_dlocal`: o que acontece quando a dLocal diz "pago"
// num pedido SEM quiz. Banco e rede falsos, a lógica de verdade.

const creditarUpsell = vi.fn(async () => ({ creditou: true, quadro: false, video: true, erro: null }));
const avisarDonos = vi.fn(async () => {});
vi.mock("../../api/lib/creditar-upsell.js", () => ({ creditarUpsell }));
vi.mock("../../src/lib/avisar-donos.js", () => ({ avisarDonos }));
vi.mock("../../api/lib/entrega.js", () => ({
  musicaDoQuiz: vi.fn(),
  refazerSeFaltou: vi.fn(),
  mandarEmailDeEntrega: vi.fn(),
}));
vi.mock("../../api/lib/tiktok-eventos.js", () => ({ venderNoTiktok: vi.fn() }));

const UUID = "b1c2d3e4-0000-4000-8000-000000000000";

type Pedido = { id: string; status: string; valor_centavos: number; quiz_response_id: string | null; email: string | null };

/** Um supabase de mentira: só o que `confirmarPagamentoDlocal` usa, com a trava do `status`. */
function bancoFalso(pedido: Pedido) {
  const eventos: Array<{ event_name: string }> = [];
  const from = (tabela: string) => {
    const filtros: Record<string, unknown> = {};
    let patch: Record<string, unknown> | null = null;
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => {
        filtros[c] = v;
        return q;
      },
      neq: () => q,
      limit: () => q,
      update: (p: Record<string, unknown>) => {
        patch = p;
        return q;
      },
      insert: async (linha: { event_name: string }) => {
        if (tabela === "funnel_events") eventos.push(linha);
        return { error: null };
      },
      maybeSingle: async () => ({ data: tabela === "pedidos" ? pedido : null }),
      then: (ok: (r: unknown) => unknown) => {
        if (patch && tabela === "pedidos") {
          if (filtros.status === pedido.status) {
            Object.assign(pedido, patch);
            return Promise.resolve(ok({ data: [{ id: pedido.id }] }));
          }
          return Promise.resolve(ok({ data: [] }));
        }
        return Promise.resolve(ok({ data: [] }));
      },
    };
    return q;
  };
  return { sb: { from } as never, eventos };
}

function dlocalDiz(p: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: "DP-1", status: "PAID", ...p }) })),
  );
}

beforeEach(() => {
  vi.stubEnv("DLOCALGO_API_KEY", "k");
  vi.stubEnv("DLOCALGO_SECRET_KEY", "s");
  vi.stubEnv("RESEND_API_KEY", "");
  creditarUpsell.mockClear();
  avisarDonos.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const pendente = (valor: number): Pedido => ({ id: "p1", status: "pendente", valor_centavos: valor, quiz_response_id: null, email: "a@b.com" });

describe("upsell pago pela dLocal", () => {
  it("o vídeo em peso mexicano libera pelo creditarUpsell, uma vez", async () => {
    const { confirmarPagamentoDlocal } = await import("../../api/lib/dlocalgo");
    // $129 MXN ÷ 18,4 = US$ 7,01 no pedido.
    const pedido = pendente(701);
    const { sb, eventos } = bancoFalso(pedido);
    dlocalDiz({ amount: 129, currency: "MXN", order_id: `up-video-${UUID}-abc` });

    const r = await confirmarPagamentoDlocal(sb, "DP-1");
    expect(r).toMatchObject({ ok: true, entregue: true });
    expect(pedido.status).toBe("pago");
    expect(creditarUpsell).toHaveBeenCalledTimes(1);
    expect(creditarUpsell.mock.calls[0]).toMatchObject([sb, { oferta: { id: "video", creditos: 0 }, email: "a@b.com", pedidoId: "p1" }]);
    expect(eventos.map((e) => e.event_name)).toContain("dlocal_video_pago");

    // O aviso repetido não libera de novo.
    const de_novo = await confirmarPagamentoDlocal(sb, "DP-1");
    expect(de_novo).toMatchObject({ ok: true, entregue: false, duplicado: true });
    expect(creditarUpsell).toHaveBeenCalledTimes(1);
  });

  it("a extra em peso chileno, que não tem centavo, confere o valor e dá o crédito", async () => {
    const { confirmarPagamentoDlocal } = await import("../../api/lib/dlocalgo");
    // $7.490 CLP ÷ 1060 = US$ 7,07.
    const pedido = pendente(707);
    const { sb } = bancoFalso(pedido);
    dlocalDiz({ amount: 7490, currency: "CLP", order_id: `up-extra-${UUID}-abc` });

    const r = await confirmarPagamentoDlocal(sb, "DP-1");
    expect(r).toMatchObject({ ok: true, entregue: true });
    expect(creditarUpsell.mock.calls[0]).toMatchObject([sb, { oferta: { id: "extra", creditos: 1 } }]);
  });

  it("valor diferente não libera e avisa", async () => {
    const { confirmarPagamentoDlocal } = await import("../../api/lib/dlocalgo");
    const pedido = pendente(701);
    const { sb } = bancoFalso(pedido);
    dlocalDiz({ amount: 1, currency: "MXN", order_id: `up-video-${UUID}-abc` });

    const r = await confirmarPagamentoDlocal(sb, "DP-1");
    expect(r).toMatchObject({ ok: false, motivo: "valor-diferente" });
    expect(pedido.status).toBe("pendente");
    expect(creditarUpsell).not.toHaveBeenCalled();
    expect(avisarDonos).toHaveBeenCalledTimes(1);
  });

  it("order_id que não é nosso não libera nada e avisa", async () => {
    const { confirmarPagamentoDlocal } = await import("../../api/lib/dlocalgo");
    const pedido = pendente(701);
    const { sb } = bancoFalso(pedido);
    dlocalDiz({ amount: 129, currency: "MXN", order_id: "qualquer-coisa" });

    const r = await confirmarPagamentoDlocal(sb, "DP-1");
    expect(r).toMatchObject({ ok: true, entregue: false });
    expect(creditarUpsell).not.toHaveBeenCalled();
    expect(avisarDonos).toHaveBeenCalledTimes(1);
  });

  it("ficha ainda não paga não mexe em nada", async () => {
    const { confirmarPagamentoDlocal } = await import("../../api/lib/dlocalgo");
    const pedido = pendente(701);
    const { sb } = bancoFalso(pedido);
    dlocalDiz({ status: "PENDING", amount: 129, currency: "MXN", order_id: `up-video-${UUID}-abc` });

    const r = await confirmarPagamentoDlocal(sb, "DP-1");
    expect(r).toMatchObject({ ok: false, motivo: "nao-pago" });
    expect(pedido.status).toBe("pendente");
    expect(creditarUpsell).not.toHaveBeenCalled();
  });
});
