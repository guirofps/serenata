import { describe, expect, it } from "vitest";
import { oQueFazer, depoisDaConsulta, type LinhaAndando } from "./reserva-decisao";

const AGORA = Date.parse("2026-10-09T21:30:00Z");
const ha = (min: number) => new Date(AGORA - min * 60000).toISOString();
const linha = (p: Partial<LinhaAndando>): LinhaAndando => ({
  status: "aguardando",
  updated_at: ha(0),
  task_atual: null,
  task_em: null,
  reserva_em: null,
  reserva_tentativas: 0,
  ...p,
});

describe("oQueFazer", () => {
  it("música recém-criada é do Inngest", () => {
    expect(oQueFazer(linha({ updated_at: ha(1) }), AGORA)).toBe("nada");
  });

  it("aguardando intocada por 3 minutos: o Inngest não pegou, o reserva gera", () => {
    expect(oQueFazer(linha({ updated_at: ha(3) }), AGORA)).toBe("gerar");
  });

  it("pronta e falhou nunca são tocadas", () => {
    expect(oQueFazer(linha({ status: "pronta", updated_at: ha(60) }), AGORA)).toBe("nada");
    expect(oQueFazer(linha({ status: "falhou", updated_at: ha(60) }), AGORA)).toBe("nada");
  });

  it("gerando sem task: espera o job começar, depois assume", () => {
    expect(oQueFazer(linha({ status: "gerando", updated_at: ha(4) }), AGORA)).toBe("nada");
    expect(oQueFazer(linha({ status: "gerando", updated_at: ha(5) }), AGORA)).toBe("gerar");
  });

  it("gerando com task do job em andamento normal: não mexe", () => {
    expect(oQueFazer(linha({ status: "gerando", updated_at: ha(4), task_atual: "t", task_em: ha(4) }), AGORA)).toBe("nada");
  });

  it("task do job sem pronta há 8 minutos: vai conferir (sem pagar nada)", () => {
    expect(oQueFazer(linha({ status: "gerando", updated_at: ha(8), task_atual: "t", task_em: ha(8) }), AGORA)).toBe("acompanhar");
  });

  it("alguém acabou de mexer (ajuste, webhook): espera, mesmo com task velha", () => {
    expect(oQueFazer(linha({ status: "gerando", updated_at: ha(1), task_atual: "t", task_em: ha(30) }), AGORA)).toBe("nada");
  });

  it("do reserva com task: acompanha sempre", () => {
    expect(oQueFazer(linha({ status: "gerando", reserva_em: ha(1), task_atual: "t", task_em: ha(1), updated_at: ha(0) }), AGORA)).toBe("acompanhar");
  });

  it("do reserva sem task: assumiu e caiu antes de disparar, refaz depois de 3 min", () => {
    expect(oQueFazer(linha({ status: "gerando", reserva_em: ha(1) }), AGORA)).toBe("nada");
    expect(oQueFazer(linha({ status: "gerando", reserva_em: ha(3) }), AGORA)).toBe("gerar");
  });
});

describe("depoisDaConsulta", () => {
  it("task pronta é sempre terminada, de quem for", () => {
    expect(depoisDaConsulta(linha({ task_em: ha(9) }), "sucesso", AGORA)).toBe("finalizar");
    expect(depoisDaConsulta(linha({ reserva_em: ha(2), task_em: ha(1) }), "sucesso", AGORA)).toBe("finalizar");
  });

  it("falha do job: respeita o respiro dele antes de pagar outra", () => {
    expect(depoisDaConsulta(linha({ task_em: ha(10) }), "falhou", AGORA)).toBe("nada");
    expect(depoisDaConsulta(linha({ task_em: ha(15) }), "falhou", AGORA)).toBe("gerar");
  });

  it("task do job andando: provedor lento não é motivo pra pagar de novo", () => {
    expect(depoisDaConsulta(linha({ task_em: ha(10) }), "andando", AGORA)).toBe("nada");
    expect(depoisDaConsulta(linha({ task_em: ha(24) }), "andando", AGORA)).toBe("gerar");
  });

  it("task do reserva: até 2 gerações, depois desiste e deixa pra repescagem", () => {
    const minha = { reserva_em: ha(5), task_em: ha(2) };
    expect(depoisDaConsulta(linha({ ...minha, reserva_tentativas: 1 }), "falhou", AGORA)).toBe("gerar");
    expect(depoisDaConsulta(linha({ ...minha, reserva_tentativas: 2 }), "falhou", AGORA)).toBe("desistir");
    expect(depoisDaConsulta(linha({ ...minha, reserva_tentativas: 1 }), "andando", AGORA)).toBe("nada");
    expect(depoisDaConsulta(linha({ ...minha, task_em: ha(12), reserva_tentativas: 1 }), "andando", AGORA)).toBe("gerar");
  });
});
