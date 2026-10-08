import { describe, expect, it } from "vitest";
import { escolherFonteDoPresente, type GravacaoDoPresente } from "@/lib/presente-fonte";

// O link do presente não pode "quebrar" durante o ajuste (08/10): 129 ajustes
// em 7 dias, e cada um deixava a página em "link incompleto" até a regravação
// terminar.

const atual: GravacaoDoPresente = {
  titulo: "Nova",
  letra: "letra nova",
  audio_path: null,
  audio_path_v2: null,
  timestamps: null,
  timestamps_v2: null,
};

const arquivada = (ordem: number, audio = true): GravacaoDoPresente => ({
  titulo: `Versão ${ordem}`,
  letra: `letra ${ordem}`,
  audio_path: audio ? `id/versoes/${ordem}/v1.mp3` : null,
  audio_path_v2: audio ? `id/versoes/${ordem}/v2.mp3` : null,
  timestamps: [{ word: "a", start: 0, end: 1 }],
  timestamps_v2: null,
});

describe("escolherFonteDoPresente", () => {
  it("música pronta toca a gravação atual, sem olhar o arquivo", () => {
    const pronta = { ...atual, audio_path: "id/v1.mp3", status: "pronta" };
    const f = escolherFonteDoPresente(pronta, [arquivada(1)]);
    expect(f?.audio_path).toBe("id/v1.mp3");
    expect(f?.atualizando).toBe(false);
  });

  it("durante a regravação toca a última versão arquivada", () => {
    const f = escolherFonteDoPresente({ ...atual, status: "gerando" }, [arquivada(2), arquivada(1)]);
    expect(f?.titulo).toBe("Versão 2");
    expect(f?.letra).toBe("letra 2");
    expect(f?.audio_path).toBe("id/versoes/2/v1.mp3");
    expect(f?.atualizando).toBe(true);
  });

  it("pula versão arquivada sem áudio (página muda é pior que nada)", () => {
    const f = escolherFonteDoPresente({ ...atual, status: "falhou" }, [arquivada(2, false), arquivada(1)]);
    expect(f?.titulo).toBe("Versão 1");
  });

  it("música que nunca ficou pronta continua sem página", () => {
    expect(escolherFonteDoPresente({ ...atual, status: "gerando" }, [])).toBeNull();
    expect(escolherFonteDoPresente({ ...atual, status: "gerando" }, null)).toBeNull();
  });
});
