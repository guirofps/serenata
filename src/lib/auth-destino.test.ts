import { describe, expect, it } from "vitest";
import { destinoDoCallback } from "./auth-destino";

describe("destinoDoCallback — o único destino alternativo do callback", () => {
  it("reconhece o painel", () => {
    expect(destinoDoCallback("admin")).toBe("admin");
  });

  it("qualquer outra coisa vira undefined, que significa /dashboard", () => {
    expect(destinoDoCallback(undefined)).toBeUndefined();
    expect(destinoDoCallback("dashboard")).toBeUndefined();
    expect(destinoDoCallback("")).toBeUndefined();
  });

  // ── A RAZÃO DESTE ARQUIVO EXISTIR ─────────────────────────────
  //
  // Esta rota CRIA SESSÃO, e é a pior página do site pra ter redirect aberto:
  // a pessoa chega nela confiando no link que a trouxe. Se `destino` virasse
  // um endereço, `?destino=https://serenata-gift.com/...` mandaria alguém
  // recém-logado pra um clone.
  //
  // A defesa não é sanitizar URL, é NUNCA aceitar uma: o tipo de retorno é uma
  // palavra de uma lista de uma. Quem tentar "melhorar" isto pra aceitar
  // caminho quebra estes testes.
  it("nunca aceita URL, nem absoluta nem protocolo-relativa", () => {
    expect(destinoDoCallback("https://evil.com")).toBeUndefined();
    expect(destinoDoCallback("//evil.com")).toBeUndefined();
    expect(destinoDoCallback("http://localhost/admin")).toBeUndefined();
    expect(destinoDoCallback("javascript:alert(1)")).toBeUndefined();
  });

  it("nunca aceita caminho, nem o do próprio painel", () => {
    // `/admin` parece inofensivo e é a porta de entrada pro resto: aceitar
    // caminho obriga a decidir quais caminhos valem, e essa lista é onde o
    // `//evil.com` entra despercebido.
    expect(destinoDoCallback("/admin")).toBeUndefined();
    expect(destinoDoCallback("/")).toBeUndefined();
  });

  it("não normaliza caixa nem espaço", () => {
    // Comparação exata de propósito. Normalizar aqui não traz benefício algum
    // — o valor é escrito pelo nosso próprio código, nunca digitado — e cada
    // transformação a mais é uma chance de duas leituras discordarem.
    expect(destinoDoCallback("Admin")).toBeUndefined();
    expect(destinoDoCallback(" admin ")).toBeUndefined();
  });

  it("aguenta tipo que não é string", () => {
    expect(destinoDoCallback(null)).toBeUndefined();
    expect(destinoDoCallback(42)).toBeUndefined();
    expect(destinoDoCallback(["admin"])).toBeUndefined();
    expect(destinoDoCallback({ destino: "admin" })).toBeUndefined();
  });
});
