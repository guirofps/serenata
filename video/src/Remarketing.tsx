import React from "react";
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as carregarCaveat } from "@remotion/google-fonts/Caveat";
import type { LinhaKaraoke } from "./props";

// REMARKETING (09/10): 30s vertical em motion graphics pra quem já escreveu a
// letra e não comprou. "Do papel ao choro": a letra que a pessoa deixou
// guardada ganha tinta no ritmo do canto, vira música tocando, vira presente
// no celular, e o fechamento diz que a música dela ESTÁ ESPERANDO.
//
// A música e a letra são as de um exemplo público da home (Isabela no geral,
// Denise no gospel), com o tempo de cada palavra tirado da própria página.
// Render local: `scratch/remarketing/` monta as props e o --public-dir.

const { fontFamily: POPPINS } = carregarPoppins("normal", { weights: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: PLAYFAIR } = carregarPlayfair("italic", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] });
const { fontFamily: CAVEAT } = carregarCaveat("normal", { weights: ["600"], subsets: ["latin", "latin-ext"] });

const FUNDO = "#120a0d";
const OURO = "#e8c46a";
const CREME = "#f7ede2";
const VINHO = "#7d2b3a";
const TINTA = "#3b1820";
const suave = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export const FPS_REMARKETING = 30;
export const DURACAO_REMARKETING_S = 30;

type Frase = { reta: string; italico: string };

export type PropsRemarketing = {
  variante: "geral" | "gospel";
  /** Caminhos em `--public-dir` (staticFile). O áudio já vem cortado no trecho. */
  audio: string;
  capa: string;
  logo: string;
  titulo: string;
  para: string;
  /** Linhas com o tempo RELATIVO ao trecho. As 2 primeiras vão no papel, as 2 seguintes no karaokê. */
  linhas: LinhaKaraoke[];
  textos: {
    gancho: Frase;
    papel: Frase;
    ouvindo: Frase;
    presente: Frase;
    cta: Frase & { sub: string; botao: string };
  };
};

// Onde cada cena começa e termina (segundos). O refrão entra aos 3s nos dois
// trechos: o papel abre junto com a primeira palavra cantada.
const CENAS = {
  gancho: [0, 3.2],
  papel: [3.2, 11.2],
  ouvindo: [11.2, 19.6],
  presente: [19.6, 25.2],
  cta: [25.2, 30],
} as const;

const useT = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return f / fps;
};

/** Opacidade de entrada e saída de uma cena, no tempo local dela. */
function fade(t: number, dur: number, entra = 0.45, sai = 0.4) {
  return Math.min(clamp(t / entra), clamp((dur - t) / sai));
}

// ── Fundo ─────────────────────────────────────────────────────────

