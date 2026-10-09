import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as carregarLora } from "@remotion/google-fonts/Lora";
import type { LinhaKaraoke } from "./props";
import { ANTECEDE, fimDe } from "./Presente";

// LETRA + REAÇÃO (09/10): o formato do criativo que mais roda na Musimee,
// adaptado pra Ballad em espanhol (hispanos dos EUA).
//
// Tela dividida: em cima, o cartão "a letra que ela está escutando" com a
// letra acendendo palavra por palavra NO TEMPO DA MÚSICA CANTADA (timestamps
// reais do provedor, os mesmos do vídeo-presente); embaixo, as reações reais
// de clientes (o `reacoes.mp4` da home), mudas, com a nossa música por cima.
//
// ── POR QUE O KARAOKÊ É O DO VÍDEO-PRESENTE ──────────────────────
//
// O que vende aqui é "a letra é DELA e a música canta exatamente isso". Se a
// palavra acende fora do tempo, a prova vira teatro, o mesmo erro que matou o
// karaokê com base instrumental (23/07). Por isso o tempo vem de `Presente`:
// a linha entra 0,45s ANTES de ser cantada e a palavra sustentada apaga em
// 2,2s. Um ajuste lá vale aqui.
//
// ── O QUE NÃO PODE APARECER ──────────────────────────────────────
//
// Nada de travessão no texto visível (regra do funil): a letra gerada às vezes
// traz um ("Dios te bendiga", Mamá —) e as aspas soltas que o provedor separa
// em palavra própria. A limpeza mora no script que monta as props
// (`scratch/anuncio-es/_montar.mjs`); aqui ainda se tira o travessão por garantia.

const { fontFamily: POPPINS } = carregarPoppins("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: PLAYFAIR } = carregarPlayfair("italic", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] });
const { fontFamily: LORA } = carregarLora("normal", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] });

const FUNDO = "#120a0d";
const OURO = "#e8c46a";
const CREME = "#f7ede2";
const VINHO = "#7d2b3a";
const VERMELHO = "#d7263d";
const suave = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A metade de cima (cartão da letra) e a de baixo (reações): 960 cada. */
const METADE = 960;

export const FPS_LETRA_REACAO = 30;

/** Um trecho do `reacoes.mp4`: de/até em segundos do arquivo, `x` é o enquadramento horizontal (0-100). */
export type TrechoReacao = { de: number; ate: number; x?: number };

export type PropsLetraReacao = {
  /** Música sem metadados, em `video/public` (staticFile). */
  audio: string;
  /** Segundo da música em que o anúncio começa (uns 4s antes do refrão). */
  inicioAudio: number;
  /** Duração do anúncio inteiro, com o cartão final. */
  duracaoS: number;
  /** Letra com tempo absoluto da música (o `inicioAudio` é descontado aqui). */
  karaoke: LinhaKaraoke[];
  /** "LA LETRA QUE ELLA ESTÁ ESCUCHANDO". */
  tituloCartao: string;
  tituloMusica: string;
  /** Nome de quem ganha: acende em itálico dourado quando cantado ("Marisol"). */
  nome?: string;
  /** O gancho dos primeiros segundos: a caixa branca e a faixa vermelha. */
  gancho: { caixa: string; faixa: string; ate: number };
  /** Frases do meio, na mesma caixa branca, cada uma na sua janela. */
  legendas: Array<{ texto: string; de: number; ate: number }>;
  /** O vídeo das reações (em `video/public`), os trechos em ordem e a velocidade. */
  reacoes: { video: string; trechos: TrechoReacao[]; velocidade?: number };
  /** O cartão final, que ocupa os últimos `duracaoS` segundos. */
  final: { logo: string; titulo: string; destaque: string; sub: string; site: string; duracaoS: number };
};

const semAcento = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const semTravessao = (s: string) => s.replace(/\s*[—–]\s*/g, " ").trim();

// ── Cartão da letra ───────────────────────────────────────────────

/** A linha da vez: a última que já "entrou" (0,45s antes da primeira palavra). */
function indiceAtivo(karaoke: LinhaKaraoke[], t: number): number {
  let ativa = -1;
  for (let i = 0; i < karaoke.length; i++) {
    if (karaoke[i].start - ANTECEDE <= t) ativa = i;
    else break;
  }
  return ativa;
}

const LinhaApagada: React.FC<{ linha?: LinhaKaraoke; op: number }> = ({ linha, op }) =>
  linha ? (
    <div style={{ fontFamily: LORA, fontWeight: 500, fontSize: 38, lineHeight: 1.3, color: CREME, opacity: op, textAlign: "center" }}>
      {semTravessao(linha.words.map((w) => w.t).join(" "))}
    </div>
  ) : (
    <div style={{ height: 50 }} />
  );

