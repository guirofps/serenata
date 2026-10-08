import { describe, expect, it } from "vitest";
import { TETO_MARKETING_24H, cabeMaisUmMarketing, contarMarketing } from "./limite-frequencia";

const agora = Date.parse("2026-10-08T15:00:00Z");
const horasAtras = (h: number) => new Date(agora - h * 3600000).toISOString();
const envio = (template: string, h: number) => ({ template, created_at: horasAtras(h) });

describe("contarMarketing", () => {
  it("conta só o que está nas últimas 24h", () => {
    expect(contarMarketing([envio("escada_2", 1), envio("quase_comprou", 23.9), envio("escada_3", 24.1)], agora)).toBe(2);
  });

  it("transacional não conta", () => {
    const linhas = ["entrega", "entrega_em_producao", "entrega_credito", "video_pronto"].map((t) => envio(t, 1));
    expect(contarMarketing(linhas, agora)).toBe(0);
  });

  it("a letra e o 1º lembrete do PIX contam só do segundo em diante", () => {
    expect(contarMarketing([envio("letra_pronta", 2)], agora)).toBe(0);
    expect(contarMarketing([envio("letra_pronta", 2), envio("letra_pronta", 1)], agora)).toBe(1);
    expect(contarMarketing([envio("pix_nao_pago", 20), envio("pix_nao_pago", 1)], agora)).toBe(1);
    // A letra e o PIX não dividem a mesma isenção.
    expect(contarMarketing([envio("letra_pronta", 3), envio("pix_nao_pago", 2)], agora)).toBe(0);
  });

  it("template vazio ou desconhecido conta (na dúvida, é marketing)", () => {
    expect(contarMarketing([{ template: null, created_at: horasAtras(1) }, envio("ocasiao_maes_2027", 1)], agora)).toBe(2);
  });

  it("data ilegível não conta nem quebra", () => {
    expect(contarMarketing([{ template: "escada_2", created_at: "ontem" }], agora)).toBe(0);
  });
});

describe("cabeMaisUmMarketing", () => {
  it(`o teto é ${TETO_MARKETING_24H} em 24h`, () => {
    expect(TETO_MARKETING_24H).toBe(2);
    expect(cabeMaisUmMarketing([], agora)).toBe(true);
    expect(cabeMaisUmMarketing([envio("escada_2", 1)], agora)).toBe(true);
    expect(cabeMaisUmMarketing([envio("escada_2", 1), envio("quase_comprou", 5)], agora)).toBe(false);
    // Letra + entrega + dois de marketing: barrado.
    expect(
      cabeMaisUmMarketing(
        [envio("letra_pronta", 10), envio("entrega", 9), envio("guarde_o_link", 3), envio("indicacao_convite", 2)],
        agora,
      ),
    ).toBe(false);
  });

  it("a janela anda: o que saiu há mais de 24h libera a vaga", () => {
    expect(cabeMaisUmMarketing([envio("escada_2", 25), envio("quase_comprou", 1)], agora)).toBe(true);
  });
});
