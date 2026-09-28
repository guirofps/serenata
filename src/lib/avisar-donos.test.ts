import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { htmlParaTexto } from "./avisar-donos";

describe("htmlParaTexto", () => {
  // O texto do WhatsApp é DERIVADO do HTML do e-mail, nunca escrito à parte.
  // Um segundo texto à mão é um texto que fica desatualizado em relação ao
  // e-mail, e aí os dois canais contam histórias diferentes do mesmo incidente.
  it("tira as etiquetas e mantém o conteúdo", () => {
    expect(htmlParaTexto("<p>O funil <strong>parou</strong>.</p>")).toBe("O funil parou.");
  });

  it("<br> e </p> viram quebra de linha, não texto grudado", () => {
    expect(htmlParaTexto("<p>linha 1<br>linha 2</p>")).toBe("linha 1\nlinha 2");
  });

  it("lista vira bullet legível no celular", () => {
    expect(htmlParaTexto("<ul><li>um</li><li>dois</li></ul>")).toBe("• um\n• dois");
  });

  it("entidade HTML não chega crua no WhatsApp", () => {
    expect(htmlParaTexto("<p>&ldquo;saldo&rdquo; &amp; custo</p>")).toBe('"saldo" & custo');
  });

  it("não deixa um muro de linhas em branco", () => {
    expect(htmlParaTexto("<p>a</p><p></p><p></p><p>b</p>")).toBe("a\n\nb");
  });

  it("entrada vazia não quebra", () => {
    expect(htmlParaTexto("")).toBe("");
    expect(htmlParaTexto(undefined as unknown as string)).toBe("");
  });
});

// ── O GUARD: alerta novo não nasce só com e-mail ─────────────────
//
// O pedido foi "me avisa SEMPRE que tiver problema". "Sempre" não sobrevive a
// doze cópias do código de envio — a décima terceira vai esquecer o WhatsApp,
// e ninguém vai notar, porque o e-mail continua chegando.
//
// Este teste lê o repositório e recusa qualquer `emails.send` mandando pros
// donos por fora do `avisarDonos`.
describe("nenhum alerta manda pros donos por fora do avisarDonos", () => {
  it("não existe destinatário de dono solto em `emails.send`", () => {
    let saida = "";
    try {
      saida = execFileSync(
        "grep",
        // As TRÊS formas, não só a literal. O buraco não é hipotético: em
        // 28/09 um alerta novo entrou com `to: PARA` e passou verde por este
        // teste — ele saía por e-mail e não pelo WhatsApp, que é justamente o
        // que o pedido "me avisa SEMPRE" queria impedir.
        [
          "-rnE",
          "to: (\\[\\.\\.\\.DONOS\\]|PARA|dono),",
          "--include=*.ts",
          "src",
          "inngest",
          "api",
        ],
        { encoding: "utf-8", cwd: process.cwd() },
      );
    } catch {
      saida = ""; // grep sai 1 sem achar nada: é o caso verde.
    }
    // Fora os proprios arquivos de teste: o titulo deste `it` contem a
    // string procurada, e ele casaria consigo mesmo pra sempre.
    const infratores = saida
      .split("\n")
      .filter(Boolean)
      .filter((l) => !/\.test\.ts:/.test(l));
    expect(
      infratores,
      "mande pelo avisarDonos() de src/lib/avisar-donos.ts — ele cobre e-mail E WhatsApp",
    ).toEqual([]);
  });
});
