import { describe, expect, it } from "vitest";
import {
  falhaTransitoria,
  recusaDeConteudo,
  semOTermo,
  termoBarrado,
} from "./recusa-provedor";

// A LEITURA DA RECUSA DO PROVEDOR (08/10).
//
// O caso que fez este arquivo existir: o Suno barrou "que delícia" e escreveu
// na recusa "producer tag que delicia", SEM acento. A busca literal não achava
// o termo na letra, e o job mandou a mesma letra três vezes, pagando as três.

describe("termoBarrado", () => {
  it("lê o termo da mensagem de producer tag", () => {
    expect(
      termoBarrado("Your lyrics contain producer tag que delicia - we don't reference producers"),
    ).toBe("que delicia");
  });

  it("lê o termo da mensagem de artist name", () => {
    expect(termoBarrado("Your tags contain artist name pressa - we don't reference artists")).toBe(
      "pressa",
    );
  });

  it("sem motivo, ou motivo de outro tipo, não inventa termo", () => {
    expect(termoBarrado(null)).toBeNull();
    expect(termoBarrado("500 · Internal Error")).toBeNull();
  });

  it("termo curto demais não vira remoção cega", () => {
    expect(termoBarrado("Your lyrics contain artist name ai - we don't reference")).toBeNull();
  });
});

describe("semOTermo, ignorando acento", () => {
  it("O CASO DE 08/10: tira 'que delícia' quando o provedor diz 'que delicia'", () => {
    const letra = "Teu sorriso, que delícia de manhã\nE o café na mesa";
    const limpa = semOTermo(letra, "que delicia");
    expect(limpa).not.toMatch(/del[ií]cia/i);
    expect(limpa).toBe("Teu sorriso, de manhã\nE o café na mesa");
  });

  it("preserva o acento do RESTO da letra", () => {
    const limpa = semOTermo("Coração, que delícia, você é minha canção", "que delicia");
    expect(limpa).toBe("Coração, você é minha canção");
  });

  it("não diferencia maiúscula", () => {
    expect(semOTermo("Que Delícia te ver", "que delicia")).toBe("te ver");
  });

  it("acha o termo mesmo que o provedor mande COM acento e a letra esteja sem", () => {
    expect(semOTermo("que delicia te ver", "que delícia")).toBe("te ver");
  });

  it("tira a palavra inteira, não o pedaço de dentro de outra", () => {
    // "pressa" barrada não pode transformar "depressa" em "de".
    expect(semOTermo("Vem depressa, sem pressa nenhuma", "pressa")).toBe(
      "Vem depressa, sem nenhuma",
    );
  });

  it("se só existe dentro de outra palavra, tira o pedaço: foi isso que o provedor viu", () => {
    expect(semOTermo("Vem depressa", "pressa")).toBe("Vem de");
  });

  it("termo partido entre dois versos não junta os versos", () => {
    expect(semOTermo("Teu beijo é que\ndelícia de verão", "que delicia")).toBe(
      "Teu beijo é\nde verão",
    );
  });

  it("mantém a linha em branco entre estrofes", () => {
    const letra = "[Verso]\nque delícia te ver\n\n[Refrão]\nvocê";
    expect(semOTermo(letra, "que delicia")).toBe("[Verso]\nte ver\n\n[Refrão]\nvocê");
  });

  it("caractere especial no termo não quebra a regex", () => {
    expect(semOTermo("amor (sim) amor", "(sim)")).toBe("amor amor");
  });

  it("termo que não aparece devolve o texto igual", () => {
    expect(semOTermo("Coração de mãe", "que delicia")).toBe("Coração de mãe");
  });

  it("serve também pro estilo", () => {
    expect(semOTermo("sertanejo, pressa, voz masculina", "pressa")).toBe(
      "sertanejo, voz masculina",
    );
  });
});

describe("falhaTransitoria: o que a repescagem pode tentar de novo", () => {
  it("timeout passa", () => {
    expect(falhaTransitoria("timeout no provedor")).toBe(true);
  });

  it("5xx do provedor passa (os 100 leads de 03/10)", () => {
    expect(falhaTransitoria("provedor recusou 4x: 500 · Internal Error")).toBe(true);
    expect(falhaTransitoria("provedor recusou 4x: 500 · Audio decrypt failed")).toBe(true);
    expect(falhaTransitoria("provedor recusou 4x: 503 · Service Unavailable")).toBe(true);
  });

  it("recusa de conteúdo NÃO passa", () => {
    expect(
      falhaTransitoria(
        "provedor recusou 4x: 400 · Your lyrics contain producer tag que delicia - we don't reference",
      ),
    ).toBe(false);
    expect(falhaTransitoria("provedor recusou 4x: 413 · lyrics too long")).toBe(false);
  });

  it("teto diário e erro sem motivo não passam", () => {
    expect(falhaTransitoria("teto diário de geração atingido (300/dia)")).toBe(false);
    expect(falhaTransitoria("provedor recusou 4x")).toBe(false);
    expect(falhaTransitoria(null)).toBe(false);
  });

  it("número de 4 dígitos começando com 5 não é 5xx", () => {
    expect(falhaTransitoria("provedor recusou 4x: 5000 · algo")).toBe(false);
  });
});

describe("recusaDeConteudo: o que NÃO adianta refazer", () => {
  it("4xx é recusa de conteúdo", () => {
    expect(recusaDeConteudo("provedor recusou 4x: 400 · bad request")).toBe(true);
    expect(recusaDeConteudo("provedor recusou 4x: 413 · lyrics too long")).toBe(true);
  });

  it("termo barrado é recusa de conteúdo, mesmo sem código", () => {
    expect(
      recusaDeConteudo(
        "provedor recusou 4x: Your tags contain artist name pressa - we don't reference artists",
      ),
    ).toBe(true);
  });

  it("5xx, timeout e teto NÃO são recusa de conteúdo", () => {
    expect(recusaDeConteudo("provedor recusou 4x: 500 · Internal Error")).toBe(false);
    expect(recusaDeConteudo("timeout no provedor")).toBe(false);
    expect(recusaDeConteudo("teto diário de geração atingido (300/dia)")).toBe(false);
    expect(recusaDeConteudo(null)).toBe(false);
  });
});