const Poeira: React.FC<{ n?: number; cor?: string }> = ({ n = 46, cor = OURO }) => {
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
const Raios: React.FC<{ forca?: number }> = ({ forca = 1 }) => {
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

const Fundo: React.FC<{ gospel: boolean }> = ({ gospel }) => (
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
const Titulo: React.FC<{ frase: Frase; t: number; topo: number; tam?: number; corReta?: string; corItalico?: string }> = ({
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

// ── Cena 1: o gancho ──────────────────────────────────────────────

const CenaGancho: React.FC<{ p: PropsRemarketing }> = ({ p }) => {
  const t = useT();
  const dur = CENAS.gancho[1] - CENAS.gancho[0];
  // Uma pena escrevendo um traço, embaixo da pergunta.
  const traco = suave(clamp((t - 1.2) / 1.3));
  return (
    <AbsoluteFill style={{ opacity: fade(t, dur, 0.3, 0.35) }}>
      <Titulo frase={p.textos.gancho} t={t} topo={620} tam={100} />
      <svg width={1080} height={200} style={{ position: "absolute", top: 1000 }} viewBox="0 0 1080 200">
        <path
          d="M 260 100 C 360 40, 440 160, 540 100 S 720 40, 820 100"
          fill="none"
          stroke={OURO}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={800}
          strokeDashoffset={800 * (1 - traco)}
          opacity={0.85}
        />
      </svg>
    </AbsoluteFill>
  );
};

// ── Cena 2: a letra no papel ganha tinta ──────────────────────────

const CenaPapel: React.FC<{ p: PropsRemarketing }> = ({ p }) => {
  const t = useT();
  const [ini, fim] = CENAS.papel;
  const dur = fim - ini;
  const g = t + ini; // tempo do trecho de áudio
  const entra = suave(clamp(t / 0.9));
  const sai = clamp((t - (dur - 0.7)) / 0.7);
  const linhas = p.linhas.slice(0, 2);
  // Ondas sonoras saindo do papel no fim: a letra "ganhando voz".
  const ondas = clamp((t - 5.2) / 2.6);
  return (
    <AbsoluteFill style={{ opacity: fade(t, dur, 0.4, 0.5) }}>
      <Titulo frase={p.textos.papel} t={t - 0.3} topo={210} tam={84} />
      {[0, 1, 2].map((k) => {
        const fase = (ondas * 1.6 + k * 0.33) % 1;
        return ondas > 0 ? (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 540 - 380 - fase * 260,
              top: 1080 - 380 - fase * 260,
              width: 760 + fase * 520,
              height: 760 + fase * 520,
              borderRadius: "50%",
              border: `3px solid ${OURO}`,
              opacity: (1 - fase) * 0.45 * ondas,
            }}
          />
        ) : null;
      })}
      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          top: 700,
          height: 720,
          transform: `translateY(${(1 - entra) * 260 - sai * 60}px) rotate(${-2.5 + entra * 1.2}deg) scale(${0.92 + 0.08 * entra + sai * 0.25})`,
          opacity: entra * (1 - sai),
          filter: `blur(${sai * 10}px)`,
          borderRadius: 18,
          background: `linear-gradient(170deg, #fbf4e8 0%, ${CREME} 60%, #efe1cd 100%)`,
          boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.4) inset",
          overflow: "hidden",
        }}
      >
        {/* pauta do caderno */}
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 262 + i * 76, height: 2, background: "rgba(125,43,58,0.10)" }} />
        ))}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 86, width: 2, background: "rgba(200,80,90,0.22)" }} />
        <div style={{ position: "absolute", top: 70, left: 120, right: 50, fontFamily: POPPINS, fontWeight: 600, fontSize: 26, letterSpacing: 6, color: "rgba(125,43,58,0.6)" }}>
          A LETRA
        </div>
        <div style={{ position: "absolute", top: 112, left: 120, right: 50, fontFamily: PLAYFAIR, fontWeight: 600, fontSize: 52, color: VINHO, lineHeight: 1.1 }}>
          {p.titulo}
        </div>
        <div style={{ position: "absolute", top: 268, left: 120, right: 56 }}>
          {linhas.map((l, li) => (
            <div key={li} style={{ marginBottom: 34, fontFamily: CAVEAT, fontWeight: 600, fontSize: 76, lineHeight: 1.0 }}>
              {l.words.map((w, wi) => {
                const e = suave(clamp((g - w.s + 0.12) / 0.35));
                return (
                  <span
                    key={wi}
                    style={{
                      display: "inline-block",
                      marginRight: "0.22em",
                      color: e > 0.5 ? VINHO : TINTA,
                      opacity: 0.16 + 0.84 * e,
                      transform: `translateY(${(1 - e) * 6}px) scale(${1 + 0.08 * Math.sin(Math.PI * e)})`,
                      textShadow: e > 0 && e < 1 ? `0 0 18px rgba(232,196,106,${0.9 * Math.sin(Math.PI * e)})` : "none",
                    }}
                  >
                    {w.t}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {/* notas subindo do papel quando a letra ganha voz */}
        {Array.from({ length: 7 }).map((_, i) => {
          const nasce = 1.0 + i * 0.85;
          const k = clamp((t - nasce) / 2.6);
          if (k <= 0 || k >= 1) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 140 + random(`n${i}`) * 560,
                top: 760 - k * 520,
                fontSize: 54 + random(`s${i}`) * 26,
                color: OURO,
                opacity: Math.sin(Math.PI * k) * 0.9,
                transform: `rotate(${(random(`a${i}`) - 0.5) * 40}deg)`,
                textShadow: "0 0 14px rgba(232,196,106,0.8)",
              }}
            >
              {i % 2 ? "♪" : "♫"}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Cena 3: vira música (capa + karaokê + ondas) ──────────────────

const Barras: React.FC<{ audio: string; largura: number; n?: number }> = ({ audio, largura, n = 40 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dados = useAudioData(staticFile(audio));
  const off = Math.round(CENAS.ouvindo[0] * fps);
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

const CenaOuvindo: React.FC<{ p: PropsRemarketing }> = ({ p }) => {
  const t = useT();
  const [ini, fim] = CENAS.ouvindo;
  const dur = fim - ini;
  const g = t + ini;
  const entra = suave(clamp(t / 0.9));
  const linhas = p.linhas.slice(2, 4);
  // A linha que está sendo cantada (ou a última que passou).
  let atual = 0;
  linhas.forEach((l, i) => {
    if (g >= l.start - 0.3) atual = i;
  });
  const linha = linhas[atual];
  const trocou = linha ? clamp((g - (linha.start - 0.3)) / 0.45) : 1;
  return (
    <AbsoluteFill style={{ opacity: fade(t, dur, 0.5, 0.45) }}>
      {/* a capa, desfocada, enche a tela */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={staticFile(p.capa)}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(38px) saturate(1.2)", transform: `scale(${1.3 + t * 0.01})`, opacity: 0.55 }}
        />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(18,10,13,0.75) 0%, rgba(18,10,13,0.35) 40%, rgba(18,10,13,0.85) 100%)" }} />
      </AbsoluteFill>
      {p.variante === "gospel" && <Raios forca={0.8} />}
      <Poeira n={24} />
      <Titulo frase={p.textos.ouvindo} t={t - 0.2} topo={170} tam={80} />
      {/* a capa nítida, num cartão que respira com a música */}
      <div
        style={{
          position: "absolute",
          left: 540 - 300,
          top: 520,
          width: 600,
          height: 600,
          borderRadius: 36,
          overflow: "hidden",
          transform: `scale(${(0.85 + 0.15 * entra) * (1 + t * 0.006)})`,
          opacity: entra,
          boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 ${60 + 30 * Math.sin(t * 2)}px rgba(232,196,106,0.35)`,
          border: `3px solid rgba(232,196,106,0.6)`,
        }}
      >
        <Img src={staticFile(p.capa)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.05 + t * 0.012})` }} />
      </div>
      <div style={{ position: "absolute", top: 1150, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: entra }}>
        <Barras audio={p.audio} largura={640} />
      </div>
      {linha && (
        <div
          style={{
            position: "absolute",
            top: 1300,
            left: 70,
            right: 70,
            textAlign: "center",
            fontFamily: PLAYFAIR,
            fontWeight: 600,
            fontSize: 70,
            lineHeight: 1.14,
            opacity: suave(trocou),
            transform: `translateY(${(1 - suave(trocou)) * 30}px)`,
          }}
        >
          {linha.words.map((w, i) => {
            const cantou = g >= w.s;
            const agora = cantou && g < w.e + 0.15;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: "0.24em",
                  color: cantou ? OURO : CREME,
                  opacity: cantou ? 1 : 0.4,
                  transform: `scale(${agora ? 1.07 : 1})`,
                  textShadow: agora ? "0 0 24px rgba(232,196,106,0.85)" : "0 4px 18px rgba(0,0,0,0.6)",
                }}
              >
                {w.t}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── Cena 4: vira presente (o celular com a página) ────────────────

const QR: React.FC<{ tam: number }> = ({ tam }) => {
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

const Coracao: React.FC<{ tam: number; cor: string }> = ({ tam, cor }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24">
    <path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.1 0 3.4 1.2 4 2.3.6-1.1 1.9-2.3 4-2.3 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z" fill={cor} />
  </svg>
);

const CenaPresente: React.FC<{ p: PropsRemarketing }> = ({ p }) => {
  const t = useT();
  const [ini, fim] = CENAS.presente;
  const dur = fim - ini;
  const g = t + ini;
  const entra = suave(clamp(t / 1.0));
  const progresso = clamp((g - 3) / 60);
  const linha = p.linhas.find((l) => g >= l.start - 0.2 && g < l.end + 0.5) ?? p.linhas[Math.min(3, p.linhas.length - 1)];
  const pulsoQr = 1 + 0.04 * Math.max(0, Math.sin((t - 2) * 4)) * clamp(t - 2);
  return (
    <AbsoluteFill style={{ opacity: fade(t, dur, 0.4, 0.45) }}>
      <Titulo frase={p.textos.presente} t={t - 0.2} topo={170} tam={72} />
      {/* corações subindo atrás do celular */}
      {Array.from({ length: 14 }).map((_, i) => {
        const nasce = 0.6 + i * 0.32;
        const k = clamp((t - nasce) / 3.2);
        if (k <= 0 || k >= 1) return null;
        const x = 200 + random(`hx${i}`) * 680;
        return (
          <div key={i} style={{ position: "absolute", left: x + Math.sin(k * 6 + i) * 30, top: 1500 - k * 1100, opacity: Math.sin(Math.PI * k) * 0.8 }}>
            <Coracao tam={36 + random(`hs${i}`) * 40} cor={i % 3 ? OURO : "#c44a5e"} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 540 - 290,
          top: 470,
          width: 580,
          height: 1150,
          borderRadius: 74,
          background: "#141114",
          padding: 16,
          boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 0 3px rgba(232,196,106,0.35)",
          transform: `translateY(${(1 - entra) * 700}px) rotate(${(1 - entra) * 8 - 1.5 + Math.sin(t * 1.2) * 0.6}deg)`,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 60, overflow: "hidden", background: CREME }}>
          <div style={{ width: "100%", height: 430, overflow: "hidden" }}>
            <Img src={staticFile(p.capa)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.05 + t * 0.015})` }} />
          </div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 430, background: "linear-gradient(180deg, transparent 55%, rgba(247,237,226,1) 100%)" }} />
          <div style={{ position: "absolute", top: 50, left: 0, right: 0, textAlign: "center" }}>
            <span style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 18, letterSpacing: 4, color: CREME, background: "rgba(18,10,13,0.45)", padding: "8px 18px", borderRadius: 30 }}>
              UMA MÚSICA PARA VOCÊ
            </span>
          </div>
          <div style={{ position: "relative", zIndex: 2, padding: "0 40px", marginTop: -36, textAlign: "center" }}>
            <div style={{ fontFamily: PLAYFAIR, fontWeight: 600, fontSize: 46, color: VINHO, lineHeight: 1.08 }}>{p.titulo}</div>
            <div style={{ fontFamily: POPPINS, fontWeight: 500, fontSize: 24, color: "rgba(59,24,32,0.7)", marginTop: 8 }}>para {p.para}</div>
            {/* player */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30 }}>
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: VINHO, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ width: 8, height: 26, background: CREME, borderRadius: 2 }} />
                  <div style={{ width: 8, height: 26, background: CREME, borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(125,43,58,0.18)", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(0.3 + progresso) * 100}%`, background: VINHO, borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ fontFamily: PLAYFAIR, fontWeight: 500, fontSize: 30, color: TINTA, marginTop: 34, minHeight: 80, lineHeight: 1.25, display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.24em" }}>
              {linha?.words.map((w, i) => (
                <span key={i} style={{ color: g >= w.s ? VINHO : "rgba(59,24,32,0.35)" }}>
                  {w.t}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ padding: 12, background: "#fff", borderRadius: 18, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", transform: `scale(${pulsoQr})` }}>
                <QR tam={170} />
              </div>
              <div style={{ fontFamily: POPPINS, fontWeight: 500, fontSize: 20, color: "rgba(59,24,32,0.65)" }}>Link + QR Code pra presentear</div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Cena 5: a chamada ─────────────────────────────────────────────

const CenaCta: React.FC<{ p: PropsRemarketing }> = ({ p }) => {
  const t = useT();
  const abre = suave(clamp(t / 0.7));
  const cta = p.textos.cta;
  const aparece = (atraso: number) => suave(clamp((t - atraso) / 0.5));
  const pulso = 1 + 0.035 * Math.max(0, Math.sin((t - 1.8) * 5)) * clamp(t - 1.8);
  const seta = Math.abs(Math.sin(t * 4)) * 16;
  return (
    <AbsoluteFill style={{ clipPath: `circle(${abre * 120}% at 50% 55%)` }}>
      <AbsoluteFill
        style={{
          background:
            p.variante === "gospel"
              ? `radial-gradient(ellipse 100% 60% at 50% 0%, #fff6e2 0%, ${CREME} 55%, #ecd9c1 100%)`
              : `radial-gradient(ellipse 100% 70% at 50% 40%, #fff8ef 0%, ${CREME} 55%, #ead7c3 100%)`,
        }}
      />
      {p.variante === "gospel" && (
        <AbsoluteFill
          style={{
            opacity: 0.6,
            background: `repeating-conic-gradient(from ${t * 3}deg at 50% -8%, rgba(232,196,106,0.22) 0deg 3deg, transparent 3deg 11deg)`,
            maskImage: "radial-gradient(ellipse 90% 60% at 50% 0%, black 0%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 60% at 50% 0%, black 0%, transparent 80%)",
          }}
        />
      )}
      <Poeira n={20} cor="#d9a94c" />
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: aparece(0.2), transform: `translateY(${(1 - aparece(0.2)) * 20}px)` }}>
        <Img src={staticFile(p.logo)} style={{ width: 600 }} />
      </div>
      <Titulo frase={{ reta: cta.reta, italico: cta.italico }} t={t - 0.45} topo={560} tam={98} corReta={TINTA} corItalico={VINHO} />
      <div
        style={{
          position: "absolute",
          top: 900,
          left: 110,
          right: 110,
          textAlign: "center",
          fontFamily: POPPINS,
          fontWeight: 500,
          fontSize: 44,
          lineHeight: 1.3,
          color: "rgba(59,24,32,0.82)",
          opacity: aparece(1.3),
          transform: `translateY(${(1 - aparece(1.3)) * 20}px)`,
        }}
      >
        {cta.sub}
      </div>
      <div style={{ position: "absolute", top: 1150, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: aparece(1.8) }}>
        <div
          style={{
            transform: `scale(${(0.9 + 0.1 * aparece(1.8)) * pulso})`,
            background: `linear-gradient(180deg, #933446 0%, ${VINHO} 100%)`,
            color: CREME,
            fontFamily: POPPINS,
            fontWeight: 700,
            fontSize: 50,
            padding: "34px 64px",
            borderRadius: 100,
            boxShadow: "0 20px 50px rgba(125,43,58,0.45), 0 0 0 4px rgba(232,196,106,0.6)",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <span style={{ fontSize: 46 }}>▶</span> {cta.botao}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1340,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: POPPINS,
          fontWeight: 600,
          fontSize: 36,
          color: VINHO,
          opacity: aparece(2.4),
        }}
      >
        Toque em <b>Saiba mais</b>
        <div style={{ fontSize: 56, marginTop: 4, transform: `translateY(${seta}px)` }}>↓</div>
      </div>
    </AbsoluteFill>
  );
};

// ── Montagem ──────────────────────────────────────────────────────

const em = (s: number) => Math.round(s * FPS_REMARKETING);

export const Remarketing: React.FC<PropsRemarketing> = (p) => {
  const f = useCurrentFrame();
  const total = em(DURACAO_REMARKETING_S);
  const volume = interpolate(f, [0, em(1.2), total - em(2.5), total], [0.25, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cena = (k: keyof typeof CENAS, el: React.ReactNode) => (
    <Sequence from={em(CENAS[k][0])} durationInFrames={em(CENAS[k][1] - CENAS[k][0])} layout="absolute-fill">
      {el}
    </Sequence>
  );
  return (
    <AbsoluteFill style={{ background: FUNDO }}>
      <Audio src={staticFile(p.audio)} volume={volume} />
      <Fundo gospel={p.variante === "gospel"} />
      {cena("gancho", <CenaGancho p={p} />)}
      {cena("papel", <CenaPapel p={p} />)}
      {cena("ouvindo", <CenaOuvindo p={p} />)}
      {cena("presente", <CenaPresente p={p} />)}
      {cena("cta", <CenaCta p={p} />)}
    </AbsoluteFill>
  );
};
