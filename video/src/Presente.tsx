import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as carregarLora } from "@remotion/google-fonts/Lora";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import type { LinhaKaraoke, PropsPresente } from "./props";

// A FONTE VEM DE FORA, NÃO DO SISTEMA. O Chromium da Lambda não tem Georgia
// nem quase nada instalado: com fontFamily de sistema o texto caía num serif
// genérico, que é metade da cara de "vídeo feito às pressas".
const { fontFamily: LORA } = carregarLora("normal", { weights: ["400", "500", "600"], subsets: ["latin", "latin-ext"] });
carregarLora("italic", { weights: ["400"], subsets: ["latin", "latin-ext"] });
const { fontFamily: PLAYFAIR } = carregarPlayfair("normal", { weights: ["500"], subsets: ["latin", "latin-ext"] });

const CREME = "#f7ede2";
const OURO = "#e8c46a";
const FECHAMENTO_S = 5;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Dedicatória longa não cabe no card.
 *
 * Prefere terminar numa FRASE inteira ("...ao meu lado.") a cortar no meio
 * dela: o primeiro teste real saiu "...ao meu lado. E…", com um "E" solto
 * pendurado. Só quando não há fim de frase razoável corta na palavra.
 */
function encurtar(texto: string, max = 170): string {
  const t = texto.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const fimDeFrase = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("! "), corte.lastIndexOf("? "));
  if (fimDeFrase >= max * 0.5) return corte.slice(0, fimDeFrase + 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${corte.slice(0, ultimoEspaco > 80 ? ultimoEspaco : max).replace(/[,;:.]$/, "")}…`;
}

// ── Uma foto: Ken Burns + crossfade ───────────────────────────────
const Foto: React.FC<{ src: string; ini: number; dur: number; fade: number; k: number; t: number; unica?: boolean }> = ({
  src, ini, dur, fade, k, t, unica,
}) => {
  const local = t - ini;
  const op = unica ? 1 : clamp(Math.min(local / fade, (dur + fade - local) / fade), 0, 1);
  if (op <= 0) return null;
  const p = clamp(local / (dur + fade), 0, 1);
  const escala = unica ? 1.05 + 0.2 * p : 1.06 + 0.14 * p;
  const dir = k % 2 === 0 ? 1 : -1;
  const tx = dir * 34 * (p - 0.5);
  const ty = -22 * (p - 0.5);
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Img
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${escala}) translate(${tx}px, ${ty}px)` }}
      />
    </AbsoluteFill>
  );
};

/** Sem foto nenhuma: um fundo vivo da marca, pra letra ainda ter onde morar. */
const FundoSemFoto: React.FC<{ t: number }> = ({ t }) => {
  const x = 50 + 18 * Math.sin(t / 7);
  const y = 40 + 12 * Math.cos(t / 9);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(90% 60% at ${x}% ${y}%, rgba(125,43,58,0.85) 0%, rgba(40,14,20,1) 55%, #120a0d 100%)`,
      }}
    />
  );
};

function linhaAtiva(karaoke: LinhaKaraoke[], t: number): { linha: LinhaKaraoke | null; proxIni: number } {
  let ativa = -1;
  for (let i = 0; i < karaoke.length; i++) {
    if (karaoke[i].start <= t + 0.12) ativa = i;
    else break;
  }
  if (ativa < 0) return { linha: null, proxIni: Infinity };
  return { linha: karaoke[ativa], proxIni: karaoke[ativa + 1]?.start ?? Infinity };
}

const TEXTOS = {
  pt: { fecho: "uma música feita da história de vocês" },
  es: { fecho: "una canción hecha de su historia" },
} as const;

