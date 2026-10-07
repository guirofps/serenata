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
