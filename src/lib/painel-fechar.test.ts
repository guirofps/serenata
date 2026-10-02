import { describe, expect, it } from "vitest";
import { fecharDias, type DepsFechamento } from "./painel-fechar";
import { resumoVazio, type FiltroFunil } from "./painel-resumo";

// O LAÇO DO CRON. Banco e relógio injetados: o que se testa é a ordem, o
// prazo e o que acontece quando um dia dá errado.

function deps(
  opcoes: { falharEm?: { dia?: string; filtro?: FiltroFunil }; passoMs?: number } = {},
) {
  let relogio = 0;
  const gravados: string[] = [];
  const pedidosSessao: Record<string, string[]> = {};
  const d: DepsFechamento = {
    agora: () => relogio,
    lerLeads: async () => [
      { id: "q1", session_id: "s1", locale: "pt" },
      { id: "q2", session_id: "s2", locale: "es" },
    ],
    lerPedidos: async () => [
      { quiz_response_id: "q1", status: "pago" },
      { quiz_response_id: "q2", status: "pago" },
    ],
    resumir: async (f, filtro, sessoes) => {
      relogio += opcoes.passoMs ?? 1;
      const dia = f.inicio.toISOString().slice(0, 10);
      pedidosSessao[`${dia}:${filtro}`] = sessoes;
      const falha = opcoes.falharEm;
      if (
        falha &&
        (!falha.filtro || falha.filtro === filtro) &&
        (!falha.dia || f.inicio.toISOString().startsWith(falha.dia))
      ) {
        throw new Error("statement timeout");
      }
      return resumoVazio();
    },
    gravar: async (dia, filtro) => {
      gravados.push(`${dia}:${filtro}`);
    },
  };
  return { d, gravados, pedidosSessao };
}

describe("fecharDias", () => {
  it("grava os três filtros de cada dia, com as sessões compradoras de cada filtro", async () => {
    const { d, gravados, pedidosSessao } = deps();
    const r = await fecharDias(d, ["2026-09-30", "2026-10-01"], 200_000);
    expect(r).toEqual({ feitos: ["2026-09-30", "2026-10-01"], falhas: [], pendentes: [] });
    expect(gravados).toEqual([
      "2026-09-30:todos",
      "2026-09-30:pt",
      "2026-09-30:es",
      "2026-10-01:todos",
      "2026-10-01:pt",
      "2026-10-01:es",
    ]);
    expect(pedidosSessao["2026-09-30:es"]).toEqual(["s2"]);
    expect(pedidosSessao["2026-09-30:pt"]).toEqual(["s1"]);
  });

  it("um dia que falha é registrado e o laço segue pro próximo", async () => {
    const { d, gravados } = deps({ falharEm: { dia: "2026-09-30" } });
    const r = await fecharDias(d, ["2026-09-30", "2026-10-01"], 200_000);
    expect(r.feitos).toEqual(["2026-10-01"]);
    expect(r.falhas).toEqual([{ dia: "2026-09-30", erro: "statement timeout" }]);
    expect(gravados.filter((g) => g.startsWith("2026-09-30"))).toEqual([]);
  });

  it("falha no terceiro filtro deixa o dia incompleto, e ele não conta como feito", async () => {
    const { d, gravados } = deps({ falharEm: { dia: "2026-09-30", filtro: "es" } });
    const r = await fecharDias(d, ["2026-09-30"], 200_000);
    expect(r.feitos).toEqual([]);
    expect(gravados).toEqual(["2026-09-30:todos", "2026-09-30:pt"]);
  });

  it("passado o prazo, não começa dia novo e devolve o resto como pendente", async () => {
    // Cada resumir anda 50 no relógio: 3 filtros = 150 por dia.
    const { d } = deps({ passoMs: 50 });
    const r = await fecharDias(d, ["2026-09-28", "2026-09-29", "2026-09-30"], 200);
    expect(r.feitos).toEqual(["2026-09-28", "2026-09-29"]);
    expect(r.pendentes).toEqual(["2026-09-30"]);
  });
});
