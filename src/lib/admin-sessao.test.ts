import { describe, expect, it } from "vitest";
import { DURACAO_SESSAO_S, deveRenovarSessao } from "@/lib/admin-sessao";

const DIA = 24 * 60 * 60 * 1000;
const agora = Date.UTC(2026, 9, 28, 12);

describe("sessão do painel (28/10)", () => {
  it("dura 30 dias", () => {
    expect(DURACAO_SESSAO_S).toBe(30 * 24 * 60 * 60);
  });

  it("não renova o cookie que acabou de nascer (no máximo 1 renovação por dia)", () => {
    const expira = agora + DURACAO_SESSAO_S * 1000 - 60_000; // emitido há 1 min
    expect(deveRenovarSessao(expira, agora)).toBe(false);
  });

  it("renova quem usa o painel depois de mais de 1 dia", () => {
    const expira = agora + DURACAO_SESSAO_S * 1000 - DIA - 1;
    expect(deveRenovarSessao(expira, agora)).toBe(true);
  });

  it("renova até o último minuto antes de vencer", () => {
    expect(deveRenovarSessao(agora + 60_000, agora)).toBe(true);
  });

  it("nunca ressuscita sessão vencida", () => {
    expect(deveRenovarSessao(agora, agora)).toBe(false);
    expect(deveRenovarSessao(agora - DIA, agora)).toBe(false);
  });
});
