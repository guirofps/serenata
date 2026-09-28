import { describe, expect, it } from "vitest";
import { ESCADA_MIN_LETRAS_48H, escadaMuda } from "./sinais-email";

describe("escadaMuda", () => {
  it("avisa quando há tráfego e a escada não mandou nada", () => {
    const r = escadaMuda({ enviosNasUltimasHoras: 0, letras48h: 800 });
    expect(r.avisar).toBe(true);
    expect(r.motivo).toContain("800 letras");
  });

  it("não avisa quando a escada está mandando", () => {
    expect(escadaMuda({ enviosNasUltimasHoras: 3, letras48h: 800 }).avisar).toBe(false);
  });

  it("dorme sem tráfego: pouca letra não exige escada", () => {
    expect(escadaMuda({ enviosNasUltimasHoras: 0, letras48h: ESCADA_MIN_LETRAS_48H - 1 }).avisar).toBe(false);
  });
});
