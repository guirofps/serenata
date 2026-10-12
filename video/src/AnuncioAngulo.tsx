import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { LinhaKaraoke } from "./props";
import { CREME, FUNDO, OURO, PLAYFAIR, POPPINS, TINTA, VINHO, Barras, Coracao, Fundo, Poeira, QR, Raios, Titulo, clamp, fade, suave, useT, type Frase } from "./pecas-anuncio";

// ANÚNCIOS DE ÂNGULO (12/10): 31s vertical pro Demand Gen, Serenata (pt) e
// Ballad (espanhol dos EUA), público frio e quente, geral e gospel. Dois
// ângulos, os dois tirados do que mais converte no Google:
//
//   perfume — "Perfume acaba. Música fica." (o título curto que mais vende):
//             perfume esvazia, flor murcha, chocolate some; os três ficam
//             apagados no alto e a música entra no refrão.
//   pov     — o que ELA vê: a mensagem chega, ela abre o link, a página com o
//             nome dela toca a música, e a reação real (`reacoes.mp4`).
//
// O texto inteiro vem das props (idioma e marca são dado, não código). A
// música e o tempo de cada palavra saem da página pública do exemplo.
// Montagem e render: `scratch/anuncios-12out/`.

export const FPS_ANGULO = 30;
export const DURACAO_ANGULO_S = 31;

type Objeto = { tipo: "perfume" | "flor" | "chocolate"; frase: Frase };

export type PropsAngulo = {
  angulo: "perfume" | "pov";
  publico: "frio" | "quente";
  variante: "geral" | "gospel";
  /** Caminhos no --public-dir. O áudio já vem cortado: o refrão cai em `REFRAO_EM`. */
  audio: string;
  capa: string;
  logo: string;
  larguraLogo: number;
  reacoes: string;
  /** Dois trechos do `reacoes.mp4` (segundos), um plano cada. */
  trechosReacao: [number, number];
  titulo: string;
  para: string;
  dominio: string;
  linhas: LinhaKaraoke[];
  textos: {
    objetos: Objeto[];
    fica: Frase;
    presente: Frase;
    gancho: Frase;
    remetente: string;
    mensagem: string;
    linkTitulo: string;
    tocando: Frase;
    reacao: Frase;
    passosTitulo: Frase;
    passos: [string, string, string];
    rotuloPagina: string;
    qr: string;
    cta: Frase & { sub: string; botao: string; toque: string; saibaMais: string };
  };
};

/** Segundo do vídeo em que o refrão começa, por ângulo (o áudio é cortado pra isso). */
export const REFRAO_EM = { perfume: 8.6, pov: 7.0 } as const;

const CENAS = {
  perfume: { objetos: [0, 16.6], fica: [7.9, 16.6], presente: [16.6, 22.4], passos: [22.4, 26.2], cta: [26.2, 31] },
  pov: { pov: [0, 22.8], passos: [22.8, 26.2], cta: [26.2, 31] },
} as const;

const em = (s: number) => Math.round(s * FPS_ANGULO);

// ── Os três presentes que acabam ──────────────────────────────────

const Perfume: React.FC<{ k: number }> = ({ k }) => {
  // k: 0 cheio → 1 vazio
  const nivel = 0.85 * (1 - k);
  const topo = 72 + 166 * (1 - nivel);
  return (
    <svg width={200} height={260} viewBox="0 0 200 260">
      <defs>
        <clipPath id="corpo-perfume">
          <rect x={42} y={72} width={116} height={166} rx={26} />
        </clipPath>
      </defs>
      <rect x={78} y={14} width={44} height={34} rx={6} fill={OURO} />
      <rect x={90} y={48} width={20} height={24} fill="rgba(232,196,106,0.7)" />
      <rect x={42} y={72} width={116} height={166} rx={26} fill="rgba(247,237,226,0.06)" />
      <rect x={42} y={topo} width={116} height={240 - topo} clipPath="url(#corpo-perfume)" fill="rgba(232,150,170,0.75)" />
      <rect x={42} y={72} width={116} height={166} rx={26} fill="none" stroke={OURO} strokeWidth={5} />
      <rect x={58} y={88} width={14} height={60} rx={7} fill="rgba(255,255,255,0.35)" />
    </svg>
  );
};

