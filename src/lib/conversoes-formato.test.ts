import { describe, expect, it } from "vitest";
import { horaGoogle } from "../../api/conversoes";

// O FORMATO DE HORA QUE O GOOGLE ACEITA, E SÓ ELE.
//
// A primeira versão escrevia `+00:00`, que é ISO 8601 e é o que toda
// linguagem produz sozinha com `toISOString`. O Google recusou as 1.089
// linhas, todas com a mesma mensagem:
//
//   The value '2026-08-27 16:31:11+00:00' in column 'Conversion Time'
//   is invalid.
//
// Ele quer os quatro dígitos colados: `+0000`. A diferença é um par de
// dois-pontos, e ela custou uma importação inteira.
//
// Este teste existe porque o erro é invisível na leitura: as duas formas
// parecem certas, e a errada é justamente a que o autocompletar sugere.
describe("horário no formato do Google Ads", () => {
  it("usa deslocamento de 4 dígitos, sem dois-pontos", () => {
    expect(horaGoogle("2026-08-27T16:31:11.000Z")).toBe("2026-08-27 16:31:11+0000");
  });

  it("nunca devolve o `+00:00` do ISO 8601", () => {
    expect(horaGoogle("2026-08-27T16:31:11.000Z")).not.toContain("+00:00");
  });

  it("não deixa o `T` do ISO no meio", () => {
    expect(horaGoogle("2026-01-02T03:04:05.000Z")).toBe("2026-01-02 03:04:05+0000");
  });

  it("normaliza pra UTC qualquer entrada com fuso", () => {
    // O banco devolve timestamptz; o que importa é o INSTANTE, não o fuso em
    // que ele foi escrito. 13:36 em Brasília é 16:36 em UTC.
    expect(horaGoogle("2026-08-27T13:36:40-03:00")).toBe("2026-08-27 16:36:40+0000");
  });

  it("corta os milissegundos, que o formato não prevê", () => {
    expect(horaGoogle("2026-08-27T16:31:11.987Z")).toBe("2026-08-27 16:31:11+0000");
  });
});
