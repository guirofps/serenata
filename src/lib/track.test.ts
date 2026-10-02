import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O GA4 NÃO ESPERA O BANCO, E O BANCO NÃO DEPENDE DO GA4.
//
// O insert é mockado pra NUNCA resolver: se o GA4 recebeu mesmo assim, ele
// foi chamado antes do `await`. É o que impede o hit de se perder quando a
// página navega no meio do insert — exatamente o clique que leva ao checkout.

const { inserts, sessao } = vi.hoisted(() => ({
  inserts: [] as unknown[],
  sessao: { atual: "sess-1" },
}));

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: () => ({
      insert: (linha: unknown) => {
        inserts.push(linha);
        return new Promise(() => {});
      },
    }),
  },
}));

vi.mock("@/lib/session-context", () => ({
  getOrCreateSessionId: () => sessao.atual,
  getStoredAttribution: () => ({ utm_source: "google", ref: "ANA42" }),
  getDevice: () => "mobile",
  getFbIdentifiers: () => ({ fbp: "fb.1.123.456", fbc: null }),
}));

import { primeiraVez, trackEvent } from "./track";

let gtag: ReturnType<typeof vi.fn>;
beforeEach(() => {
  inserts.length = 0;
  gtag = vi.fn();
  vi.stubGlobal("window", { location: { pathname: "/criar" }, gtag });
});
afterEach(() => vi.unstubAllGlobals());

describe("trackEvent e o GA4", () => {
  it("manda ao GA4 na hora, sem esperar o banco", () => {
    void trackEvent("quiz_step", { step: 3 });
    expect(gtag).toHaveBeenCalledWith("event", "quiz_step", {
      device: "mobile",
      utm_source: "google",
      ref: "ANA42",
      step: 3,
      send_to: "G-E2EKHK3RQF",
    });
  });

  it("o identificador do Meta grava no banco e não vai ao GA4", async () => {
    void trackEvent("quiz_step", { step: 1 });
    expect(gtag.mock.calls[0][2]).not.toHaveProperty("fbp");
    await vi.waitFor(() => expect(inserts).toHaveLength(1));
    const linha = inserts[0] as { event_data: Record<string, unknown> };
    expect(linha.event_data.fbp).toBe("fb.1.123.456");
  });

  it("gtag que explode não impede a gravação no banco", async () => {
    vi.stubGlobal("window", {
      location: { pathname: "/criar" },
      gtag: () => {
        throw new Error("bloqueador");
      },
    });
    void trackEvent("quiz_step", { step: 1 });
    await vi.waitFor(() => expect(inserts).toHaveLength(1));
  });

  it("page_view grava no banco e não vai ao GA4", async () => {
    void trackEvent("page_view", { is_landing: true });
    expect(gtag).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(inserts).toHaveLength(1));
  });
});

describe("primeiraVez", () => {
  const memoria = () => {
    const dados = new Map<string, string>();
    return {
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => void dados.set(k, v),
    };
  };

  it("verdadeiro uma vez só por nome e chave", () => {
    vi.stubGlobal("localStorage", memoria());
    expect(primeiraVez("letra_finalizada", "v1")).toBe(true);
    expect(primeiraVez("letra_finalizada", "v1")).toBe(false);
    expect(primeiraVez("letra_finalizada", "v2")).toBe(true);
  });

  it("uma vez por SESSÃO: o segundo quiz no mesmo celular conta de novo", () => {
    vi.stubGlobal("localStorage", memoria());
    sessao.atual = "sess-a";
    expect(primeiraVez("letra_finalizada", "v1")).toBe(true);
    expect(primeiraVez("letra_finalizada", "v1")).toBe(false);
    sessao.atual = "sess-b";
    expect(primeiraVez("letra_finalizada", "v1")).toBe(true);
    sessao.atual = "sess-1";
  });

  it("storage bloqueado conta como primeira vez: perder a dedupe é melhor que perder o evento", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("quota");
      },
      setItem: () => {},
    });
    expect(primeiraVez("x", "v1")).toBe(true);
    expect(primeiraVez("x", "v1")).toBe(true);
  });
});