const Flor: React.FC<{ k: number }> = ({ k }) => {
  const murcha = suave(clamp(k * 1.3));
  return (
    <svg width={200} height={260} viewBox="0 0 200 260">
      <g transform={`rotate(${murcha * 38} 100 252)`}>
        <path d="M100 252 C 96 200, 104 160, 100 108" stroke="#6f9a5a" strokeWidth={7} fill="none" strokeLinecap="round" />
        <ellipse cx={82} cy={190} rx={20} ry={9} fill="#6f9a5a" transform="rotate(-30 82 190)" />
        {Array.from({ length: 6 }).map((_, i) => {
          const cai = clamp((k - 0.15 - i * 0.09) / 0.45);
          const ang = i * 60;
          return (
            <ellipse
              key={i}
              cx={100}
              cy={72}
              rx={17}
              ry={30}
              fill="#c44a5e"
              stroke="#e8a0ad"
              strokeWidth={2}
              transform={`rotate(${ang} 100 100) translate(0 ${cai * 160}) rotate(${cai * 90} 100 72)`}
              opacity={1 - cai}
            />
          );
        })}
        <circle cx={100} cy={100} r={15} fill={OURO} opacity={1 - murcha * 0.5} />
      </g>
    </svg>
  );
};

const Chocolate: React.FC<{ k: number }> = ({ k }) => (
  <svg width={200} height={260} viewBox="0 0 200 260">
    <rect x={34} y={150} width={132} height={96} rx={8} fill={OURO} opacity={0.85} />
    {Array.from({ length: 12 }).map((_, i) => {
      const c = i % 3;
      const l = Math.floor(i / 3);
      const ordem = random(`choc${i}`);
      const some = clamp((k - ordem * 0.75) / 0.18);
      const s = 1 - some;
      const x = 42 + c * 40;
      const y = 22 + l * 40;
      return (
        <g key={i} transform={`translate(${x + 18} ${y + 18}) scale(${s}) translate(${-18} ${-18})`} opacity={s}>
          <rect width={36} height={36} rx={5} fill="#6b3a2a" />
          <rect x={4} y={4} width={28} height={28} rx={4} fill="none" stroke="#8a5038" strokeWidth={3} />
        </g>
      );
    })}
  </svg>
);

const ICONE = { perfume: Perfume, flor: Flor, chocolate: Chocolate };

