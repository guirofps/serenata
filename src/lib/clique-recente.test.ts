import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canalDoUltimoClique,
  cliqueMaisRecente,
  gclidParaConversao,
  ttclidDaVenda,
  ultimoCliqueDaUrl,
  ultimoCliqueDe,
} from "./clique-recente";
import {
  captureFirstTouchAttribution,
  capturarUltimoClique,
  getStoredAttribution,
  sessaoTemLetra,
} from "./session-context";

const DIA = 86400000;
const AGORA = Date.parse("2026-10-16T12:00:00Z");
const diasAtras = (n: number) => new Date(AGORA - n * DIA).toISOString();

describe("ultimoCliqueDaUrl", () => {
  it("pega os quatro ids e a hora", () => {
    const u = ultimoCliqueDaUrl(
      "?gclid=G&gbraid=B&wbraid=W&ttclid=T&utm_source=google",
      new Date(AGORA),
    );
    expect(u).toEqual({
      gclid: "G",
      gbraid: "B",
      wbraid: "W",
      ttclid: "T",
      em: new Date(AGORA).toISOString(),
    });
  });
  it("sem id de clique, nada (UTM sozinha não é clique)", () => {
    expect(ultimoCliqueDaUrl("?utm_source=google&utm_campaign=x")).toBeNull();
    expect(ultimoCliqueDaUrl("?gclid=")).toBeNull();
    expect(ultimoCliqueDaUrl("")).toBeNull();
  });
});

describe("ultimoCliqueDe", () => {
  it("ignora objeto sem hora ou sem id (JSON do banco é livre)", () => {
    expect(ultimoCliqueDe({ ultimo_clique: { gclid: "G" } })).toBeNull();
    expect(ultimoCliqueDe({ ultimo_clique: { em: "2026-10-01T00:00:00Z" } })).toBeNull();
    expect(ultimoCliqueDe({ ultimo_clique: "lixo" })).toBeNull();
    expect(ultimoCliqueDe(null)).toBeNull();
  });
});

describe("gclidParaConversao (o clique que sobe no CSV do Google)", () => {
  it("último clique fresco vence o primeiro toque", () => {
    const attr = {
      gclid: "VELHO",
      captured_at: diasAtras(60),
      ultimo_clique: { gclid: "NOVO", em: diasAtras(2) },
    };
    expect(gclidParaConversao(attr, AGORA)).toBe("NOVO");
  });
  it("último clique sem gclid (veio do TikTok ou do iPhone): fica o primeiro toque fresco", () => {
    const attr = {
      gclid: "PRIMEIRO",
      captured_at: diasAtras(10),
      ultimo_clique: { ttclid: "T", em: diasAtras(1) },
    };
    expect(gclidParaConversao(attr, AGORA)).toBe("PRIMEIRO");
  });
  it("último clique vencido: cai pro primeiro toque se ele estiver fresco", () => {
    // Não acontece na prática (o último é sempre o mais novo), mas a régua é a validade de cada um.
    const attr = {
      gclid: "PRIMEIRO",
      captured_at: diasAtras(10),
      ultimo_clique: { gclid: "X", em: diasAtras(100) },
    };
    expect(gclidParaConversao(attr, AGORA)).toBe("PRIMEIRO");
  });
  it("tudo com mais de 90 dias: não sobe (o Google recusaria)", () => {
    expect(gclidParaConversao({ gclid: "G", captured_at: diasAtras(91) }, AGORA)).toBeNull();
    expect(
      gclidParaConversao(
        {
          gclid: "G",
          captured_at: diasAtras(120),
          ultimo_clique: { gclid: "H", em: diasAtras(95) },
        },
        AGORA,
      ),
    ).toBeNull();
  });
  it("no limite dos 90 dias ainda sobe", () => {
    expect(gclidParaConversao({ gclid: "G", captured_at: diasAtras(90) }, AGORA)).toBe("G");
  });
  it("primeiro toque sem data legível sobe como antes", () => {
    expect(gclidParaConversao({ gclid: "G" }, AGORA)).toBe("G");
    expect(gclidParaConversao({ gclid: " G ", captured_at: "lixo" }, AGORA)).toBe("G");
  });
  it("sem gclid nenhum, nada", () => {
    expect(gclidParaConversao(null, AGORA)).toBeNull();
    expect(gclidParaConversao({ gbraid: "B", captured_at: diasAtras(1) }, AGORA)).toBeNull();
    expect(gclidParaConversao({ gclid: "" }, AGORA)).toBeNull();
  });
});

