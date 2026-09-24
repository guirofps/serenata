import { describe, expect, it } from "vitest";
import { assinaturaDoVideo, entradaDaMusica } from "./assinatura-video";

const base = {
  versao_preferida: 1,
  audio_path_v2: "a/v2.mp3",
  foto_path: "f/capa.jpg",
  galeria: ["f/1.jpg", "f/2.jpg"],
  dedicatoria: "Meu amor, obrigado por tudo.",
  titulo: "Sete Meses",
};
const ass = (m: Record<string, unknown>) => assinaturaDoVideo(entradaDaMusica(m));

describe("assinaturaDoVideo", () => {
  it("é estável pra mesma página", () => {
    expect(ass(base)).toBe(ass({ ...base }));
  });

  it("muda quando troca, tira ou reordena foto", () => {
    expect(ass({ ...base, foto_path: "f/outra.jpg" })).not.toBe(ass(base));
    expect(ass({ ...base, galeria: ["f/1.jpg"] })).not.toBe(ass(base));
    expect(ass({ ...base, galeria: ["f/2.jpg", "f/1.jpg"] })).not.toBe(ass(base));
  });

  it("muda com a dedicatória, mas não com espaço sobrando", () => {
    expect(ass({ ...base, dedicatoria: "Outra frase." })).not.toBe(ass(base));
    expect(ass({ ...base, dedicatoria: "  Meu amor,  obrigado por tudo. " })).toBe(ass(base));
  });

  it("versão 2 sem áudio da v2 conta como v1 (é o que o render usa)", () => {
    expect(ass({ ...base, versao_preferida: 2, audio_path_v2: null })).toBe(ass(base));
    expect(ass({ ...base, versao_preferida: 2 })).not.toBe(ass(base));
  });
});
