import { describe, expect, it } from "vitest";
import { chaveTema, porTemaDe } from "./admin-tema";

// Sessão gospel de verdade: o tema está nas respostas (gravado antes de
// qualquer lead) e na atribuição. `soAtribuicao` é o navegador que passou pelo
// gospel antes e voltou pro funil normal: a atribuição guardada nunca é limpa.
const lead = (id: string, tema?: string, tipo?: string, soAtribuicao = false) => ({
  id,
  attribution: tema ? { tema } : {},
  respostas: { ...(tipo ? { tipo } : {}), ...(tema && !soAtribuicao ? { tema } : {}) },
});

describe("chaveTema", () => {
  it("separa louvor, presente, sem tipo e resto", () => {
    expect(chaveTema(lead("1", "gospel", "louvor"))).toBe("gospel · louvor");
    expect(chaveTema(lead("2", "gospel", "presente"))).toBe("gospel · presente");
    expect(chaveTema(lead("3", "gospel"))).toBe("gospel · sem tipo");
    expect(chaveTema(lead("4"))).toBe("resto");
  });
  it("tema só na atribuição (sessão antiga do mesmo navegador) é resto", () => {
    expect(chaveTema(lead("5", "gospel", undefined, true))).toBe("resto");
    expect(chaveTema(lead("5b", "gospel", "presente", true))).toBe("resto");
  });
  it("valor diferente de 'gospel' é resto", () => {
    expect(chaveTema(lead("6", "Gospel", "louvor"))).toBe("resto");
  });
});

describe("porTemaDe", () => {
  const leads = [lead("a", "gospel", "louvor"), lead("b", "gospel", "louvor"), lead("c"), lead("d")];
  const vendas = [
    { quiz_response_id: "a", receitaBrl: 38 },
    { quiz_response_id: "c", receitaBrl: 38 },
    { quiz_response_id: "fora-do-periodo", receitaBrl: 38 },
  ];
  const linhas = porTemaDe(leads, vendas, new Set(["a", "c", "d"]));

  it("só mostra as linhas gospel que têm lead, e o resto", () => {
    expect(linhas.map((l) => l.tema)).toEqual(["gospel · louvor", "resto"]);
  });
  it("conta leads, letras, vendas e receita por lead", () => {
    expect(linhas[0]).toEqual({
      tema: "gospel · louvor", leads: 2, letras: 1, vendas: 1, receitaBrl: 38,
      conversaoPct: 50, receitaPorLeadBrl: 19,
    });
    // a venda sem lead no período cai no resto
    expect(linhas[1]).toMatchObject({ leads: 2, letras: 2, vendas: 2, receitaBrl: 76, receitaPorLeadBrl: 38 });
  });
  it("sem nenhum lead gospel devolve vazio (o cartão some)", () => {
    expect(porTemaDe([lead("x")], [], new Set())).toEqual([]);
  });
  it("sem lead não divide por zero", () => {
    const [g] = porTemaDe([], [{ quiz_response_id: null, receitaBrl: 0 }], new Set());
    expect(g).toBeUndefined();
  });
});
