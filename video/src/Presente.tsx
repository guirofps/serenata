import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Img, interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { loadFont as carregarLora } from "@remotion/google-fonts/Lora";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import type { LinhaKaraoke, PropsPresente } from "./props";
import { linhasDeRefrao, montarCenas, type Cena } from "./cenas";

// O VÍDEO-PRESENTE: as fotos dela passando no ritmo da música, com a letra
// acendendo palavra por palavra.
//
// A montagem (quando cada foto entra e como) mora em `cenas.ts`, pura e
// testada. Aqui é só o desenho de cada instante.

// A FONTE VEM DE FORA, NÃO DO SISTEMA. O Chromium da Lambda não tem Georgia
// nem quase nada instalado: com fontFamily de sistema o texto caía num serif
// genérico, que é metade da cara de "vídeo feito às pressas".
const { fontFamily: LORA } = carregarLora("normal", { weights: ["400", "500", "600"], subsets: ["latin", "latin-ext"] });
carregarLora("italic", { weights: ["400", "500"], subsets: ["latin", "latin-ext"] });
const { fontFamily: PLAYFAIR } = carregarPlayfair("normal", { weights: ["500"], subsets: ["latin", "latin-ext"] });
carregarPlayfair("italic", { weights: ["500"], subsets: ["latin", "latin-ext"] });

const CREME = "#f7ede2";
const OURO = "#e8c46a";
const FUNDO = "#120a0d";
const FECHAMENTO_S = 5;
/** Quanto tempo a cena anterior fica por baixo enquanto a nova entra. */
const TRANSICAO_S = 0.6;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const suave = Easing.bezier(0.22, 1, 0.36, 1);

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

const semAcento = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

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

function linhaAtiva(karaoke: LinhaKaraoke[], t: number): { idx: number; proxIni: number } {
  let ativa = -1;
  for (let i = 0; i < karaoke.length; i++) {
    if (karaoke[i].start - ANTECEDE <= t) ativa = i;
    else break;
  }
  return { idx: ativa, proxIni: karaoke[ativa + 1]?.start ?? Infinity };
}

/** Segundos pra ler a dedicatória com calma: ~14 caracteres por segundo. */
const tempoDeLeitura = (texto: string) => (texto ? clamp(texto.length / 14, 3, 15) : 0);

const TEXTOS = {
  pt: { para: "PARA", fecho: "uma música feita da história de vocês", previa: "PRÉVIA" },
  es: { para: "PARA", fecho: "una canción hecha de su historia", previa: "VISTA PREVIA" },
} as const;

