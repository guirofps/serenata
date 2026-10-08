import { describe, expect, it } from "vitest";
import {
  ESPERA_TOQUE_2_H,
  dataBr,
  diaMes,
  estadoDosToques,
  prazoDoToque1,
  proximoToquePrazo,
  type EstadoPrazo,
} from "./recuperacao-prazo";
import { centavosComCupom, codigoAplicado, codigoComPrazo, descontoNaTela } from "./cupom";
import { assuntoPrazo, emailPrazo, textoPrazo } from "../../emails/recuperacao-prazo";

const H = 3600000;
const agora = Date.parse("2026-10-08T15:00:00Z"); // 12h de Brasília

const estado = (o: Partial<EstadoPrazo> = {}): EstadoPrazo => ({
  numero: 1,
  quando: agora - 25 * H,
  toques: {},
  temEscadaAntiga: false,
  ...o,
});

describe("proximoToquePrazo", () => {
  it("toque 1 no dia seguinte ao último e-mail", () => {
    expect(proximoToquePrazo(estado({ quando: agora - 23 * H }), agora)).toEqual({ tipo: "esperar" });
    expect(proximoToquePrazo(estado({ quando: agora - 24 * H }), agora)).toEqual({ tipo: "toque", toque: 1, numero: 2 });
  });

  it("quem recebeu quase_comprou ou pix_nao_pago (degrau 2) também entra no toque 1", () => {
    expect(proximoToquePrazo(estado({ numero: 2 }), agora)).toEqual({ tipo: "toque", toque: 1, numero: 2 });
  });

  it("toque 2, o último lembrete, 48h depois do 1", () => {
    const t1 = agora - 47 * H;
    expect(proximoToquePrazo(estado({ numero: 2, quando: t1, toques: { 1: t1 } }), agora)).toEqual({ tipo: "esperar" });
    const t1b = agora - ESPERA_TOQUE_2_H * H;
    expect(proximoToquePrazo(estado({ numero: 2, quando: t1b, toques: { 1: t1b } }), agora)).toEqual({
      tipo: "toque",
      toque: 2,
      numero: 3,
    });
  });

  it("o toque 2 espera 24h de qualquer outro e-mail (um lembrete do PIX no meio)", () => {
    const t1 = agora - 50 * H;
    expect(proximoToquePrazo(estado({ numero: 2, quando: agora - 3 * H, toques: { 1: t1 } }), agora)).toEqual({
      tipo: "esperar",
    });
  });

  it("depois do toque 2, nada", () => {
    expect(proximoToquePrazo(estado({ numero: 3, toques: { 1: agora - 100 * H, 2: agora - 50 * H } }), agora)).toEqual({
      tipo: "esperar",
    });
  });

  it("quem já estava na escada antiga termina nela", () => {
    expect(proximoToquePrazo(estado({ numero: 2, temEscadaAntiga: true }), agora)).toEqual({ tipo: "escada" });
  });

  it("régua já no fim (3) por outro caminho não recomeça", () => {
    expect(proximoToquePrazo(estado({ numero: 3 }), agora)).toEqual({ tipo: "esperar" });
  });
});

describe("estadoDosToques", () => {
  it("separa os toques do B da escada antiga", () => {
    const m = estadoDosToques([
      { event_name: "email_letra_enviado", event_data: { quiz_response_id: "q1" }, created_at: "2026-10-01T00:00:00Z" },
      {
        event_name: "email_sequencia_enviado",
        event_data: { quiz_response_id: "q1", numero: 2, variante: "prazo", toque: 1 },
        created_at: "2026-10-02T00:00:00Z",
      },
      {
        event_name: "email_sequencia_enviado",
        event_data: { quiz_response_id: "q2", numero: 2 },
        created_at: "2026-10-02T00:00:00Z",
      },
    ]);
    expect(m.get("q1")).toEqual({ toques: { 1: Date.parse("2026-10-02T00:00:00Z") }, temEscadaAntiga: false });
    expect(m.get("q2")).toEqual({ toques: {}, temEscadaAntiga: true });
  });
});

