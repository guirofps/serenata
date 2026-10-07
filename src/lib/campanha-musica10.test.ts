import { describe, expect, it } from "vitest";
import { emLotes, freioAcionado, linkCriarCampanha, templateDoEnvio } from "./campanha-musica10";

describe("freio", () => {
  it("não decide com amostra pequena", () => {
    expect(freioAcionado({ enviados: 150, bounces: 50, reclamacoes: 5 })).toBeNull();
  });
  it("para com bounce acima de 4%", () => {
    expect(freioAcionado({ enviados: 1000, bounces: 41, reclamacoes: 0 })).toMatch(/bounce/);
    expect(freioAcionado({ enviados: 1000, bounces: 40, reclamacoes: 0 })).toBeNull();
  });
  it("para com reclamação acima de 0,1%", () => {
    expect(freioAcionado({ enviados: 1000, bounces: 0, reclamacoes: 2 })).toMatch(/reclama/);
    expect(freioAcionado({ enviados: 1000, bounces: 0, reclamacoes: 1 })).toBeNull();
  });
});

it("emLotes corta em 100", () => {
  const xs = Array.from({ length: 250 }, (_, i) => i);
  expect(emLotes(xs).map((l) => l.length)).toEqual([100, 100, 50]);
});

it("link aplica o cupom e marca a versão", () => {
  expect(linkCriarCampanha("https://serenatagift.com", "lead")).toBe(
    "https://serenatagift.com/criar?cupom=MUSICA10&utm_source=email&utm_medium=campanha&utm_campaign=musica10&utm_content=lead",
  );
});

it("template por versão", () => {
  expect(templateDoEnvio("comprador")).toBe("campanha_musica10_comprador");
});

// Revisão final (07/10): um endereço mal formado derrubava o lote inteiro
// (o `batch` estrito do Resend recusa os 100), e o job tentava o mesmo lote
// toda hora, em silêncio.
describe("lote à prova de endereço ruim", () => {
  it("separa o que nunca é válido antes de mandar", async () => {
    const { separarPorValidade } = await import("./campanha-musica10");
    const r = separarPorValidade([
      { email: "ana@gmail.com" },
      { email: "x@hotmail.com." },
      { email: "y@gmail" },
      { email: "z z@gmail.com" },
      { email: "bia@uol.com.br" },
    ]);
    expect(r.validos.map((l) => l.email)).toEqual(["ana@gmail.com", "bia@uol.com.br"]);
    expect(r.invalidos.map((l) => l.email)).toEqual(["x@hotmail.com.", "y@gmail", "z z@gmail.com"]);
  });
  it("liga cada id ao endereço certo quando o Resend recusa alguns", async () => {
    const { idsDoLote } = await import("./campanha-musica10");
    // Só os aceitos vêm em `data`, na ordem; `errors` diz o índice dos recusados.
    expect(idsDoLote(4, [{ id: "a" }, { id: "c" }, { id: "d" }], [{ index: 1 }])).toEqual(["a", null, "c", "d"]);
    // Se vier um por posição, vale a posição.
    expect(idsDoLote(2, [{ id: "a" }, { id: "b" }], [])).toEqual(["a", "b"]);
  });
});
