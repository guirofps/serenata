import { describe, expect, it } from "vitest";
import { ErroFoto, mensagemDoErro, type ErroPersonalizar, type ErroPrepararFoto } from "./erro-personalizar";
import { erroDoReconhecedor, type ErroDitado } from "./use-dictation";
import { t as textos } from "./textos";

// OS MOTIVOS DE RECUSA SAEM NO IDIOMA DA TELA (16/10).
//
// O servidor da foto e o hook do ditado devolviam frases em português, e o
// comprador da Ballad as via cruas numa tela em inglês ou espanhol. Agora eles
// devolvem um código e a frase sai do dicionário do idioma.

const CODIGOS: Array<ErroPersonalizar | ErroPrepararFoto> = [
  "nao_encontrado",
  "galeria_cheia",
  "nenhuma_foto",
  "frase_longa",
  "formato",
  "grande",
  "subir",
  "salvar",
  "tipo",
  "navegador",
];

describe("mensagemDoErro (editor)", () => {
  it("todo código tem frase nos três idiomas, e o inglês não é português", () => {
    for (const c of CODIGOS) {
      const pt = mensagemDoErro(c, "pt");
      const en = mensagemDoErro(c, "en");
      const es = mensagemDoErro(c, "es");
      for (const m of [pt, en, es]) {
        expect(m.length, c).toBeGreaterThan(5);
        expect(m, c).not.toContain("—");
      }
      expect(en, c).not.toBe(pt);
      expect(es, c).not.toBe(pt);
    }
  });

  it("os limites entram na frase com o número certo", () => {
    expect(mensagemDoErro("galeria_cheia", "en")).toContain("12");
    expect(mensagemDoErro("frase_longa", "es")).toContain("280");
  });

  it("o ErroFoto carrega o código e guarda a mensagem em português pro log", () => {
    const e = new ErroFoto("tipo", "Use uma foto JPG, PNG ou WEBP.");
    expect(e).toBeInstanceOf(Error);
    expect(e.codigo).toBe("tipo");
    expect(e.message).toBe("Use uma foto JPG, PNG ou WEBP.");
  });
});

describe("ditado por voz", () => {
  it("o código do navegador vira o nosso", () => {
    expect(erroDoReconhecedor("not-allowed")).toBe("sem_permissao");
    expect(erroDoReconhecedor("no-speech")).toBe("sem_fala");
    expect(erroDoReconhecedor("network")).toBe("falhou");
    expect(erroDoReconhecedor(undefined)).toBe("falhou");
  });

  it("cada aviso existe nos três idiomas", () => {
    const chaves: Record<ErroDitado, keyof ReturnType<typeof textos>> = {
      sem_suporte: "ditadoSemSuporte",
      sem_permissao: "ditadoSemPermissao",
      sem_fala: "ditadoSemFala",
      falhou: "ditadoFalhou",
    };
    for (const chave of Object.values(chaves)) {
      const pt = textos("pt")[chave] as string;
      for (const l of ["en", "es"] as const) {
        const m = textos(l)[chave] as string;
        expect(m.length).toBeGreaterThan(5);
        expect(m).not.toBe(pt);
        expect(m).not.toContain("—");
      }
    }
  });
});