/** Os presentes aparecem um por vez no centro, acabam, e ficam apagados numa fileira no alto. */
const CenaObjetos: React.FC<{ p: PropsAngulo }> = ({ p }) => {
  const t = useT();
  const BATIDA = 2.7;
  const fimObjetos = BATIDA * 3;
  // Depois que a música entra, a fileira apagada some devagar.
  const fileira = 1 - clamp((t - 8.8) / 1.2) * 0.75;
  return (
    <AbsoluteFill>
      {p.textos.objetos.map((o, i) => {
        const tb = t - i * BATIDA;
        if (tb < 0) return null;
        const Ic = ICONE[o.tipo];
        const entra = suave(clamp(tb / 0.4));
        const k = clamp((tb - 0.45) / 1.8);
        const vai = suave(clamp((tb - 2.25) / 0.55));
        const slotX = 300 + i * 240;
        const cx = 540 + (slotX - 540) * vai;
        const cy = 820 + (250 - 820) * vai;
        const escala = (0.7 + 0.3 * entra) * (1.9 - vai * (1.9 - 0.5));
        const opac = entra * (1 - vai * 0.62) * (vai > 0.5 ? fileira : 1);
        const textoOp = clamp(tb / 0.3) * (1 - clamp((tb - 2.2) / 0.3));
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: cx - 100,
                top: cy - 130,
                width: 200,
                height: 260,
                transform: `scale(${escala})`,
                opacity: opac,
                filter: vai > 0.3 ? `grayscale(${vai})` : "none",
              }}
            >
              <Ic k={k} />
            </div>
            {tb < BATIDA && t < fimObjetos && (
              <div style={{ opacity: textoOp }}>
                <Titulo frase={o.frase} t={tb} topo={1180} tam={100} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ── A música fica ─────────────────────────────────────────────────

/** A linha que está sendo cantada no segundo `g` do trecho (ou a última que passou). */
function linhaAtual(linhas: LinhaKaraoke[], g: number, ini: number, fim: number) {
  const dentro = linhas.filter((l) => l.start >= ini - 0.6 && l.start < fim);
  let atual = dentro[0];
  for (const l of dentro) if (g >= l.start - 0.3) atual = l;
  return atual;
}

const Karaoke: React.FC<{ linha?: LinhaKaraoke; g: number; tam: number; claro?: boolean }> = ({ linha, g, tam, claro }) => {
  if (!linha) return null;
  const troca = suave(clamp((g - (linha.start - 0.3)) / 0.4));
  return (
    <div
      style={{
        fontFamily: PLAYFAIR,
        fontWeight: 600,
        fontSize: tam,
        lineHeight: 1.16,
        textAlign: "center",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: "0.24em",
        opacity: troca,
        transform: `translateY(${(1 - troca) * 20}px)`,
      }}
    >
      {linha.words.map((w, i) => {
        const cantou = g >= w.s;
        const agora = cantou && g < w.e + 0.15;
        const cor = claro ? (cantou ? VINHO : "rgba(59,24,32,0.3)") : cantou ? OURO : "rgba(247,237,226,0.42)";
        return (
          <span key={i} style={{ color: cor, transform: `scale(${agora ? 1.06 : 1})`, textShadow: !claro && agora ? "0 0 22px rgba(232,196,106,0.8)" : "none" }}>
            {w.t}
          </span>
        );
      })}
    </div>
  );
};

const CenaFica: React.FC<{ p: PropsAngulo; ini: number; fim: number }> = ({ p, ini, fim }) => {
  const t = useT();
  const dur = fim - ini;
  const g = t + ini;
  const entra = suave(clamp(t / 0.8));
  return (
    <AbsoluteFill style={{ opacity: fade(t, dur, 0.5, 0.4) }}>
      <AbsoluteFill style={{ overflow: "hidden", opacity: 0.5 * entra }}>
        <Img src={staticFile(p.capa)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) saturate(1.2)", transform: "scale(1.3)" }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(18,10,13,0.8) 0%, rgba(18,10,13,0.35) 45%, rgba(18,10,13,0.88) 100%)" }} />
      </AbsoluteFill>
      {p.variante === "gospel" && <Raios forca={0.8} />}
      <Titulo frase={p.textos.fica} t={t - 0.1} topo={400} tam={96} />
      <div
        style={{
          position: "absolute",
          left: 540 - 260,
          top: 680,
          width: 520,
          height: 520,
          borderRadius: 34,
          overflow: "hidden",
          transform: `scale(${(0.85 + 0.15 * entra) * (1 + t * 0.006)})`,
          opacity: entra,
          border: "3px solid rgba(232,196,106,0.6)",
          boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 ${60 + 30 * Math.sin(t * 2)}px rgba(232,196,106,0.35)`,
        }}
      >
        <Img src={staticFile(p.capa)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.05 + t * 0.012})` }} />
      </div>
      <div style={{ position: "absolute", top: 1230, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: entra }}>
        <Barras audio={p.audio} largura={600} inicio={ini} />
      </div>
      <div style={{ position: "absolute", top: 1370, left: 70, right: 70 }}>
        <Karaoke linha={linhaAtual(p.linhas, g, ini, fim)} g={g} tam={68} />
      </div>
    </AbsoluteFill>
  );
};

// ── O celular: a conversa e a página-presente ─────────────────────

/** Toque na tela: um círculo que abre e some. */
const Toque: React.FC<{ x: number; y: number; t: number }> = ({ x, y, t }) => {
  if (t < 0 || t > 0.6) return null;
  const k = t / 0.6;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 40 - k * 40,
        top: y - 40 - k * 40,
        width: 80 + k * 80,
        height: 80 + k * 80,
        borderRadius: "50%",
        background: `rgba(255,255,255,${0.55 * (1 - k)})`,
        border: `3px solid rgba(255,255,255,${0.8 * (1 - k)})`,
      }}
    />
  );
};

/**
 * A página-presente dentro do celular (tela de 532×1092). `play` é o segundo
 * do VÍDEO em que o play é tocado; `g` é o segundo do trecho de áudio.
 */
