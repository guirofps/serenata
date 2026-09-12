import { describe, expect, it } from "vitest";
import { diaAsaasParaInstante } from "./asaas-pix";

// O `paid_at` decide em que dia a venda aparece no painel financeiro. O
// Asaas manda o dia do pagamento SEM hora, e gravar isso cru empurra a venda
// pro dia anterior em Brasília.

const diaEmBrasilia = (iso: string) =>
  new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 10);

describe("diaAsaasParaInstante", () => {
  it("mantém a venda no MESMO dia em Brasília", () => {
    // O caso real: pagamento às 23:57 de 11/09, que o Asaas informa só como dia.
    const r = diaAsaasParaInstante("2026-09-11");
    expect(r).not.toBeNull();
    expect(diaEmBrasilia(r!)).toBe("2026-09-11");
  });

  it("o erro que isto evita: o dia cru cai na véspera", () => {
    // Documenta o bug em vez de só confiar no conserto.
    expect(diaEmBrasilia("2026-09-11")).toBe("2026-09-10");
  });

  it("valor que já tem hora passa intacto", () => {
    expect(diaAsaasParaInstante("2026-09-11T23:57:00.000Z")).toBe("2026-09-11T23:57:00.000Z");
  });

  it("vazio ou lixo vira null, e o vigia usa a hora de agora", () => {
    expect(diaAsaasParaInstante(null)).toBeNull();
    expect(diaAsaasParaInstante(undefined)).toBeNull();
    expect(diaAsaasParaInstante("")).toBeNull();
    expect(diaAsaasParaInstante("ontem")).toBeNull();
  });
});
