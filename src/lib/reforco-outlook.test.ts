import { describe, expect, it } from "vitest";
import { assuntoReforco, ehOutlook, textoReforco } from "./reforco-outlook";

describe("reforço de entrega pra Outlook/Hotmail", () => {
  it("reconhece os domínios da Microsoft, em qualquer país", () => {
    for (const e of ["a@hotmail.com", "A@Outlook.com", "x@live.com", "y@msn.com", "z@hotmail.com.br", "w@outlook.com.br", " k@live.com.br "]) {
      expect(ehOutlook(e)).toBe(true);
    }
  });
  it("não pega os outros", () => {
    for (const e of ["a@gmail.com", "b@yahoo.com.br", "c@icloud.com", "d@outlook-mail.com", "e@myhotmail.com", "sem-arroba"]) {
      expect(ehOutlook(e)).toBe(false);
    }
  });
  it("o texto leva o link do editor e o título, sem travessão", () => {
    const t = textoReforco({ nome: "Valentim", titulo: "Galeguinho", linkEditor: "https://www.serenatagift.com/editar/abc" });
    expect(t).toContain("https://www.serenatagift.com/editar/abc");
    expect(t).toContain('"Galeguinho"');
    expect(t).not.toContain("—");
    expect(assuntoReforco("Valentim")).toBe("Seu link da música de Valentim");
  });
  it("sem título, fala da música pelo nome", () => {
    expect(textoReforco({ nome: "Ana", titulo: null, linkEditor: "x" })).toContain("a música de Ana");
  });
});
