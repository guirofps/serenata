import { describe, expect, it } from "vitest";
import {
  cartaoDlocalLigado,
  documentoNoCartao,
  estadoDoStatus,
  expostoCartaoDlocal,
  grupoRecusaCartao,
  paisCartaoDlocal,
  proximoPassoConfirmacao,
  separarNome,
  tokenCartaoValido,
  urlTresDsValida,
  TEXTO_CARTAO_DLOCAL,
  TEXTO_RECUSA_CARTAO,
} from "./cartao-dlocal";

describe("cartao_dlocal: quem vê", () => {
  it("só os 4 países com dLocal, só no espanhol", () => {
    for (const p of ["MX", "PE", "CO", "CL", " mx "]) expect(expostoCartaoDlocal(p, "es")).toBe(true);
    for (const p of ["US", "ES", "AR", "", null]) expect(expostoCartaoDlocal(p, "es")).toBe(false);
    expect(expostoCartaoDlocal("MX", "en")).toBe(false);
  });
  it("só o B liga; sem braço é A", () => {
    expect(cartaoDlocalLigado("B", "PE", "es")).toBe(true);
    expect(cartaoDlocalLigado("b", "co", "es")).toBe(true);
    expect(cartaoDlocalLigado("A", "PE", "es")).toBe(false);
    expect(cartaoDlocalLigado(null, "PE", "es")).toBe(false);
    expect(cartaoDlocalLigado("B", "US", "es")).toBe(false);
    expect(cartaoDlocalLigado("B", "MX", "en")).toBe(false);
  });
  it("país normalizado", () => {
    expect(paisCartaoDlocal(" cl ")).toBe("CL");
    expect(paisCartaoDlocal("ES")).toBeNull();
  });
});

describe("cartao_dlocal: dados do confirm", () => {
  it("documento fora do México", () => {
    expect(documentoNoCartao("MX")).toBe(false);
    expect(documentoNoCartao("CO")).toBe(true);
    expect(documentoNoCartao("PE")).toBe(true);
    expect(documentoNoCartao("CL")).toBe(true);
  });
  it("nome em primeiro e sobrenome", () => {
    expect(separarNome("  María   José López Pérez ")).toEqual({ primeiro: "María", ultimo: "José López Pérez" });
    expect(separarNome("Ana Ruiz")).toEqual({ primeiro: "Ana", ultimo: "Ruiz" });
    expect(separarNome("Cher")).toEqual({ primeiro: "Cher", ultimo: "Cher" });
  });
  it("token do cartão só com caracteres seguros", () => {
    expect(tokenCartaoValido("CV-1a2b3c4d-5e6f")).toBe(true);
    expect(tokenCartaoValido("abc")).toBe(false);
    expect(tokenCartaoValido("x".repeat(10) + "/../")).toBe(false);
    expect(tokenCartaoValido(42)).toBe(false);
  });
  it("3DS só pra página https da dLocal", () => {
    expect(urlTresDsValida("https://checkout.dlocalgo.com/3ds/abc")).toBe(true);
    expect(urlTresDsValida("https://3ds.dlocal.com/x")).toBe(true);
    expect(urlTresDsValida("http://checkout.dlocalgo.com/x")).toBe(false);
    expect(urlTresDsValida("https://dlocalgo.com.golpe.io/x")).toBe(false);
    expect(urlTresDsValida("javascript:alert(1)")).toBe(false);
    expect(urlTresDsValida(null)).toBe(false);
  });
  it("confirm com redirect vai pro 3DS; sem, lê o pagamento", () => {
    expect(proximoPassoConfirmacao({ success: true, redirect_url: "https://checkout.dlocalgo.com/v/1" })).toEqual({ passo: "3ds", url: "https://checkout.dlocalgo.com/v/1" });
    expect(proximoPassoConfirmacao({ success: true })).toEqual({ passo: "ler" });
    expect(proximoPassoConfirmacao({ success: false, redirect_url: "https://evil.com" })).toEqual({ passo: "ler" });
  });
  it("status do GET", () => {
    expect(estadoDoStatus("PAID")).toBe("pago");
    expect(estadoDoStatus("REJECTED")).toBe("recusado");
    expect(estadoDoStatus("CANCELLED")).toBe("recusado");
    expect(estadoDoStatus("PENDING")).toBe("pendente");
    expect(estadoDoStatus(undefined)).toBe("pendente");
  });
});

describe("cartao_dlocal: recusa", () => {
  it("agrupa pelo texto da dLocal; o desconhecido é o banco", () => {
    expect(grupoRecusaCartao("Insufficient funds")).toBe("saldo");
    expect(grupoRecusaCartao("Invalid security code")).toBe("dados");
    expect(grupoRecusaCartao("Card expired")).toBe("dados");
    // Medido em 11/11: confirm com token de cartão inválido volta 400 {"code":406,"message":"Missing payment method"}.
    expect(grupoRecusaCartao("Missing payment method")).toBe("dados");
    expect(grupoRecusaCartao("Invalid document")).toBe("documento");
    expect(grupoRecusaCartao("High risk transaction")).toBe("risco");
    expect(grupoRecusaCartao("Card not supported")).toBe("cartao");
    expect(grupoRecusaCartao("Rejected by bank")).toBe("banco");
    expect(grupoRecusaCartao(null)).toBe("banco");
  });
  it("todo texto sem travessão e sem promessa de reembolso", () => {
    const todos = [...Object.values(TEXTO_RECUSA_CARTAO), ...Object.values(TEXTO_CARTAO_DLOCAL).map((v) => (typeof v === "function" ? v("$349") : v))];
    for (const t of todos) {
      expect(t).not.toMatch(/—|–/);
      expect(t.toLowerCase()).not.toMatch(/reembols|devoluci/);
    }
  });
});
