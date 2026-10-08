import { describe, expect, it } from "vitest";
import {
  codigoDoLembrete,
  linkDoLembrete,
  meioDoPendente,
  reconsultaDoPedido,
  reconsultaPermiteEnvio,
} from "./pix-nao-pago-regras";
import { assuntoPixNaoPago, emailPixNaoPago } from "../../emails/pix-nao-pago";

// O e-mail de PIX abandonado, depois da auditoria de 08/10: o cartão do
// Asaas caía nele e era mandado pra Perfect Pay com texto de PIX.

const SITE = "https://www.serenatagift.com";
const SESSAO = "0f6c2a1e-9b7d-4c1a-8e2f-3a4b5c6d7e8f";

describe("meioDoPendente", () => {
  it("PIX com tela guardada é PIX, de qualquer gateway", () => {
    expect(meioDoPendente({ gateway: "asaas", payment_id: "asaas:pay_1", pix_url: `${SITE}/pix/pay_1`, pix_codigo: "000201" })).toBe("pix");
    expect(meioDoPendente({ gateway: "woovi", payment_id: "woovi:abc", pix_url: `${SITE}/pix/abc` })).toBe("pix");
  });

  it("pedido do Asaas sem nada de PIX é o cartão (criar-cartao.ts)", () => {
    expect(meioDoPendente({ gateway: "asaas", payment_id: "asaas:pay_9", pix_url: null, pix_codigo: null })).toBe("cartao");
  });

  it("upsell e pedido de outro gateway sem URL não são cartão", () => {
    expect(meioDoPendente({ gateway: "asaas", payment_id: "asaas:up:video:x" })).toBe("sem-codigo");
    expect(meioDoPendente({ gateway: "perfectpay", payment_id: "perfectpay:1" })).toBe("sem-codigo");
  });
});

describe("linkDoLembrete", () => {
  const base = { site: SITE, sessao: SESSAO, semPix: false };

  it("PIX: o link é a tela do PIX dela", () => {
    expect(linkDoLembrete({ ...base, meio: "pix", pixUrl: `${SITE}/pix/pay_1` })).toBe(`${SITE}/pix/pay_1`);
  });

  it("cartão volta pra música dela pelo /retomar, nunca pra checkout hospedado", () => {
    const link = linkDoLembrete({ ...base, meio: "cartao", pixUrl: null });
    expect(link).toBe(`${SITE}/retomar?s=${SESSAO}`);
    expect(link).not.toMatch(/perfectpay|centerpag|go\.|src=/);
  });

  it("o cupom do pedido vai junto, pra o preço ser o que ela já viu", () => {
    expect(linkDoLembrete({ ...base, meio: "cartao", pixUrl: null, cupom: "MUSICA10" })).toBe(
      `${SITE}/retomar?s=${SESSAO}&cupom=MUSICA10`,
    );
  });

  it("interruptor RECUPERACAO_SEM_PIX: ignora o PIX e volta pela sessão", () => {
    expect(linkDoLembrete({ ...base, semPix: true, meio: "pix", pixUrl: `${SITE}/pix/pay_1` })).toBe(
      `${SITE}/retomar?s=${SESSAO}`,
    );
  });

  it("sem sessão pra voltar, não manda (o /criar começaria do zero)", () => {
    expect(linkDoLembrete({ ...base, sessao: null, meio: "cartao", pixUrl: null })).toBeNull();
    expect(linkDoLembrete({ ...base, sessao: "a&b=c", meio: "sem-codigo", pixUrl: null })).toBeNull();
  });

  it("barra no fim do site não duplica", () => {
    expect(linkDoLembrete({ ...base, site: `${SITE}/`, meio: "cartao", pixUrl: null })).toBe(`${SITE}/retomar?s=${SESSAO}`);
  });
});

describe("codigoDoLembrete", () => {
  it("só sai junto do PIX dele", () => {
    expect(codigoDoLembrete(`${SITE}/pix/p`, `${SITE}/pix/p`, "000201")).toBe("000201");
    expect(codigoDoLembrete(`${SITE}/retomar?s=${SESSAO}`, `${SITE}/pix/p`, "000201")).toBeNull();
    expect(codigoDoLembrete(`${SITE}/retomar?s=${SESSAO}`, null, null)).toBeNull();
  });
});

describe("reconsulta no gateway", () => {
  it("Woovi e Asaas são perguntados; o upsell do Asaas pela referência", () => {
    expect(reconsultaDoPedido("woovi:abc")).toEqual({ gateway: "woovi", id: "abc", porReferencia: false });
    expect(reconsultaDoPedido("asaas:pay_1")).toEqual({ gateway: "asaas", id: "pay_1", porReferencia: false });
    expect(reconsultaDoPedido("asaas:up:video:x")).toEqual({ gateway: "asaas", id: "up:video:x", porReferencia: true });
    expect(reconsultaDoPedido("perfectpay:1")).toBeNull();
    expect(reconsultaDoPedido(null)).toBeNull();
  });

  it("pago ou cartão em análise de risco não recebem o e-mail", () => {
    expect(reconsultaPermiteEnvio({ pago: true, statusCru: "RECEIVED" })).toBe(false);
    expect(reconsultaPermiteEnvio({ pago: false, statusCru: "AWAITING_RISK_ANALYSIS" })).toBe(false);
    expect(reconsultaPermiteEnvio({ pago: false, statusCru: "PENDING" })).toBe(true);
    expect(reconsultaPermiteEnvio(null)).toBe(true);
  });
});

describe("o texto do cartão", () => {
  const html = emailPixNaoPago({
    nome: "Ana",
    titulo: "Nossa canção",
    linkCheckout: `${SITE}/retomar?s=${SESSAO}`,
    codigo: "000201-nao-deveria-aparecer",
    meio: "cartao",
  });

  it("não fala de PIX nem mostra código pra quem tentou no cartão", () => {
    expect(html).toContain("tentou pagar no cartão");
    expect(html).not.toContain("chegou até o PIX");
    expect(html).not.toContain("000201-nao-deveria-aparecer");
    expect(html).not.toContain("PAGAR COM O MEU PIX");
    expect(assuntoPixNaoPago("Ana", "pt", "cartao")).toContain("compra não foi concluída");
  });

  it("o PIX continua como era", () => {
    const pix = emailPixNaoPago({ nome: "Ana", titulo: "t", linkCheckout: `${SITE}/pix/p`, codigo: "000201" });
    expect(pix).toContain("chegou até o PIX");
    expect(pix).toContain("000201");
    expect(assuntoPixNaoPago("Ana")).toBe("A música de Ana ficou pronta e o pagamento não entrou");
  });

  it("sem travessão no texto que a pessoa lê", () => {
    const visivel = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "");
    expect(visivel(html)).not.toContain("—");
    expect(assuntoPixNaoPago("Ana", "pt", "cartao")).not.toContain("—");
  });
});