// ── Uma cena: a foto, do jeito que a montagem mandou ──────────────
const CenaFoto: React.FC<{ c: Cena; i: number; src: string; t: number; pulso: number }> = ({ c, i, src, t, pulso }) => {
  const local = t - c.ini;
  const dur = c.fim - c.ini + TRANSICAO_S;
  const p = clamp(local / dur, 0, 1);

  // Entrada.
  let op = 1;
  let zoomEntrada = 1;
  if (c.transicao === "dissolve") op = clamp(local / TRANSICAO_S, 0, 1);
  else if (c.transicao === "zoom") {
    op = clamp(local / 0.4, 0, 1);
    zoomEntrada = interpolate(local, [0, TRANSICAO_S], [1.22, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: suave });
  } else op = local >= 0 ? 1 : 0; // clarão: corte seco, o brilho disfarça
  if (op <= 0) return null;

  // Movimento contínuo (Ken Burns), com o pulso da batida por cima.
  const batida = 1 + 0.018 * pulso;
  const mov =
    c.movimento === "aproxima"
      ? { s: 1.05 + 0.14 * p, x: 0 }
      : c.movimento === "afasta"
        ? { s: 1.19 - 0.14 * p, x: 0 }
        : { s: 1.15, x: (c.movimento === "esquerda" ? 1 : -1) * 44 * (0.5 - p) };

  if (c.estilo === "cheia") {
    return (
      <AbsoluteFill style={{ opacity: op }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // 35% de cima: em foto deitada cortada pra vertical o rosto costuma
            // estar no terço de cima, e o centro exato cortava testa.
            objectPosition: "50% 35%",
            transform: `scale(${mov.s * zoomEntrada * batida}) translateX(${mov.x}px)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  // MOLDURA: a foto inteira, sem corte, num papel, sobre ela mesma desfocada.
  // É o que salva foto deitada (que em tela cheia perde as laterais) e dá
  // respiro entre uma tela cheia e outra.
  //
  // O desfoque é feito numa cópia MINÚSCULA (1/8) esticada depois: desfocar
  // a imagem em tamanho cheio a cada quadro custaria caro na Lambda.
  const giro = i % 2 ? -1.8 : 1.6;
  return (
    <AbsoluteFill style={{ opacity: op, backgroundColor: FUNDO }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 135, height: 240, transform: "scale(8)", transformOrigin: "0 0" }}>
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(3px) brightness(0.5) saturate(1.1)" }} />
      </div>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 250 }}>
        <div
          style={{
            background: "#f4ece0",
            padding: 16,
            paddingBottom: 54,
            borderRadius: 6,
            boxShadow: "0 30px 70px rgba(0,0,0,0.55)",
            transform: `translateY(${24 - 48 * p}px) rotate(${giro}deg) scale(${(1 + 0.04 * p) * zoomEntrada * batida})`,
          }}
        >
          <Img src={src} style={{ display: "block", maxWidth: 800, maxHeight: 1000, width: "auto", height: "auto" }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Pra que um card sem foto nenhuma ainda tenha onde morar. */
const FundoSemFoto: React.FC<{ t: number; pulso: number }> = ({ t, pulso }) => {
  const x = 50 + 18 * Math.sin(t / 7);
  const y = 40 + 12 * Math.cos(t / 9);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(${90 + 12 * pulso}% ${60 + 8 * pulso}% at ${x}% ${y}%, rgba(125,43,58,0.85) 0%, rgba(40,14,20,1) 55%, #120a0d 100%)`,
      }}
    />
  );
};

