import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

// O ANÚNCIO UGC (03/10/2026): o dono falando pra câmera no carro, cortado seco,
// com a legenda acendendo palavra por palavra; no meio, a página-presente
// tocando a música de exemplo com a letra acendendo, e o rosto dele num círculo
// ouvindo; no fim, o cartão da marca.
//
// Renderiza LOCAL, com --public-dir apontando pra pasta dos clipes
// (`scratch/ads-serenata/public`, fora do git). Os props saem de
// `scratch/ads-serenata/montar.py`, que lê os tempos de palavra do whisper.

const { fontFamily: POPPINS } = carregarPoppins("normal", { weights: ["600", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: PLAYFAIR } = carregarPlayfair("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

const FUNDO = "#120a0d";
const OURO = "#e8c46a";
const CREME = "#f7ede2";
const VINHO = "#5a1730";
const suave = Easing.bezier(0.22, 1, 0.36, 1);

type Palavra = { t: number; f: number; texto: string };
type Fala = { tipo: "fala"; src: string; ini: number; fim: number; palavras: Palavra[] };
type Linha = { ini: number; fim: number; palavras: Palavra[] };
type Produto = {
  tipo: "produto";
  duracao: number;
  audio: string;
  audioIni: number;
  fundo: string;
  nome: string;
  titulo: string;
  linhas: Linha[];
  reacao: { src: string; ini: number };
};
type Cartao = { tipo: "cartao"; duracao: number };
type Parte = Fala | Produto | Cartao;

export type PropsAnuncioUGC = { partes: Parte[] };

export const FPS_UGC = 30;
const duracaoDa = (p: Parte) => (p.tipo === "fala" ? p.fim - p.ini : p.duracao);
// Soma dos quadros JÁ arredondados de cada parte: arredondar o total à parte
// deixaria um quadro preto (ou cortaria um) no fim.
export const duracaoUGC = (props: PropsAnuncioUGC) =>
  props.partes.reduce((s, p) => s + Math.round(duracaoDa(p) * FPS_UGC), 0);

// ── LEGENDA ─────────────────────────────────────────────────────────
// Blocos de até 3 palavras (quebra antes em pontuação): o olho lê um bloco por
// vez, e a palavra dita no instante fica em ouro.
function blocos(ps: Palavra[]): Palavra[][] {
  const out: Palavra[][] = [];
  let atual: Palavra[] = [];
  for (const p of ps) {
    atual.push(p);
    if (atual.length === 3 || /[,.?!]$/.test(p.texto)) {
      out.push(atual);
      atual = [];
    }
  }
  if (atual.length) out.push(atual);
  return out;
}

const limpa = (t: string) => t.replace(/[,.]$/, "");

function Legenda({ palavras }: { palavras: Palavra[] }) {
  const frame = useCurrentFrame();
  const t = frame / FPS_UGC;
  const lista = blocos(palavras);
  const bloco = lista.find((b, i) => t >= b[0].t && t < (lista[i + 1]?.[0].t ?? Infinity));
  if (!bloco) return null;
  const entrada = interpolate(t - bloco[0].t, [0, 0.12], [0.85, 1], { extrapolateRight: "clamp", easing: suave });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 560 }}>
      <div
        style={{
          transform: `scale(${entrada})`,
          fontFamily: POPPINS,
          fontWeight: 800,
          fontSize: 82,
          lineHeight: 1.1,
          textAlign: "center",
          maxWidth: 940,
          textTransform: "uppercase",
          letterSpacing: -1,
        }}
      >
        {bloco.map((p, i) => {
          const falando = t >= p.t && t < p.f;
          return (
            <span
              key={i}
              style={{
                color: falando ? OURO : "#ffffff",
                WebkitTextStroke: "3px #000",
                paintOrder: "stroke fill",
                textShadow: "0 6px 18px rgba(0,0,0,0.55)",
                marginRight: 18,
              }}
            >
              {limpa(p.texto)}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function ParteFala({ p }: { p: Fala }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={staticFile(p.src)} startFrom={Math.round(p.ini * FPS_UGC)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <Legenda palavras={p.palavras} />
    </AbsoluteFill>
  );
}

// ── A PÁGINA-PRESENTE ───────────────────────────────────────────────
// O mesmo desenho da /p/<token> tocando: foto escurecida, "uma música para",
// o nome, o título e a letra com a linha da vez em ouro, corações subindo.
const CORACOES = Array.from({ length: 14 }, (_, i) => ({ x: (i * 137) % 1000, atraso: (i * 0.73) % 6, tam: 34 + ((i * 17) % 30) }));

function ParteProduto({ p }: { p: Produto }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / FPS_UGC;
  const fade = interpolate(frame, [0, 10, durationInFrames - 14, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const iAtual = Math.max(0, p.linhas.findIndex((l, i) => t < (p.linhas[i + 1]?.ini ?? Infinity) && t >= l.ini - 0.3));
  const zoom = interpolate(frame, [0, durationInFrames], [1.08, 1.0]);
  return (
    <AbsoluteFill style={{ backgroundColor: FUNDO }}>
      <Audio
        src={staticFile(p.audio)}
        startFrom={Math.round(p.audioIni * FPS_UGC)}
        volume={(f) => interpolate(f, [0, 12, durationInFrames - 18, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Img src={staticFile(p.fundo)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(2px) brightness(0.42)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(18,10,13,0.2) 0%, rgba(18,10,13,0.85) 70%)" }} />
      {CORACOES.map((c, i) => {
        const ciclo = ((t + c.atraso) % 6) / 6;
        return (
          <div key={i} style={{ position: "absolute", left: 40 + c.x, top: 1900 - ciclo * 2100, fontSize: c.tam, opacity: 0.55 * Math.sin(ciclo * Math.PI), color: "#ff8fa8" }}>
            ♥
          </div>
        );
      })}
      <AbsoluteFill style={{ opacity: fade, alignItems: "center", paddingTop: 230 }}>
        <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 30, letterSpacing: 12, color: "rgba(247,237,226,0.75)" }}>UMA MÚSICA PARA</div>
        <div style={{ fontFamily: PLAYFAIR, fontWeight: 700, fontSize: 150, color: CREME, marginTop: 10, lineHeight: 1 }}>{p.nome}</div>
        <div style={{ width: 70, height: 2, background: OURO, opacity: 0.7, margin: "34px 0" }} />
        <div style={{ fontFamily: PLAYFAIR, fontWeight: 500, fontSize: 48, color: CREME, opacity: 0.9 }}>{p.titulo}</div>
        <div style={{ marginTop: 110, width: 900, display: "flex", flexDirection: "column", gap: 34 }}>
          {p.linhas.map((l, i) => {
            const ativa = i === iAtual;
            const passou = i < iAtual;
            return (
              <div key={i} style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: ativa ? 58 : 46, lineHeight: 1.25, color: passou ? "rgba(247,237,226,0.35)" : ativa ? CREME : "rgba(247,237,226,0.55)", transition: "none" }}>
                {l.palavras.map((w, j) => (
                  <span key={j} style={{ color: ativa && t >= w.t ? OURO : undefined }}>
                    {w.texto}{" "}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* Ele ouvindo, no canto: a reação de verdade, sem som. */}
      <div style={{ position: "absolute", right: 56, bottom: 120, width: 300, height: 300, borderRadius: "50%", overflow: "hidden", border: `6px solid ${OURO}`, boxShadow: "0 18px 50px rgba(0,0,0,0.6)", opacity: fade }}>
        <OffthreadVideo src={staticFile(p.reacao.src)} startFrom={Math.round(p.reacao.ini * FPS_UGC)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%" }} />
      </div>
    </AbsoluteFill>
  );
}

function ParteCartao() {
  const frame = useCurrentFrame();
  const sobe = (atraso: number) => ({
    opacity: interpolate(frame - atraso, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(frame - atraso, [0, 12], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: suave })}px)`,
  });
  return (
    <AbsoluteFill style={{ backgroundColor: CREME, alignItems: "center", justifyContent: "center", gap: 70 }}>
      <Img src={staticFile("logo-serenata-alfa.png")} style={{ width: 760, ...sobe(0) }} />
      <div style={{ fontFamily: PLAYFAIR, fontWeight: 700, fontSize: 92, color: VINHO, textAlign: "center", lineHeight: 1.1, ...sobe(6) }}>
        Crie a letra
        <br />
        grátis
      </div>
      <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 54, color: "#fff", background: VINHO, padding: "22px 48px", borderRadius: 999, ...sobe(12) }}>
        serenatagift.com
      </div>
    </AbsoluteFill>
  );
}

export const AnuncioUGC: React.FC<PropsAnuncioUGC> = ({ partes }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Series>
        {partes.map((p, i) => (
          <Series.Sequence key={i} durationInFrames={Math.round(duracaoDa(p) * FPS_UGC)}>
            {p.tipo === "fala" ? <ParteFala p={p} /> : p.tipo === "produto" ? <ParteProduto p={p} /> : <ParteCartao />}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
