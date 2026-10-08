import { describe, expect, it } from "vitest";
import {
  EXP_OUTRA_MUSICA_24H,
  JANELA_OUTRA_MUSICA_MS,
  horasDesdeCompra,
  msRestantesOutraMusica,
  textoRestanteOutraMusica,
} from "./janela-outra-musica";
import { EXPERIMENTOS } from "./experimentos";

const PAGO = "2026-10-08T12:00:00.000Z";
const T0 = Date.parse(PAGO);
const MIN = 60_000;
const H = 60 * MIN;

describe("msRestantesOutraMusica", () => {
  it("logo depois do pagamento falta a janela inteira", () => {
    expect(msRestantesOutraMusica(PAGO, T0)).toBe(JANELA_OUTRA_MUSICA_MS);
  });

  it("conta a partir do pagamento", () => {
    expect(msRestantesOutraMusica(PAGO, T0 + 10 * H)).toBe(14 * H);
  });

  it("some exatamente em 24h e depois", () => {
    expect(msRestantesOutraMusica(PAGO, T0 + 24 * H - 1)).toBe(1);
    expect(msRestantesOutraMusica(PAGO, T0 + 24 * H)).toBeNull();
    expect(msRestantesOutraMusica(PAGO, T0 + 3 * 24 * H)).toBeNull();
  });

  it("relógio atrasado (pagamento no futuro) nunca passa de 24h", () => {
    expect(msRestantesOutraMusica(PAGO, T0 - 2 * H)).toBe(JANELA_OUTRA_MUSICA_MS);
  });

  it("sem data ou data inválida: não mostra", () => {
    expect(msRestantesOutraMusica(null, T0)).toBeNull();
    expect(msRestantesOutraMusica(undefined, T0)).toBeNull();
    expect(msRestantesOutraMusica("", T0)).toBeNull();
    expect(msRestantesOutraMusica("ontem", T0)).toBeNull();
  });

  it("aceita Date e número", () => {
    expect(msRestantesOutraMusica(new Date(T0), T0 + H)).toBe(23 * H);
    expect(msRestantesOutraMusica(T0, T0 + H)).toBe(23 * H);
  });
});

describe("textoRestanteOutraMusica", () => {
  it("horas e minutos", () => {
    expect(textoRestanteOutraMusica(23 * H + 5 * MIN)).toBe("23h 5min");
  });
  it("hora cheia sem minutos", () => {
    expect(textoRestanteOutraMusica(24 * H)).toBe("24h");
  });
  it("só minutos abaixo de 1h", () => {
    expect(textoRestanteOutraMusica(45 * MIN)).toBe("45min");
  });
  it("arredonda pra cima e nunca diz 0min", () => {
    expect(textoRestanteOutraMusica(30_000)).toBe("1min");
    expect(textoRestanteOutraMusica(1)).toBe("1min");
    expect(textoRestanteOutraMusica(59 * MIN + 1)).toBe("1h");
  });
});

describe("horasDesdeCompra", () => {
  it("horas inteiras, nunca negativas", () => {
    expect(horasDesdeCompra(PAGO, T0 + 90 * MIN)).toBe(1);
    expect(horasDesdeCompra(PAGO, T0 - H)).toBe(0);
    expect(horasDesdeCompra(null, T0)).toBeNull();
    expect(horasDesdeCompra("x", T0)).toBeNull();
  });
});

describe("experimento outra_musica_24h", () => {
  it("existe no chão do código, desligado e 50/50", () => {
    const e = EXPERIMENTOS.find((x) => x.id === EXP_OUTRA_MUSICA_24H);
    expect(e?.variantes).toEqual(["A", "B"]);
    expect(e?.peso).toEqual([1, 1]);
    expect(e?.ativo).toBe(false);
  });
});
