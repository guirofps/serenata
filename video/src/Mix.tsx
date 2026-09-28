import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Anuncio, type PropsAnuncio } from "./Anuncio";
import { CARTAO_S, Clipe, Final, MOSAICO_S, usePulso, type Trecho } from "./Compilado";

// O MIX (28/09): o compilado de reações com o "como funciona" das versões g
// no meio. Pedido do dono, e as duas metades vêm de lições diferentes:
//
// - Do compilado: gente real em tela cheia desde o primeiro segundo, legenda
//   que fala com quem assiste, transição com soco e flash. É o que os
//   criativos campeões têm e o que as animações de tela perderam.
// - Das versões g: o que o produto FAZ, que o compilado não mostrava. E não
//   qualquer coisa: as três que mais vendem, na ordem em que acontecem. Ver a
//   letra de graça, OUVIR a prévia antes de pagar, e só então virar presente.
//
// A ordem é reação → como funciona → a reação que paga a explicação ("até
// ouvir o próprio nome") → urgência → os passos. Quem viu o choro no começo
// entende no meio de onde ele veio.
//
// UMA trilha só, tocando aqui. O pedaço das g entra sem a trilha dele
// (`semAudio`) e recebe o `inicioAudio` deslocado pro instante em que ele
// começa, pra a letra acesa e a batida baterem com a música que está tocando.

const FPS = 30;
const AUDIO = "anuncio/demo-v1.mp3";

type Bloco = { tipo: "clipe"; t: Trecho } | { tipo: "produto" };

// Tempo do bloco "produto": o roteiro `produto` do Anuncio (letra 5,5 +
// música 6 + recebe 5). Se o roteiro mudar lá, muda aqui.
const PRODUTO_S = 16.5;
// O cartão final fica um pouco mais que no compilado: tem três passos pra ler.
const CARTAO_MIX_S = CARTAO_S + 0.7;

export const PASSOS = [
  "Conte a história de vocês",
  "Veja a letra grátis e ouça a prévia",
  "Se amar, mande de presente",
];

// As janelas limpas e as caixas por cima da legenda antiga são as mesmas do
// compilado (medidas quadro a quadro lá).
export const BLOCOS: Bloco[] = [
  {
    tipo: "clipe",
    t: {
      src: "compilado/mae-filho.mp4",
      de: 17.8,
      ate: 21.2,
      topo: [[0, "Se alguém é importante pra você... *não ignore isso!*"]],
    },
  },
  {
    tipo: "clipe",
    t: {
      src: "compilado/pai-filha.mp4",
      de: 21.0,
      ate: 26.0,
      topo: [[0, "Ele transformou a história dela em *música*..."]],
    },
  },
  { tipo: "produto" },
  {
    tipo: "clipe",
    t: {
      src: "compilado/pai-filha.mp4",
      de: 28.0,
      ate: 34.0,
      topo: [[0, "Ela não sabia que era pra ela, até ouvir *o próprio nome*"]],
    },
  },
  {
    tipo: "clipe",
    t: {
      src: "compilado/mae-filha.mp4",
      de: 21.0,
      ate: 27.5,
      topo: [
        [0, "Um presente que ela *nunca vai esquecer*"],
        [3.2, "Não espere uma data especial. *Faça isso hoje.*"],
      ],
    },
  },
];

const duracaoBloco = (b: Bloco) => (b.tipo === "produto" ? PRODUTO_S : b.t.ate - b.t.de);
export const duracaoMix = () => BLOCOS.reduce((s, b) => s + duracaoBloco(b), 0) + MOSAICO_S + CARTAO_MIX_S;

export type PropsMix = {
  /** Segundo da música de demonstração em que o vídeo começa. */
  inicioAudio: number;
  /** A demonstração (Bianca: letra, karaokê), a mesma das versões g. */
  anuncio: PropsAnuncio;
};

/** Flash branco curto na entrada do "como funciona", igual aos cortes. */
const Flash: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ backgroundColor: "white", opacity: interpolate(f, [0, 7], [0.7, 0], { extrapolateRight: "clamp" }) }} />;
};

export const Mix: React.FC<PropsMix> = ({ inicioAudio, anuncio }) => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const pulso = usePulso(frame, inicioAudio);
  const volume = interpolate(frame, [0, 15, durationInFrames - 45, durationInFrames], [0, 0.9, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let desde = 0;
  const blocos = BLOCOS.map((b, i) => {
    const dur = Math.round(duracaoBloco(b) * FPS);
    const inicioS = desde / FPS;
    const el =
      b.tipo === "clipe" ? (
        <Sequence key={i} from={desde} durationInFrames={dur}>
          <Clipe t={b.t} primeiro={i === 0} pulso={pulso} />
        </Sequence>
      ) : (
        <Sequence key={i} from={desde} durationInFrames={dur}>
          <Anuncio
            {...anuncio}
            roteiro="produto"
            semAudio
            inicioAudio={inicioAudio + inicioS}
            textos={{
              letra: { reta: "Veja a letra", italico: "na hora, grátis." },
              musica: { reta: "Ouça a prévia", italico: "antes de pagar." },
              recebe: { reta: "Se amar,", italico: "vira presente." },
            }}
          />
          <Flash />
        </Sequence>
      );
    desde += dur;
    return el;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile(AUDIO)} startFrom={Math.round(inicioAudio * FPS)} volume={volume} />
      {blocos}
      <Sequence from={desde} durationInFrames={Math.round((MOSAICO_S + CARTAO_MIX_S) * FPS)}>
        <Final pulso={pulso} passos={PASSOS} />
      </Sequence>
    </AbsoluteFill>
  );
};