const Pagina: React.FC<{ p: PropsAngulo; t: number; g: number; play: number; karaoke: [number, number] }> = ({ p, t, g, play, karaoke }) => {
  const tocando = t >= play;
  const progresso = clamp((t - play) / 70);
  const pulso = tocando ? 1 : 1 + 0.06 * Math.sin(t * 6);
  return (
    <div style={{ position: "absolute", inset: 0, background: CREME, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 470, overflow: "hidden" }}>
        <Img src={staticFile(p.capa)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + t * 0.006})` }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(247,237,226,1) 100%)" }} />
      </div>
      <div style={{ position: "absolute", top: 420, left: 0, right: 0, textAlign: "center", padding: "0 30px" }}>
        <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 20, letterSpacing: 5, color: "rgba(125,43,58,0.7)" }}>{p.textos.rotuloPagina}</div>
        <div style={{ fontFamily: PLAYFAIR, fontWeight: 600, fontSize: 70, color: VINHO, lineHeight: 1.05, marginTop: 4 }}>{p.para}</div>
        <div style={{ fontFamily: POPPINS, fontWeight: 500, fontSize: 22, color: "rgba(59,24,32,0.7)", marginTop: 8 }}>{p.titulo}</div>
      </div>
      <div style={{ position: "absolute", top: 640, left: 50, right: 50, display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: VINHO,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transform: `scale(${pulso})`,
            boxShadow: tocando ? "none" : `0 0 0 ${8 + 6 * Math.sin(t * 6)}px rgba(125,43,58,0.18)`,
          }}
        >
          {tocando ? (
            <div style={{ display: "flex", gap: 9 }}>
              <div style={{ width: 10, height: 34, background: CREME, borderRadius: 2 }} />
              <div style={{ width: 10, height: 34, background: CREME, borderRadius: 2 }} />
            </div>
          ) : (
            <div style={{ width: 0, height: 0, borderTop: "20px solid transparent", borderBottom: "20px solid transparent", borderLeft: `32px solid ${CREME}`, marginLeft: 8 }} />
          )}
        </div>
        <div style={{ flex: 1, height: 10, borderRadius: 5, background: "rgba(125,43,58,0.18)", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${3 + progresso * 97}%`, background: VINHO, borderRadius: 5 }} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 790, left: 34, right: 34, minHeight: 200 }}>
        {tocando && <Karaoke linha={linhaAtual(p.linhas, g, karaoke[0], karaoke[1])} g={g} tam={40} claro />}
      </div>
      <div style={{ position: "absolute", top: 960, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 18, opacity: 0.9 }}>
        <div style={{ padding: 8, background: "#fff", borderRadius: 12 }}>
          <QR tam={80} />
        </div>
        <div style={{ fontFamily: POPPINS, fontWeight: 500, fontSize: 19, color: "rgba(59,24,32,0.65)", maxWidth: 230 }}>{p.textos.qr}</div>
      </div>
    </div>
  );
};

