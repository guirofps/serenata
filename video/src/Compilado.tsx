import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";

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
// Trilha única por baixo de tudo (a música de demonstração, nossa), com o
// áudio dos clipes mudo: cada clipe tinha a música de outra pessoa.

const { fontFamily: POPPINS } = carregarPoppins("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

const VINHO = "#7d2b3a";
const CREME = "#faf5ee";
const FPS = 30;

type Trecho = {
  src: string;
  /** Segundo de início e fim no arquivo original. */
  de: number;
  ate: number;
  /** Legendas do topo, trocando ao longo do trecho: [segundo relativo, texto]. */
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
    topo: [[0, "Se alguém é importante pra você... não ignore isso!"]],
  },
  {
    src: "compilado/pai-filha.mp4",
    de: 21.0,
    ate: 34.0,
    topo: [
      [0, "Ele fez uma música com a história dela..."],
      [5.5, "Ela não sabia que era pra ela, até ouvir o próprio nome"],
    ],
  },
  {
    src: "compilado/casal-sofa.mp4",
    de: 10.0,
    ate: 22.0,
    topo: [[0, "Ele ouviu a história dos dois virar música..."]],
    baixo: "Ela só contou a história, leu a letra na hora e recebeu a música completa",
  },
  {
    src: "compilado/mae-filha.mp4",
    de: 18.0,
    ate: 27.5,
    topo: [
      [0, "Um presente que ela nunca vai esquecer"],
      [5.5, "Não espere uma data especial. Faça isso hoje."],
    ],
  },
  // Tela final da Serenata, que já vem no fim deste arquivo.
  { src: "compilado/mae-filha.mp4", de: 42.3, ate: 47.0 },
];

export const duracaoCompilado = () => TRECHOS.reduce((s, t) => s + (t.ate - t.de), 0);

function Caixa({
  texto,
  onde,
  frame,
}: {
  texto: string;
  onde: "topo" | "baixo";
  frame: number;
}) {
  // Entra com um "pop" curto; texto grande e curto é o que se lê no feed.
  const s = interpolate(frame, [0, 6], [0.92, 1], { extrapolateRight: "clamp" });
  const base: React.CSSProperties = {
    position: "absolute",
    left: 50,
    right: 50,
    background: onde === "topo" ? VINHO : CREME,
    color: onde === "topo" ? CREME : VINHO,
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
    <div style={{ ...base, top: 110, height: 470, fontSize: 76 }}>{texto}</div>
  ) : (
    <div style={{ ...base, top: 1420, height: 560, bottom: -60, fontSize: 56, borderRadius: "40px 40px 0 0" }}>
      <span style={{ marginTop: -60 }}>{texto}</span>
    </div>
  );
}

function Clipe({ t }: { t: Trecho }) {
  const frame = useCurrentFrame();
  const dur = (t.ate - t.de) * FPS;
  // Um zoom lento dá movimento a um vídeo de celular parado.
  const zoom = interpolate(frame, [0, dur], [1.0, 1.06]);
  const agoraS = frame / FPS;
  const legenda = [...(t.topo ?? [])].reverse().find(([ini]) => agoraS >= ini);
  const inicioLegenda = legenda ? Math.round(legenda[0] * FPS) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <OffthreadVideo src={staticFile(t.src)} startFrom={Math.round(t.de * FPS)} muted />
      </AbsoluteFill>
      {legenda && <Caixa key={legenda[1]} texto={legenda[1]} onde="topo" frame={frame - inicioLegenda} />}
      {t.baixo && <Caixa texto={t.baixo} onde="baixo" frame={frame} />}
    </AbsoluteFill>
  );
}

export const Compilado: React.FC<{ inicioAudio?: number }> = ({ inicioAudio = 48.6 }) => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const volume = interpolate(
    frame,
    [0, 15, durationInFrames - 45, durationInFrames],
    [0, 0.9, 0.9, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  let desde = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio src={staticFile("anuncio/demo-v1.mp3")} startFrom={Math.round(inicioAudio * FPS)} volume={volume} />
      {TRECHOS.map((t, i) => {
        const dur = Math.round((t.ate - t.de) * FPS);
        const el = (
          <Sequence key={i} from={desde} durationInFrames={dur}>
            <Clipe t={t} />
          </Sequence>
        );
        desde += dur;
        return el;
      })}
    </AbsoluteFill>
  );
};
