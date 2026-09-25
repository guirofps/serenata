import React from "react";
import { Composition } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { Presente } from "./Presente";
import type { PropsPresente } from "./props";
import { Anuncio, duracaoDoRoteiro, type PropsAnuncio } from "./Anuncio";

/**
 * O vídeo dura o que a MÚSICA dura, medido no próprio MP3.
 *
 * `duracaoS` do job é só reserva: a coluna `duracao_s` existe pra versão 1
 * e não pra 2, e a última palavra cantada não sabe do instrumental do fim.
 * Cortar o outro no meio seria cortar a parte em que ela chora.
 */
async function duracaoDoVideo(props: PropsPresente): Promise<number> {
  if (!props.audioUrl) return props.duracaoS;
  try {
    return await getAudioDurationInSeconds(props.audioUrl);
  } catch {
    return props.duracaoS;
  }
}

export const FPS = 30;

// Props de exemplo só pro estúdio (`npm run estudio`). Em produção quem manda
// é o job, via `inputProps` do renderMediaOnLambda.
const EXEMPLO: PropsPresente = {
  audioUrl: "",
  fotos: [],
  karaoke: [],
  titulo: "Título da música",
  dedicatoria: "A dedicatória que ela escreveu no editor.",
  duracaoS: 20,
  locale: "pt",
};

// O anúncio renderiza LOCAL (`scratch/anuncio/`), com --public-dir=video/public:
// os prints e a música de demonstração moram lá, fora do git.
const EXEMPLO_ANUNCIO: PropsAnuncio = {
  titulo: "",
  para: "Bianca",
  audio: "anuncio/demo-v1.mp3",
  inicioAudio: 0,
  versos: [],
  karaoke: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Anuncio"
      component={Anuncio}
      durationInFrames={Math.round(duracaoDoRoteiro() * FPS)}
      // O roteiro (completo ou curto) decide a duração.
      calculateMetadata={({ props }) => ({ durationInFrames: Math.round(duracaoDoRoteiro(props.roteiro) * FPS) })}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={EXEMPLO_ANUNCIO}
    />
    <Composition
      id="Presente"
      component={Presente}
      // Placeholder: a duração de verdade vem de `calculateMetadata`, pelo
      // tamanho da música daquela pessoa.
      durationInFrames={FPS * 20}
      fps={FPS}
      // Vertical, formato de story/status. O render sai em 720x1280
      // (`scale` 2/3 no job): no celular não se distingue do 1080 e o
      // arquivo cai de ~140 MB pra ~20 MB numa música de 3 minutos.
      width={1080}
      height={1920}
      defaultProps={EXEMPLO}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.max(FPS * 5, Math.ceil((await duracaoDoVideo(props)) * FPS)),
      })}
    />
    </>
  );
};