const CartaoLetra: React.FC<{ props: PropsLetraReacao; tMusica: number; bandas: number[] }> = ({ props, tMusica, bandas }) => {
  const { karaoke, nome } = props;
  const nomeChave = semAcento((nome ?? "").split(/\s+/)[0] ?? "");
  // Antes da primeira linha entrar, a próxima já fica na tela (apagada): o
  // cartão nunca abre vazio.
  const ativo = indiceAtivo(karaoke, tMusica);
  const idx = Math.max(0, ativo);
  const linha = karaoke[idx];
  // Troca de linha: a nova sobe um tico e acende, como letra de app de música.
  const entrou = linha ? tMusica - (linha.start - ANTECEDE) : 1;
  const e = ativo < 0 ? 1 : suave(clamp(entrou / 0.35, 0, 1));
  const graves = (bandas[0] + bandas[1] + bandas[2]) / 3;

  return (
    <AbsoluteFill style={{ height: METADE }}>
      {/* Brilho quente que respira com os graves, atrás do cartão. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(${80 + 10 * graves}% ${60 + 8 * graves}% at 50% 55%, rgba(125,43,58,${0.6 + 0.2 * graves}) 0%, rgba(40,14,20,0.7) 50%, ${FUNDO} 85%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 44,
          right: 44,
          top: 70,
          bottom: 40,
          borderRadius: 44,
          background: "linear-gradient(180deg, rgba(36,14,20,0.92) 0%, rgba(24,10,14,0.95) 100%)",
          boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 0 2px rgba(232,196,106,0.28)`,
          overflow: "hidden",
        }}
      >
        {/* Cabeçalho: o "ao vivo" diz que ela está ouvindo AGORA. */}
        <div style={{ position: "absolute", top: 46, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: VERMELHO,
                boxShadow: `0 0 ${10 + 14 * graves}px ${VERMELHO}`,
                opacity: 0.7 + 0.3 * Math.sin(tMusica * 5),
              }}
            />
            <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 33, letterSpacing: 3, color: OURO }}>{props.tituloCartao}</div>
          </div>
          <div style={{ fontFamily: PLAYFAIR, fontStyle: "italic", fontWeight: 600, fontSize: 50, color: CREME, marginTop: 14 }}>
            “{props.tituloMusica}”
          </div>
          <div style={{ width: 120, height: 2, background: "rgba(232,196,106,0.5)", margin: "26px auto 0" }} />
        </div>

        {/* A letra: anterior apagada, a da vez acendendo, a próxima apagada. */}
        <div
          style={{
            position: "absolute",
            top: 250,
            left: 50,
            right: 50,
            height: 420,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 30,
          }}
        >
          <LinhaApagada linha={ativo >= 1 ? karaoke[idx - 1] : undefined} op={0.32 * e} />
          {linha ? (
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "0 16px",
                opacity: 0.4 + 0.6 * e,
                transform: `translateY(${(1 - e) * 36}px)`,
              }}
            >
              {linha.words.map((w, i) => {
                const texto = semTravessao(w.t);
                if (!texto) return null;
                const cantada = w.s <= tMusica + 0.02;
                const atual = w.s <= tMusica && tMusica < fimDe(w) + 0.08;
                const ehNome = nomeChave.length >= 3 && semAcento(texto).startsWith(nomeChave);
                return (
                  <span
                    key={i}
                    style={{
                      fontFamily: ehNome ? PLAYFAIR : LORA,
                      fontStyle: ehNome ? "italic" : "normal",
                      fontWeight: 600,
                      fontSize: 62,
                      lineHeight: 1.25,
                      color: atual || (ehNome && cantada) ? OURO : cantada ? CREME : "rgba(247,237,226,0.34)",
                      display: "inline-block",
                      transform: `scale(${atual ? 1.06 : 1})`,
                      textShadow: atual ? "0 0 26px rgba(232,196,106,0.55)" : "none",
                    }}
                  >
                    {texto}
                  </span>
                );
              })}
            </div>
          ) : null}
          <LinhaApagada linha={karaoke[idx + 1]} op={0.32 * e} />
        </div>

        {/* Equalizador: o áudio lido de verdade, espelhado a partir do centro. */}
        <Equalizador bandas={bandas} />
      </div>
    </AbsoluteFill>
  );
};

