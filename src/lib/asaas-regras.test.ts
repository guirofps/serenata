import { describe, expect, it } from "vitest";
import {
  decidirCobrancaExistente,
  eventoDeEstorno,
  outroPagamentoDoQuiz,
  quizDaReferencia,
  statusConfirmaEstorno,
} from "./asaas-regras";

// As decisões de dinheiro do Asaas (08/10). O caso real que motivou tudo: o
// quiz bb9effb8… pagou R$ 38 em 03/10 e de novo em 06/10, pelo QR de 01/10
// que tinha vencido e continuava pagável.

const QUIZ = "bb9effb8-1234-4abc-9def-0123456789ab";

describe("quizDaReferencia", () => {
  it("lê o quiz de toda referência do funil", () => {
    expect(quizDaReferencia(`serenata:${QUIZ}`)).toBe(QUIZ);
    expect(quizDaReferencia(`serenata:${QUIZ}:q`)).toBe(QUIZ);
    expect(quizDaReferencia(`serenata:${QUIZ}:c:i:d`)).toBe(QUIZ);
    expect(quizDaReferencia(`serenata:${QUIZ}:e2`)).toBe(QUIZ);
    // A referência com sufixo de valor que o Asaas já tem em produção.
    expect(quizDaReferencia(`serenata:${QUIZ}:v3800`)).toBe(QUIZ);
  });

  it("upsell, lixo e vazio não viram quiz", () => {
    expect(quizDaReferencia(`up:quadro:${QUIZ}`)).toBeNull();
    expect(quizDaReferencia("serenata:nao-e-uuid")).toBeNull();
    expect(quizDaReferencia("serenata:")).toBeNull();
    expect(quizDaReferencia("")).toBeNull();
    expect(quizDaReferencia(null)).toBeNull();
    expect(quizDaReferencia(undefined)).toBeNull();
  });
});

describe("outroPagamentoDoQuiz", () => {
  it("acha o pagamento ANTERIOR do mesmo quiz por outra cobrança", () => {
    const linhas = [
      { payment_id: "asaas:pay_06out", status: "pendente" },
      { payment_id: "asaas:pay_03out", status: "pago" },
    ];
    expect(outroPagamentoDoQuiz(linhas, "asaas:pay_06out")?.payment_id).toBe("asaas:pay_03out");
  });

  it("a própria cobrança não conta (reenvio do mesmo evento)", () => {
    expect(outroPagamentoDoQuiz([{ payment_id: "asaas:pay_1", status: "pago" }], "asaas:pay_1")).toBeNull();
  });

  it("upsell e cortesia não contam como 'já pago'", () => {
    const linhas = [
      { payment_id: "asaas:up:quadro:abc", status: "pago" },
      { payment_id: "woovi:up:musica:abc", status: "pago" },
      { payment_id: "manual:x", status: "pago", dinheiro_entrou: false },
    ];
    expect(outroPagamentoDoQuiz(linhas, "asaas:pay_novo")).toBeNull();
  });

  it("liberação manual com dinheiro e venda de outro gateway contam", () => {
    expect(
      outroPagamentoDoQuiz([{ payment_id: "manual:y", status: "pago", dinheiro_entrou: true }], "asaas:pay_2"),
    ).not.toBeNull();
    expect(outroPagamentoDoQuiz([{ payment_id: "woovi:serenata:x", status: "pago" }], "asaas:pay_2")).not.toBeNull();
  });

  it("pendente, cancelado e reembolsado não travam", () => {
    const linhas = ["pendente", "cancelado", "reembolsado"].map((status, i) => ({
      payment_id: `asaas:pay_${i}`,
      status,
    }));
    expect(outroPagamentoDoQuiz(linhas, "asaas:pay_novo")).toBeNull();
    expect(outroPagamentoDoQuiz(null, "asaas:pay_novo")).toBeNull();
  });
});

