import { describe, expect, it } from "vitest";
import { MERCADOS, textoNaMoeda, usdDe, valorNaMoeda, valorPagoConfere, valorUsdNoPais } from "./mercados";
import {
  CONTROLE_LOCAL,
  bracoLocalCobravel,
  bracoPedido,
  configDoTesteLocal,
  limparBraco,
  testeLocalLigado,
  textosPorBraco,
  valorLocalDoBraco,
} from "./preco-local";

const CO = MERCADOS.CO;
const LIGADO = {
  ativo: true,
  variantes: [
    { nome: "A", peso: 1 },
    { nome: "B", peso: 1 },
    { nome: "C", peso: 1 },
  ],
};

describe("preco_co: a tabela da Colômbia por braço", () => {
  it("o teste da Colômbia se chama preco_co e só tem os braços B e C", () => {
    expect(CO.teste?.id).toBe("preco_co");
    expect(Object.keys(CO.teste?.bracos ?? {}).sort()).toEqual(["B", "C"]);
  });

  it("a música: A $39.900, B $29.900, C $34.900", () => {
    expect(valorNaMoeda(CO, 1900)).toBe(3990000);
    expect(valorNaMoeda(CO, 1900, "A")).toBe(3990000);
    expect(valorNaMoeda(CO, 1900, "B")).toBe(2990000);
    expect(valorNaMoeda(CO, 1900, "C")).toBe(3490000);
  });

  it("a âncora: A $99.900, B e C $74.900", () => {
    expect(valorNaMoeda(CO, 4900)).toBe(9990000);
    expect(valorNaMoeda(CO, 4900, "B")).toBe(7490000);
    expect(valorNaMoeda(CO, 4900, "C")).toBe(7490000);
  });

  it("vídeo e música extra NÃO mudam com o braço (upsell fixo)", () => {
    for (const braco of [undefined, "A", "B", "C"]) {
      expect(valorNaMoeda(CO, 1200, braco)).toBe(2590000);
      expect(valorNaMoeda(CO, 1400, braco)).toBe(2990000);
    }
  });

  it("braço que não existe, vazio ou nulo cobra o de hoje", () => {
    expect(valorNaMoeda(CO, 1900, "Z")).toBe(3990000);
    expect(valorNaMoeda(CO, 1900, "")).toBe(3990000);
    expect(valorNaMoeda(CO, 1900, null)).toBe(3990000);
    expect(valorNaMoeda(CO, 1900, "fora")).toBe(3990000);
    // nome de propriedade herdada não vira braço
    expect(valorNaMoeda(CO, 1900, "constructor")).toBe(3990000);
    expect(valorNaMoeda(CO, 1900, "__proto__")).toBe(3990000);
  });

  it("país sem teste ignora o braço", () => {
    expect(valorNaMoeda(MERCADOS.CL, 1900, "B")).toBe(9990);
    expect(valorNaMoeda(MERCADOS.PE, 1900, "B")).toBe(3900);
    expect(valorNaMoeda(MERCADOS.US, 1900, "B")).toBe(1900);
    expect(valorUsdNoPais(19, "PE", "B")).toBe(valorUsdNoPais(19, "PE"));
    expect(valorUsdNoPais(19, "US", "B")).toBe(19);
  });

  it("só a Colômbia e o México têm teste de preço", () => {
    const comTeste = Object.values(MERCADOS).filter((m) => m.teste).map((m) => `${m.pais}:${m.teste?.id}`);
    expect(comTeste.sort()).toEqual(["CO:preco_co", "MX:preco_mx"]);
  });

  it("o texto da tela sai da mesma tabela", () => {
    expect(textoNaMoeda(CO, "US$ 19")).toBe("$39.900 COP");
    expect(textoNaMoeda(CO, "US$ 19", "B")).toBe("$29.900 COP");
    expect(textoNaMoeda(CO, "US$ 19", "C")).toBe("$34.900 COP");
    expect(textoNaMoeda(CO, "US$ 49", "B")).toBe("$74.900 COP");
    expect(textoNaMoeda(CO, "US$ 12", "B")).toBe("$25.900 COP");
  });

  it("o pedido grava o dólar do que se cobrou: 1174, 879 e 1026", () => {
    expect(valorLocalDoBraco(CO, 1900, "A")).toEqual({ valorLocal: 3990000, valorDoPedido: 1174 });
    expect(valorLocalDoBraco(CO, 1900, "B")).toEqual({ valorLocal: 2990000, valorDoPedido: 879 });
    expect(valorLocalDoBraco(CO, 1900, "C")).toEqual({ valorLocal: 3490000, valorDoPedido: 1026 });
    expect(usdDe(CO, 2990000)).toBe(879);
  });

  it("o valor que vai pro anúncio é o do braço", () => {
    expect(valorUsdNoPais(19, "CO")).toBe(11.74);
    expect(valorUsdNoPais(19, "CO", "B")).toBe(8.79);
    expect(valorUsdNoPais(19, "CO", "C")).toBe(10.26);
  });

  it("o webhook aceita o pago contra o pedido do PRÓPRIO braço e recusa contra o de outro", () => {
    expect(valorPagoConfere("cop", 2990000, 879)).toBe(true);
    expect(valorPagoConfere("cop", 3490000, 1026)).toBe(true);
    expect(valorPagoConfere("cop", 3990000, 1174)).toBe(true);
    // pagou o B num pedido que nasceu no A: retém
    expect(valorPagoConfere("cop", 2990000, 1174)).toBe(false);
    expect(valorPagoConfere("cop", 2990000, 1026)).toBe(false);
  });
});