const Equalizador: React.FC<{ bandas: number[] }> = ({ bandas }) => {
  const n = 15;
  const barras = Array.from({ length: n * 2 + 1 }, (_, i) => Math.abs(i - n));
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 54,
        height: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      {barras.map((b, i) => {
        // Banda baixa no centro, aguda nas pontas: o meio pulsa mais.
        // Só as 8 primeiras bandas, com raiz quadrada: as agudas do
        // `visualizeAudio` vêm quase em zero, e no primeiro render o
        // equalizador saiu uma fila de pontinhos com uma barra no meio.
        const v = clamp(Math.sqrt(bandas[Math.floor(b / 2)] ?? 0) * 2.3, 0, 1);
        const h = 10 + 76 * v * (1 - (b / (n + 4)) * 0.6);
        return <div key={i} style={{ width: 12, height: h, borderRadius: 8, background: OURO, opacity: 0.45 + 0.55 * v }} />;
      })}
    </div>
  );
};

// ── Reações (metade de baixo) ─────────────────────────────────────

const Reacoes: React.FC<{ reacoes: PropsLetraReacao["reacoes"] }> = ({ reacoes }) => {
  const { fps } = useVideoConfig();
  const vel = reacoes.velocidade ?? 1;
  let inicio = 0;
  const blocos = reacoes.trechos.map((tr) => {
    const dur = (tr.ate - tr.de) / vel;
    const b = { ...tr, de0: inicio, dur };
    inicio += dur;
    return b;
  });
  return (
    <div style={{ position: "absolute", left: 0, top: METADE, width: 1080, height: METADE, overflow: "hidden", background: "#000" }}>
      {blocos.map((b, i) => (
        <Sequence key={i} from={Math.round(b.de0 * fps)} durationInFrames={Math.max(1, Math.round(b.dur * fps))} layout="none">
          <TrechoVideo src={reacoes.video} de={b.de} x={b.x ?? 50} vel={vel} dur={b.dur} />
        </Sequence>
      ))}
      {/* Costura entre as metades: sombra curta, pra o cartão "assentar" no vídeo. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70, background: "linear-gradient(180deg, rgba(18,10,13,0.85), rgba(18,10,13,0))" }} />
    </div>
  );
};

const TrechoVideo: React.FC<{ src: string; de: number; x: number; vel: number; dur: number }> = ({ src, de, x, vel, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Aproximação lenta: dá vida ao trecho sem mexer no enquadramento.
  const zoom = 1.02 + 0.05 * clamp(f / fps / dur, 0, 1);
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={Math.round(de * fps)}
        playbackRate={vel}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x}% 50%`, transform: `scale(${zoom})`, transformOrigin: `${x}% 45%` }}
      />
    </AbsoluteFill>
  );
};

// ── Textos por cima (gancho e legendas) ───────────────────────────

/** A caixa branca de legenda de selfie: sobe e aparece, desvanece no fim. */
function useJanela(de: number, ate: number) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const e = suave(clamp((t - de) / 0.35, 0, 1));
  const s = clamp((ate - t) / 0.25, 0, 1);
  return { op: Math.min(e, s), e, t };
}

const CaixaBranca: React.FC<{ texto: string; tamanho?: number }> = ({ texto, tamanho = 52 }) => (
  <div
    style={{
      background: "#ffffff",
      color: "#16090c",
      fontFamily: POPPINS,
      fontWeight: 700,
      fontSize: tamanho,
      lineHeight: 1.2,
      padding: "20px 34px",
      borderRadius: 22,
      textAlign: "center",
      maxWidth: 1010,
      boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
    }}
  >
    {semTravessao(texto)}
  </div>
);

const Gancho: React.FC<{ gancho: PropsLetraReacao["gancho"] }> = ({ gancho }) => {
  const { op, e } = useJanela(0, gancho.ate);
  if (op <= 0.001) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", top: 800, height: 320, opacity: op, transform: `translateY(${(1 - e) * 30}px)` }}>
      <CaixaBranca texto={gancho.caixa} tamanho={47} />
      <div
        style={{
          marginTop: -6,
          background: VERMELHO,
          color: "#ffffff",
          fontFamily: POPPINS,
          fontWeight: 700,
          fontSize: 33,
          padding: "14px 26px",
          borderRadius: 14,
          textAlign: "center",
          maxWidth: 1010,
          whiteSpace: "nowrap",
          boxShadow: "0 12px 34px rgba(0,0,0,0.4)",
        }}
      >
        {semTravessao(gancho.faixa)}
      </div>
    </AbsoluteFill>
  );
};

const Legenda: React.FC<{ texto: string; de: number; ate: number }> = ({ texto, de, ate }) => {
  const { op, e } = useJanela(de, ate);
  if (op <= 0.001) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", top: 890, height: 200, opacity: op, transform: `translateY(${(1 - e) * 24}px) scale(${0.96 + 0.04 * e})` }}>
      <CaixaBranca texto={texto} tamanho={50} />
    </AbsoluteFill>
  );
};