// ── A letra: palavras subindo, a da vez em dourado, o nome em itálico ─
const Letra: React.FC<{ linha: LinhaKaraoke; t: number; op: number; refrao: boolean; nome: string }> = ({
  linha,
  t,
  op,
  refrao,
  nome,
}) => {
  const entra = linha.start - ANTECEDE;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 200, paddingLeft: 70, paddingRight: 70 }}>
      <div style={{ opacity: op, textAlign: "center", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 18px" }}>
        {linha.words.map((w, i) => {
          const e = clamp((t - (entra + i * 0.035)) / 0.28, 0, 1);
          const cantada = w.s <= t + 0.02;
          const atual = w.s <= t && t < fimDe(w) + 0.08;
          const ehNome = nome.length >= 3 && semAcento(w.t).startsWith(nome);
          return (
            <span
              key={i}
              style={{
                fontFamily: ehNome ? PLAYFAIR : LORA,
                fontStyle: ehNome || refrao ? "italic" : "normal",
                fontSize: refrao ? 68 : 60,
                lineHeight: 1.28,
                fontWeight: 500,
                color: atual || ehNome ? OURO : cantada ? CREME : "rgba(247,237,226,0.42)",
                opacity: e,
                transform: `translateY(${(1 - suave(e)) * 22}px) scale(${atual ? 1.05 : 1})`,
                textShadow: "0 3px 24px rgba(0,0,0,0.85)",
                display: "inline-block",
              }}
            >
              {w.t}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── A batida: o áudio lido de verdade, não um seno fingindo ─────────
function usePulso(audioUrl: string, frame: number, fps: number): number {
  const audio = useAudioData(audioUrl);
  if (!audio) return 0;
  const bandas = visualizeAudio({ fps, frame, audioData: audio, numberOfSamples: 32, optimizeFor: "speed", smoothing: true });
  const graves = (bandas[0] + bandas[1] + bandas[2] + bandas[3]) / 4;
  return clamp(graves * 2.4, 0, 1);
}

const ComPulso: React.FC<PropsPresente> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulso = usePulso(props.audioUrl, frame, fps);
  return <Montagem {...props} pulso={pulso} />;
};

// useAudioData precisa de URL: sem áudio (estúdio, props de exemplo), o
// vídeo monta igual, só sem respirar com a batida.
export const Presente: React.FC<PropsPresente> = (props) =>
  props.audioUrl ? <ComPulso {...props} /> : <Montagem {...props} pulso={0} />;

const Montagem: React.FC<PropsPresente & { pulso: number }> = ({
  audioUrl,
  fotos,
  karaoke,
  titulo,
  dedicatoria,
  locale,
  previa,
  para,
  trecho,
  pulso,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const durS = durationInFrames / fps;
  const T = TEXTOS[locale] ?? TEXTOS.pt;
  const nome = (para ?? "").trim();
  const nomeChave = semAcento(nome.split(/\s+/)[0] ?? "");

  const refrao = useMemo(() => linhasDeRefrao(karaoke), [karaoke]);

  // ── Karaokê ─────────────────────────────────────────────────────
  const inicioFecho = trecho ? Infinity : durS - FECHAMENTO_S;
  const { idx, proxIni } = linhaAtiva(karaoke, t);
  const linha = idx >= 0 ? karaoke[idx] : null;
  const ultima = linha?.words[linha.words.length - 1];
  const saiLinha = ultima ? fimDe(ultima) + 1.2 : 0;
  const mostraLinha = !!linha && t < saiLinha && t < inicioFecho;
  const opLinha = linha
    ? clamp(Math.min((t - (linha.start - ANTECEDE)) / 0.3, (proxIni - ANTECEDE - t) / 0.2, (saiLinha - t) / 0.5, (inicioFecho - t) / 0.4), 0, 1)
    : 0;

  // ── Abertura ────────────────────────────────────────────────────
  // Fica o tempo de LER a dedicatória, não até a primeira palavra cantada:
  // com intro curta ela sumia aos 6s. Se o canto começa antes, o card sobe e
  // divide a tela com a letra (ele no meio, a letra embaixo, sem encostar).
  const ded = dedicatoria ? encurtar(dedicatoria, 240) : "";
  const primeiraFala = karaoke[0]?.start ?? 4;
  const fimTitulo = trecho ? 0 : Math.max(primeiraFala, 2.6 + tempoDeLeitura(ded), 4.5);
  const opTitulo = trecho
    ? 0
    : interpolate(t, [0.2, 0.9, fimTitulo - 0.6, fimTitulo + 0.4], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const opTituloTexto = interpolate(t, [1.1, 1.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opDed = interpolate(t, [1.8, 2.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cenas = useMemo(
    () => montarCenas({ karaoke, nFotos: fotos.length, durS, introAte: fimTitulo }),
    [karaoke, fotos.length, durS, fimTitulo],
  );
  const sobeTitulo =
    fimTitulo > primeiraFala
      ? interpolate(t, [primeiraFala - ANTECEDE - 0.8, primeiraFala - ANTECEDE], [0, -170], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  // ── Clarão do refrão ────────────────────────────────────────────
  const clarao = cenas.reduce((acc, c) => {
    if (c.transicao !== "clarao") return acc;
    const d = t - c.ini;
    if (d < -0.12 || d > 0.7) return acc;
    return Math.max(acc, d < 0 ? (d + 0.12) / 0.12 : Math.exp(-d * 5));
  }, 0);

  // ── Fechamento ──────────────────────────────────────────────────
  const opFecho = trecho
    ? 0
    : interpolate(t, [inicioFecho, inicioFecho + 1.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: FUNDO }}>
      {audioUrl ? <Audio src={audioUrl} /> : null}

      {fotos.length === 0 && <FundoSemFoto t={t} pulso={pulso} />}
      {cenas.map((c, i) =>
        t >= c.ini - 0.01 && t <= c.fim + TRANSICAO_S ? (
          <CenaFoto key={i} c={c} i={i} src={fotos[c.foto]} t={t} pulso={pulso} />
        ) : null,
      )}

      {/* Grade quente + vinheta em gradiente. Nada de box-shadow gigante:
          sombra interna de 320px era redesenhada a cada quadro e pesava. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(60,20,30,0.28) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 50%, rgba(10,4,7,0.55) 80%, rgba(8,3,5,0.88) 100%)",
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(115% 75% at 50% 42%, rgba(0,0,0,0) 45%, rgba(12,4,8,0.45) 78%, rgba(10,4,7,0.8) 100%)" }}
      />
      {/* O brilho que respira com a batida. */}
      <AbsoluteFill
        style={{
          opacity: 0.05 + 0.2 * pulso,
          background: "radial-gradient(70% 45% at 50% 70%, rgba(232,196,106,0.55) 0%, rgba(232,196,106,0) 70%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Abertura */}
      {opTitulo > 0.01 && (
        <AbsoluteFill
          style={{
            opacity: opTitulo,
            transform: `translateY(${sobeTitulo}px)`,
            background: "radial-gradient(78% 32% at 50% 50%, rgba(12,5,8,0.66) 0%, rgba(12,5,8,0.32) 60%, rgba(12,5,8,0) 100%)",
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
          {nome ? (
            <>
              <div style={{ fontFamily: LORA, color: OURO, letterSpacing: 16, fontSize: 30, textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}>{T.para}</div>
              <div style={{ fontFamily: PLAYFAIR, fontStyle: "italic", color: OURO, fontSize: nome.length > 14 ? 96 : 124, lineHeight: 1.1, margin: "6px 0 26px", textShadow: "0 4px 34px rgba(0,0,0,0.7)" }}>
                {[...nome].map((letra, i) => {
                  const e = clamp((t - (0.35 + i * 0.05)) / 0.4, 0, 1);
                  return (
                    <span key={i} style={{ display: "inline-block", whiteSpace: "pre", opacity: e, transform: `translateY(${(1 - suave(e)) * 30}px)` }}>
                      {letra}
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: LORA, color: OURO, letterSpacing: 14, fontSize: 32, marginBottom: 30, textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}>
              SERENATA
            </div>
          )}
          <div style={{ opacity: nome ? opTituloTexto : 1, fontFamily: PLAYFAIR, color: CREME, fontSize: nome ? 62 : 80, lineHeight: 1.15, fontWeight: 500, textShadow: "0 4px 34px rgba(0,0,0,0.75)" }}>
            {titulo}
          </div>
          {ded ? (
            <div
              style={{
                opacity: opDed,
                fontFamily: LORA,
                fontStyle: "italic",
                color: "rgba(247,237,226,0.9)",
                fontSize: ded.length > 170 ? 30 : ded.length > 100 ? 33 : 36,
                marginTop: 34,
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

      {mostraLinha && linha && <Letra linha={linha} t={t} op={opLinha} refrao={refrao.has(idx)} nome={nomeChave} />}

      {/* Clarão dourado na entrada do refrão */}
      {clarao > 0.01 && (
        <AbsoluteFill
          style={{
            opacity: 0.6 * clarao,
            background: "radial-gradient(90% 70% at 50% 45%, rgba(255,236,190,1) 0%, rgba(232,196,106,0.6) 45%, rgba(232,196,106,0) 100%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Fechamento */}
      {opFecho > 0.01 && (
        <AbsoluteFill style={{ backgroundColor: `rgba(12,5,8,${0.82 * opFecho})`, justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 100px" }}>
          <div style={{ opacity: opFecho }}>
            {nome ? (
              <div style={{ fontFamily: PLAYFAIR, fontStyle: "italic", color: OURO, fontSize: 92, marginBottom: 22 }}>{nome}</div>
            ) : null}
            <div style={{ fontFamily: LORA, fontStyle: "italic", color: CREME, fontSize: 38, lineHeight: 1.45 }}>{T.fecho}</div>
            <div style={{ fontFamily: LORA, color: "rgba(232,196,106,0.8)", letterSpacing: 14, fontSize: 26, marginTop: 40 }}>SERENATA</div>
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
            {T.previa}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
