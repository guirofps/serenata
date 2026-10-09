import React from "react";
import { Composition } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { Presente } from "./Presente";
import type { PropsPresente } from "./props";
import { Anuncio, duracaoDoRoteiro, type PropsAnuncio } from "./Anuncio";
import { Compilado, duracaoCompilado } from "./Compilado";
import { Mix, duracaoMix } from "./Mix";
import { FinalBallad, FINAL_BALLAD_S } from "./FinalBallad";
import { AnuncioUGC, FPS_UGC, duracaoUGC, type PropsAnuncioUGC } from "./AnuncioUGC";
import { LetraReacao, FPS_LETRA_REACAO, duracaoLetraReacao, type PropsLetraReacao } from "./LetraReacao";
import { Remarketing,FPS_REMARKETING, DURACAO_REMARKETING_S, duracaoRemarketing, type PropsRemarketing } from "./Remarketing";

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

// Só pro estúdio abrir: o anúncio de verdade sai com as props do script.
const EXEMPLO_LETRA_REACAO: PropsLetraReacao = {
  audio: "anuncio-es/es-us-mama.mp3",
  inicioAudio: 0,
  duracaoS: 45,
  karaoke: [],
  tituloCartao: "LA LETRA QUE ELLA ESTÁ ESCUCHANDO",
  tituloMusica: "",
  gancho: { caixa: "", faixa: "", ate: 3 },
  legendas: [],
  reacoes: { video: "anuncio-es/reacoes.mp4", trechos: [{ de: 0, ate: 26 }] },
  final: { logo: "anuncio-es/logo-clara.webp", titulo: "", destaque: "", sub: "", site: "balladgift.com/es", duracaoS: 6 },
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
      id="Compilado"
      component={Compilado}
      durationInFrames={Math.round(duracaoCompilado() * FPS)}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ inicioAudio: 48.6 }}
    />
    <Composition
      id="Mix"
      component={Mix}
      durationInFrames={Math.round(duracaoMix() * FPS)}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.round(duracaoMix(props.blocos) * FPS) })}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ inicioAudio: 48.6, anuncio: EXEMPLO_ANUNCIO }}
    />
    {/* Cartão final dos criativos da Ballad: 9:16 e 4:5, os dois formatos que chegam. */}
    {/* Anúncio UGC (03/10): props de scratch/ads-serenata/montar.py, --public-dir=scratch/ads-serenata/public. */}
    <Composition
      id="AnuncioUGC"
      component={AnuncioUGC}
      durationInFrames={FPS_UGC}
      fps={FPS_UGC}
      width={1080}
      height={1920}
      defaultProps={{ partes: [] } as PropsAnuncioUGC}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, duracaoUGC(props)) })}
    />
    {/* Remarketing (09/10): props de scratch/remarketing/props-*.json, --public-dir com áudio e capa. */}
    <Composition
      id="Remarketing"
      component={Remarketing}
      durationInFrames={DURACAO_REMARKETING_S * FPS_REMARKETING}
      fps={FPS_REMARKETING}
      width={1080}
      height={1920}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.round(duracaoRemarketing(props) * FPS_REMARKETING) })}
      defaultProps={{ variante: "geral", audio: "", capa: "", logo: "", titulo: "", para: "", linhas: [], textos: { gancho: { reta: "", italico: "" }, papel: { reta: "", italico: "" }, ouvindo: { reta: "", italico: "" }, presente: { reta: "", italico: "" }, cta: { reta: "", italico: "", sub: "", botao: "" } } } as PropsRemarketing}
    />
    {/* Letra + reação em espanhol da Ballad (09/10): props de scratch/anuncio-es/_montar.mjs, --public-dir=video/public. */}
    <Composition
      id="LetraReacao"
      component={LetraReacao}
      durationInFrames={45 * FPS_LETRA_REACAO}
      fps={FPS_LETRA_REACAO}
      width={1080}
      height={1920}
      calculateMetadata={({ props }) => ({ durationInFrames: duracaoLetraReacao(props) })}
      defaultProps={EXEMPLO_LETRA_REACAO}
    />
    <Composition id="FinalBallad" component={FinalBallad} durationInFrames={Math.round(FINAL_BALLAD_S * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{}} />
    <Composition id="FinalBallad45" component={FinalBallad} durationInFrames={Math.round(FINAL_BALLAD_S * FPS)} fps={FPS} width={1080} height={1350} defaultProps={{}} />
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
