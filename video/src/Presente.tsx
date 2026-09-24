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
        // 35% de cima: em foto deitada cortada pra vertical, o rosto costuma
        // estar no terço de cima, e o centro exato cortava testa.
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 35%", transform: `scale(${escala}) translate(${tx}px, ${ty}px)` }}
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

// ── Tempo do karaokê ──────────────────────────────────────────────
// A linha entra ANTES de ser cantada: aparecendo só no instante da primeira
// palavra, o olho chega atrasado e a letra inteira parece fora de tempo (foi
// a reclamação do primeiro vídeo real, 24/09).
const ANTECEDE = 0.45;
// Nota sustentada e pausa instrumental vêm como UMA palavra comprida: no
// refrão da Daiane, "trilho" durou 11,9s atravessando o solo. Sem teto, a
// palavra fica dourada e a linha fica na tela o solo inteiro.
const SUSTENTA_MAX = 2.2;
const fimDe = (w: { s: number; e: number }) => Math.min(w.e, w.s + SUSTENTA_MAX);

function linhaAtiva(karaoke: LinhaKaraoke[], t: number): { linha: LinhaKaraoke | null; proxIni: number } {
  let ativa = -1;
  for (let i = 0; i < karaoke.length; i++) {
    if (karaoke[i].start - ANTECEDE <= t) ativa = i;
    else break;
  }
  if (ativa < 0) return { linha: null, proxIni: Infinity };
  return { linha: karaoke[ativa], proxIni: karaoke[ativa + 1]?.start ?? Infinity };
}

/** Segundos pra ler a dedicatória com calma: ~14 caracteres por segundo. */
const tempoDeLeitura = (texto: string) => (texto ? clamp(texto.length / 14, 3, 15) : 0);

const TEXTOS = {
  pt: { fecho: "uma música feita da história de vocês", previa: "PRÉVIA" },
  es: { fecho: "una canción hecha de su historia", previa: "VISTA PREVIA" },
} as const;

export const Presente: React.FC<PropsPresente> = ({ audioUrl, fotos, karaoke, titulo, dedicatoria, locale, previa }) => {
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
  const ultima = linha?.words[linha.words.length - 1];
  const saiLinha = ultima ? fimDe(ultima) + 1.2 : 0;
  const mostraLinha = !!linha && t < saiLinha && t < inicioFecho;
  const opLinha = linha
    ? clamp(
        Math.min(
          (t - (linha.start - ANTECEDE)) / 0.3,
          (proxIni - ANTECEDE - t) / 0.2,
          (saiLinha - t) / 0.5,
          (inicioFecho - t) / 0.4,
        ),
        0,
        1,
      )
    : 0;

  // ── Card de abertura ────────────────────────────────────────────
  // Fica o tempo de LER a dedicatória, não até a primeira palavra cantada:
  // com intro curta ele sumia aos 6s, antes de dar pra ler duas linhas. Se o
  // canto começa antes, o card sobe um pouco e divide a tela com a letra
  // (ele no meio, a letra embaixo, sem encostar).
  const ded = dedicatoria ? encurtar(dedicatoria, 240) : "";
  const primeiraFala = karaoke[0]?.start ?? 4;
  const fimTitulo = Math.max(primeiraFala, 2.2 + tempoDeLeitura(ded), 4);
  const opTitulo = interpolate(t, [0.3, 1.2, fimTitulo - 0.6, fimTitulo + 0.4], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opDed = interpolate(t, [1.4, 2.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sobeTitulo = fimTitulo > primeiraFala
    ? interpolate(t, [primeiraFala - ANTECEDE - 0.8, primeiraFala - ANTECEDE], [0, -170], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

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
      {/* Vinheta em gradiente, não em box-shadow: sombra interna de 320px de
          desfoque é redesenhada a cada quadro e pesava no tempo de render. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(115% 75% at 50% 42%, rgba(0,0,0,0) 45%, rgba(12,4,8,0.45) 78%, rgba(10,4,7,0.8) 100%)",
        }}
      />

      {/* Abertura. O véu escuro atrás é o que deixa a dedicatória legível em
          cima de rosto e de céu claro; sai junto com o card. */}
      {opTitulo > 0.01 && (
        <AbsoluteFill
          style={{
            opacity: opTitulo,
            transform: `translateY(${sobeTitulo}px)`,
            background: "radial-gradient(75% 30% at 50% 50%, rgba(12,5,8,0.62) 0%, rgba(12,5,8,0.3) 60%, rgba(12,5,8,0) 100%)",
          }}
        />
      )}
      {opTitulo > 0.01 && (
        <AbsoluteFill
          style={{
            opacity: opTitulo,
            justifyContent: "center",
            alignItems: "center",
            padding: "0 90px",
            textAlign: "center",
            transform: `translateY(${sobeTitulo}px)`,
          }}
        >
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
                opacity: opDed,
                color: "rgba(247,237,226,0.9)",
                fontSize: ded.length > 170 ? 30 : ded.length > 100 ? 33 : 36,
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
              const atual = w.s <= t && t < fimDe(w) + 0.08;
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

      {/* Marca da prévia: em diagonal no terço de cima, onde recortar tira o
          rosto junto. No meio ela brigava com o título e a dedicatória. */}
      {previa && (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 360, pointerEvents: "none" }}>
          <div
            style={{
              transform: "rotate(-24deg)",
              fontFamily: LORA,
              fontWeight: 600,
              fontSize: 150,
              letterSpacing: 30,
              color: "rgba(255,255,255,0.24)",
              textShadow: "0 0 2px rgba(0,0,0,0.12)",
              whiteSpace: "nowrap",
            }}
          >
            {(TEXTOS[locale] ?? TEXTOS.pt).previa}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