/** A conversa: chega a mensagem e o link com a capa. */
const Conversa: React.FC<{ p: PropsAngulo; t: number }> = ({ p, t }) => {
  const b1 = suave(clamp((t - 0.9) / 0.35));
  const b2 = suave(clamp((t - 1.9) / 0.4));
  const digitando = (t > 0.35 && t < 0.9) || (t > 1.3 && t < 1.9);
  const aperta = t > 3.7 && t < 4.1 ? 0.96 : 1;
  const inicial = p.textos.remetente.trim().charAt(0).toUpperCase();
  return (
    <div style={{ position: "absolute", inset: 0, background: "#ece3d8" }}>
      <div style={{ height: 150, background: "#2a1f22", display: "flex", alignItems: "flex-end", padding: "0 26px 22px", gap: 18 }}>
        <div style={{ width: 66, height: 66, borderRadius: "50%", background: OURO, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: POPPINS, fontWeight: 700, fontSize: 30, color: TINTA }}>
          {inicial}
        </div>
        <div>
          <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 30, color: CREME }}>{p.textos.remetente}</div>
          <div style={{ fontFamily: POPPINS, fontWeight: 500, fontSize: 20, color: "rgba(247,237,226,0.6)" }}>online</div>
        </div>
      </div>
      <div style={{ padding: "34px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
        {b1 > 0 && (
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: 420,
              background: "#fff",
              borderRadius: "8px 26px 26px 26px",
              padding: "18px 24px",
              fontFamily: POPPINS,
              fontWeight: 500,
              fontSize: 30,
              color: TINTA,
              opacity: b1,
              transform: `translateY(${(1 - b1) * 20}px) scale(${0.9 + 0.1 * b1})`,
              transformOrigin: "left top",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            {p.textos.mensagem}
          </div>
        )}
        {b2 > 0 && (
          <div
            style={{
              alignSelf: "flex-start",
              width: 420,
              background: "#fff",
              borderRadius: "8px 26px 26px 26px",
              overflow: "hidden",
              opacity: b2,
              transform: `translateY(${(1 - b2) * 20}px) scale(${(0.9 + 0.1 * b2) * aperta})`,
              transformOrigin: "left top",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <Img src={staticFile(p.capa)} style={{ width: 420, height: 260, objectFit: "cover", display: "block" }} />
            <div style={{ padding: "16px 22px 20px" }}>
              <div style={{ fontFamily: PLAYFAIR, fontWeight: 600, fontSize: 30, color: VINHO, lineHeight: 1.15 }}>{p.textos.linkTitulo}</div>
              <div style={{ fontFamily: POPPINS, fontWeight: 500, fontSize: 19, color: "rgba(59,24,32,0.55)", marginTop: 6 }}>{p.dominio}</div>
            </div>
          </div>
        )}
        {digitando && (
          <div style={{ alignSelf: "flex-start", background: "#fff", borderRadius: 26, padding: "16px 22px", display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(59,24,32,0.4)", transform: `translateY(${Math.sin(t * 10 - i) * 4}px)` }} />
            ))}
          </div>
        )}
      </div>
      <Toque x={230} y={560} t={t - 3.7} />
    </div>
  );
};

/** O celular grande do POV, em coordenadas de tela 532×1092 (bezel de 14). */
const Celular: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      width: 560,
      height: 1120,
      borderRadius: 76,
      background: "#141114",
      padding: 14,
      boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 0 3px rgba(232,196,106,0.35)",
      transformOrigin: "top left",
      ...style,
    }}
  >
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 62, overflow: "hidden" }}>{children}</div>
  </div>
);

const ABRE_PAGINA = 4.3;
const TOCA_PLAY = 6.1;
const REACAO = 17;

