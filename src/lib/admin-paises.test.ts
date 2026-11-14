import { describe, expect, it } from "vitest";
import { OUTROS_PAISES, SEM_PAIS, paisDaCampanha, paisPeloNome, resumoPaises } from "./admin-paises";

const linha = (r: ReturnType<typeof resumoPaises>, pais: string) => r.find((x) => x.pais === pais);

describe("país pelo nome da campanha (só quando a campanha não trouxe lead)", () => {
  it("reconhece os mercados pelo jeito que as campanhas são nomeadas", () => {
    expect(paisPeloNome("Ballad | MEX 37 | banda | Aberto")).toBe("MX");
    expect(paisPeloNome("MEX 70 Intenção regalo")).toBe("MX");
    expect(paisPeloNome("100 Colômbia Aberto")).toBe("CO");
    expect(paisPeloNome("118 Colombia Fans música latina")).toBe("CO");
    expect(paisPeloNome("113 Search IA Peru")).toBe("PE");
    expect(paisPeloNome("101 Chile Aberto")).toBe("CL");
    expect(paisPeloNome("107 Espanha rumba Aberto")).toBe("ES");
    expect(paisPeloNome("España balada")).toBe("ES");
    expect(paisPeloNome("120 Argentina Aberto")).toBe("AR");
    expect(paisPeloNome("81 Valentina × Hispanos EUA")).toBe("US");
  });

  it("`ES` sozinho é ESPANHOL (a língua), não Espanha: não decide país", () => {
    expect(paisPeloNome("ES 37 banda Aberto")).toBeNull();
    expect(paisPeloNome("ES · Intencao regalo 25+")).toBeNull();
  });

  it("nome sem país, vazio ou nulo: não sabe", () => {
    expect(paisPeloNome("Search | Concorrentes")).toBeNull();
    expect(paisPeloNome("")).toBeNull();
    expect(paisPeloNome(null)).toBeNull();
    // "Peruíbe" não é Peru, "Chilena" não é Chile
    expect(paisPeloNome("Peruíbe teste")).toBeNull();
  });
});

describe("o país de uma campanha", () => {
  it("é o da maioria dos leads dela", () => {
    expect(paisDaCampanha(new Map([["CO", 8], ["US", 1]]), null)).toBe("CO");
    expect(paisDaCampanha(new Map([["MX", 1]]), "100 Colômbia")).toBe("MX");
  });

  it("no empate, o nome desempata; sem nome que ajude, a ordem alfabética (estável)", () => {
    expect(paisDaCampanha(new Map([["CO", 2], ["PE", 2]]), "113 Search IA Peru")).toBe("PE");
    expect(paisDaCampanha(new Map([["PE", 2], ["CO", 2]]), "Search IA")).toBe("CO");
  });

  it("sem lead nenhum com país, vale o nome; sem nome, não sabe", () => {
    expect(paisDaCampanha(new Map(), "MEX 104 Ideas de regalo")).toBe("MX");
    expect(paisDaCampanha(new Map(), "Teste novo")).toBeNull();
    expect(paisDaCampanha(new Map(), null)).toBeNull();
  });
});