describe("preco_co: qual braço vale", () => {
  it("ligado e com peso: o braço da pessoa", () => {
    expect(bracoLocalCobravel(CO, LIGADO, "B")).toBe("B");
    expect(bracoLocalCobravel(CO, LIGADO, "C")).toBe("C");
    expect(bracoLocalCobravel(CO, LIGADO, "A")).toBe(CONTROLE_LOCAL);
  });

  it("sem linha no banco, desligado ou sem variantes: controle", () => {
    expect(bracoLocalCobravel(CO, null, "B")).toBe(CONTROLE_LOCAL);
    expect(bracoLocalCobravel(CO, undefined, "B")).toBe(CONTROLE_LOCAL);
    expect(bracoLocalCobravel(CO, { ...LIGADO, ativo: false }, "B")).toBe(CONTROLE_LOCAL);
    expect(bracoLocalCobravel(CO, { ativo: true, variantes: [] }, "B")).toBe(CONTROLE_LOCAL);
  });

  it("braço zerado pelo peso paga o controle", () => {
    const zerado = { ativo: true, variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 0 }, { nome: "C", peso: 1 }] };
    expect(bracoLocalCobravel(CO, zerado, "B")).toBe(CONTROLE_LOCAL);
    expect(bracoLocalCobravel(CO, zerado, "C")).toBe("C");
  });

  it("braço desconhecido, `fora`, vazio ou nulo: controle", () => {
    for (const b of ["Z", "fora", "", null, undefined, "b"]) {
      expect(bracoLocalCobravel(CO, LIGADO, b)).toBe(CONTROLE_LOCAL);
    }
  });

  it("braço vivo no banco mas sem preço na tabela do país: controle", () => {
    const comD = { ativo: true, variantes: [...LIGADO.variantes, { nome: "D", peso: 1 }] };
    expect(bracoLocalCobravel(CO, comD, "D")).toBe(CONTROLE_LOCAL);
  });

  it("país sem teste: sempre controle, com a config que for", () => {
    expect(bracoLocalCobravel(MERCADOS.PE, LIGADO, "B")).toBe(CONTROLE_LOCAL);
    expect(bracoLocalCobravel(MERCADOS.US, LIGADO, "B")).toBe(CONTROLE_LOCAL);
  });
});

