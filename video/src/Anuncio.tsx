import React from "react";
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as carregarLora } from "@remotion/google-fonts/Lora";
import type { LinhaKaraoke } from "./props";
import { Presente } from "./Presente";

// O ANÚNCIO: 21s vertical mostrando o produto funcionando, com a música de
// demonstração tocando por baixo.
//
// Tudo aqui é produto de verdade: a tela do quiz e a página presente são
// prints do site, a música e a letra saíram do pipeline do app. A história
// é INVENTADA (Bianca e o café ruim): música, foto e rosto de cliente nunca
// entram em anúncio.
//
// A linguagem vem de anúncio de app (tipografia cinética, capítulos, celular
// com etiquetas), nas cores da marca: vinho, ouro e creme sobre escuro.

const { fontFamily: POPPINS } = carregarPoppins("normal", { weights: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: PLAYFAIR } = carregarPlayfair("italic", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] });
const { fontFamily: LORA } = carregarLora("normal", { weights: ["500"], subsets: ["latin", "latin-ext"] });

const FUNDO = "#120a0d";
const OURO = "#e8c46a";
const CREME = "#f7ede2";
const VINHO = "#7d2b3a";
const suave = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export type PropsAnuncio = {
  titulo: string;
  para: string;
  /** Caminho em `video/public` (staticFile). */
  audio: string;
  /** Segundo da música em que o anúncio começa (um tico antes do refrão). */
  inicioAudio: number;
  versos: string[];
  karaoke: LinhaKaraoke[];
};

// ── Roteiro (em segundos) ─────────────────────────────────────────
// ~5s por cena: com 3,5s (primeira versão, 21s) não dava tempo de ler as
// etiquetas, e o dono achou curto.
const CENAS = {
  gancho: [0, 4.2],
  conta: [4.2, 9.2],
  letra: [9.2, 14.2],
  musica: [14.2, 19.4],
  video: [19.4, 24.6],
  presente: [24.6, 29.6],
  fecho: [29.6, 34],
} as const;
export const DURACAO_ANUNCIO_S = 34;

// ── Peças ─────────────────────────────────────────────────────────

/** Entra (sobe e aparece) e sai (desvanece) dentro da própria cena. */
function useEntradaSaida(dur: number, atraso = 0) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const e = clamp((t - atraso) / 0.5, 0, 1);
  const s = clamp((dur - t) / 0.3, 0, 1);
  return { t, e: suave(e), op: Math.min(e, s) };
}

/** Título em duas linhas: a primeira reta, a segunda em itálico dourado. */
const Titulo: React.FC<{ reta: string; italico: string; dur: number; topo?: number }> = ({ reta, italico, dur, topo = 250 }) => {
  const { t, op } = useEntradaSaida(dur);
  const palavras = reta.split(" ");
  return (
    <div style={{ position: "absolute", top: topo, left: 0, right: 0, textAlign: "center", opacity: op, padding: "0 70px" }}>
      <div style={{ fontFamily: POPPINS, fontWeight: 700, color: CREME, fontSize: 86, lineHeight: 1.05, letterSpacing: -2 }}>
        {palavras.map((p, i) => {
          const e = suave(clamp((t - i * 0.07) / 0.45, 0, 1));
          return (
            <span key={i} style={{ display: "inline-block", marginRight: 22, opacity: e, transform: `translateY(${(1 - e) * 40}px)` }}>
              {p}
            </span>
          );
        })}
      </div>
      <div
        style={{
          fontFamily: PLAYFAIR,
          fontStyle: "italic",
          fontWeight: 600,
          color: OURO,
          fontSize: 100,
          lineHeight: 1.1,
          marginTop: 6,
          opacity: suave(clamp((t - 0.35) / 0.5, 0, 1)),
          transform: `translateY(${(1 - suave(clamp((t - 0.35) / 0.5, 0, 1))) * 40}px)`,
        }}
      >
        {italico}
      </div>
    </div>
  );
};

const Capitulo: React.FC<{ n: string; nome: string; dur: number }> = ({ n, nome, dur }) => {
  const { op } = useEntradaSaida(dur);
  return (
    <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", opacity: op, fontFamily: POPPINS, fontWeight: 600, fontSize: 26, letterSpacing: 8 }}>
      <span style={{ color: OURO }}>{n}</span>
      {nome ? <span style={{ color: "rgba(247,237,226,0.55)" }}> · {nome}</span> : null}
    </div>
  );
};