describe("resumo por país", () => {
  const base = () => ({
    leads: [
      { id: "q1", campanha: "c-mx" },
      { id: "q2", campanha: "c-mx" },
      { id: "q3", campanha: "c-mx" },
      { id: "q4", campanha: "c-mx" },
      { id: "q5", campanha: "c-co" },
      { id: "q6", campanha: "c-co" },
      { id: "q7", campanha: null },
      { id: "q8", campanha: "c-mx" }, // não chegou à letra: sem país
    ],
    paisDoQuiz: new Map<string, string | null>([
      ["q1", "MX"],
      ["q2", "MX"],
      ["q3", "MX"],
      ["q4", "US"], // vazou pros EUA
      ["q5", "CO"],
      ["q6", "CO"],
      ["q7", "BR"], // fora dos mercados
      ["q8", null],
      ["antigo", "MX"], // quiz de antes da janela, que comprou agora
    ]),
    vendas: [
      { quiz_response_id: "q1", receitaBrl: 55, canal: "google" as const },
      { quiz_response_id: "q5", receitaBrl: 60, canal: "tiktok" as const },
      { quiz_response_id: "antigo", receitaBrl: 55, canal: "email" as const },
      { quiz_response_id: null, receitaBrl: 30, canal: "organico" as const }, // upsell, sem quiz
    ],
    custoPorCampanha: new Map([
      ["c-mx", 100],
      ["c-co", 40],
      ["c-pe", 25], // gastou e não trouxe lead: vai pelo nome
      ["c-x", 10], // gastou, sem lead e sem país no nome
    ]),
    nomeDaCampanha: new Map([
      ["c-pe", "113 Search IA Peru"],
      ["c-x", "Teste novo"],
    ]),
  });

  it("leads, vendas, receita e conversão de cada país", () => {
    const r = resumoPaises(base());
    expect(linha(r, "MX")).toMatchObject({ nome: "México", leads: 3, vendas: 2, receitaBrl: 110 });
    expect(linha(r, "MX")?.conversaoPct).toBeCloseTo(66.67, 1);
    expect(linha(r, "CO")).toMatchObject({ nome: "Colômbia", leads: 2, vendas: 1, receitaBrl: 60, conversaoPct: 50 });
    expect(linha(r, "US")).toMatchObject({ nome: "EUA", leads: 1, vendas: 0, conversaoPct: 0 });
  });

  it("o gasto de cada campanha vai INTEIRO pro país da maioria dos leads dela", () => {
    const r = resumoPaises(base());
    // c-mx: 3 leads do México e 1 dos EUA → os R$ 100 são do México
    expect(linha(r, "MX")?.gastoBrl).toBe(100);
    expect(linha(r, "US")?.gastoBrl).toBe(0);
    expect(linha(r, "CO")?.gastoBrl).toBe(40);
  });

  it("campanha que gastou e não trouxe lead entra pelo nome: o gasto perdido não some do CPA", () => {
    const r = resumoPaises(base());
    expect(linha(r, "PE")).toMatchObject({ nome: "Peru", leads: 0, vendas: 0, gastoBrl: 25, cpaBrl: null });
  });

  it("o CPA é o gasto do Google ÷ as vendas do país que vieram do GOOGLE", () => {
    const r = resumoPaises(base());
    // México: 2 vendas, só 1 do Google → R$ 100 ÷ 1
    expect(linha(r, "MX")).toMatchObject({ vendasGoogle: 1, cpaBrl: 100 });
    // Colômbia: gastou R$ 40 e a única venda veio do TikTok → sem CPA
    expect(linha(r, "CO")).toMatchObject({ vendasGoogle: 0, cpaBrl: null });
  });

  it("país fora dos mercados vira `outros`; sem país vira `sem`, por último e sem conversão", () => {
    const r = resumoPaises(base());
    expect(linha(r, OUTROS_PAISES)).toMatchObject({ nome: "Outros países", leads: 1, vendas: 0 });
    const sem = linha(r, SEM_PAIS);
    // q8 (não chegou à letra), a venda sem quiz (upsell não é venda de música: fica fora) e o gasto sem país
    expect(sem).toMatchObject({ leads: 1, vendas: 0, gastoBrl: 10, conversaoPct: null, cpaBrl: null });
    expect(r[r.length - 1].pais).toBe(SEM_PAIS);
  });

  it("os totais fecham com o que entrou", () => {
    const e = base();
    const r = resumoPaises(e);
    expect(r.reduce((s, x) => s + x.leads, 0)).toBe(e.leads.length);
    // a venda sem quiz não é de país nenhum e fica de fora
    expect(r.reduce((s, x) => s + x.vendas, 0)).toBe(3);
    expect(r.reduce((s, x) => s + x.gastoBrl, 0)).toBe(175);
  });

  it("ordem: mais vendas primeiro, depois mais leads; `sem` sempre no fim", () => {
    const r = resumoPaises(base());
    expect(r.map((x) => x.pais)).toEqual(["MX", "CO", "US", OUTROS_PAISES, "PE", SEM_PAIS]);
  });

  it("país sem nada no período não aparece; tudo vazio dá lista vazia", () => {
    const r = resumoPaises(base());
    expect(linha(r, "ES")).toBeUndefined();
    expect(linha(r, "AR")).toBeUndefined();
    expect(
      resumoPaises({ leads: [], paisDoQuiz: new Map(), vendas: [], custoPorCampanha: new Map(), nomeDaCampanha: new Map() }),
    ).toEqual([]);
  });

  it("país escrito em minúscula ou com espaço é o mesmo país", () => {
    const r = resumoPaises({
      leads: [{ id: "a", campanha: null }],
      paisDoQuiz: new Map([["a", " mx "]]),
      vendas: [],
      custoPorCampanha: new Map(),
      nomeDaCampanha: new Map(),
    });
    expect(linha(r, "MX")?.leads).toBe(1);
  });
});
