import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { podeGerar } from "../../inngest/lib/disjuntor";

// O DISJUNTOR, testado onde dói: no que ele NÃO bloqueia.
//
// Mora em `src/lib/` pelo mesmo motivo de `vercel-rotas.test.ts` — é só onde o
// vitest varre (`vitest.config.ts`), não porque tenha a ver com `lib`.
//
// O teste que mais importa é o do comprador: um teto que barra quem pagou
// troca R$ 0,32 de prejuízo por um reembolso e uma avaliação ruim, que é o
// oposto do que ele existe pra fazer.

/**
 * Um Supabase de mentira, com só o que `podeGerar` toca: `from().select()...`
 * pra ler pedido, e `rpc()` pro contador. Guarda as chamadas pra o teste poder
 * afirmar que o contador NÃO foi consumido no caminho do pago.
 */
function fakeSb(opts: { pago?: boolean; cabe?: boolean; erroRpc?: string; erroPedido?: boolean }) {
  const rpcs: Array<{ chave: string; teto: number }> = [];
  const sb = {
    from() {
      const cadeia = {
        select: () => cadeia,
        eq: () => cadeia,
        limit: () => cadeia,
        maybeSingle: async () => {
          if (opts.erroPedido) throw new Error("banco fora do ar");
          return { data: opts.pago ? { id: "ped_1" } : null };
        },
      };
      return cadeia;
    },
    async rpc(_nome: string, args: { p_chave: string; p_teto: number }) {
      rpcs.push({ chave: args.p_chave, teto: args.p_teto });
      if (opts.erroRpc) return { data: null, error: { message: opts.erroRpc } };
      // O alerta tem teto 1 e caminho próprio; só o contador do dia responde
      // ao `cabe` do teste.
      if (args.p_chave.startsWith("alerta-")) return { data: true, error: null };
      return { data: opts.cabe ?? true, error: null };
    },
  };
  // O tipo real do SupabaseClient é grande demais pra reproduzir; o que
  // interessa aqui é o comportamento das duas chamadas acima.
  return { sb: sb as never, rpcs };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.TETO_MUSICAS_DIA;
  vi.restoreAllMocks();
});

describe("podeGerar — o disjuntor de gasto do Suno", () => {
  it("QUEM PAGOU passa mesmo com o teto estourado", async () => {
    const { sb } = fakeSb({ pago: true, cabe: false });
    await expect(podeGerar(sb, "quiz_1")).resolves.toEqual({ ok: true });
  });

  it("quem pagou não CONSOME o orçamento — senão um dia de vendas desligaria o funil", async () => {
    const { sb, rpcs } = fakeSb({ pago: true, cabe: true });
    await podeGerar(sb, "quiz_1");
    expect(rpcs).toEqual([]);
  });

  it("quem não pagou passa enquanto cabe no dia, e consome o contador", async () => {
    const { sb, rpcs } = fakeSb({ pago: false, cabe: true });
    await expect(podeGerar(sb, "quiz_1")).resolves.toEqual({ ok: true });
    expect(rpcs.map((r) => r.chave.split(":")[0])).toEqual(["musica-dia"]);
  });

  it("quem não pagou é barrado quando o dia estourou", async () => {
    const { sb } = fakeSb({ pago: false, cabe: false });
    const r = await podeGerar(sb, "quiz_1");
    expect(r.ok).toBe(false);
  });

  it("o teto vem do env, pra ajustar sem deploy", async () => {
    process.env.TETO_MUSICAS_DIA = "50";
    const { sb, rpcs } = fakeSb({ pago: false, cabe: true });
    await podeGerar(sb, "quiz_1");
    expect(rpcs[0].teto).toBe(50);
  });

  it("env inválido cai no padrão em vez de virar teto zero", async () => {
    process.env.TETO_MUSICAS_DIA = "abacaxi";
    const { sb, rpcs } = fakeSb({ pago: false, cabe: true });
    await podeGerar(sb, "quiz_1");
    expect(rpcs[0].teto).toBe(300);
  });

  it("FALHA ABERTA: contador ilegível libera a geração", async () => {
    // Inclui o caso de a migration ainda não ter rodado. Melhor gerar demais
    // que parar de entregar por soluço de banco — o log grita.
    const { sb } = fakeSb({ pago: false, erroRpc: "function does not exist" });
    await expect(podeGerar(sb, "quiz_1")).resolves.toEqual({ ok: true });
  });

  it("FALHA ABERTA: se não dá pra saber se pagou, entrega", async () => {
    const { sb } = fakeSb({ erroPedido: true, cabe: false });
    await expect(podeGerar(sb, "quiz_1")).resolves.toEqual({ ok: true });
  });

  it("sessão sem lead ainda passa pelo teto — é justamente o caminho do robô", async () => {
    const { sb, rpcs } = fakeSb({ cabe: false });
    const r = await podeGerar(sb, null);
    expect(r.ok).toBe(false);
    expect(rpcs[0].chave.startsWith("musica-dia:")).toBe(true);
  });

  it("a chave do contador é o DIA no fuso do Brasil", async () => {
    const { sb, rpcs } = fakeSb({ cabe: true });
    await podeGerar(sb, null);
    const hojeBr = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    expect(rpcs[0].chave).toBe(`musica-dia:${hojeBr}`);
  });
});