/** Celular com a tela dentro. Entra subindo, com leve zoom. */
const Celular: React.FC<{ dur: number; topo?: number; largura?: number; children: React.ReactNode; giro?: number }> = ({
  dur,
  topo = 620,
  largura = 500,
  children,
  giro = 0,
}) => {
  const { e, op } = useEntradaSaida(dur, 0.1);
  const altura = (largura - 28) * (844 / 390) + 28;
  return (
    <div
      style={{
        position: "absolute",
        top: topo,
        left: (1080 - largura) / 2,
        width: largura,
        height: altura,
        borderRadius: 74,
        background: "#1b1214",
        padding: 14,
        boxShadow: "0 50px 120px rgba(0,0,0,0.6), 0 0 0 2px rgba(232,196,106,0.18)",
        opacity: op,
        transform: `translateY(${(1 - e) * 140}px) scale(${0.94 + 0.06 * e}) rotate(${giro}deg)`,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 60, overflow: "hidden", background: "#000" }}>{children}</div>
    </div>
  );
};

/** Etiqueta com linha até um ponto (a linha se desenha). */
const Etiqueta: React.FC<{ x: number; y: number; ax: number; ay: number; titulo: string; sub?: string; atraso: number; dur: number }> = ({
  x,
  y,
  ax,
  ay,
  titulo,
  sub,
  atraso,
  dur,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const e = suave(clamp((t - atraso) / 0.5, 0, 1));
  const s = clamp((dur - t) / 0.3, 0, 1);
  const esquerda = x < ax;
  return (
    <AbsoluteFill style={{ opacity: Math.min(e * 1.4, s) }}>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <line x1={x + (esquerda ? 12 : -12)} y1={y} x2={x + (ax - x) * e} y2={y + (ay - y) * e} stroke={OURO} strokeWidth={3} />
        <circle cx={ax} cy={ay} r={12 * e} fill={OURO} />
        <circle cx={ax} cy={ay} r={24 * e} fill="none" stroke={OURO} strokeOpacity={0.4} strokeWidth={2} />
      </svg>
      <div
        style={{
          position: "absolute",
          top: y - 34,
          ...(esquerda ? { right: 1080 - x + 18, textAlign: "right" as const } : { left: x + 18 }),
          fontFamily: POPPINS,
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ color: CREME, fontWeight: 600, fontSize: 31 }}>{titulo}</div>
        {sub ? <div style={{ color: "rgba(247,237,226,0.6)", fontWeight: 500, fontSize: 23 }}>{sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Anéis + barras que batem com a música. */
const Pulso: React.FC<{ bandas: number[]; cy: number; escala?: number; op?: number }> = ({ bandas, cy, escala = 1, op = 1 }) => {
  const graves = (bandas[0] + bandas[1] + bandas[2]) / 3;
  const barras = [5, 3, 1, 2, 4, 6, 8];
  return (
    <AbsoluteFill style={{ opacity: op }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const r = (150 + i * 95) * escala * (1 + 0.06 * graves * (5 - i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 540 - r,
              top: cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              border: `2px solid rgba(232,196,106,${0.5 - i * 0.09})`,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", top: cy - 90 * escala, left: 0, right: 0, height: 180 * escala, display: "flex", alignItems: "center", justifyContent: "center", gap: 22 * escala }}>
        {barras.map((b, i) => {
          const h = (40 + 150 * clamp((bandas[b] ?? 0) * 3.2, 0, 1)) * escala;
          return <div key={i} style={{ width: 26 * escala, height: h, borderRadius: 20, background: OURO }} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Cenas ─────────────────────────────────────────────────────────

const dur = (c: readonly [number, number]) => c[1] - c[0];

const CenaGancho: React.FC<{ bandas: number[] }> = ({ bandas }) => {
  const d = dur(CENAS.gancho);
  const { op } = useEntradaSaida(d);
  return (
    <AbsoluteFill>
      <Capitulo n="SERENATA" nome="" dur={d} />
      <Titulo reta="E se a história de vocês" italico="virasse música?" dur={d} topo={330} />
      <Pulso bandas={bandas} cy={1250} op={op} />
    </AbsoluteFill>
  );
};

const CenaConta: React.FC = () => {
  const d = dur(CENAS.conta);
  return (
    <AbsoluteFill>
      <Capitulo n="01" nome="VOCÊ CONTA" dur={d} />
      <Titulo reta="Você conta" italico="a história…" dur={d} />
      <Celular dur={d}>
        <Img src={staticFile("anuncio/quiz.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
      </Celular>
      <Etiqueta x={250} y={1040} ax={350} ay={1010} titulo="Pra quem é" sub="mãe, pai, amor…" atraso={0.9} dur={d} />
      <Etiqueta x={830} y={760} ax={745} ay={672} titulo="8 perguntas" sub="em 2 minutos" atraso={1.5} dur={d} />
    </AbsoluteFill>
  );
};

const CenaLetra: React.FC<{ versos: string[]; para: string }> = ({ versos, para }) => {
  const d = dur(CENAS.letra);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  // Máquina de escrever: ~60 letras por segundo, depois de o celular entrar.
  const total = versos.join("\n");
  const n = Math.floor(clamp((t - 0.55) * 60, 0, total.length));
  const escrito = total.slice(0, n).split("\n");
  return (
    <AbsoluteFill>
      <Capitulo n="02" nome="A LETRA" dur={d} />
      <Titulo reta="…e a letra sai" italico="na hora." dur={d} />
      <Celular dur={d}>
        <AbsoluteFill style={{ background: "#faf5ee", padding: "90px 44px", fontFamily: LORA }}>
          <div style={{ fontFamily: POPPINS, fontSize: 20, letterSpacing: 6, color: VINHO, fontWeight: 600, textAlign: "center" }}>A LETRA DE</div>
          <div style={{ fontFamily: PLAYFAIR, fontStyle: "italic", fontSize: 58, color: VINHO, textAlign: "center", marginBottom: 40 }}>{para}</div>
          {escrito.map((v, i) => (
            <div key={i} style={{ fontSize: 31, lineHeight: 1.5, color: "#2a1518", marginBottom: 10 }}>
              {v}
              {i === escrito.length - 1 && n < total.length ? <span style={{ color: VINHO }}>|</span> : null}
            </div>
          ))}
        </AbsoluteFill>
      </Celular>
      <Etiqueta x={250} y={1250} ax={345} ay={1010} titulo="De graça" sub="em segundos" atraso={1.2} dur={d} />
    </AbsoluteFill>
  );
};

const CenaMusica: React.FC<{ karaoke: LinhaKaraoke[]; inicioAudio: number; para: string; bandas: number[] }> = ({
  karaoke,
  inicioAudio,
  para,
  bandas,
}) => {
  const d = dur(CENAS.musica);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tMusica = inicioAudio + CENAS.musica[0] + f / fps;
  const linha = [...karaoke].reverse().find((l) => l.start - 0.45 <= tMusica);
  const { op } = useEntradaSaida(d);
  return (
    <AbsoluteFill>
      <Pulso bandas={bandas} cy={1330} escala={1.35} op={op * 0.7} />
      <Capitulo n="03" nome="A MÚSICA" dur={d} />
      <Titulo reta="Vira música" italico="de verdade." dur={d} />
      <Celular dur={d}>
        <Img src={staticFile("anuncio/presente-capa.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {/* A letra acendendo por cima, no lugar do "toque para ouvir":
            é o que a página faz quando a música toca. */}
        <AbsoluteFill style={{ top: "58%", height: "30%", background: "linear-gradient(180deg, rgba(18,10,13,0) 0%, rgba(18,10,13,0.95) 25%)" }} />
        {linha ? (
          <div style={{ position: "absolute", top: "66%", left: 30, right: 30, textAlign: "center", fontFamily: LORA, fontSize: 34, lineHeight: 1.35 }}>
            {linha.words.map((w, i) => (
              <span key={i} style={{ color: w.s <= tMusica && tMusica < w.e + 0.1 ? OURO : w.s <= tMusica ? CREME : "rgba(247,237,226,0.4)" }}>
                {w.t}{" "}
              </span>
            ))}
          </div>
        ) : null}
      </Celular>
      <Etiqueta x={250} y={860} ax={450} ay={955} titulo="O nome dela" sub="cantado na música" atraso={0.8} dur={d} />
      <Etiqueta x={830} y={1440} ax={700} ay={1320} titulo="A letra" sub="acende no ritmo" atraso={1.4} dur={d} />
    </AbsoluteFill>
  );
};

/**
 * O VÍDEO-PRESENTE de verdade, rodando dentro do celular: a mesma composição
 * que a Lambda renderiza pro cliente, em modo `trecho` (sem abertura nem
 * fechamento), com a letra deslocada pro instante da música que está tocando.
 */
const CenaVideo: React.FC<{ karaoke: LinhaKaraoke[]; inicioAudio: number; para: string }> = ({ karaoke, inicioAudio, para }) => {
  const d = dur(CENAS.video);
  const desloca = inicioAudio + CENAS.video[0];
  const trechoKaraoke = React.useMemo(
    () =>
      karaoke
        .filter((l) => l.end - desloca > 0)
        .map((l) => ({
          start: l.start - desloca,
          end: l.end - desloca,
          words: l.words.map((w) => ({ ...w, s: w.s - desloca, e: w.e - desloca })),
        })),
    [karaoke, desloca],
  );
  // O quadro 1080x1920 escalado pela ALTURA da tela do celular e centrado:
  // a tela do celular é mais estreita que 9:16, então sobra um pouco dos lados.
  const altura = (500 - 28) * (844 / 390);
  const escala = altura / 1920;
  return (
    <AbsoluteFill>
      <Capitulo n="04" nome="O VÍDEO" dur={d} />
      <Titulo reta="As fotos de vocês" italico="viram vídeo." dur={d} />
      <Celular dur={d}>
        <div style={{ position: "absolute", top: 0, left: (500 - 28 - 1080 * escala) / 2, width: 1080, height: 1920, transform: `scale(${escala})`, transformOrigin: "0 0" }}>
          <Presente
            audioUrl=""
            fotos={[staticFile("anuncio/namorada.webp")]}
            karaoke={trechoKaraoke}
            titulo=""
            dedicatoria=""
            duracaoS={d}
            locale="pt"
            para={para}
            trecho
          />
        </div>
      </Celular>
      <Etiqueta x={250} y={1500} ax={360} ay={1420} titulo="No ritmo" sub="da música" atraso={0.9} dur={d} />
      <Etiqueta x={830} y={900} ax={700} ay={960} titulo="Pra mandar" sub="no WhatsApp" atraso={1.5} dur={d} />
    </AbsoluteFill>
  );
};

const CenaPresente: React.FC<{ para: string }> = ({ para }) => {
  const d = dur(CENAS.presente);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const cartao = (i: number) => {
    const e = suave(clamp((t - 0.35 - i * 0.35) / 0.5, 0, 1));
    return { opacity: Math.min(e, clamp((d - t) / 0.3, 0, 1)), transform: `translateY(${(1 - e) * 90}px)` };
  };
  const rotulo: React.CSSProperties = { fontFamily: POPPINS, fontWeight: 600, fontSize: 30, color: CREME, textAlign: "center", marginTop: 26 };
  return (
    <AbsoluteFill>
      <Capitulo n="05" nome="O PRESENTE" dur={d} />
      <Titulo reta="E vira" italico="presente." dur={d} />
      <div style={{ position: "absolute", top: 720, left: 40, right: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* Página presente com QR Code */}
        <div style={{ width: 310, ...cartao(0) }}>
          <div style={{ borderRadius: 40, background: "#1b1214", padding: 9, boxShadow: "0 30px 70px rgba(0,0,0,0.5)" }}>
            <div style={{ borderRadius: 32, overflow: "hidden", height: 600 }}>
              <Img src={staticFile("anuncio/presente-capa.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
          <div style={rotulo}>Página com<br />QR Code</div>
        </div>
        {/* Vídeo com as fotos */}
        <div style={{ width: 310, marginTop: 70, ...cartao(1) }}>
          <div style={{ position: "relative", borderRadius: 26, overflow: "hidden", height: 551, boxShadow: "0 30px 70px rgba(0,0,0,0.5)" }}>
            <Img src={staticFile("anuncio/namorada.webp")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.05 + 0.05 * (t / d)})` }} />
            <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(10,4,7,0.85) 100%)" }} />
            <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", fontFamily: PLAYFAIR, fontStyle: "italic", color: OURO, fontSize: 46 }}>{para}</div>
            <div style={{ position: "absolute", top: 20, right: 20, width: 58, height: 58, borderRadius: "50%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 0, height: 0, borderTop: "13px solid transparent", borderBottom: "13px solid transparent", borderLeft: `20px solid ${CREME}`, marginLeft: 5 }} />
            </div>
          </div>
          <div style={rotulo}>Vídeo com<br />as fotos</div>
        </div>
        {/* Quadro pra parede */}
        <div style={{ width: 310, marginTop: 140, ...cartao(2) }}>
          <div style={{ background: "#2c211a", padding: 16, boxShadow: "0 30px 70px rgba(0,0,0,0.5)" }}>
            <Img src={staticFile("anuncio/quadro-exemplo.jpg")} style={{ width: "100%", display: "block" }} />
          </div>
          <div style={rotulo}>Quadro pra<br />parede</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CenaFecho: React.FC = () => {
  const d = dur(CENAS.fecho);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const e = (a: number) => suave(clamp((t - a) / 0.5, 0, 1));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 80px" }}>
      <div style={{ fontFamily: LORA, color: OURO, letterSpacing: 18, fontSize: 40, opacity: e(0) }}>SERENATA</div>
      <div style={{ fontFamily: POPPINS, fontWeight: 700, color: CREME, fontSize: 74, lineHeight: 1.1, marginTop: 50, letterSpacing: -1.5, opacity: e(0.2), transform: `translateY(${(1 - e(0.2)) * 30}px)` }}>
        Uma música feita da
      </div>
      <div style={{ fontFamily: PLAYFAIR, fontStyle: "italic", fontWeight: 600, color: OURO, fontSize: 86, lineHeight: 1.15, opacity: e(0.45), transform: `translateY(${(1 - e(0.45)) * 30}px)` }}>
        história de vocês.
      </div>
      <div
        style={{
          marginTop: 80,
          padding: "34px 70px",
          borderRadius: 999,
          background: OURO,
          color: FUNDO,
          fontFamily: POPPINS,
          fontWeight: 700,
          fontSize: 44,
          opacity: e(0.8),
          transform: `scale(${0.9 + 0.1 * e(0.8)})`,
          boxShadow: "0 20px 60px rgba(232,196,106,0.35)",
        }}
      >
        Crie a sua agora
      </div>
      <div style={{ fontFamily: POPPINS, fontWeight: 500, color: "rgba(247,237,226,0.6)", fontSize: 32, marginTop: 34, opacity: e(1.1) }}>
        A letra é grátis · serenatagift.com
      </div>
    </AbsoluteFill>
  );
};

// ── O anúncio ─────────────────────────────────────────────────────

export const Anuncio: React.FC<PropsAnuncio> = (props) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const audioSrc = staticFile(props.audio);
  const audio = useAudioData(audioSrc);
  const frameMusica = f + Math.round(props.inicioAudio * fps);
  const bandas = audio ? visualizeAudio({ fps, frame: frameMusica, audioData: audio, numberOfSamples: 32, optimizeFor: "speed", smoothing: true }) : new Array(32).fill(0);
  const graves = (bandas[0] + bandas[1] + bandas[2]) / 3;
  const seq = (c: readonly [number, number]) => ({ from: Math.round(c[0] * fps), durationInFrames: Math.round((c[1] - c[0]) * fps) });

  return (
    <AbsoluteFill style={{ backgroundColor: FUNDO }}>
      <Audio
        src={audioSrc}
        startFrom={Math.round(props.inicioAudio * fps)}
        volume={(fr) => interpolate(fr, [0, 8, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      {/* Brilho quente de fundo, que respira com os graves. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(${70 + 10 * graves}% ${45 + 6 * graves}% at 50% 58%, rgba(125,43,58,${0.55 + 0.2 * graves}) 0%, rgba(40,14,20,0.6) 45%, ${FUNDO} 80%)`,
        }}
      />
      <Sequence {...seq(CENAS.gancho)}><CenaGancho bandas={bandas} /></Sequence>
      <Sequence {...seq(CENAS.conta)}><CenaConta /></Sequence>
      <Sequence {...seq(CENAS.letra)}><CenaLetra versos={props.versos} para={props.para} /></Sequence>
      <Sequence {...seq(CENAS.musica)}>
        <CenaMusica karaoke={props.karaoke} inicioAudio={props.inicioAudio} para={props.para} bandas={bandas} />
      </Sequence>
      <Sequence {...seq(CENAS.video)}>
        <CenaVideo karaoke={props.karaoke} inicioAudio={props.inicioAudio} para={props.para} />
      </Sequence>
      <Sequence {...seq(CENAS.presente)}><CenaPresente para={props.para} /></Sequence>
      <Sequence {...seq(CENAS.fecho)}><CenaFecho /></Sequence>
    </AbsoluteFill>
  );
};
