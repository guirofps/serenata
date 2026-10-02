import { describe, expect, it } from "vitest";
import {
  fatiasDe,
  filtroCursor,
  lerJanela,
  PAGINA,
  type ConsultaFatia,
  type LinhaComCursor,
} from "./ler-janela";

// A LEITURA DO PAINEL. Substitui a paginação por OFFSET, que obrigava o banco
// a reordenar a janela inteira por um uuid aleatório a cada página.

type L = LinhaComCursor & { n: number };

/** Um banco de mentira que obedece ao mesmo contrato do PostgREST. */
function bancoFalso(linhas: L[]) {
  const chamadas: Array<{ desde: string; ate: string; cursor: unknown }> = [];
  const ordenadas = [...linhas].sort((a, b) =>
    a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1,
  );
  const consulta: ConsultaFatia<L> = async ({ desde, ate, cursor, limite }) => {
    chamadas.push({ desde, ate, cursor });
    const data = ordenadas
      .filter((l) => l.created_at >= desde && l.created_at < ate)
      .filter(
        (l) =>
          !cursor ||
          l.created_at > cursor.created_at ||
          (l.created_at === cursor.created_at && l.id > cursor.id),
      )
      .slice(0, limite);
    return { data, error: null };
  };
  return { consulta, chamadas };
}

const t = (iso: string) => new Date(iso);
const linha = (i: number, created_at: string): L => ({
  id: `id-${String(i).padStart(6, "0")}`,
  created_at,
  n: i,
});

describe("fatiasDe", () => {
  it("corta em pedaços de 24h a partir do início, e o último termina no fim", () => {
    expect(fatiasDe(t("2026-10-01T10:00:00.000Z"), t("2026-10-03T04:00:00.000Z"))).toEqual([
      { desde: "2026-10-01T10:00:00.000Z", ate: "2026-10-02T10:00:00.000Z" },
      { desde: "2026-10-02T10:00:00.000Z", ate: "2026-10-03T04:00:00.000Z" },
    ]);
  });

  it("janela vazia não tem fatia", () => {
    expect(fatiasDe(t("2026-10-01T10:00:00.000Z"), t("2026-10-01T10:00:00.000Z"))).toEqual([]);
  });
});

describe("filtroCursor", () => {
  it("põe o timestamp entre aspas e desempata por id", () => {
    // Sem aspas, o "+" e os ":" do fuso quebram o or=(...) do PostgREST.
    expect(filtroCursor({ created_at: "2026-10-01T12:34:56.123456+00:00", id: "abc" })).toBe(
      'created_at.gt."2026-10-01T12:34:56.123456+00:00",and(created_at.eq."2026-10-01T12:34:56.123456+00:00",id.gt.abc)',
    );
  });
});

describe("lerJanela", () => {
  it("janela sem linhas devolve lista vazia", async () => {
    const { consulta } = bancoFalso([]);
    expect(
      await lerJanela(consulta, t("2026-10-01T00:00:00.000Z"), t("2026-10-03T00:00:00.000Z")),
    ).toEqual([]);
  });

  it("fatia com mais de uma página anda pelo cursor sem repetir nem pular", async () => {
    const linhas = Array.from({ length: PAGINA * 2 + 7 }, (_, i) =>
      linha(i, `2026-10-01T05:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:00.000Z`),
    );
    const { consulta } = bancoFalso(linhas);
    const lidas = await lerJanela(
      consulta,
      t("2026-10-01T00:00:00.000Z"),
      t("2026-10-02T00:00:00.000Z"),
    );
    expect(lidas).toHaveLength(linhas.length);
    expect(new Set(lidas.map((l) => l.id)).size).toBe(linhas.length);
  });

  it("empate de created_at maior que uma página desempata por id", async () => {
    // Mil e poucas linhas no MESMO instante: sem o id no cursor, a segunda
    // página repetiria a primeira pra sempre.
    const linhas = Array.from({ length: PAGINA + 3 }, (_, i) =>
      linha(i, "2026-10-01T05:00:00.000Z"),
    );
    const { consulta } = bancoFalso(linhas);
    const lidas = await lerJanela(
      consulta,
      t("2026-10-01T00:00:00.000Z"),
      t("2026-10-02T00:00:00.000Z"),
    );
    expect(lidas).toHaveLength(PAGINA + 3);
  });

  it("junta as fatias de dias diferentes", async () => {
    const linhas = [linha(1, "2026-10-01T05:00:00.000Z"), linha(2, "2026-10-02T05:00:00.000Z")];
    const { consulta, chamadas } = bancoFalso(linhas);
    const lidas = await lerJanela(
      consulta,
      t("2026-10-01T00:00:00.000Z"),
      t("2026-10-03T00:00:00.000Z"),
    );
    expect(lidas.map((l) => l.n).sort()).toEqual([1, 2]);
    expect(chamadas).toHaveLength(2);
  });

  it("erro numa fatia lança, como antes", async () => {
    const consulta: ConsultaFatia<L> = async () => ({
      data: null,
      error: { message: "statement timeout" },
    });
    await expect(
      lerJanela(consulta, t("2026-10-01T00:00:00.000Z"), t("2026-10-02T00:00:00.000Z")),
    ).rejects.toThrow("statement timeout");
  });

  it("cursor parado lança em vez de girar pra sempre", async () => {
    // Página cheia que ignora o cursor: devolve sempre as mesmas linhas.
    const cheia = Array.from({ length: PAGINA }, (_, i) => linha(i, "2026-10-01T05:00:00.000Z"));
    const consulta: ConsultaFatia<L> = async () => ({ data: cheia, error: null });
    await expect(
      lerJanela(consulta, t("2026-10-01T00:00:00.000Z"), t("2026-10-02T00:00:00.000Z")),
    ).rejects.toThrow(/cursor parado/);
  });
});
