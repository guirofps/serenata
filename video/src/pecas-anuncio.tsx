import React from "react";
import { AbsoluteFill, Easing, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as carregarCaveat } from "@remotion/google-fonts/Caveat";

// PEÇAS DOS ANÚNCIOS EM MOTION GRAPHICS (12/10): fontes, cores da marca, fundo,
// título animado, barras de áudio, QR e coração. Saíram de `Remarketing.tsx`
// pra os anúncios de ângulo (`AnuncioAngulo.tsx`) usarem as mesmas, sem cópia.

export type Frase = { reta: string; italico: string };

export const { fontFamily: POPPINS } = carregarPoppins("normal", { weights: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: PLAYFAIR } = carregarPlayfair("italic", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: CAVEAT } = carregarCaveat("normal", { weights: ["600"], subsets: ["latin", "latin-ext"] });

export const FUNDO = "#120a0d";
export const OURO = "#e8c46a";
export const CREME = "#f7ede2";
export const VINHO = "#7d2b3a";
export const TINTA = "#3b1820";
export const suave = Easing.bezier(0.22, 1, 0.36, 1);
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export const useT = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return f / fps;
};

/** Opacidade de entrada e saída de uma cena, no tempo local dela. */
export function fade(t: number, dur: number, entra = 0.45, sai = 0.4) {
  return Math.min(clamp(t / entra), clamp((dur - t) / sai));
}

// ── Fundo ─────────────────────────────────────────────────────────

export const Poeira: React.FC<{ n?: number; cor?: string }> = ({ n = 46, cor = OURO }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }).map((_, i) => {
        const x = random(`x${i}`) * 1080;
        const vel = 18 + random(`v${i}`) * 40;
        const y = (((random(`y${i}`) * 2100 - t * vel) % 2100) + 2100) % 2100 - 100;
        const r = 3 + random(`r${i}`) * 9;
        const pisca = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * (0.8 + random(`p${i}`) * 1.6) + i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.sin(t * 0.6 + i) * 14,
              top: y,
              width: r,
              height: r,
              borderRadius: "50%",
              background: cor,
              opacity: pisca,
              filter: `blur(${r > 8 ? 3 : 1}px)`,
              boxShadow: `0 0 ${r * 2}px ${cor}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Raios de luz descendo do alto, só no gospel. */
export const Raios: React.FC<{ forca?: number }> = ({ forca = 1 }) => {
  const t = useT();
  return (
    <AbsoluteFill
      style={{
        opacity: 0.55 * forca,
        background: `repeating-conic-gradient(from ${t * 3}deg at 50% -8%, rgba(255,214,140,0.16) 0deg 3deg, transparent 3deg 11deg)`,
        maskImage: "radial-gradient(ellipse 90% 75% at 50% 0%, black 0%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 90% 75% at 50% 0%, black 0%, transparent 75%)",
        mixBlendMode: "screen",
      }}
    />
  );
};

export const Fundo: React.FC<{ gospel: boolean }> = ({ gospel }) => (
  <AbsoluteFill
    style={{
      background: gospel
        ? `radial-gradient(ellipse 120% 70% at 50% 8%, #4a2a1c 0%, #22120f 45%, ${FUNDO} 100%)`
        : `radial-gradient(ellipse 110% 70% at 50% 35%, #3a1520 0%, #1c0d12 50%, ${FUNDO} 100%)`,
    }}
  >
    {gospel && <Raios />}
    <Poeira />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
  </AbsoluteFill>
);

// ── Peças de texto ────────────────────────────────────────────────

