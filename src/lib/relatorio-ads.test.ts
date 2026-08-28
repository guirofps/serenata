import { describe, expect, it } from "vitest";
import { lerRelatorioCampanhas, linhaCsv, numeroBr, diaIso } from "./relatorio-ads";

// O QUE ESTE TESTE SEGURA
//
// Este parser vira CUSTO, e custo vira ROAS — o número pelo qual campanha é
// morta ou escalada. Errar aqui não dá erro na tela: dá um número plausível e
// errado, que é o pior tipo.
//
// Os três jeitos de errar em silêncio, todos cobertos abaixo:
//   1. vírgula dentro do nome deslocando as colunas
//   2. `1.234,56` lido como NaN e virando custo zero (ROAS infinito)
//   3. a linha "Total" do rodapé entrando como se fosse campanha

describe("linhaCsv — vírgula dentro do nome não desloca coluna", () => {
  it("respeita aspas", () => {
    expect(linhaCsv('123,"Busca: Música, homenagem",R$ 10')).toEqual([
      "123",
      "Busca: Música, homenagem",
      "R$ 10",
    ]);
  });

  it("aspas dobradas viram uma aspa", () => {
    expect(linhaCsv('1,"o ""campeão"" 1",2')).toEqual(["1", 'o "campeão" 1', "2"]);
  });
});

describe("numeroBr — o formato brasileiro do Google", () => {
  it("ponto de milhar e vírgula decimal", () => {
    expect(numeroBr("1.234,56")).toBe(1234.56);
    expect(numeroBr("R$ 1.234,56")).toBe(1234.56);
    expect(numeroBr("0,50")).toBe(0.5);
  });

  it("vazio, traço e '--' são zero, não NaN", () => {
    // NaN aqui viraria custo zero num relatório de milhares de reais, e
    // ROAS infinito é exatamente o número que faz alguém escalar o que está
    // dando prejuízo.
    for (const v of ["", "--", "-", "   "]) expect(numeroBr(v)).toBe(0);
  });

  it("aguenta o formato inglês, caso a conta esteja em en-US", () => {
    // Quem vem por último é o decimal. Sem essa regra, `1,234.56` era lido
    // como 1,23 — mil vezes menos, num campo que vira ROAS.
    expect(numeroBr("1,234.56")).toBe(1234.56);
    expect(numeroBr("1234.56")).toBe(1234.56);
    expect(numeroBr("1,234,567.89")).toBe(1234567.89);
  });

  it("ponto sozinho: três dígitos é milhar, dois é decimal", () => {
    // O caso ambíguo de verdade. A conta é brasileira, então `1.234` é mil.
    expect(numeroBr("1.234")).toBe(1234);
    expect(numeroBr("12.34")).toBe(12.34);
    expect(numeroBr("1.234.567")).toBe(1234567);
  });
});

describe("diaIso", () => {
  it("lê os três formatos que o Google usa", () => {
    expect(diaIso("2026-08-27")).toBe("2026-08-27");
    expect(diaIso("27/08/2026")).toBe("2026-08-27");
    expect(diaIso("27 de ago. de 2026")).toBe("2026-08-27");
  });

  it("devolve null no que não é data", () => {
    expect(diaIso("Total: contas")).toBeNull();
    expect(diaIso("")).toBeNull();
  });
});

const CABECALHO =
  "Campanha,ID da campanha,Status da campanha,Tipo de campanha,Dia,Impr.,Cliques,Custo,Conversões";

describe("lerRelatorioCampanhas", () => {
  it("lê o relatório com preâmbulo, como o Google exporta", () => {
    const csv = [
      "Relatório de campanha",
      "27 de ago. de 2026 - 27 de ago. de 2026",
      "",
      CABECALHO,
      '"GD | Serenata | Remkt Concorrentes | CAMPEÃO 1#",24116713654,Ativada,Geração de demanda,27/08/2026,"12.345","1.234","R$ 1.234,56","13,00"',
      "Total: campanhas,,,,,12.345,1.234,\"R$ 1.234,56\",\"13,00\"",
    ].join("\n");

    const r = lerRelatorioCampanhas(csv);
    expect(r.metricas).toHaveLength(1);
    expect(r.metricas[0]).toEqual({
      dia: "2026-08-27",
      campanhaId: "24116713654",
      nome: "GD | Serenata | Remkt Concorrentes | CAMPEÃO 1#",
      status: "Ativada",
      tipo: "Geração de demanda",
      custoBrl: 1234.56,
      cliques: 1234,
      impressoes: 12345,
      conversoesGoogle: 13,
    });
  });

  it("A LINHA DE TOTAL NÃO ENTRA — somá-la dobraria o gasto do período", () => {
    const csv = [
      CABECALHO,
      "Campanha A,111,Ativada,Pesquisa,27/08/2026,10,2,\"R$ 5,00\",1",
      "Total: contas,,,,,10,2,\"R$ 5,00\",1",
    ].join("\n");
    const r = lerRelatorioCampanhas(csv);
    expect(r.metricas).toHaveLength(1);
    expect(r.metricas[0].custoBrl).toBe(5);
    // E não avisa sobre ela: é ruído esperado, não problema.
    expect(r.avisos.join(" ")).not.toContain("Total");
  });

  it("RECUSA relatório sem a coluna Dia, em vez de inventar um dia", () => {
    // É o erro mais fácil de cometer: o export padrão vem somado no período.
    // Aceitar isso criaria um custo diário que nunca existiu.
    const csv = [
      "Campanha,ID da campanha,Custo",
      "Campanha A,111,\"R$ 100,00\"",
    ].join("\n");
    const r = lerRelatorioCampanhas(csv);
    expect(r.metricas).toHaveLength(0);
    expect(r.avisos.join(" ")).toContain("Dia");
  });

  it("RECUSA relatório sem o ID: o nome muda, o ID não", () => {
    const csv = ["Campanha,Dia,Custo", "Campanha A,27/08/2026,\"R$ 100,00\""].join("\n");
    const r = lerRelatorioCampanhas(csv);
    expect(r.metricas).toHaveLength(0);
    expect(r.avisos.join(" ")).toContain("ID");
  });

  it("aceita cabeçalho com sufixo, que o Google muda sozinho", () => {
    const csv = [
      "Campanha,ID da campanha,Dia,Custo (BRL),Conversões (por interação)",
      "A,111,27/08/2026,\"R$ 9,90\",\"2,00\"",
    ].join("\n");
    const r = lerRelatorioCampanhas(csv);
    expect(r.metricas[0].custoBrl).toBe(9.9);
    expect(r.metricas[0].conversoesGoogle).toBe(2);
  });

  it("avisa o que ignorou, em vez de importar calado", () => {
    const csv = [CABECALHO, "Campanha estranha,,Ativada,Pesquisa,,10,2,\"R$ 5,00\",1"].join("\n");
    const r = lerRelatorioCampanhas(csv);
    expect(r.metricas).toHaveLength(0);
    expect(r.avisos.some((a) => a.includes("Campanha estranha"))).toBe(true);
  });
});