export const Presente: React.FC<PropsPresente> = ({ audioUrl, fotos, karaoke, titulo, dedicatoria, locale }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const durS = durationInFrames / fps;

  // ── Fotos espalhadas pela música inteira ────────────────────────
  // 13 fotos numa música de 3 min dariam 15s cada, parado demais. O teto de
  // 7s faz elas rodarem de novo (com o movimento invertido) em vez de arrastar.
  const n = fotos.length;
  const slotDur = n ? clamp(durS / n, 4, 7) : 0;
  const fade = 0.9;
  const nSlots = n > 1 ? Math.ceil(durS / slotDur) + 1 : 0;

  // ── Karaokê ─────────────────────────────────────────────────────
  const inicioFecho = durS - FECHAMENTO_S;
  const { linha, proxIni } = linhaAtiva(karaoke, t);
  const mostraLinha = !!linha && t < proxIni + 0.2 && t < linha.end + 3.5 && t < inicioFecho;
  const opLinha = linha ? clamp(Math.min((t - linha.start) / 0.32, (proxIni - t) / 0.3, (inicioFecho - t) / 0.4), 0, 1) : 0;

  // ── Card de abertura: some quando começa a cantar ───────────────
  const primeiraFala = karaoke[0]?.start ?? 4;
  const fimTitulo = Math.max(primeiraFala, 3.5);
  const opTitulo = interpolate(t, [0.3, 1.2, fimTitulo - 0.5, fimTitulo + 0.3], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ded = dedicatoria ? encurtar(dedicatoria) : "";

  // ── Card de fechamento ──────────────────────────────────────────
  const opFecho = interpolate(t, [inicioFecho, inicioFecho + 1.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#120a0d" }}>
      {audioUrl ? <Audio src={audioUrl} /> : null}

      {n === 0 && <FundoSemFoto t={t} />}
      {n === 1 && <Foto src={fotos[0]} ini={0} dur={durS} fade={fade} k={0} t={t} unica />}
      {n > 1 &&
        Array.from({ length: nSlots }).map((_, k) => (
          <Foto key={k} src={fotos[k % n]} ini={k * slotDur} dur={slotDur} fade={fade} k={k} t={t} />
        ))}

      {/* Grade quente + vinheta: é o que tira a cara de PowerPoint. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(60,20,30,0.28) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 52%, rgba(10,4,7,0.55) 82%, rgba(8,3,5,0.86) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 320px 90px rgba(12,4,8,0.7)",
          background: "radial-gradient(120% 80% at 50% 42%, rgba(0,0,0,0) 55%, rgba(10,4,7,0.5) 100%)",
        }}
      />

      {/* Abertura */}
      {opTitulo > 0.01 && (
        <AbsoluteFill style={{ opacity: opTitulo, justifyContent: "center", alignItems: "center", padding: "0 90px", textAlign: "center" }}>
          <div style={{ fontFamily: LORA, color: OURO, letterSpacing: 14, fontSize: 32, marginBottom: 30, textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}>
            SERENATA
          </div>
          <div style={{ fontFamily: PLAYFAIR, color: CREME, fontSize: 80, lineHeight: 1.15, fontWeight: 500, textShadow: "0 4px 34px rgba(0,0,0,0.75)" }}>
            {titulo}
          </div>
          {ded ? (
            <div
              style={{
                fontFamily: LORA,
                fontStyle: "italic",
                color: "rgba(247,237,226,0.85)",
                fontSize: ded.length > 100 ? 30 : 34,
                marginTop: 36,
                lineHeight: 1.5,
                maxWidth: 760,
                textShadow: "0 2px 18px rgba(0,0,0,0.7)",
              }}
            >
              {ded}
            </div>
          ) : null}
        </AbsoluteFill>
      )}

      {/* Karaokê: a palavra da vez em dourado, as cantadas em creme, as que vêm apagadas */}
      {mostraLinha && linha && (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 210, paddingLeft: 80, paddingRight: 80 }}>
          <div style={{ opacity: opLinha, textAlign: "center", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 18px" }}>
            {linha.words.map((w, i) => {
              const cantada = w.s <= t + 0.02;
              const atual = w.s <= t && t < w.e + 0.08;
              return (
                <span
                  key={i}
                  style={{
                    fontFamily: LORA,
                    fontSize: 62,
                    lineHeight: 1.28,
                    fontWeight: 500,
                    color: atual ? OURO : cantada ? CREME : "rgba(247,237,226,0.4)",
                    transform: atual ? "translateY(-3px)" : "none",
                    textShadow: cantada ? "0 3px 24px rgba(0,0,0,0.85)" : "0 3px 20px rgba(0,0,0,0.7)",
                    display: "inline-block",
                  }}
                >
                  {w.t}
                </span>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* Fechamento */}
      {opFecho > 0.01 && (
        <AbsoluteFill style={{ backgroundColor: `rgba(12,5,8,${0.82 * opFecho})`, justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 100px" }}>
          <div style={{ opacity: opFecho }}>
            <div style={{ fontFamily: LORA, color: OURO, letterSpacing: 14, fontSize: 34, marginBottom: 26 }}>SERENATA</div>
            <div style={{ fontFamily: LORA, fontStyle: "italic", color: CREME, fontSize: 38, lineHeight: 1.45 }}>
              {(TEXTOS[locale] ?? TEXTOS.pt).fecho}
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
