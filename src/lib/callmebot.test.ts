import { describe, expect, it } from "vitest";
import { encurtar, lerDestinos, urlDoAviso } from "./callmebot";

// O CANAL DE AVISO, testado onde ele falha CALADO.
//
// Nada aqui quebra de forma visível: uma variável de ambiente torta, um `+`
// virando espaço, um `&` cortando a mensagem — em todos esses casos o alerta
// simplesmente não chega, e quem devia ser acordado continua dormindo. Não há
// tela onde isso apareça.

describe("lerDestinos", () => {
  it("lê o par telefone:chave", () => {
    expect(lerDestinos("+5511999998888:abc123")).toEqual([
      { telefone: "+5511999998888", apikey: "abc123" },
    ]);
  });

  it("lê vários, separados por vírgula", () => {
    expect(lerDestinos("+5511999998888:abc123,+5511777776666:def456")).toHaveLength(2);
  });

  it("aguenta espaço, parêntese e traço de quem copiou da agenda", () => {
    expect(lerDestinos(" +55 (11) 99999-8888 : abc123 ")).toEqual([
      { telefone: "+5511999998888", apikey: "abc123" },
    ]);
  });

  it("NUNCA lança com entrada torta — descarta a linha e segue", () => {
    // Esta função roda dentro do caminho que estava tentando reportar um
    // problema. Se ela estourasse por uma vírgula a mais, o alerta morreria
    // junto e a falha original ficaria sem aviso nenhum.
    for (const lixo of ["", "   ", ",,,", "semchave", ":", "abc:", ":xyz", "naoéumtelefone:k"]) {
      expect(() => lerDestinos(lixo)).not.toThrow();
      expect(lerDestinos(lixo)).toEqual([]);
    }
    expect(lerDestinos(undefined)).toEqual([]);
    expect(lerDestinos(null)).toEqual([]);
  });

  it("a linha boa passa mesmo com uma torta do lado", () => {
    // O caso que importa: o sócio errou a dele, e o dono continua sendo avisado.
    const d = lerDestinos("quebrado,+5511999998888:abc123");
    expect(d).toHaveLength(1);
    expect(d[0].telefone).toBe("+5511999998888");
  });

  it("não repete o mesmo telefone", () => {
    expect(lerDestinos("+5511999998888:abc,+5511999998888:xyz")).toHaveLength(1);
  });

  it("recusa telefone curto ou gigante demais pra ser E.164", () => {
    expect(lerDestinos("123:abc")).toEqual([]);
    expect(lerDestinos("1234567890123456789:abc")).toEqual([]);
  });
});

describe("urlDoAviso", () => {
  const destino = { telefone: "+5511999998888", apikey: "abc123" };

  it("o `+` do DDI vai escapado — numa query string, `+` cru é ESPAÇO", () => {
    // Sem isso o CallMeBot receberia " 5511999998888" e não entregaria nada,
    // sem erro nenhum do nosso lado.
    const u = urlDoAviso(destino, "oi");
    expect(u).toContain("phone=%2B5511999998888");
    expect(u).not.toContain("phone=+55");
  });

  it("o `&` no meio do aviso não corta a mensagem nem inventa parâmetro", () => {
    const u = new URL(urlDoAviso(destino, "vendas & custos"));
    expect(u.searchParams.get("text")).toBe("vendas & custos");
    expect(u.searchParams.get("apikey")).toBe("abc123");
  });

  it("quebra de linha sobrevive", () => {
    const u = new URL(urlDoAviso(destino, "linha 1\nlinha 2"));
    expect(u.searchParams.get("text")).toBe("linha 1\nlinha 2");
  });

  it("aponta pro endpoint do CallMeBot", () => {
    expect(urlDoAviso(destino, "x").startsWith("https://api.callmebot.com/whatsapp.php?")).toBe(
      true,
    );
  });
});

describe("encurtar", () => {
  it("texto curto passa inteiro", () => {
    expect(encurtar("oi")).toBe("oi");
  });

  it("texto longo é cortado com reticência, não no meio calado", () => {
    // O texto viaja na QUERY STRING: URL longa é cortada por servidor e CDN, e
    // a mensagem chegaria truncada no meio de uma frase sem ninguém saber.
    const r = encurtar("a".repeat(1000));
    expect(r.length).toBeLessThanOrEqual(700);
    expect(r.endsWith("…")).toBe(true);
  });

  it("no limite exato não corta", () => {
    expect(encurtar("a".repeat(700))).toHaveLength(700);
  });
});