describe("preco_co: de onde o servidor tira o braço", () => {
  it("o que a folha mandou vence o que está gravado no lead", () => {
    expect(bracoPedido("preco_co", "B", { exp: { preco_co: "C" } })).toBe("B");
  });

  it("sem o campo (aba com o código antigo), o do lead", () => {
    expect(bracoPedido("preco_co", undefined, { exp: { preco_co: "C" } })).toBe("C");
    expect(bracoPedido("preco_co", null, { exp: { preco_co: "C" } })).toBe("C");
    expect(bracoPedido("preco_co", "", { exp: { preco_co: "C" } })).toBe("C");
  });

  it("sem nenhum dos dois, nulo (que vira controle)", () => {
    expect(bracoPedido("preco_co", undefined, null)).toBeNull();
    expect(bracoPedido("preco_co", undefined, { exp: { preco: "B" } })).toBeNull();
    expect(bracoPedido("preco_co", undefined, { exp: "lixo" })).toBeNull();
  });

  it("o campo mandado é texto curto de nome de braço, o resto é descartado", () => {
    expect(limparBraco("B")).toBe("B");
    expect(limparBraco(" C1 ")).toBe("C1");
    expect(limparBraco("fora")).toBe("fora");
    expect(limparBraco("B<script>")).toBeNull();
    expect(limparBraco("x".repeat(40))).toBeNull();
    expect(limparBraco(7)).toBeNull();
    expect(limparBraco({})).toBeNull();
    expect(limparBraco(null)).toBeNull();
  });
});

describe("preco_co: os preços que vão no HTML", () => {
  const cfg = (extra: Partial<{ ativo: boolean; variantes: Array<{ nome: string; peso: number }> }> = {}) => [
    { id: "preco", ativo: true, exposicaoPct: 100, variantes: [{ nome: "A", peso: 1 }] },
    { id: "preco_co", exposicaoPct: 100, ...LIGADO, ...extra },
  ];

  it("ligado: um texto por braço, na ordem da config, com o id do teste", () => {
    expect(textosPorBraco(CO, "US$ 19", cfg())).toEqual({
      id: "preco_co",
      bracos: [
        { nome: "A", texto: "$39.900 COP" },
        { nome: "B", texto: "$29.900 COP" },
        { nome: "C", texto: "$34.900 COP" },
      ],
    });
    expect(textosPorBraco(CO, "US$ 49", cfg())?.bracos.map((b) => b.texto)).toEqual([
      "$99.900 COP",
      "$74.900 COP",
      "$74.900 COP",
    ]);
  });

  it("SEM a linha na config, nada de braço: senão os três preços apareceriam lado a lado", () => {
    expect(textosPorBraco(CO, "US$ 19", [{ id: "preco", ativo: true, variantes: [{ nome: "A", peso: 1 }] }])).toBeNull();
    expect(textosPorBraco(CO, "US$ 19", [])).toBeNull();
    expect(configDoTesteLocal(CO, [])).toBeNull();
  });

  it("desligado: todo braço mostraria o controle, então nem desenha os braços", () => {
    expect(textosPorBraco(CO, "US$ 19", cfg({ ativo: false }))).toBeNull();
  });

  it("braço zerado pelo peso mostra o preço do controle", () => {
    const zerado = cfg({ variantes: [{ nome: "A", peso: 1 }, { nome: "B", peso: 0 }, { nome: "C", peso: 1 }] });
    expect(textosPorBraco(CO, "US$ 19", zerado)?.bracos).toEqual([
      { nome: "A", texto: "$39.900 COP" },
      { nome: "B", texto: "$39.900 COP" },
      { nome: "C", texto: "$34.900 COP" },
    ]);
  });

  it("preço que não muda com o braço (vídeo, extra) sai sem braço nenhum", () => {
    expect(textosPorBraco(CO, "US$ 12", cfg())).toBeNull();
    expect(textosPorBraco(CO, "US$ 14", cfg())).toBeNull();
  });

  it("país sem teste e texto sem número: sem braço", () => {
    expect(textosPorBraco(MERCADOS.PE, "US$ 19", cfg())).toBeNull();
    // o México tem teste, mas a config só tem a linha da Colômbia
    expect(textosPorBraco(MERCADOS.MX, "US$ 19", cfg())).toBeNull();
    expect(textosPorBraco(MERCADOS.US, "US$ 19", cfg())).toBeNull();
    expect(textosPorBraco(CO, "gratis", cfg())).toBeNull();
  });

  it("nome de braço fora do charset do painel não vira atributo", () => {
    const sujo = cfg({ variantes: [{ nome: "A", peso: 1 }, { nome: 'B"]{}', peso: 1 }, { nome: "C", peso: 1 }] });
    expect(textosPorBraco(CO, "US$ 19", sujo)?.bracos.map((b) => b.nome)).toEqual(["A", "C"]);
  });
});

