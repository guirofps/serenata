import { afterEach, describe, expect, it, vi } from "vitest";
import { idDaTransacao } from "./google-ads";

// O SESSION_ID É CREDENCIAL.
//
// `/retomar?s=<session_id>` devolve e-mail, WhatsApp, as respostas do quiz e o
// `tokenEdicao`, e manda a pessoa direto pro editor. Como `transaction_id` ele
// ia CRU pro Ads e pro GA4 em toda venda de cartão (o cartão não guarda
// referência antes de ir pra `/obrigado`) — e o GA4 mostra Transaction ID
// como dimensão navegável nos relatórios que o dono compartilha.
//
// A dedupe só precisa de um valor ESTÁVEL por sessão, não do id.

afterEach(() => vi.unstubAllGlobals());

const comSessao = (id: string) =>
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k === "mp_session_id" ? id : null),
  });

describe("idDaTransacao", () => {
  it("o id que veio passa como veio", () => {
    expect(idDaTransacao("pix_abc")).toBe("pix_abc");
  });

  it("o session_id NUNCA sai cru", () => {
    comSessao("3f2b8c1e-0a4d-4e8b-9c7f-1a2b3c4d5e6f");
    const id = idDaTransacao();
    expect(id).toBeDefined();
    expect(id).not.toContain("3f2b8c1e");
    expect(id).toMatch(/^s_[a-z0-9]+$/);
  });

  it("é estável por sessão: um F5 na /obrigado não conta a venda de novo", () => {
    comSessao("sess-1");
    expect(idDaTransacao()).toBe(idDaTransacao());
  });

  it("sessões diferentes dão ids diferentes", () => {
    comSessao("sess-1");
    const a = idDaTransacao();
    comSessao("sess-2");
    expect(idDaTransacao()).not.toBe(a);
  });

  it("sem id nenhum, omite", () => {
    expect(idDaTransacao()).toBeUndefined();
  });
});
