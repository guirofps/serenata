import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Freeze,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

// O COMPILADO DE REAÇÕES, no formato que vende (27/09).
//
// Assistidos os dois criativos campeões (Video Fone e Vid 5), o que eles têm
// em comum: gente real na tela desde o primeiro segundo, legenda que fala COM
// quem assiste ou narra o que a pessoa sente, e a chamada no fim com urgência.
// Animação de tela de app perdeu pros dois.
//
// A matéria-prima são anúncios já editados (com legenda gravada na imagem). A
// legenda nova entra numa caixa OPACA exatamente por cima da antiga: as caixas
// de cima e de baixo foram medidas quadro a quadro nos trechos usados (as
// antigas ficam entre y=140 e y=560 no topo, e de y=1440 pra baixo no casal).
//
// v2 (mesmo dia, pedido do dono: "ficou seco de efeitos"): soco de zoom com
// flash em cada corte, palavras entrando uma a uma com as palavras-chave em
// dourado, tudo respirando na batida da música, e no fim um mosaico das
// quatro reações com um cartão animado no lugar da imagem parada.
//
// Trilha única por baixo de tudo (a música de demonstração, nossa), com o
// áudio dos clipes mudo: cada clipe tinha a música de outra pessoa.

const { fontFamily: POPPINS } = carregarPoppins("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});
const { fontFamily: PLAYFAIR } = carregarPlayfair("normal", {
  weights: ["600"],
  subsets: ["latin", "latin-ext"],
});

const VINHO = "#7d2b3a";
const CREME = "#faf5ee";
const OURO = "#e8c46a";
const FPS = 30;
const AUDIO = "anuncio/demo-v1.mp3";

type Trecho = {
  src: string;
  /** Segundo de início e fim no arquivo original. */
  de: number;
  ate: number;
  /**
   * Legendas do topo, trocando ao longo do trecho: [segundo relativo, texto].
   * Palavra entre *asteriscos* sai em dourado.
   */
  topo?: Array<[number, string]>;
  /** Legenda de baixo (cobre a antiga do casal). */
  baixo?: string;
};

export const TRECHOS: Trecho[] = [
  // Gancho: o menino chorando com as mãos no rosto. A legenda antiga deste
  // trecho (vermelha, no topo, até ~20s) fica embaixo da caixa; a de baixo só
  // entra aos 23,3s.
  {
    src: "compilado/mae-filho.mp4",
    de: 17.8,
    ate: 21.2,
    topo: [[0, "Se alguém é importante pra você... *não ignore isso!*"]],
  },
  {
    src: "compilado/pai-filha.mp4",
    de: 21.0,
    ate: 34.0,
    topo: [
      [0, "Ele fez uma *música* com a história dela..."],
      [5.5, "Ela não sabia que era pra ela, até ouvir *o próprio nome*"],
    ],
  },
  {
    src: "compilado/casal-sofa.mp4",
    de: 10.0,
    ate: 22.0,
    topo: [[0, "Ele ouviu a história dos dois *virar música*..."]],
    baixo: "Ela só contou a história, leu a letra na hora e recebeu a música completa",
  },
  {
    src: "compilado/mae-filha.mp4",
    de: 18.0,
    ate: 27.5,
    topo: [
      [0, "Um presente que ela *nunca vai esquecer*"],
      [5.5, "Não espere uma data especial. *Faça isso hoje.*"],
    ],
  },
];

// O fim: as quatro reações juntas, e o cartão por cima delas. Os trechos dos
// quadradinhos foram escolhidos onde o original ainda não tem legenda nem
// tela final (conferido quadro a quadro).
const MOSAICO_S = 3.0;
const CARTAO_S = 4.8;
const TILES: Array<{ src: string; de: number; congelaEm?: number }> = [
  { src: "compilado/pai-filha.mp4", de: 27.5 },
  // Janela limpa curta: a legenda vermelha antiga do topo vai até ~20,5s e a
  // de baixo ("Faça você também") entra aos ~23,1s. Toca de 20,6 e congela
  // aos 23,0 (o menino com as mãos no rosto) até o borrão cobrir.
  { src: "compilado/mae-filho.mp4", de: 20.6, congelaEm: 23.0 },
  { src: "compilado/casal-sofa.mp4", de: 20.0 },
  { src: "compilado/mae-filha.mp4", de: 22.0 },
];

const duracaoTrechos = () => TRECHOS.reduce((s, t) => s + (t.ate - t.de), 0);
export const duracaoCompilado = () => duracaoTrechos() + MOSAICO_S + CARTAO_S;

/** Graves da música, 0 a 1, pra tudo respirar na batida. */
function usePulso(frame: number, inicioAudio: number): number {
  const audio = useAudioData(staticFile(AUDIO));
  if (!audio) return 0;
  const b = visualizeAudio({
    fps: FPS,
    frame: frame + Math.round(inicioAudio * FPS),
    audioData: audio,
    numberOfSamples: 32,
    optimizeFor: "speed",
    smoothing: true,
  });
  return Math.min(1, Math.max(0, ((b[0] + b[1] + b[2] + b[3]) / 4) * 2.4));
}

/** Texto com *destaque* em dourado, palavra por palavra entrando. */
function TextoAnimado({ texto, frame, corBase }: { texto: string; frame: number; corBase: string }) {
  // Cada palavra é uma lista de pedaços: "música*..." vira "música" dourado
  // colado em "..." branco, sem espaço no meio.
  let ouro = false;
  const partes = texto
    .split(" ")
    .filter(Boolean)
    .map((palavra) =>
      palavra.split(/(\*)/).flatMap((pedaco) => {
        if (pedaco === "*") {
          ouro = !ouro;
          return [];
        }
        return pedaco ? [{ t: pedaco, ouro }] : [];
      }),
    );
  return (
    <span>
      {partes.map((pedacos, i) => {
        const f = frame - i * 2;
        const op = interpolate(f, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const y = interpolate(f, [0, 6], [22, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: op,
              transform: `translateY(${y}px)`,
              marginRight: "0.26em",
            }}
          >
            {pedacos.map((x, j) => (
              <span key={j} style={{ color: x.ouro ? OURO : corBase }}>
                {x.t}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

function Caixa({
  texto,
  onde,
  frame,
  pulso,
}: {
  texto: string;
  onde: "topo" | "baixo";
  frame: number;
  pulso: number;
}) {
  // A caixa nunca some nem encolhe (é ela que tapa a legenda antiga): o
  // "pulo" de entrada vai de 1 pra cima e volta, nunca abaixo de 1.
  const pulo = interpolate(frame, [0, 4, 10], [1, 1.05, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = pulo * (1 + 0.018 * pulso);
  const base: React.CSSProperties = {
    position: "absolute",
    left: 50,
    right: 50,
    borderRadius: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "0 56px",
    fontFamily: POPPINS,
    fontWeight: 800,
    lineHeight: 1.18,
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    transform: `scale(${s})`,
  };
  return onde === "topo" ? (
    <div
      style={{
        ...base,
        top: 110,
        height: 470,
        fontSize: 76,
        background: `linear-gradient(160deg, ${VINHO}, #5e1f2c)`,
        border: `4px solid ${OURO}66`,
      }}
    >
      <TextoAnimado texto={texto} frame={frame} corBase={CREME} />
    </div>
  ) : (
    <div
      style={{
        ...base,
        top: 1420,
        bottom: -60,
        fontSize: 56,
        background: CREME,
        borderRadius: "40px 40px 0 0",
        transformOrigin: "bottom center",
      }}
    >
      <span style={{ marginTop: -60 }}>
        <TextoAnimado texto={texto} frame={frame - 6} corBase={VINHO} />
      </span>
    </div>
  );
}

function Clipe({ t, primeiro, pulso }: { t: Trecho; primeiro: boolean; pulso: number }) {
  const frame = useCurrentFrame();
  const dur = (t.ate - t.de) * FPS;
  // Zoom lento + soco de entrada no corte + respiro na batida.
  const lento = interpolate(frame, [0, dur], [1.0, 1.06]);
  const soco = primeiro
    ? 0
    : interpolate(frame, [0, 9], [0.16, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const zoom = lento + soco + 0.012 * pulso;
  const flash = primeiro ? 0 : interpolate(frame, [0, 7], [0.7, 0], { extrapolateRight: "clamp" });
  const agoraS = frame / FPS;
  const legenda = [...(t.topo ?? [])].reverse().find(([ini]) => agoraS >= ini);
  const inicioLegenda = legenda ? Math.round(legenda[0] * FPS) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <OffthreadVideo src={staticFile(t.src)} startFrom={Math.round(t.de * FPS)} muted />
      </AbsoluteFill>
      {/* Vinheta leve: tira o ar de vídeo de celular cru. */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)" }}
      />
      {legenda && (
        <Caixa key={legenda[1]} texto={legenda[1]} onde="topo" frame={frame - inicioLegenda} pulso={pulso} />
      )}
      {t.baixo && <Caixa texto={t.baixo} onde="baixo" frame={frame} pulso={pulso} />}
      <AbsoluteFill style={{ backgroundColor: "white", opacity: flash }} />
    </AbsoluteFill>
  );
}

/** As quatro reações em grade 2x2, e o cartão final por cima delas. */
function Final({ pulso }: { pulso: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const noCartao = frame - Math.round(MOSAICO_S * FPS);
  const borrao = interpolate(noCartao, [0, 12], [0, 22], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const escurece = interpolate(noCartao, [0, 12], [0, 0.8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flash = interpolate(frame, [0, 7], [0.7, 0], { extrapolateRight: "clamp" });
  const entra = (atraso: number) =>
    spring({ frame: noCartao - atraso, fps, config: { damping: 14, stiffness: 160 } });
  const respiroBotao = 1 + 0.05 * pulso + 0.03 * Math.sin((noCartao / fps) * Math.PI * 2);
  const fraseEntra = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 170 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ filter: `blur(${borrao}px)` }}>
        {TILES.map((t, i) => {
          const s = spring({ frame: frame - i * 4, fps, config: { damping: 13, stiffness: 170 } });
          const limite = t.congelaEm ? Math.round((t.congelaEm - t.de) * FPS) : 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (i % 2) * 540,
                top: Math.floor(i / 2) * 960,
                width: 540,
                height: 960,
                overflow: "hidden",
                transform: `scale(${(0.7 + 0.3 * s) * (1 + 0.01 * pulso)})`,
                opacity: s,
                border: "4px solid black",
              }}
            >
              <Freeze frame={limite} active={t.congelaEm !== undefined && frame > limite}>
                <OffthreadVideo
                  src={staticFile(t.src)}
                  startFrom={Math.round(t.de * FPS)}
                  muted
                  style={{ width: 540, height: 960, objectFit: "cover" }}
                />
              </Freeze>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Na grade, antes do cartão: a frase no meio, onde as quatro se encontram. */}
      {noCartao < 0 && (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 780,
            padding: "36px 44px",
            borderRadius: 36,
            background: VINHO,
            border: `4px solid ${OURO}`,
            textAlign: "center",
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 60,
            lineHeight: 1.18,
            opacity: fraseEntra,
            transform: `scale(${(0.8 + 0.2 * fraseEntra) * (1 + 0.02 * pulso)})`,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}
        >
          <TextoAnimado texto="Todas essas reações começaram com *uma história*" frame={frame - 10} corBase={CREME} />
        </div>
      )}

      <AbsoluteFill style={{ backgroundColor: `rgba(58, 16, 26, ${escurece})` }} />

      {noCartao >= 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 80px" }}>
          <div
            style={{
              fontFamily: PLAYFAIR,
              fontWeight: 600,
              letterSpacing: 18,
              fontSize: 64,
              color: OURO,
              opacity: entra(0),
              transform: `translateY(${(1 - entra(0)) * 30}px)`,
            }}
          >
            SERENATA
          </div>
          <div
            style={{
              marginTop: 56,
              fontFamily: POPPINS,
              fontWeight: 800,
              fontSize: 84,
              lineHeight: 1.12,
              color: CREME,
            }}
          >
            <TextoAnimado texto="Transforme a história de vocês em *música*" frame={noCartao - 6} corBase={CREME} />
          </div>
          <div
            style={{
              marginTop: 40,
              fontFamily: POPPINS,
              fontWeight: 600,
              fontSize: 44,
              lineHeight: 1.35,
              color: CREME,
              opacity: 0.9 * entra(22),
              transform: `translateY(${(1 - entra(22)) * 24}px)`,
            }}
          >
            Você conta a história.
            <br />A letra sai na hora, de graça.
          </div>
          <div
            style={{
              marginTop: 70,
              padding: "34px 70px",
              borderRadius: 999,
              background: `linear-gradient(135deg, ${OURO}, #d4a84a)`,
              color: "#3a101a",
              fontFamily: POPPINS,
              fontWeight: 800,
              fontSize: 54,
              boxShadow: `0 0 ${40 + 30 * pulso}px ${OURO}88`,
              opacity: entra(34),
              transform: `scale(${(0.7 + 0.3 * entra(34)) * respiroBotao})`,
            }}
          >
            Crie a sua agora
          </div>
          <div
            style={{
              marginTop: 40,
              fontFamily: POPPINS,
              fontWeight: 600,
              fontSize: 40,
              color: CREME,
              opacity: entra(44),
            }}
          >
            serenatagift.com
          </div>
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{ backgroundColor: "white", opacity: flash }} />
    </AbsoluteFill>
  );
}

export const Compilado: React.FC<{ inicioAudio?: number }> = ({ inicioAudio = 48.6 }) => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const pulso = usePulso(frame, inicioAudio);
  const volume = interpolate(frame, [0, 15, durationInFrames - 45, durationInFrames], [0, 0.9, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let desde = 0;
  const clipes = TRECHOS.map((t, i) => {
    const dur = Math.round((t.ate - t.de) * FPS);
    const el = (
      <Sequence key={i} from={desde} durationInFrames={dur}>
        <Clipe t={t} primeiro={i === 0} pulso={pulso} />
      </Sequence>
    );
    desde += dur;
    return el;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile(AUDIO)} startFrom={Math.round(inicioAudio * FPS)} volume={volume} />
      {clipes}
      <Sequence from={desde} durationInFrames={Math.round((MOSAICO_S + CARTAO_S) * FPS)}>
        <Final pulso={pulso} />
      </Sequence>
    </AbsoluteFill>
  );
};
