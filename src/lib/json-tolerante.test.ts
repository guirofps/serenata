import { describe, expect, it } from "vitest";
import { consertarJson, extrairJsonTolerante } from "./json-tolerante";

type Letra = { titulo: string; letra: string; estilo_suno: string };

describe("extrairJsonTolerante", () => {
  it("JSON válido passa intacto", () => {
    const j = '{"titulo":"A","letra":"linha 1\\nlinha 2","estilo_suno":"sertanejo"}';
    expect(extrairJsonTolerante<Letra>(j)).toEqual({
      titulo: "A",
      letra: "linha 1\nlinha 2",
      estilo_suno: "sertanejo",
    });
  });

  it("aspa sem escape dentro da letra (o erro 'Expected : after property name')", () => {
    const j =
      '{"titulo":"Sim","letra":"E ela disse "sim" no altar\\nE eu chorei","estilo_suno":"pop"}';
    expect(() => JSON.parse(j)).toThrow();
    expect(extrairJsonTolerante<Letra>(j).letra).toBe('E ela disse "sim" no altar\nE eu chorei');
  });

  it("quebra de linha crua dentro do texto", () => {
    const j = '{"titulo":"A","letra":"linha 1\nlinha 2","estilo_suno":"pop"}';
    expect(() => JSON.parse(j)).toThrow();
    expect(extrairJsonTolerante<Letra>(j).letra).toBe("linha 1\nlinha 2");
  });

  it("barra solta que não é escape", () => {
    const j = '{"titulo":"A","letra":"meio a meio \\ sempre","estilo_suno":"pop"}';
    expect(() => JSON.parse(j)).toThrow();
    expect(extrairJsonTolerante<Letra>(j).letra).toBe("meio a meio \\ sempre");
  });

  it("texto em volta do JSON e aspa perto do fim do campo", () => {
    const j =
      'Aqui está:\n{"titulo":"Fim","letra":"ela disse \\"oi\\" e depois "tchau"","estilo_suno":"mpb"}\nObrigado';
    expect(extrairJsonTolerante<Letra>(j).letra).toBe('ela disse "oi" e depois "tchau"');
  });

  it("sem JSON nenhum continua lançando", () => {
    expect(() => extrairJsonTolerante("só texto")).toThrow("não continha JSON");
  });

  it("o conserto não mexe em JSON válido", () => {
    const j = '{"a":"x, y: z","b":["1","2"],"c":{"d":"e"}}';
    expect(consertarJson(j)).toBe(j);
  });
});
