import { describe, expect, it } from "vitest";
import { mascaraTelefone, telefoneValido, paraE164, exemploTelefone } from "@/lib/telefone";
import { mercadoEs } from "@/lib/mercado-es";

// O CAMPO QUE FALHA EM SILÊNCIO.
//
// Máscara errada a pessoa vê e corrige. DDI errado, não: o campo aceita, a
// máscara formata bonito, e o que fica gravado é um número que não existe.
// Foi o que aconteceu com o funil ES inteiro enquanto ele estava cravado no
// México e a campanha rodava na Argentina.

describe("telefone brasileiro", () => {
  it("aceita celular de 11 e fixo de 10", () => {
    expect(telefoneValido("(11) 91234-5678", "pt")).toBe(true);
    expect(telefoneValido("(11) 1234-5678", "pt")).toBe(true);
  });
  it("recusa DDD com zero e número repetido", () => {
    expect(telefoneValido("(01) 91234-5678", "pt")).toBe(false);
    expect(telefoneValido("11111111111", "pt")).toBe(false);
  });
  it("não deixa o 55 digitado virar DDD", () => {
    expect(paraE164("+55 11 91234-5678", "pt")).toBe("5511912345678");
  });
});

describe("telefone espanhol segue o mercado", () => {
  const m = mercadoEs();

  it("o DDI é o do país que a mídia está comprando", () => {
    const esperado = { argentina: "54", espanha: "34", latam: "52" }[m];
    expect(paraE164("1112345678", "es").startsWith(esperado)).toBe(true);
  });

  it("na Argentina o link do WhatsApp carrega o 9 do celular", () => {
    if (m !== "argentina") return;
    // `54` + `9` + os 10 dígitos. Sem o 9 o wa.me não abre conversa.
    expect(paraE164("11 1234-5678", "es")).toBe("5491112345678");
  });

  it("o exemplo do campo é um número do país certo", () => {
    const ex = exemploTelefone("es");
    if (m === "argentina") expect(ex).toBe("11 1234-5678");
    if (m === "espanha") expect(ex).toBe("612 34 56 78");
    if (m === "latam") expect(ex).toBe("55 1234 5678");
    // E o exemplo tem que passar na própria validação — senão a tela ensina
    // a pessoa a digitar algo que o botão recusa.
    expect(telefoneValido(ex, "es")).toBe(true);
  });

  it("a máscara formata do jeito que o país lê", () => {
    if (m === "argentina") expect(mascaraTelefone("1112345678", "es")).toBe("11 1234-5678");
    if (m === "espanha") expect(mascaraTelefone("612345678", "es")).toBe("612 345 678");
    if (m === "latam") expect(mascaraTelefone("5512345678", "es")).toBe("55 1234 5678");
  });

  it("recusa o comprimento do país errado", () => {
    // 9 dígitos é número espanhol; 10 é argentino/mexicano.
    const nove = telefoneValido("612345678", "es");
    const dez = telefoneValido("1112345678", "es");
    expect(m === "espanha" ? nove : dez).toBe(true);
    expect(m === "espanha" ? dez : nove).toBe(false);
  });
});