// ── Cartão final ──────────────────────────────────────────────────

const CartaoFinal: React.FC<{ final: PropsLetraReacao["final"]; ini: number }> = ({ final, ini }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps - ini;
  if (t < 0) return null;
  const ent = (a: number) => suave(clamp((t - a) / 0.5, 0, 1));
  const fundo = clamp(t / 0.45, 0, 1);
  const pulo = Math.abs(Math.sin(t * Math.PI * 1.6));
  return (
    <AbsoluteFill style={{ opacity: fundo }}>
      <AbsoluteFill style={{ background: `radial-gradient(90% 60% at 50% 40%, ${VINHO} 0%, #3a101a 55%, ${FUNDO} 100%)` }} />
      <AbsoluteFill style={{ alignItems: "center", textAlign: "center", padding: "0 60px", paddingTop: 380 }}>
        <Img src={staticFile(final.logo)} style={{ width: 460, opacity: ent(0.1), transform: `translateY(${(1 - ent(0.1)) * 24}px)` }} />
        <div
          style={{
            marginTop: 90,
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 76,
            lineHeight: 1.12,
            color: CREME,
            letterSpacing: -1,
            opacity: ent(0.3),
            transform: `translateY(${(1 - ent(0.3)) * 30}px)`,
          }}
        >
          {final.titulo} <span style={{ color: OURO }}>{final.destaque}</span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: PLAYFAIR,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 46,
            lineHeight: 1.3,
            color: "rgba(247,237,226,0.92)",
            opacity: ent(0.6),
            transform: `translateY(${(1 - ent(0.6)) * 24}px)`,
          }}
        >
          {final.sub}
        </div>
        <div
          style={{
            marginTop: 70,
            padding: "26px 60px",
            borderRadius: 999,
            background: `linear-gradient(135deg, ${OURO}, #d4a84a)`,
            color: "#3a101a",
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 54,
            boxShadow: `0 0 50px ${OURO}66`,
            opacity: ent(0.9),
            transform: `scale(${0.8 + 0.2 * ent(0.9)})`,
          }}
        >
          {final.site}
        </div>
        {/* Seta pro botão do anúncio, que a plataforma desenha embaixo. */}
        <svg width={170} height={215} viewBox="0 0 150 190" style={{ marginTop: 70, opacity: ent(1.2), transform: `translateY(${pulo * 26}px)` }}>
          <path d="M75 10 L75 160 M22 108 L75 162 L128 108" stroke={OURO} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── O anúncio ─────────────────────────────────────────────────────

export const duracaoLetraReacao = (p: Pick<PropsLetraReacao, "duracaoS">) => Math.round(p.duracaoS * FPS_LETRA_REACAO);

export const LetraReacao: React.FC<PropsLetraReacao> = (props) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = f / fps;
  const tMusica = props.inicioAudio + t;
  const audioSrc = staticFile(props.audio);
  const dados = useAudioData(audioSrc);
  const bandas = dados
    ? visualizeAudio({ fps, frame: f + Math.round(props.inicioAudio * fps), audioData: dados, numberOfSamples: 32, optimizeFor: "speed", smoothing: true })
    : new Array(32).fill(0);
  const iniFinal = props.duracaoS - props.final.duracaoS;
  // Entra em 1,5s (o anúncio começa no meio da música) e morre durante o
  // cartão final, sem corte seco.
  const fimCheio = Math.round((iniFinal + 0.8) * fps);
  const volume = (fr: number) =>
    interpolate(fr, [0, Math.round(1.5 * fps), fimCheio, durationInFrames], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    });

  return (
    <AbsoluteFill style={{ backgroundColor: FUNDO }}>
      <Audio src={audioSrc} startFrom={Math.round(props.inicioAudio * fps)} volume={volume} />
      <CartaoLetra props={props} tMusica={tMusica} bandas={bandas} />
      <Reacoes reacoes={props.reacoes} />
      <Gancho gancho={props.gancho} />
      {props.legendas.map((l, i) => (
        <Legenda key={i} {...l} />
      ))}
      <CartaoFinal final={props.final} ini={iniFinal} />
    </AbsoluteFill>
  );
};