describe("ttclidDaVenda", () => {
  it("último clique primeiro, senão o primeiro toque", () => {
    expect(ttclidDaVenda({ ttclid: "A", ultimo_clique: { ttclid: "B", em: diasAtras(1) } })).toBe(
      "B",
    );
    expect(ttclidDaVenda({ ttclid: "A", ultimo_clique: { gclid: "G", em: diasAtras(1) } })).toBe(
      "A",
    );
    expect(ttclidDaVenda({ gclid: "G", ultimo_clique: { ttclid: "B", em: diasAtras(1) } })).toBe(
      "B",
    );
  });
  it("sem ttclid nenhum, a venda não é do TikTok", () => {
    expect(ttclidDaVenda({ gclid: "G" })).toBeNull();
    expect(ttclidDaVenda(null)).toBeNull();
  });
});

describe("cliqueMaisRecente (o /retomar)", () => {
  const velho = { gclid: "V", em: diasAtras(10) };
  const novo = { ttclid: "N", em: diasAtras(1) };
  it("vale o mais novo, venha de onde vier", () => {
    expect(cliqueMaisRecente(novo, velho)).toEqual(novo);
    expect(cliqueMaisRecente(velho, novo)).toEqual(novo);
  });
  it("um lado vazio ou inválido: fica o outro", () => {
    expect(cliqueMaisRecente(undefined, velho)).toEqual(velho);
    expect(cliqueMaisRecente(velho, null)).toEqual(velho);
    expect(cliqueMaisRecente({ gclid: "sem hora" }, velho)).toEqual(velho);
    expect(cliqueMaisRecente(undefined, undefined)).toBeNull();
  });
});

describe("canalDoUltimoClique", () => {
  it("Google pelos três ids, TikTok pelo ttclid", () => {
    expect(canalDoUltimoClique({ ultimo_clique: { gbraid: "B", em: diasAtras(1) } })).toBe(
      "Google",
    );
    expect(canalDoUltimoClique({ ultimo_clique: { wbraid: "W", em: diasAtras(1) } })).toBe(
      "Google",
    );
    expect(canalDoUltimoClique({ ultimo_clique: { gclid: "G", em: diasAtras(1) } })).toBe("Google");
    expect(canalDoUltimoClique({ ultimo_clique: { ttclid: "T", em: diasAtras(1) } })).toBe(
      "TikTok",
    );
    expect(canalDoUltimoClique({ gclid: "G" })).toBeNull();
  });
});

// ── NO NAVEGADOR: o primeiro toque fica, o último clique anda ──────

const memoria = () => {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
  };
};

function chegar(busca: string, referrer = "") {
  vi.stubGlobal("window", { location: { search: busca } });
  vi.stubGlobal("document", { referrer, cookie: "" });
  captureFirstTouchAttribution();
  return capturarUltimoClique();
}

describe("captura no navegador", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoria());
  });

  it("a segunda chegada por anúncio NÃO mexe nas UTMs do primeiro toque, só no último clique", () => {
    expect(chegar("?utm_source=google&utm_campaign=c1&gclid=G1")).toBe(true);
    expect(chegar("?utm_source=tiktok&utm_campaign=c2&ttclid=T2")).toBe(true);
    const a = getStoredAttribution();
    expect(a?.utm_source).toBe("google");
    expect(a?.utm_campaign).toBe("c1");
    expect(a?.gclid).toBe("G1");
    expect(a?.ttclid).toBeUndefined();
    // Sobrescreve inteiro: o G1 não fica grudado na hora do T2.
    expect(a?.ultimo_clique?.ttclid).toBe("T2");
    expect(a?.ultimo_clique?.gclid).toBeUndefined();
  });

  it("primeiro toque orgânico, depois anúncio: o clique entra no último clique", () => {
    expect(chegar("", "https://www.instagram.com/")).toBe(false);
    expect(chegar("?gbraid=B1")).toBe(true);
    const a = getStoredAttribution();
    expect(a?.referrer).toBe("https://www.instagram.com/");
    expect(a?.gbraid).toBeUndefined();
    expect(a?.ultimo_clique?.gbraid).toBe("B1");
  });

  it("chegada sem clique não apaga o último clique", () => {
    chegar("?gclid=G1");
    expect(chegar("?utm_source=email")).toBe(false);
    expect(getStoredAttribution()?.ultimo_clique?.gclid).toBe("G1");
  });

  it("sessaoTemLetra só com a letra DESTA sessão", () => {
    localStorage.setItem("mp_session_id", "s1");
    expect(sessaoTemLetra()).toBe(false);
    localStorage.setItem("mp_quiz", JSON.stringify({ state: { letraFinal: { sessionId: "s0" } } }));
    expect(sessaoTemLetra()).toBe(false);
    localStorage.setItem("mp_quiz", JSON.stringify({ state: { letraFinal: { sessionId: "s1" } } }));
    expect(sessaoTemLetra()).toBe(true);
  });
});