const CenaPov: React.FC<{ p: PropsAngulo; fim: number }> = ({ p, fim }) => {
  const t = useT();
  const { fps } = useVideoConfig();
  const g = t; // o POV começa no segundo 0 do trecho
  const entra = suave(clamp(t / 0.7));
  const abre = suave(clamp((t - ABRE_PAGINA) / 0.5));
  // Na reação, o celular encolhe e desce, ainda tocando.
  const r = suave(clamp((t - REACAO) / 0.8));
  const escala = 1.32 - r * (1.32 - 0.42);
  const esq = 540 - (560 * escala) / 2;
  const topo = (1 - entra) * 600 + 420 + r * (1130 - 420);
  const frase = t < TOCA_PLAY - 0.2 ? p.textos.gancho : t < REACAO ? p.textos.tocando : p.textos.reacao;
  const desdeFrase = t < TOCA_PLAY - 0.2 ? t : t < REACAO ? t - (TOCA_PLAY - 0.2) : t - REACAO;
  const meio = (REACAO + fim) / 2;
  const segundo = t >= meio;
  const desdeClip = segundo ? meio : REACAO;
  const rc = suave(clamp((t - (desdeClip + (segundo ? 0 : 0.3))) / 0.45));
  const dur = fim;
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, clamp((dur - t) / 0.4)) }}>
      {/* corações sobem quando a música começa */}
      {Array.from({ length: 16 }).map((_, i) => {
        const nasce = TOCA_PLAY + 1 + i * 0.6;
        const k = clamp((t - nasce) / 3.4);
        if (k <= 0 || k >= 1) return null;
        return (
          <div key={i} style={{ position: "absolute", left: 80 + random(`h${i}`) * 900 + Math.sin(k * 6 + i) * 30, top: 1700 - k * 1300, opacity: Math.sin(Math.PI * k) * 0.7 }}>
            <Coracao tam={34 + random(`hs${i}`) * 36} cor={i % 3 ? OURO : "#c44a5e"} />
          </div>
        );
      })}
      <div key={frase.reta}>
        <Titulo frase={frase} t={desdeFrase} topo={130} tam={78} />
      </div>
      <Celular style={{ left: esq, top: topo, transform: `scale(${escala})` }}>
        <Conversa p={p} t={t} />
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - abre) * 1100}px)` }}>
          {abre > 0 && <Pagina p={p} t={t} g={g} play={TOCA_PLAY} karaoke={[TOCA_PLAY, fim]} />}
        </div>
        <Toque x={50 + 48} y={688} t={t - (TOCA_PLAY - 0.15)} />
      </Celular>
      {t >= REACAO && (
        <div
          key={segundo ? "b" : "a"}
          style={{
            position: "absolute",
            left: 40,
            top: 470,
            width: 1000,
            height: 563,
            borderRadius: 32,
            overflow: "hidden",
            border: "4px solid rgba(232,196,106,0.8)",
            boxShadow: "0 40px 90px rgba(0,0,0,0.65)",
            opacity: rc,
            transform: `translateY(${(1 - rc) * 60}px) scale(${0.95 + 0.05 * rc})`,
          }}
        >
          <Sequence from={Math.round(desdeClip * fps)} layout="none">
            <OffthreadVideo
              src={staticFile(p.reacoes)}
              startFrom={Math.round((segundo ? p.trechosReacao[1] : p.trechosReacao[0]) * fps)}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── O celular pequeno (ângulo perfume) ────────────────────────────

const CenaPresente: React.FC<{ p: PropsAngulo; ini: number; fim: number }> = ({ p, ini, fim }) => {
  const t = useT();
  const dur = fim - ini;
  const entra = suave(clamp(t / 0.9));
  return (
    <AbsoluteFill style={{ opacity: fade(t, dur, 0.4, 0.45) }}>
      <Titulo frase={p.textos.presente} t={t - 0.15} topo={150} tam={80} />
      <Celular style={{ left: 540 - (560 * 1.0) / 2, top: 450 + (1 - entra) * 700, transform: `rotate(${(1 - entra) * 8 - 1 + Math.sin(t * 1.2) * 0.6}deg)` }}>
        <Pagina p={p} t={t + 30} g={t + ini} play={0} karaoke={[ini - 6, fim]} />
      </Celular>
    </AbsoluteFill>
  );
};

// ── Os passos ─────────────────────────────────────────────────────

const CenaPassos: React.FC<{ p: PropsAngulo; ini: number; fim: number }> = ({ p, ini, fim }) => {
  const t = useT();
  const dur = fim - ini;
  const quente = p.publico === "quente";
  return (
    <AbsoluteFill style={{ opacity: fade(t, dur, 0.35, 0.4) }}>
      <Titulo frase={p.textos.passosTitulo} t={t - 0.05} topo={330} tam={92} />
      {p.textos.passos.map((texto, i) => {
        const aparece = suave(clamp((t - (quente ? 0.3 + i * 0.25 : 0.5 + i * 0.75)) / 0.4));
        const feito = quente ? i < 2 : t > 0.8 + i * 0.75;
        const pendente = quente && i === 2;
        const anel = pendente ? 1 + 0.08 * Math.sin(t * 6) : 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 120,
              right: 90,
              top: 760 + i * 170,
              display: "flex",
              alignItems: "center",
              gap: 34,
              opacity: aparece,
              transform: `translateX(${(1 - aparece) * -60}px)`,
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                flexShrink: 0,
                border: `5px solid ${OURO}`,
                background: feito ? OURO : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${anel})`,
                boxShadow: pendente ? `0 0 ${30 + 20 * Math.sin(t * 6)}px rgba(232,196,106,0.6)` : "none",
              }}
            >
              {feito ? (
                <svg width={54} height={54} viewBox="0 0 24 24">
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={FUNDO} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 44, color: OURO }}>{i + 1}</div>
              )}
            </div>
            <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: pendente ? OURO : CREME }}>{texto}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── A chamada ─────────────────────────────────────────────────────

