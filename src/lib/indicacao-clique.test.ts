import { beforeEach, describe, expect, it, vi } from "vitest";
import { carimbarIndicacao, getStoredAttribution } from "./session-context";

// O CLIQUE NO CONVITE.
//
// Tudo o que a aba de links mostra como "Cliques" depende de uma linha só:
// `carimbarIndicacao` devolver o código que veio NA URL, mesmo quando não há
// nada novo pra gravar. A tentação de devolver só quando o storage muda é
// grande (é o caminho que já faz trabalho), e foi exatamente esse atalho que
// deixou o painel sem número de clique — a mesma pessoa abrindo o mesmo link
// dez vezes deixava um rastro só.
//
// Os dois contratos convivem de propósito:
//   RETORNO  = chegada pela URL      -> vira evento, conta clique
//   ref_em   = código entrou aqui    -> dedupe do histórico, conta pessoa

const memoria = () => {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
  };
};

function visitar(busca: string) {
  vi.stubGlobal("window", { location: { search: busca } });
}

describe("carimbo do convite", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoria());
  });

  it("sem ?ref= não devolve nada e não grava", () => {
    visitar("?utm_source=google");
    expect(carimbarIndicacao()).toBeNull();
    expect(getStoredAttribution()).toBeNull();
  });

  it("grava o código e a hora, e devolve o código", () => {
    visitar("?ref=VURPFW");
    expect(carimbarIndicacao()).toBe("VURPFW");
    const attr = getStoredAttribution();
    expect(attr?.ref).toBe("VURPFW");
    expect(attr?.ref_em).toBeTruthy();
  });

  it("normaliza minúsculo", () => {
    visitar("?ref=vurpfw");
    expect(carimbarIndicacao()).toBe("VURPFW");
    expect(getStoredAttribution()?.ref).toBe("VURPFW");
  });

  it("recusa o que não é código", () => {
    for (const ruim of ["ABC", "VURPF0", "VURPFWX", "", "<script>"]) {
      visitar(`?ref=${encodeURIComponent(ruim)}`);
      expect(carimbarIndicacao()).toBeNull();
    }
    expect(getStoredAttribution()).toBeNull();
  });

  // O TESTE QUE SEGURA O NÚMERO DE CLIQUES.
  it("o mesmo link de novo continua sendo um clique, sem mexer no ref_em", () => {
    visitar("?ref=VURPFW");
    carimbarIndicacao();
    const primeiro = getStoredAttribution()?.ref_em;

    // Três voltas pelo mesmo link: três cliques, uma pessoa.
    expect(carimbarIndicacao()).toBe("VURPFW");
    expect(carimbarIndicacao()).toBe("VURPFW");
    expect(carimbarIndicacao()).toBe("VURPFW");

    expect(getStoredAttribution()?.ref_em).toBe(primeiro);
  });

  it("o último link vence, e a troca renova o ref_em", async () => {
    visitar("?ref=VURPFW");
    carimbarIndicacao();
    const primeiro = getStoredAttribution()?.ref_em;

    await new Promise((r) => setTimeout(r, 2));
    visitar("?ref=K7M9P2");
    expect(carimbarIndicacao()).toBe("K7M9P2");
    expect(getStoredAttribution()?.ref).toBe("K7M9P2");
    expect(getStoredAttribution()?.ref_em).not.toBe(primeiro);
  });

  it("não perde o que a atribuição já tinha", () => {
    visitar("?ref=VURPFW");
    localStorage.setItem("mp_attribution", JSON.stringify({ utm_source: "google", variant: "A" }));
    carimbarIndicacao();
    const attr = getStoredAttribution();
    expect(attr?.utm_source).toBe("google");
    expect(attr?.variant).toBe("A");
    expect(attr?.ref).toBe("VURPFW");
  });

  // Aba anônima com cota zerada: sem convite gravado, preço cheio — mas o
  // clique aconteceu e tem que ser contado do mesmo jeito.
  it("com localStorage bloqueado, ainda conta o clique", () => {
    visitar("?ref=VURPFW");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {},
    });
    expect(() => carimbarIndicacao()).not.toThrow();
    expect(carimbarIndicacao()).toBe("VURPFW");
  });
});
