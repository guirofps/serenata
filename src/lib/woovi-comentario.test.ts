import { describe, expect, it } from "vitest";
import { comentarioSemEmoji } from "./woovi";
import { descricaoCobrancaMusica } from "./descricao-cobranca";

// A Woovi recusa o PIX inteiro ("Emoji não é permitido no comentário") quando o
// comentário tem qualquer caractere da faixa U+2000-U+33FF ou emoji (11/11).
const RECUSADO = /[ -㏿︀-️‍]|\p{Extended_Pictographic}/u;

describe("comentário do PIX da Woovi", () => {
  it("o título real que travou 20 tentativas sai sem o travessão", () => {
    const c = comentarioSemEmoji(descricaoCobrancaMusica("Célio,amor — O Amor Não Desiste"));
    expect(c).toBe("Serenata · Célio,amor - O Amor Não Desiste · ouça em serenatagift.com/login");
    expect(RECUSADO.test(c)).toBe(false);
  });

  it("tira emoji com seletor de variação e o de coroa, sem deixar espaço duplo", () => {
    expect(comentarioSemEmoji("Amor ❤️, Sempre Você")).toBe("Amor, Sempre Você");
    expect(comentarioSemEmoji("Minha Rainha 👑")).toBe("Minha Rainha");
    expect(comentarioSemEmoji("KAH❤️, Minha Xuxinha")).toBe("KAH, Minha Xuxinha");
  });

  it("as reticências do título longo viram três pontos", () => {
    const c = comentarioSemEmoji(descricaoCobrancaMusica("a".repeat(120)));
    expect(c).toContain("...");
    expect(RECUSADO.test(c)).toBe(false);
  });

  it("acento e o ponto do meio (que sempre passaram) ficam", () => {
    expect(comentarioSemEmoji("Serenata · Canção da Mãe")).toBe("Serenata · Canção da Mãe");
  });
});