const CenaCta: React.FC<{ p: PropsAngulo }> = ({ p }) => {
  const t = useT();
  const abre = suave(clamp(t / 0.7));
  const cta = p.textos.cta;
  const aparece = (atraso: number) => suave(clamp((t - atraso) / 0.5));
  const pulso = 1 + 0.035 * Math.max(0, Math.sin((t - 1.8) * 5)) * clamp(t - 1.8);
  const seta = Math.abs(Math.sin(t * 4)) * 16;
  return (
    <AbsoluteFill style={{ clipPath: `circle(${abre * 120}% at 50% 55%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 100% 70% at 50% 35%, #fff8ef 0%, ${CREME} 55%, #ead7c3 100%)` }} />
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
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: aparece(0.2) }}>
        <Img src={staticFile(p.logo)} style={{ width: p.larguraLogo }} />
      </div>
      {/* Frase longa ("Regala una canción") quebraria em duas linhas e encostaria no texto de baixo. */}
      <Titulo frase={{ reta: cta.reta, italico: cta.italico }} t={t - 0.45} topo={560} tam={cta.reta.length > 15 ? 78 : 96} corReta={TINTA} corItalico={VINHO} />
      <div
        style={{
          position: "absolute",
          top: 910,
          left: 110,
          right: 110,
          textAlign: "center",
          fontFamily: POPPINS,
          fontWeight: 500,
          fontSize: 44,
          lineHeight: 1.3,
          color: "rgba(59,24,32,0.82)",
          opacity: aparece(1.3),
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
      <div style={{ position: "absolute", top: 1340, left: 0, right: 0, textAlign: "center", fontFamily: POPPINS, fontWeight: 600, fontSize: 36, color: VINHO, opacity: aparece(2.4) }}>
        {cta.toque} <b>{cta.saibaMais}</b>
        <div style={{ fontSize: 56, marginTop: 4, transform: `translateY(${seta}px)` }}>↓</div>
      </div>
    </AbsoluteFill>
  );
};

// ── Montagem ──────────────────────────────────────────────────────

export const AnuncioAngulo: React.FC<PropsAngulo> = (p) => {
  const f = useCurrentFrame();
  const total = em(DURACAO_ANGULO_S);
  const sobe = em(REFRAO_EM[p.angulo] - (p.angulo === "pov" ? 0.9 : 0.5));
  const volume = interpolate(f, [0, sobe, sobe + em(0.6), total - em(2.5), total], [0.22, 0.22, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cena = (de: number, ate: number, el: React.ReactNode) => (
    <Sequence from={em(de)} durationInFrames={em(ate - de)} layout="absolute-fill">
      {el}
    </Sequence>
  );
  const c = CENAS;
  return (
    <AbsoluteFill style={{ background: FUNDO }}>
      <Audio src={staticFile(p.audio)} volume={volume} />
      <Fundo gospel={p.variante === "gospel"} />
      {p.angulo === "perfume" ? (
        <>
          {cena(c.perfume.objetos[0], c.perfume.objetos[1], <CenaObjetos p={p} />)}
          {cena(c.perfume.fica[0], c.perfume.fica[1], <CenaFica p={p} ini={c.perfume.fica[0]} fim={c.perfume.fica[1]} />)}
          {cena(c.perfume.presente[0], c.perfume.presente[1], <CenaPresente p={p} ini={c.perfume.presente[0]} fim={c.perfume.presente[1]} />)}
          {cena(c.perfume.passos[0], c.perfume.passos[1], <CenaPassos p={p} ini={c.perfume.passos[0]} fim={c.perfume.passos[1]} />)}
          {cena(c.perfume.cta[0], c.perfume.cta[1], <CenaCta p={p} />)}
        </>
      ) : (
        <>
          {cena(c.pov.pov[0], c.pov.pov[1], <CenaPov p={p} fim={c.pov.pov[1]} />)}
          {cena(c.pov.passos[0], c.pov.passos[1], <CenaPassos p={p} ini={c.pov.passos[0]} fim={c.pov.passos[1]} />)}
          {cena(c.pov.cta[0], c.pov.cta[1], <CenaCta p={p} />)}
        </>
      )}
    </AbsoluteFill>
  );
};
