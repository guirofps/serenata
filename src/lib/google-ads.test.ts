// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { conversaoCompra, guardarTransacao } from "./google-ads";

// O QUE ESTE TESTE SEGURA, E POR QUE ELE EXISTE
//
// O Google DEDUPLICA conversão por `transaction_id`. String vazia é um id
// como outro qualquer: com o campo vazio em todas as vendas, ele guarda UMA e
// descarta o resto — sem erro, sem aviso, sem nada na tela.
//
// Foi o que aconteceu. Medido em 28/08: 23 vendas num dia e 8 contadas. Dois
// terços jogados fora, e a campanha otimizando em cima do terço que sobrou.
//
// Nenhum teste teria pego isso lendo o código: `transaction_id: id ?? ""`
// parece defensivo. O que ele quebra só aparece sabendo o que o Google faz
// com o campo. Por isso o teste afirma a REGRA, não a implementação: nunca
// sai vazio.

function pegarEvento() {
  const chamadas = (window.gtag as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return chamadas[chamadas.length - 1]?.[2] as Record<string, unknown> | undefined;
}

describe("conversaoCompra — o transaction_id nunca sai vazio", () => {
  beforeEach(() => {
    (window as unknown as { gtag: unknown }).gtag = vi.fn();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("usa o id que veio do chamador", () => {
    conversaoCompra({ valor: 38, transactionId: "PPCPMTB5HJAJGNL7RT" });
    expect(pegarEvento()?.transaction_id).toBe("PPCPMTB5HJAJGNL7RT");
  });

  it("cai na referência guardada pela tela do PIX", () => {
    guardarTransacao("serenata:abc-123");
    conversaoCompra({ valor: 38 });
    expect(pegarEvento()?.transaction_id).toBe("serenata:abc-123");
  });

  it("cai no id da SESSÃO quando não há nem code nem referência", () => {
    // É o caso do checkout transparente sem a folha do PIX na mesma aba, e
    // era exatamente aqui que a conversão sumia.
    localStorage.setItem("mp_session_id", "sess-xyz");
    conversaoCompra({ valor: 38 });
    expect(pegarEvento()?.transaction_id).toBe("sess-xyz");
  });

  it("NUNCA manda string vazia: sem nenhum id, OMITE o campo", () => {
    // Omitir faz o Google contar a conversão como única. Vazio faz ele
    // descartar. Errar pra cima aqui é muito melhor que errar pra baixo.
    conversaoCompra({ valor: 38 });
    const ev = pegarEvento()!;
    expect(ev.transaction_id).toBeUndefined();
    expect("transaction_id" in ev).toBe(false);
  });

  it("id só com espaços conta como ausente", () => {
    conversaoCompra({ valor: 38, transactionId: "   " });
    expect("transaction_id" in pegarEvento()!).toBe(false);
  });

  it("o valor e a moeda continuam vindo do chamador", () => {
    // Um preço cravado aqui sobreviveria à mudança de preço, e o Google
    // otimizaria em cima de um número que não existe mais.
    conversaoCompra({ valor: 54.9, moeda: "USD", transactionId: "x" });
    const ev = pegarEvento()!;
    expect(ev.value).toBe(54.9);
    expect(ev.currency).toBe("USD");
  });

  it("sem gtag na página, não explode", () => {
    (window as unknown as { gtag: unknown }).gtag = undefined;
    expect(() => conversaoCompra({ valor: 38 })).not.toThrow();
  });
});