describe("preco_co: o valor que o navegador manda pros anúncios", () => {
  it("na Ballad, na Colômbia, o clique de comprar leva o dólar do BRAÇO", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("VITE_MARCA", "ballad");
    try {
      const { valorDoCheckout, valorDaCompra, noPaisDoAcesso } = await import("./valor-conversao");
      const base = { locale: "es" as const, valorDaTela: 19, valorCobravel: 19, pais: "CO" };
      expect(valorDoCheckout(base)).toBe(11.74);
      expect(valorDoCheckout({ ...base, braco: "B" })).toBe(8.79);
      expect(valorDoCheckout({ ...base, braco: "C" })).toBe(10.26);
      // país sem teste ignora o braço
      expect(valorDoCheckout({ ...base, pais: "PE", braco: "B" })).toBe(valorDoCheckout({ ...base, pais: "PE" }));
      // México (`preco_mx`): $199 → 10,82; B $149 → 8,10; C $249 → 13,53
      expect(valorDoCheckout({ ...base, pais: "MX" })).toBe(10.82);
      expect(valorDoCheckout({ ...base, pais: "MX", braco: "B" })).toBe(8.1);
      expect(valorDoCheckout({ ...base, pais: "MX", braco: "C" })).toBe(13.53);
      expect(noPaisDoAcesso(19, "es", "CO", "B")).toBe(8.79);
      // a compra paga sai do pedido; a reserva (sem pedido) segue o braço
      expect(valorDaCompra({ locale: "es", pedido: { valorCentavos: 879, gateway: "stripe" }, reserva: 19, pais: "CO" })).toBe(8.79);
      expect(valorDaCompra({ locale: "es", pedido: null, reserva: 19, pais: "CO", braco: "C" })).toBe(10.26);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("preco_co: o teste está rodando?", () => {
  it("só com teste no mercado, linha no banco, ligada e com variantes", () => {
    expect(testeLocalLigado(CO, LIGADO)).toBe(true);
    expect(testeLocalLigado(CO, null)).toBe(false);
    expect(testeLocalLigado(CO, undefined)).toBe(false);
    expect(testeLocalLigado(CO, { ...LIGADO, ativo: false })).toBe(false);
    expect(testeLocalLigado(CO, { ativo: true, variantes: [] })).toBe(false);
    expect(testeLocalLigado(MERCADOS.PE, LIGADO)).toBe(false);
  });

  it("nome de braço aceita os 24 caracteres do painel", () => {
    expect(limparBraco("a".repeat(24))).toBe("a".repeat(24));
    expect(limparBraco("a".repeat(25))).toBeNull();
  });
});

// ── MÉXICO (`preco_mx`, 12/11) ───────────────────────────────────
describe("preco_mx: a tabela do México por braço", () => {
  const MX = MERCADOS.MX;

  it("o teste do México se chama preco_mx e só tem os braços B e C", () => {
    expect(MX.teste?.id).toBe("preco_mx");
    expect(Object.keys(MX.teste?.bracos ?? {}).sort()).toEqual(["B", "C"]);
  });

  it("a música: A $199, B $149, C $249", () => {
    expect(valorNaMoeda(MX, 1900)).toBe(19900);
    expect(valorNaMoeda(MX, 1900, "A")).toBe(19900);
    expect(valorNaMoeda(MX, 1900, "B")).toBe(14900);
    expect(valorNaMoeda(MX, 1900, "C")).toBe(24900);
  });

  it("a âncora: A $549, B $399, C $699", () => {
    expect(valorNaMoeda(MX, 4900)).toBe(54900);
    expect(valorNaMoeda(MX, 4900, "B")).toBe(39900);
    expect(valorNaMoeda(MX, 4900, "C")).toBe(69900);
  });

  it("vídeo ($129) e música extra ($149) NÃO mudam com o braço", () => {
    for (const braco of [undefined, "A", "B", "C"]) {
      expect(valorNaMoeda(MX, 1200, braco)).toBe(12900);
      expect(valorNaMoeda(MX, 1400, braco)).toBe(14900);
    }
  });

  it("o texto da tela", () => {
    expect(textoNaMoeda(MX, "US$ 19")).toBe("$199 MXN");
    expect(textoNaMoeda(MX, "US$ 19", "B")).toBe("$149 MXN");
    expect(textoNaMoeda(MX, "US$ 19", "C")).toBe("$249 MXN");
    expect(textoNaMoeda(MX, "US$ 49", "B")).toBe("$399 MXN");
    expect(textoNaMoeda(MX, "US$ 49", "C")).toBe("$699 MXN");
  });

  it("o pedido grava 1082, 810 e 1353 centavos de dólar", () => {
    expect(valorLocalDoBraco(MX, 1900, "A")).toEqual({ valorLocal: 19900, valorDoPedido: 1082 });
    expect(valorLocalDoBraco(MX, 1900, "B")).toEqual({ valorLocal: 14900, valorDoPedido: 810 });
    expect(valorLocalDoBraco(MX, 1900, "C")).toEqual({ valorLocal: 24900, valorDoPedido: 1353 });
  });

  it("o webhook aceita o pago contra o pedido do próprio braço e recusa contra o de outro", () => {
    expect(valorPagoConfere("mxn", 19900, 1082)).toBe(true);
    expect(valorPagoConfere("mxn", 14900, 810)).toBe(true);
    expect(valorPagoConfere("mxn", 24900, 1353)).toBe(true);
    // a regra antiga do México (US$ 19 a $349) não abre porta entre braços
    for (const [pago, pedido] of [
      [14900, 1082],
      [14900, 1353],
      [19900, 810],
      [19900, 1353],
      [24900, 1082],
      [24900, 810],
    ]) {
      expect(valorPagoConfere("mxn", pago, pedido)).toBe(false);
    }
  });

  it("a regra do braço é a mesma da Colômbia, com a linha DELE", () => {
    expect(bracoLocalCobravel(MX, LIGADO, "B")).toBe("B");
    expect(bracoLocalCobravel(MX, LIGADO, "C")).toBe("C");
    expect(bracoLocalCobravel(MX, { ...LIGADO, ativo: false }, "B")).toBe(CONTROLE_LOCAL);
    expect(bracoLocalCobravel(MX, null, "B")).toBe(CONTROLE_LOCAL);
  });

  it("cada país lê a SUA linha: a da Colômbia ligada não mexe no México, e vice-versa", () => {
    const soCo = [{ id: "preco_co", ...LIGADO }];
    const soMx = [{ id: "preco_mx", ...LIGADO }];
    expect(textosPorBraco(MX, "US$ 19", soCo)).toBeNull();
    expect(textosPorBraco(CO, "US$ 19", soMx)).toBeNull();
    expect(textosPorBraco(MX, "US$ 19", soMx)).toEqual({
      id: "preco_mx",
      bracos: [
        { nome: "A", texto: "$199 MXN" },
        { nome: "B", texto: "$149 MXN" },
        { nome: "C", texto: "$249 MXN" },
      ],
    });
    expect(bracoPedido("preco_mx", undefined, { exp: { preco_co: "B" } })).toBeNull();
  });
});
