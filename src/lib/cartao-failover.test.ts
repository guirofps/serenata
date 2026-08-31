import { describe, it, expect } from "vitest";
import { checkoutAntigoDoBraco } from "@/lib/criar-cartao";

// A VOLTA PRO CHECKOUT ANTIGO — o que ela aceita como destino.
//
// Este teste existe porque o campo `checkout` é editável pelo painel de teste
// A/B. Um failover que confia no que está gravado é um redirect aberto com
// outro nome: bastaria alguém com acesso ao painel (ou um bug de escrita) pra
// que a nossa tela de pagamento despejasse compradores num site qualquer, com
// o número do cartão na mão e a confiança da nossa marca no bolso.

describe("destino do failover de cartão", () => {
  const braco = (checkout: unknown) => [{ nome: "A", plano: { valor: 38, checkout } }];

  it("aceita o checkout da Perfect Pay do braço sorteado", () => {
    const v = [
      { nome: "A", plano: { valor: 38, checkout: "https://go.perfectpay.com.br/AAA" } },
      { nome: "E", plano: { valor: 54.9, checkout: "https://go.perfectpay.com.br/EEE" } },
    ];
    expect(checkoutAntigoDoBraco(v, "E")).toBe("https://go.perfectpay.com.br/EEE");
  });

  it("cai no controle quando o braço não tem plano", () => {
    const v = [{ nome: "A", plano: { valor: 38, checkout: "https://go.perfectpay.com.br/AAA" } }];
    expect(checkoutAntigoDoBraco(v, "Z")).toBe("https://go.perfectpay.com.br/AAA");
  });

  it("recusa domínio que não é o da Perfect Pay", () => {
    expect(checkoutAntigoDoBraco(braco("https://go-perfectpay.com.br/X"), "A")).toBeNull();
    expect(checkoutAntigoDoBraco(braco("https://evil.com/go.perfectpay.com.br"), "A")).toBeNull();
    expect(checkoutAntigoDoBraco(braco("https://go.perfectpay.com.br.evil.com/X"), "A")).toBeNull();
  });

  it("recusa http, javascript: e data:", () => {
    expect(checkoutAntigoDoBraco(braco("http://go.perfectpay.com.br/X"), "A")).toBeNull();
    expect(checkoutAntigoDoBraco(braco("javascript:alert(1)"), "A")).toBeNull();
    expect(checkoutAntigoDoBraco(braco("data:text/html,<script>"), "A")).toBeNull();
  });

  it("recusa lixo: vazio, não-string, ausente", () => {
    expect(checkoutAntigoDoBraco(braco(""), "A")).toBeNull();
    expect(checkoutAntigoDoBraco(braco(42), "A")).toBeNull();
    expect(checkoutAntigoDoBraco(braco(undefined), "A")).toBeNull();
    expect(checkoutAntigoDoBraco([{ nome: "A" }], "A")).toBeNull();
    expect(checkoutAntigoDoBraco(null, "A")).toBeNull();
    expect(checkoutAntigoDoBraco(undefined, "A")).toBeNull();
  });
});