describe("o prazo é de verdade", () => {
  it("vale até 23h59 de AMANHÃ em Brasília, e não depois", () => {
    const prazo = prazoDoToque1(agora);
    expect(prazo).toBe("2026-10-09");
    const codigo = codigoComPrazo(prazo);
    expect(codigo).toBe("SRN27P261009");
    expect(centavosComCupom(3800, codigo, new Date(agora))).toBe(2800);
    expect(centavosComCupom(3800, codigo, new Date("2026-10-09T23:59:00-03:00"))).toBe(2800);
    expect(centavosComCupom(3800, codigo, new Date("2026-10-10T00:00:01-03:00"))).toBe(3800);
  });

  it("às 22h de Brasília, 'amanhã' ainda é o dia seguinte de Brasília", () => {
    const tarde = Date.parse("2026-10-08T22:00:00-03:00"); // 01h UTC do dia 9
    expect(dataBr(tarde)).toBe("2026-10-08");
    expect(prazoDoToque1(tarde)).toBe("2026-10-09");
  });

  it("o toque 2 sai SEMPRE depois do fim do prazo do toque 1", () => {
    for (let h = 0; h < 24; h++) {
      const envio1 = Date.parse("2026-10-08T00:00:00-03:00") + h * H + 59 * 60000;
      const fim = Date.parse(`${prazoDoToque1(envio1)}T23:59:59-03:00`);
      expect(envio1 + ESPERA_TOQUE_2_H * H).toBeGreaterThan(fim);
      // E o toque 1 sempre dá pelo menos 24h de desconto.
      expect(fim - envio1).toBeGreaterThanOrEqual(24 * H);
    }
  });

  it("a venda grava o código com prazo; a tela mostra SRN27", () => {
    const codigo = codigoComPrazo("2026-10-09");
    expect(codigoAplicado(3800, codigo, new Date(agora))).toBe("SRN27P261009");
    expect(descontoNaTela(codigo, "pt", 3800, "musica", new Date(agora))).toMatchObject({
      codigo: "SRN27",
      por: "R$ 28",
      porCentavos: 2800,
    });
  });
});

describe("a copy da oferta com prazo", () => {
  const link = "https://www.serenatagift.com/retomar?s=abc&cupom=SRN27P261009&de=prazo1";
  const args = { nome: "Ana", prazo: "2026-10-09", link, linkDescadastro: "https://x/descadastrar" };

  it("o assunto do toque 1 é o combinado, e o do 2 é o último lembrete", () => {
    expect(assuntoPrazo(1, "Ana")).toBe("Sua música está guardada. R$ 28 até amanhã");
    expect(assuntoPrazo(2, "Ana")).toBe("Último lembrete sobre a música de Ana");
  });

  it("o toque 1 escreve o dia e a hora do fim do prazo", () => {
    expect(diaMes("2026-10-09")).toBe("09/10");
    const html = emailPrazo({ toque: 1, ...args });
    expect(html).toContain("09/10 às 23h59");
    expect(html).toContain(link);
    expect(textoPrazo({ toque: 1, ...args })).toContain("09/10 às 23h59");
  });

  it("o toque 2 não oferece o R$ 28 de novo: diz que acabou", () => {
    const html = emailPrazo({ toque: 2, ...args });
    expect(html).toContain("terminou");
    expect(html).not.toContain("Levar por R$ 28");
  });

  it("sem travessão e sem {nome} cru", () => {
    for (const t of [1, 2] as const) {
      const tudo = [assuntoPrazo(t, "Ana"), emailPrazo({ toque: t, ...args, verso: "linha um\nlinha dois" }), textoPrazo({ toque: t, ...args })].join(" ");
      expect(tudo).not.toContain("—");
      expect(tudo).not.toContain("{nome}");
      expect(tudo).not.toContain("undefined");
    }
  });
});
