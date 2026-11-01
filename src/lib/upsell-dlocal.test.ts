import { describe, expect, it } from "vitest";
import {
  BOTAO_SEM_CARTAO,
  bracoUpsellDlocal,
  lerOrderIdUpsell,
  lerVoltaUpsell,
  orderIdUpsellDlocal,
  paisVendeUpsellDlocal,
  semCartaoNaFolha,
} from "./upsell-dlocal";
import { bracoExtraBallad } from "./extra-ballad";

const UUID = "b1c2d3e4-0000-4000-8000-000000000000";

describe("teste upsell_dlocal", () => {
  it("o braço sai do 2º caractere do fim, pela paridade", () => {
    expect(bracoUpsellDlocal("aaa1f")).toBe("B");
    expect(bracoUpsellDlocal("aaa2f")).toBe("A");
    expect(bracoUpsellDlocal("")).toBe("A");
    expect(bracoUpsellDlocal("zzzzz")).toBe("A");
    expect(bracoUpsellDlocal(null)).toBe("A");
  });

  it("não anda junto com o extra_ballad, que usa o 3º caractere", () => {
    expect(bracoUpsellDlocal("aa21f")).toBe("B");
    expect(bracoExtraBallad("aa21f")).toBe("A");
  });

  it("só nos países da dLocal: EUA, Espanha e desconhecido ficam de fora", () => {
    for (const p of ["MX", "CO", "CL", "PE", "mx"]) expect(paisVendeUpsellDlocal(p)).toBe(true);
    for (const p of ["US", "ES", "BR", "", null, undefined]) expect(paisVendeUpsellDlocal(p)).toBe(false);
  });

  it("o botão precisa do braço, do país e do espanhol", () => {
    expect(semCartaoNaFolha({ tokenEdicao: "aaa1f", pais: "MX", locale: "es" })).toBe(true);
    expect(semCartaoNaFolha({ tokenEdicao: "aaa2f", pais: "MX", locale: "es" })).toBe(false);
    expect(semCartaoNaFolha({ tokenEdicao: "aaa1f", pais: "US", locale: "es" })).toBe(false);
    expect(semCartaoNaFolha({ tokenEdicao: "aaa1f", pais: "MX", locale: "en" })).toBe(false);
  });

  it("todo país que vende tem o texto do botão", () => {
    for (const p of ["MX", "CO", "CL", "PE"]) expect(BOTAO_SEM_CARTAO[p]).toMatch(/Sin tarjeta/);
  });
});

describe("order_id do upsell", () => {
  it("só usa o que a dLocal aceita (letras, números, hífen, sublinhado)", () => {
    expect(orderIdUpsellDlocal("video", UUID, 1792800000000)).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
  });

  it("vai e volta com a oferta e a música", () => {
    expect(lerOrderIdUpsell(orderIdUpsellDlocal("extra", UUID))).toEqual({ oferta: "extra", musicaId: UUID });
    expect(lerOrderIdUpsell(orderIdUpsellDlocal("video", UUID))).toEqual({ oferta: "video", musicaId: UUID });
  });

  it("o id da música (quiz-hora) e lixo não viram upsell", () => {
    expect(lerOrderIdUpsell(`${UUID}-abc123`)).toBeNull();
    expect(lerOrderIdUpsell(`up-quadro-${UUID}-abc`)).toBeNull();
    expect(lerOrderIdUpsell(`up-video-nao-e-uuid-abc`)).toBeNull();
    expect(lerOrderIdUpsell(undefined)).toBeNull();
  });

  it("não carrega o token de edição", () => {
    expect(orderIdUpsellDlocal("video", UUID)).not.toContain("token");
  });
});

describe("a volta do pagamento", () => {
  it("lê o que a folha guardou", () => {
    expect(lerVoltaUpsell(JSON.stringify({ tokenEdicao: "abc", oferta: "video" }))).toEqual({ tokenEdicao: "abc", oferta: "video" });
  });
  it("recusa o que não é dela", () => {
    expect(lerVoltaUpsell(null)).toBeNull();
    expect(lerVoltaUpsell("{quebrado")).toBeNull();
    expect(lerVoltaUpsell(JSON.stringify({ tokenEdicao: "abc", oferta: "quadro" }))).toBeNull();
    expect(lerVoltaUpsell(JSON.stringify({ oferta: "video" }))).toBeNull();
  });
});
