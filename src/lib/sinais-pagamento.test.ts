import { describe, expect, it } from "vitest";
import { trilhoMudo, type DiagnosticoPagamento } from "./sinais-pagamento";

const base: DiagnosticoPagamento = {
  minutosSemPagamento: 5,
  pixGeradosNaJanela: 8,
  maduras: 6,
};

describe("trilhoMudo", () => {
  it("cala num dia normal", () => {
    expect(trilhoMudo(base).avisar).toBe(false);
  });

  it("acende no cenário real de 11/09", () => {
    // Entre 16:44 e 17:30: 46 minutos sem pagamento, 6 PIX gerados.
    const r = trilhoMudo({ minutosSemPagamento: 46, pixGeradosNaJanela: 6, maduras: 4 });
    expect(r.avisar).toBe(true);
    expect(r.motivo).toContain("46 min");
    expect(r.motivo).toContain("6 PIX");
  });

  it("DORME de madrugada, que é o ponto mais importante", () => {
    // 3h da manhã: duas horas sem pagamento porque não tem ninguém no site.
    // Sem esta regra o alarme tocaria toda noite e viraria e-mail não lido.
    expect(trilhoMudo({ minutosSemPagamento: 120, pixGeradosNaJanela: 1, maduras: 1 }).avisar).toBe(false);
    expect(trilhoMudo({ minutosSemPagamento: 300, pixGeradosNaJanela: 0, maduras: 0 }).avisar).toBe(false);
  });

  it("não acende só porque tem muito PIX sendo gerado", () => {
    // Movimento alto e pagamento entrando: é o melhor cenário possível.
    expect(trilhoMudo({ minutosSemPagamento: 2, pixGeradosNaJanela: 40, maduras: 3 }).avisar).toBe(false);
  });

  it("banco sem nenhum pagamento na história não é queda", () => {
    expect(trilhoMudo({ minutosSemPagamento: null, pixGeradosNaJanela: 20, maduras: 20 }).avisar).toBe(false);
  });

  it("respeita a fronteira dos 40 minutos", () => {
    expect(trilhoMudo({ ...base, minutosSemPagamento: 39 }).avisar).toBe(false);
    expect(trilhoMudo({ ...base, minutosSemPagamento: 40 }).avisar).toBe(true);
  });

  it("respeita a fronteira das 5 cobranças", () => {
    expect(trilhoMudo({ minutosSemPagamento: 90, pixGeradosNaJanela: 4, maduras: 4 }).avisar).toBe(false);
    expect(trilhoMudo({ minutosSemPagamento: 90, pixGeradosNaJanela: 5, maduras: 5 }).avisar).toBe(true);
  });
});
