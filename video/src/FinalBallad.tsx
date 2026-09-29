import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";
import { TextoAnimado } from "./Compilado";

// O CARTÃO FINAL DA BALLAD (29/09), pra colar no fim dos criativos gringos.
//
// Os criativos licenciados de outras marcas terminavam no cartão delas. Este
// entra no lugar: o mesmo passo a passo do `Mix` da Serenata, em inglês, por
// cima do último quadro limpo do vídeo borrado (`fundo`), pra o corte não
// parecer emenda. Sem áudio: a música do próprio criativo continua por baixo
// e morre no fim, montada no ffmpeg (`scratch/criativos-ballad/`).
//
// Um componente pros dois formatos. Os criativos vêm em 9:16 e em 4:5, e o
// cartão se ajusta pela altura do quadro em vez de existir em duas cópias.

const { fontFamily: POPPINS } = carregarPoppins("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
});

const CREME = "#faf5ee";
const OURO = "#e8c46a";

export const FINAL_BALLAD_S = 5.5;

// Promessa conservadora, a mesma do funil: a prévia sai em ~1 minuto, mas o
// anúncio diz "minutes", nunca um número que o provedor pode não cumprir.
export const PASSOS_BALLAD = [
  "Tell us your story",
  "Read your lyrics free, hear a preview in minutes",
  "Love it? Send it as a gift",
];

export type PropsFinalBallad = {
  /** Quadro parado do fim do criativo (em `video/public/`), que vira o fundo borrado. */
  fundo?: string;
};

export const FinalBallad: React.FC<PropsFinalBallad> = ({ fundo }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  // 1920 é a referência; no 4:5 (1350) tudo encolhe junto.
  const k = Math.min(1, height / 1920 + 0.12);
  const entra = (atraso: number) => spring({ frame: frame - atraso, fps, config: { damping: 14, stiffness: 160 } });
  const flash = interpolate(frame, [0, 7], [0.7, 0], { extrapolateRight: "clamp" });
  const borrao = interpolate(frame, [0, 12], [0, 26], { extrapolateRight: "clamp" });
  const escurece = interpolate(frame, [0, 12], [0.2, 0.82], { extrapolateRight: "clamp" });
  const respiro = 1 + 0.04 * Math.sin((frame / fps) * Math.PI * 2);

  return (
    <AbsoluteFill style={{ backgroundColor: "#3a101a" }}>
      {fundo && (
        <AbsoluteFill style={{ filter: `blur(${borrao}px)`, transform: "scale(1.08)" }}>
          <Img src={staticFile(fundo)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ backgroundColor: `rgba(58, 16, 26, ${escurece})` }} />

      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: `0 ${80 * k}px` }}
      >
        <Img
          src={staticFile("ballad/logo-clara.webp")}
          style={{
            width: 420 * k,
            opacity: entra(0),
            transform: `translateY(${(1 - entra(0)) * 30}px)`,
          }}
        />
        <div
          style={{
            marginTop: 50 * k,
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 84 * k,
            lineHeight: 1.12,
            color: CREME,
          }}
        >
          <TextoAnimado texto="Turn their story into a *song*" frame={frame - 6} corBase={CREME} />
        </div>

        <div style={{ marginTop: 48 * k, display: "flex", flexDirection: "column", gap: 24 * k, width: 900 * k }}>
          {PASSOS_BALLAD.map((p, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24 * k,
                textAlign: "left",
                opacity: entra(18 + i * 7),
                transform: `translateX(${(1 - entra(18 + i * 7)) * -40}px)`,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 62 * k,
                  height: 62 * k,
                  borderRadius: "50%",
                  background: OURO,
                  color: "#3a101a",
                  fontFamily: POPPINS,
                  fontWeight: 800,
                  fontSize: 32 * k,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 42 * k, lineHeight: 1.2, color: CREME }}>
                {p}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 64 * k,
            padding: `${32 * k}px ${70 * k}px`,
            borderRadius: 999,
            background: `linear-gradient(135deg, ${OURO}, #d4a84a)`,
            color: "#3a101a",
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 54 * k,
            boxShadow: `0 0 50px ${OURO}88`,
            opacity: entra(34),
            transform: `scale(${(0.7 + 0.3 * entra(34)) * respiro})`,
          }}
        >
          Start for free
        </div>
        <div style={{ marginTop: 36 * k, fontFamily: POPPINS, fontWeight: 600, fontSize: 40 * k, color: CREME, opacity: entra(44) }}>
          balladgift.com
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ backgroundColor: "white", opacity: flash }} />
    </AbsoluteFill>
  );
};