/** Título de duas linhas: palavras da reta sobem uma a uma, a itálica em ouro depois. */
export const Titulo: React.FC<{ frase: Frase; t: number; topo: number; tam?: number; corReta?: string; corItalico?: string }> = ({
  frase,
  t,
  topo,
  tam = 92,
  corReta = CREME,
  corItalico = OURO,
}) => {
  const palavras = frase.reta.split(" ");
  const fimReta = 0.1 + palavras.length * 0.12;
  const eIt = suave(clamp((t - fimReta) / 0.6));
  return (
    <div style={{ position: "absolute", top: topo, left: 0, right: 0, textAlign: "center", padding: "0 80px" }}>
      <div style={{ fontFamily: POPPINS, fontWeight: 700, color: corReta, fontSize: tam, lineHeight: 1.06, letterSpacing: -2 }}>
        {palavras.map((p, i) => {
          const e = suave(clamp((t - 0.1 - i * 0.12) / 0.45));
          return (
            <span key={i} style={{ display: "inline-block", opacity: e, transform: `translateY(${(1 - e) * 40}px)`, marginRight: "0.25em" }}>
              {p}
            </span>
          );
        })}
      </div>
      <div
        style={{
          fontFamily: PLAYFAIR,
          fontWeight: 600,
          color: corItalico,
          fontSize: tam * 1.04,
          lineHeight: 1.1,
          marginTop: 6,
          opacity: eIt,
          transform: `translateY(${(1 - eIt) * 30}px) scale(${0.96 + 0.04 * eIt})`,
          filter: `blur(${(1 - eIt) * 8}px)`,
        }}
      >
        {frase.italico}
      </div>
    </div>
  );
};

/** Barras de áudio que reagem à música. `inicio` = segundo do trecho em que a cena começa. */
export const Barras: React.FC<{ audio: string; largura: number; inicio: number; n?: number }> = ({ audio, largura, inicio, n = 40 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dados = useAudioData(staticFile(audio));
  const off = Math.round(inicio * fps);
  const amostras = dados
    ? visualizeAudio({ fps, frame: f + off, audioData: dados, numberOfSamples: 64 }).slice(0, n)
    : Array.from({ length: n }).map((_, i) => 0.2 + 0.2 * Math.sin(f / 4 + i));
  const passo = largura / n;
  return (
    <div style={{ position: "relative", width: largura, height: 120, display: "flex", alignItems: "center", justifyContent: "center", gap: passo * 0.35 }}>
      {amostras.map((v, i) => {
        // espelha pro meio ficar mais alto
        const peso = 1 - Math.abs(i - n / 2) / (n / 2);
        const h = 10 + Math.min(110, v * 900 * (0.4 + peso));
        return <div key={i} style={{ width: passo * 0.65, height: h, borderRadius: 6, background: `linear-gradient(${OURO}, #c98a4b)`, opacity: 0.9 }} />;
      })}
    </div>
  );
};

export const QR: React.FC<{ tam: number }> = ({ tam }) => {
  const n = 21;
  const c = tam / n;
  const olho = (x: number, y: number) => x < 7 && y < 7;
  const ehOlho = (x: number, y: number) => olho(x, y) || olho(n - 1 - x, y) || olho(x, n - 1 - y);
  const corOlho = (x: number, y: number) => {
    const lx = x < 7 ? x : n - 1 - x;
    const ly = y < 7 ? y : n - 1 - y;
    const d = Math.max(Math.abs(lx - 3), Math.abs(ly - 3));
    return d === 3 || d <= 1;
  };
  return (
    <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`}>
      <rect width={tam} height={tam} fill="#fff" />
      {Array.from({ length: n * n }).map((_, i) => {
        const x = i % n;
        const y = Math.floor(i / n);
        const on = ehOlho(x, y) ? corOlho(x, y) : random(`qr${i}`) > 0.52;
        return on ? <rect key={i} x={x * c} y={y * c} width={c + 0.4} height={c + 0.4} fill={TINTA} /> : null;
      })}
    </svg>
  );
};

export const Coracao: React.FC<{ tam: number; cor: string }> = ({ tam, cor }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24">
    <path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.1 0 3.4 1.2 4 2.3.6-1.1 1.9-2.3 4-2.3 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z" fill={cor} />
  </svg>
);
