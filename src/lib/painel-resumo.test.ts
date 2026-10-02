import { describe, expect, it } from "vitest";
import {
  diaBr,
  faixasVivas,
  fatiarJanela,
  limitesDoDia,
  resumoVazio,
  somarResumos,
  type EventosResumo,
} from "./painel-resumo";

// O RESUMO DIÁRIO DO FUNIL. Dia fechado vem da tabela; as pontas da janela
// (que começa e termina no meio de um dia) vêm ao vivo.

const t = (iso: string) => new Date(iso);
const iso = (f: { inicio: Date; fim: Date }) => [f.inicio.toISOString(), f.fim.toISOString()];

describe("diaBr e limitesDoDia", () => {
  it("02h em UTC ainda é o dia anterior no Brasil", () => {
    expect(diaBr(Date.parse("2026-10-02T02:59:00.000Z"))).toBe("2026-10-01");
    expect(diaBr(Date.parse("2026-10-02T03:00:00.000Z"))).toBe("2026-10-02");
  });

  it("o dia vai de 03:00 UTC a 03:00 UTC do dia seguinte", () => {
    expect(iso(limitesDoDia("2026-10-01"))).toEqual([
      "2026-10-01T03:00:00.000Z",
      "2026-10-02T03:00:00.000Z",
    ]);
  });
});

describe("fatiarJanela", () => {
  // 01/10 22:38 no Brasil.
  const agora = Date.parse("2026-10-02T01:38:00.000Z");

  it("7 dias móveis: ponta inicial viva, 6 dias da tabela, hoje vivo", () => {
    const fim = new Date(agora);
    const inicio = new Date(agora - 7 * 86_400_000);
    const r = fatiarJanela(inicio, fim, agora);
    expect(r.dias).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
    ]);
    expect(r.vivas.map(iso)).toEqual([
      ["2026-09-25T01:38:00.000Z", "2026-09-25T03:00:00.000Z"],
      ["2026-10-01T03:00:00.000Z", "2026-10-02T01:38:00.000Z"],
    ]);
  });

  it("um dia fechado escolhido por data: só tabela, nada vivo", () => {
    const { inicio, fim } = limitesDoDia("2026-09-28");
    const r = fatiarJanela(inicio, fim, agora);
    expect(r).toEqual({ dias: ["2026-09-28"], vivas: [] });
  });

  it("só hoje: tudo vivo", () => {
    const { inicio } = limitesDoDia("2026-10-01");
    const r = fatiarJanela(inicio, new Date(agora), agora);
    expect(r.dias).toEqual([]);
    expect(r.vivas.map(iso)).toEqual([["2026-10-01T03:00:00.000Z", "2026-10-02T01:38:00.000Z"]]);
  });

  it("vira o mês sem pular dia", () => {
    const r = fatiarJanela(
      limitesDoDia("2026-09-29").inicio,
      limitesDoDia("2026-10-01").inicio,
      agora,
    );
    expect(r.dias).toEqual(["2026-09-29", "2026-09-30"]);
  });

  it("janela anterior do comparativo, terminando no meio de ontem: a ponta final é viva", () => {
    // 7 dias, deslocados 7 dias pra trás: termina 24/09 22:38 no Brasil.
    const fim = new Date(agora - 7 * 86_400_000);
    const inicio = new Date(agora - 14 * 86_400_000);
    const r = fatiarJanela(inicio, fim, agora);
    expect(r.dias[r.dias.length - 1]).toBe("2026-09-23");
    expect(r.vivas.map(iso)[1]).toEqual(["2026-09-24T03:00:00.000Z", "2026-09-25T01:38:00.000Z"]);
  });

  it("janela vazia não tem nada", () => {
    expect(fatiarJanela(new Date(agora), new Date(agora), agora)).toEqual({ dias: [], vivas: [] });
  });
});

describe("faixasVivas", () => {
  const plano = {
    dias: ["2026-09-26", "2026-09-27", "2026-09-28"],
    vivas: [
      { inicio: t("2026-09-25T20:00:00.000Z"), fim: t("2026-09-26T03:00:00.000Z") },
      { inicio: t("2026-09-29T03:00:00.000Z"), fim: t("2026-09-29T10:00:00.000Z") },
    ],
  };

  it("com todos os dias na tabela, só as pontas vão ao banco", () => {
    const r = faixasVivas(plano, new Set(plano.dias));
    expect(r.faltando).toEqual([]);
    expect(r.faixas).toHaveLength(2);
  });

  it("dia faltando vira faixa viva, colada na vizinha", () => {
    const r = faixasVivas(plano, new Set(["2026-09-27", "2026-09-28"]));
    expect(r.faltando).toEqual(["2026-09-26"]);
    // A ponta inicial e o dia 26 se tocam: uma chamada só.
    expect(r.faixas.map(iso)).toEqual([
      ["2026-09-25T20:00:00.000Z", "2026-09-27T03:00:00.000Z"],
      ["2026-09-29T03:00:00.000Z", "2026-09-29T10:00:00.000Z"],
    ]);
  });

  it("tabela vazia: a janela inteira numa faixa só, como era antes", () => {
    const r = faixasVivas(plano, new Set());
    expect(r.faixas.map(iso)).toEqual([["2026-09-25T20:00:00.000Z", "2026-09-29T10:00:00.000Z"]]);
  });
});

describe("somarResumos", () => {
  const a: EventosResumo = {
    visitantes: 10,
    sessoes_abertura: 6,
    sessoes_oferta: 3,
    sessoes_checkout: 2,
    contagens: { musica_play: 4 },
    por_entrada: [
      { caminho: "/", visitantes: 7, quiz: 3, letras: 2, vendas: 1 },
      { caminho: "/criar", visitantes: 3, quiz: 3, letras: 1, vendas: 0 },
    ],
  };
  const b: EventosResumo = {
    visitantes: 5,
    sessoes_oferta: 1,
    sessoes_checkout: 0,
    contagens: { musica_play: 1, letra_refacao: 2 },
    por_entrada: [{ caminho: "/criar", visitantes: 5, quiz: 4, letras: 2, vendas: 1 }],
  };

  it("soma os números e as contagens, mesmo com chaves diferentes", () => {
    const s = somarResumos([a, b]);
    expect(s.visitantes).toBe(15);
    expect(s.sessoes_abertura).toBe(6); // ausente em `b` conta zero
    expect(s.sessoes_oferta).toBe(4);
    expect(s.contagens).toEqual({ musica_play: 5, letra_refacao: 2 });
  });

  it("soma as entradas por caminho e reordena por visitantes", () => {
    expect(somarResumos([a, b]).por_entrada).toEqual([
      { caminho: "/criar", visitantes: 8, quiz: 7, letras: 3, vendas: 1 },
      { caminho: "/", visitantes: 7, quiz: 3, letras: 2, vendas: 1 },
    ]);
  });

  it("nada pra somar devolve o resumo zerado, nunca undefined", () => {
    expect(somarResumos([])).toEqual(resumoVazio());
  });

  it("não muda as partes", () => {
    const copia = JSON.parse(JSON.stringify(a));
    somarResumos([a, b]);
    expect(a).toEqual(copia);
  });
});
