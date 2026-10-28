import { describe, expect, it } from "vitest";
import { bracoRecusaRapida, grupoDoMotivo, naHoraDeAvisar, textoDaRecusa } from "./recusa-rapida";

describe("recusa_rapida", () => {
  it("agrupa os motivos que o Stripe devolveu em 21-27/10", () => {
    expect(grupoDoMotivo("do_not_honor")).toBe("banco");
    expect(grupoDoMotivo("try_again_later")).toBe("banco");
    expect(grupoDoMotivo("generic_decline")).toBe("banco");
    expect(grupoDoMotivo("insufficient_funds")).toBe("saldo");
    expect(grupoDoMotivo("incorrect_cvc")).toBe("dados");
    expect(grupoDoMotivo("requested_block_on_incorrect_cvc")).toBe("dados");
    expect(grupoDoMotivo("card_not_supported")).toBe("cartao");
    expect(grupoDoMotivo("transaction_not_allowed")).toBe("cartao");
    expect(grupoDoMotivo("highest_risk_level")).toBe("risco");
    expect(grupoDoMotivo("motivo_novo_que_ninguem_viu")).toBe("banco");
    expect(grupoDoMotivo(null)).toBe("banco");
  });

  it("não ajuda a passar cartão roubado ou fraude declarada", () => {
    for (const m of ["stolen_card", "lost_card", "pickup_card", "fraudulent"]) expect(grupoDoMotivo(m)).toBeNull();
  });

  it("avisa entre 10 minutos e 2 horas depois da última recusa", () => {
    const agora = Date.parse("2026-10-28T15:00:00Z");
    expect(naHoraDeAvisar(agora - 5 * 60000, agora)).toBe(false);
    expect(naHoraDeAvisar(agora - 10 * 60000, agora)).toBe(true);
    expect(naHoraDeAvisar(agora - 119 * 60000, agora)).toBe(true);
    expect(naHoraDeAvisar(agora - 121 * 60000, agora)).toBe(false);
  });

  it("o OXXO aparece só pro México e só em espanhol", () => {
    expect(textoDaRecusa("banco", "es", true).lembrete).toContain("OXXO");
    expect(textoDaRecusa("banco", "es", false).lembrete).not.toContain("OXXO");
    expect(textoDaRecusa("banco", "en", true).lembrete).not.toContain("OXXO");
  });

  it("nenhum texto fala de bancos dos EUA nem usa travessão", () => {
    for (const g of ["banco", "saldo", "dados", "cartao", "risco"] as const) {
      for (const [l, mx] of [["es", true], ["es", false], ["en", false]] as const) {
        const t = textoDaRecusa(g, l, mx);
        expect(`${t.corpo} ${t.lembrete}`).not.toMatch(/EE\. UU\.|US banks|—/);
      }
    }
  });

  it("braço pelo 7º caractere do fim, separado do 6º (`quase_comprou` com recusa)", () => {
    expect(bracoRecusaRapida("00000000-0000-0000-0000-000000000000")).toBe("A");
    expect(bracoRecusaRapida("00000000-0000-0000-0000-000001000000")).toBe("B");
    expect(bracoRecusaRapida("00000000-0000-0000-0000-000000100000")).toBe("A");
  });
});
