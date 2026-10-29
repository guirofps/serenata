import { describe, expect, it } from "vitest";
import { comRetentativas } from "./retentar";

const semDormir = { dormir: async () => {} };

describe("comRetentativas", () => {
  it("deu certo de primeira: uma tentativa, nenhuma espera", async () => {
    const esperas: number[] = [];
    const r = await comRetentativas(async () => 7, [500, 2000, 5000], {
      dormir: async (ms) => void esperas.push(ms),
    });
    expect(r).toEqual({ ok: true, valor: 7, tentativas: 1 });
    expect(esperas).toEqual([]);
  });

  it("falha duas vezes e passa na terceira, esperando 0,5s e 2s", async () => {
    const esperas: number[] = [];
    let n = 0;
    const r = await comRetentativas(
      async () => {
        if (++n < 3) throw new Error("rede");
        return "ok";
      },
      [500, 2000, 5000],
      { dormir: async (ms) => void esperas.push(ms) },
    );
    expect(r).toEqual({ ok: true, valor: "ok", tentativas: 3 });
    expect(esperas).toEqual([500, 2000]);
  });

  it("esgota: 1 tentativa + 3 retentativas, devolve o último erro", async () => {
    let n = 0;
    const r = await comRetentativas(
      async () => {
        n++;
        throw new Error(`falha ${n}`);
      },
      [500, 2000, 5000],
      semDormir,
    );
    expect(n).toBe(4);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect((r.erro as Error).message).toBe("falha 4");
      expect(r.desistiu).toBe(false);
    }
  });

  it("desiste quando uma chamada mais nova já levou o dado", async () => {
    let n = 0;
    const r = await comRetentativas(
      async () => {
        n++;
        throw new Error("rede");
      },
      [500, 2000, 5000],
      { ...semDormir, desistir: () => n >= 2 },
    );
    expect(n).toBe(2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.desistiu).toBe(true);
  });
});