describe("estorno e chargeback", () => {
  it("classifica os eventos do Asaas", () => {
    expect(eventoDeEstorno("PAYMENT_REFUNDED")).toBe("estorno");
    expect(eventoDeEstorno("PAYMENT_REFUND_IN_PROGRESS")).toBe("estorno");
    expect(eventoDeEstorno("PAYMENT_CHARGEBACK_REQUESTED")).toBe("chargeback");
    expect(eventoDeEstorno("PAYMENT_CHARGEBACK_DISPUTE")).toBe("chargeback");
    expect(eventoDeEstorno("PAYMENT_PARTIALLY_REFUNDED")).toBe("parcial");
  });

  it("pagamento e recusa não são estorno", () => {
    expect(eventoDeEstorno("PAYMENT_RECEIVED")).toBeNull();
    expect(eventoDeEstorno("PAYMENT_CONFIRMED")).toBeNull();
    expect(eventoDeEstorno("PAYMENT_REPROVED_BY_RISK_ANALYSIS")).toBeNull();
    expect(eventoDeEstorno("")).toBeNull();
  });

  it("só a RECONSULTA confirma: postback forjado com cobrança paga não vira reembolso", () => {
    expect(statusConfirmaEstorno("REFUNDED")).toBe(true);
    expect(statusConfirmaEstorno("REFUND_IN_PROGRESS")).toBe(true);
    expect(statusConfirmaEstorno("CHARGEBACK_REQUESTED")).toBe(true);
    expect(statusConfirmaEstorno("CHARGEBACK_DISPUTE")).toBe(true);
    expect(statusConfirmaEstorno("RECEIVED")).toBe(false);
    expect(statusConfirmaEstorno("CONFIRMED")).toBe(false);
    // Disputa ganha: o dinheiro está voltando PRA NÓS.
    expect(statusConfirmaEstorno("AWAITING_CHARGEBACK_REVERSAL")).toBe(false);
    expect(statusConfirmaEstorno(null)).toBe(false);
  });
});

describe("decidirCobrancaExistente", () => {
  it("o caso bb9effb8: QR vencido é cancelado quando nasce o novo", () => {
    const d = decidirCobrancaExistente([{ id: "pay_01out", status: "OVERDUE", value: 38 }], 3800);
    expect(d).toEqual({ tipo: "nova", cancelar: ["pay_01out"] });
  });

  it("vencido também cai quando a viva do mesmo valor é reaproveitada", () => {
    const d = decidirCobrancaExistente(
      [
        { id: "pay_velho", status: "OVERDUE", value: 38 },
        { id: "pay_vivo", status: "PENDING", value: 38 },
      ],
      3800,
    );
    expect(d.tipo).toBe("reusar");
    expect(d.tipo === "reusar" && d.cobranca.id).toBe("pay_vivo");
    expect(d.cancelar).toEqual(["pay_velho"]);
  });

  it("já paga ganha de tudo, mesmo de outro valor, e nunca é cancelada", () => {
    const d = decidirCobrancaExistente(
      [
        { id: "pay_pago", status: "RECEIVED", value: 29 },
        { id: "pay_vencido", status: "OVERDUE", value: 38 },
        { id: "pay_vivo", status: "PENDING", value: 38 },
      ],
      3800,
    );
    expect(d.tipo).toBe("paga");
    expect(d.tipo === "paga" && d.paga.id).toBe("pay_pago");
    expect(d.cancelar).not.toContain("pay_pago");
    expect(d.cancelar).toEqual(["pay_vencido"]);
  });

  it("viva de outro valor é cancelada e nasce a nova na MESMA referência", () => {
    const d = decidirCobrancaExistente([{ id: "pay_38", status: "PENDING", value: 38 }], 2900);
    expect(d).toEqual({ tipo: "nova", cancelar: ["pay_38"] });
  });

  it("cartão em análise antifraude nunca é cancelado", () => {
    const d = decidirCobrancaExistente([{ id: "pay_cartao", status: "AWAITING_RISK_ANALYSIS", value: 38 }], 2900);
    expect(d).toEqual({ tipo: "nova", cancelar: [] });
  });

  it("estornada, apagada e lista vazia: só nasce uma nova", () => {
    expect(decidirCobrancaExistente([{ id: "pay_x", status: "REFUNDED", value: 38 }], 3800)).toEqual({
      tipo: "nova",
      cancelar: [],
    });
    expect(decidirCobrancaExistente([], 3800)).toEqual({ tipo: "nova", cancelar: [] });
    expect(decidirCobrancaExistente(null, 3800)).toEqual({ tipo: "nova", cancelar: [] });
  });

  it("centavos quebrados batem (R$ 62,90)", () => {
    const d = decidirCobrancaExistente([{ id: "pay_q", status: "PENDING", value: 62.9 }], 6290);
    expect(d.tipo).toBe("reusar");
  });
});
