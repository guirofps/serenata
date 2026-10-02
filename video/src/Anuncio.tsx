import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { loadFont as carregarPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as carregarPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as carregarLora } from "@remotion/google-fonts/Lora";
import type { LinhaKaraoke } from "./props";
import { Presente } from "./Presente";

// O ANÚNCIO: ~1 minuto vertical que abre e fecha na EMOÇÃO de quem recebe, e
// no meio mostra o produto funcionando, com a música de demonstração por baixo.
//
// ── EMOÇÃO PRIMEIRO ──────────────────────────────────────────────
//
// A primeira versão só mostrava o que a plataforma entrega, e o dono apontou
// o buraco: não mostrava o que a pessoa SENTE ao receber. Agora o gancho são
// as reações (o mesmo vídeo da home, que a marca já usa), e elas voltam antes
// do fechamento. O "como funciona" fica no meio, como explicação do choro.
//
// ── RITMO DE QUEM TEM 35-40+ ─────────────────────────────────────
//
// Cenas de ~7s, letra maior e máquina de escrever mais lenta: o público lê
// cada tela até o fim antes de a próxima entrar.
//
// A música e a história da demonstração são INVENTADAS (Bianca e o café
// ruim); as telas são prints do site. Música e foto de cliente não entram.
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
  /** `completo` (~60s, YouTube/Google) ou `curto` (~28s, TikTok/Reels). */
  roteiro?: NomeRoteiro;
  /**
   * O título das reações do começo: é o GANCHO que se testa. `inicios` são os
   * dois segundos do `reacoes.mp4` que abrem o vídeo (a imagem do gancho).
   */
  gancho?: { reta: string; italico: string; inicios?: [number, number] };
  /** As frases que passam no meio. O que faltar fica no texto padrão. */
  textos?: Partial<Record<"conta" | "letra" | "musica" | "recebe" | "video" | "reacoes" | "presente" | "fecho", Frase>>;
  /** Os dois trechos do `reacoes.mp4` da cena de reações do meio. */
  reacoesInicios?: [number, number];
  /**
   * Os passos do fechamento ("Conte a história", "Veja a letra grátis e ouça
   * a prévia", "Se amar, mande de presente"). Sem eles, o fechamento antigo.
   */
  passos?: string[];
  /**
   * Sem a trilha própria: quando o anúncio vira um PEDAÇO de outra montagem
   * (o `Mix`), a música toca lá fora, uma só, e `inicioAudio` só serve pra
   * a letra e a batida daqui baterem com ela.
   */
  semAudio?: boolean;
  /**
   * O idioma das cenas do "como funciona" (letra, música, recebe): rótulos,
   * etiquetas e os prints. `en` é a Ballad (02/10), com as telas dela.
   */
  idioma?: "pt" | "en";
};

type Frase = { reta: string; italico: string };

// O texto das versões g1 a g3 (as primeiras, que venderam no TikTok): as
// variações novas trocam só o que precisam e herdam o resto daqui.
const TEXTOS_PADRAO: Record<"conta" | "letra" | "musica" | "recebe" | "video" | "reacoes" | "presente" | "fecho", Frase> = {
  conta: { reta: "Você conta", italico: "a história…" },
  letra: { reta: "…e a letra sai", italico: "na hora." },
  musica: { reta: "Vira música", italico: "de verdade." },
  recebe: { reta: "Ela recebe", italico: "no WhatsApp…" },
  video: { reta: "As fotos de vocês", italico: "viram vídeo." },
  reacoes: { reta: "Quem recebe", italico: "nunca esquece." },
  presente: { reta: "E vira", italico: "presente." },
  fecho: { reta: "Uma música feita da", italico: "história de vocês." },
};
const TextosCtx = React.createContext(TEXTOS_PADRAO);

// Os rótulos e prints das cenas do produto, por idioma. Só as cenas que o
// `Mix` usa (letra, música, recebe) existem em inglês.
const ROTULOS = {
  pt: {
    capLetra: "A LETRA", letraDe: "A LETRA DE", etLetra: ["De graça", "em segundos"],
    capMusica: "A MÚSICA", etNome: ["O nome dela", "cantado na música"], etAcende: ["A letra", "acende no ritmo"],
    capRecebe: "ELA RECEBE", etAbre: ["Abre o link", "sem baixar nada"], etOuve: ["E ouve", "a história dela"],
    capa: "anuncio/presente-capa.png", entrega: "anuncio/entrega.mp4",
    marca: "SERENATA", cta: "Crie a sua agora", rodape: "A letra é grátis · serenatagift.com",
  },
  en: {
    capLetra: "THE LYRICS", letraDe: "LYRICS FOR", etLetra: ["Free", "in seconds"],
    capMusica: "THE SONG", etNome: ["Her name", "sung in the song"], etAcende: ["The lyrics", "light up in rhythm"],
    capRecebe: "SHE GETS IT", etAbre: ["Opens the link", "no app needed"], etOuve: ["And hears", "her story"],
    capa: "anuncio-en/presente-capa.png", entrega: "anuncio-en/entrega.mp4",
    marca: "BALLAD", cta: "Make yours now", rodape: "Your lyrics are free · balladgift.com",
  },
};
const RotulosCtx = React.createContext(ROTULOS.pt);
const useRotulos = () => React.useContext(RotulosCtx);
const useFrase = (k: keyof typeof TEXTOS_PADRAO) => React.useContext(TextosCtx)[k];

// ── Roteiros (em segundos) ────────────────────────────────────────
//
// O curto é o mesmo material cortado pra quem rola rápido: reações, a letra,
// ela recebendo, reações de novo e o fechamento. Sem "como funciona" longo:
// no TikTok o que segura é a emoção, e a explicação cabe numa cena.
type TipoCena = "gancho" | "conta" | "letra" | "musica" | "recebe" | "video" | "reacoes" | "presente" | "fecho";
export type NomeRoteiro = "completo" | "curto" | "vendedor" | "produto";
const ROTEIROS: Record<NomeRoteiro, Array<[TipoCena, number]>> = {
  completo: [
    ["gancho", 6.5],
    ["conta", 7],
    ["letra", 7],
    ["musica", 7],
    ["recebe", 7],
    ["video", 6],
    ["reacoes", 7],
    ["presente", 6],
    ["fecho", 6.5],
  ],
  curto: [
    ["gancho", 5],
    ["letra", 6],
    ["recebe", 6],
    ["reacoes", 6],
    ["fecho", 5],
  ],
  // O VENDEDOR (28/09): o curto tinha perdido a cena da música, e o dono
  // apontou que é exatamente o que mais vende: ver a letra de graça, OUVIR a
  // prévia antes de pagar, e só então virar presente. As três em sequência,
  // e o fechamento repete como passos.
  vendedor: [
    ["gancho", 4.5],
    ["letra", 6],
    ["musica", 6.5],
    ["recebe", 5.5],
    ["reacoes", 5],
    ["fecho", 5.5],
  ],
  // Só o "como funciona", pra entrar no meio das reações do `Mix`.
  produto: [
    ["letra", 5.5],
    ["musica", 6],
    ["recebe", 5],
  ],
};
export const duracaoDoRoteiro = (r: NomeRoteiro = "completo") => ROTEIROS[r].reduce((s, [, d]) => s + d, 0);

/** Onde cada cena começa, quanto dura e que número de capítulo leva. */
function linhaDoTempo(r: NomeRoteiro) {
  let t = 0;
  let cap = 0;
  const semNumero = new Set<TipoCena>(["gancho", "reacoes", "fecho"]);
  return ROTEIROS[r].map(([tipo, d]) => {
    const ini = t;
    t += d;
    const n = semNumero.has(tipo) ? "" : String(++cap).padStart(2, "0");
    return { tipo, ini, d, n };
  });
}

const CenaCtx = React.createContext({ ini: 0, d: 5, n: "" });
const useCena = () => React.useContext(CenaCtx);

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
      <div style={{ fontFamily: POPPINS, fontWeight: 700, color: CREME, fontSize: 94, lineHeight: 1.05, letterSpacing: -2 }}>
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
          fontSize: 110,
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
    <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", opacity: op, fontFamily: POPPINS, fontWeight: 600, fontSize: 30, letterSpacing: 8 }}>
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


/**
 * REAÇÕES: duas de uma vez, empilhadas. O vídeo é horizontal (o da home) e
 * o anúncio é vertical: em vez de cortar o quadro e perder metade das
 * pessoas (quase toda cena tem duas), cada reação entra inteira numa faixa.
 * Mudo: por baixo toca a nossa música, e o áudio de lá é outra canção.
 */
const CenaReacoes: React.FC<{ reta: string; italico: string; inicios: [number, number] }> = ({ reta, italico, inicios }) => {
  const { d } = useCena();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const faixa = (i: number): React.CSSProperties => {
    const e = suave(clamp((t - 0.15 - i * 0.25) / 0.6, 0, 1));
    return {
      position: "absolute",
      left: 40,
      right: 40,
      top: 560 + i * 640,
      height: 580,
      borderRadius: 34,
      overflow: "hidden",
      boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 2px rgba(232,196,106,0.2)",
      opacity: Math.min(e, clamp((d - t) / 0.35, 0, 1)),
      transform: `translateY(${(1 - e) * 80}px) scale(${1.02 - 0.02 * e})`,
    };
  };
  return (
    <AbsoluteFill>
      <Titulo reta={reta} italico={italico} dur={d} topo={170} />
      {inicios.map((ini, i) => (
        <div key={i} style={faixa(i)}>
          <OffthreadVideo src={staticFile("anuncio/reacoes.mp4")} startFrom={Math.round(ini * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

/**
 * ELA RECEBE: a gravação de tela da entrega (a mesma da home), no celular.
 * WhatsApp, toca no link, a página abre e a música começa. É a experiência
 * de quem ganha, do jeito que ela acontece.
 */
const CenaRecebe: React.FC = () => {
  const { d, n, ini } = useCena();
  const r = useRotulos();
  return (
    <AbsoluteFill>
      <Capitulo n={n} nome={r.capRecebe} dur={d} />
      <Titulo {...useFrase("recebe")} dur={d} />
      <Celular dur={d}>
        <OffthreadVideo src={staticFile(r.entrega)} startFrom={15} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </Celular>
      <Etiqueta x={250} y={1060} ax={380} ay={1120} titulo={r.etAbre[0]} sub={r.etAbre[1]} atraso={1.2} dur={d} />
      <Etiqueta x={830} y={1500} ax={700} ay={1420} titulo={r.etOuve[0]} sub={r.etOuve[1]} atraso={3.4} dur={d} />
    </AbsoluteFill>
  );
};

const CenaConta: React.FC = () => {
  const { d, n, ini } = useCena();
  return (
    <AbsoluteFill>
      <Capitulo n={n} nome="VOCÊ CONTA" dur={d} />
      <Titulo {...useFrase("conta")} dur={d} />
      <Celular dur={d}>
        <Img src={staticFile("anuncio/quiz.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
      </Celular>
      <Etiqueta x={250} y={1040} ax={350} ay={1010} titulo="Pra quem é" sub="mãe, pai, amor…" atraso={0.9} dur={d} />
      <Etiqueta x={830} y={760} ax={745} ay={672} titulo="8 perguntas" sub="em 2 minutos" atraso={1.5} dur={d} />
    </AbsoluteFill>
  );
};

const CenaLetra: React.FC<{ versos: string[]; para: string }> = ({ versos, para }) => {
  const { d, n: capitulo } = useCena();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  // Máquina de escrever: ~45 letras por segundo (público 35-40+ lê até o fim), depois de o celular entrar.
  const total = versos.join("\n");
  const n = Math.floor(clamp((t - 0.55) * 45, 0, total.length));
  const escrito = total.slice(0, n).split("\n");
  const r = useRotulos();
  return (
    <AbsoluteFill>
      <Capitulo n={capitulo} nome={r.capLetra} dur={d} />
      <Titulo {...useFrase("letra")} dur={d} />
      <Celular dur={d}>
        <AbsoluteFill style={{ background: "#faf5ee", padding: "90px 44px", fontFamily: LORA }}>
          <div style={{ fontFamily: POPPINS, fontSize: 20, letterSpacing: 6, color: VINHO, fontWeight: 600, textAlign: "center" }}>{r.letraDe}</div>
          <div style={{ fontFamily: PLAYFAIR, fontStyle: "italic", fontSize: 58, color: VINHO, textAlign: "center", marginBottom: 40 }}>{para}</div>
          {escrito.map((v, i) => (
            <div key={i} style={{ fontSize: 31, lineHeight: 1.5, color: "#2a1518", marginBottom: 10 }}>
              {v}
              {i === escrito.length - 1 && n < total.length ? <span style={{ color: VINHO }}>|</span> : null}
            </div>
          ))}
        </AbsoluteFill>
      </Celular>
      <Etiqueta x={250} y={1250} ax={345} ay={1010} titulo={r.etLetra[0]} sub={r.etLetra[1]} atraso={1.2} dur={d} />
    </AbsoluteFill>
  );
};

const CenaMusica: React.FC<{ karaoke: LinhaKaraoke[]; inicioAudio: number; para: string; bandas: number[] }> = ({
  karaoke,
  inicioAudio,
  para,
  bandas,
}) => {
  const { d, n, ini } = useCena();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tMusica = inicioAudio + ini + f / fps;
  const linha = [...karaoke].reverse().find((l) => l.start - 0.45 <= tMusica);
  const { op } = useEntradaSaida(d);
  const r = useRotulos();
  return (
    <AbsoluteFill>
      <Pulso bandas={bandas} cy={1330} escala={1.35} op={op * 0.7} />
      <Capitulo n={n} nome={r.capMusica} dur={d} />
      <Titulo {...useFrase("musica")} dur={d} />
      <Celular dur={d}>
        <Img src={staticFile(r.capa)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
      <Etiqueta x={250} y={860} ax={450} ay={955} titulo={r.etNome[0]} sub={r.etNome[1]} atraso={0.8} dur={d} />
      <Etiqueta x={830} y={1440} ax={700} ay={1320} titulo={r.etAcende[0]} sub={r.etAcende[1]} atraso={1.4} dur={d} />
    </AbsoluteFill>
  );
};

/**
 * O VÍDEO-PRESENTE de verdade, rodando dentro do celular: a mesma composição
 * que a Lambda renderiza pro cliente, em modo `trecho` (sem abertura nem
 * fechamento), com a letra deslocada pro instante da música que está tocando.
 */
const CenaVideo: React.FC<{ karaoke: LinhaKaraoke[]; inicioAudio: number; para: string }> = ({ karaoke, inicioAudio, para }) => {
  const { d, n, ini } = useCena();
  const desloca = inicioAudio + ini;
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
      <Capitulo n={n} nome="O VÍDEO" dur={d} />
      <Titulo {...useFrase("video")} dur={d} />
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
  const { d, n, ini } = useCena();
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
      <Capitulo n={n} nome="O PRESENTE" dur={d} />
      <Titulo {...useFrase("presente")} dur={d} />
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

const CenaFecho: React.FC<{ passos?: string[] }> = ({ passos }) => {
  const { d, n, ini } = useCena();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const e = (a: number) => suave(clamp((t - a) / 0.5, 0, 1));
  const fecho = useFrase("fecho");
  const r = useRotulos();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 80px" }}>
      <div style={{ fontFamily: LORA, color: OURO, letterSpacing: 18, fontSize: 40, opacity: e(0) }}>{r.marca}</div>
      <div style={{ fontFamily: POPPINS, fontWeight: 700, color: CREME, fontSize: 74, lineHeight: 1.1, marginTop: 50, letterSpacing: -1.5, opacity: e(0.2), transform: `translateY(${(1 - e(0.2)) * 30}px)` }}>
        {fecho.reta}
      </div>
      <div style={{ fontFamily: PLAYFAIR, fontStyle: "italic", fontWeight: 600, color: OURO, fontSize: 86, lineHeight: 1.15, opacity: e(0.45), transform: `translateY(${(1 - e(0.45)) * 30}px)` }}>
        {fecho.italico}
      </div>
      {passos?.length ? (
        <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 26, alignItems: "stretch", width: 860 }}>
          {passos.map((p, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                textAlign: "left",
                opacity: e(0.7 + i * 0.25),
                transform: `translateX(${(1 - e(0.7 + i * 0.25)) * -40}px)`,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: OURO,
                  color: FUNDO,
                  fontFamily: POPPINS,
                  fontWeight: 700,
                  fontSize: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontFamily: POPPINS, fontWeight: 600, color: CREME, fontSize: 40, lineHeight: 1.2 }}>{p}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div
        style={{
          marginTop: passos?.length ? 60 : 80,
          padding: "34px 70px",
          borderRadius: 999,
          background: OURO,
          color: FUNDO,
          fontFamily: POPPINS,
          fontWeight: 700,
          fontSize: 44,
          opacity: e(passos?.length ? 1.5 : 0.8),
          transform: `scale(${0.9 + 0.1 * e(passos?.length ? 1.5 : 0.8)})`,
          boxShadow: "0 20px 60px rgba(232,196,106,0.35)",
        }}
      >
        {r.cta}
      </div>
      <div style={{ fontFamily: POPPINS, fontWeight: 500, color: "rgba(247,237,226,0.6)", fontSize: 32, marginTop: 34, opacity: e(1.1) }}>
        {r.rodape}
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
  const gancho = props.gancho ?? { reta: "Ela não esperava", italico: "por isso." };
  const textos = { ...TEXTOS_PADRAO, ...props.textos };
  const cena = (tipo: TipoCena): React.ReactNode => {
    switch (tipo) {
      case "gancho":
        return <CenaReacoes reta={gancho.reta} italico={gancho.italico} inicios={gancho.inicios ?? [4.5, 13.4]} />;
      case "conta":
        return <CenaConta />;
      case "letra":
        return <CenaLetra versos={props.versos} para={props.para} />;
      case "musica":
        return <CenaMusica karaoke={props.karaoke} inicioAudio={props.inicioAudio} para={props.para} bandas={bandas} />;
      case "recebe":
        return <CenaRecebe />;
      case "video":
        return <CenaVideo karaoke={props.karaoke} inicioAudio={props.inicioAudio} para={props.para} />;
      case "reacoes":
        return <CenaReacoes {...textos.reacoes} inicios={props.reacoesInicios ?? [15.6, 20]} />;
      case "presente":
        return <CenaPresente para={props.para} />;
      case "fecho":
        return <CenaFecho passos={props.passos} />;
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: FUNDO }}>
      {props.semAudio ? null : <Audio
        src={audioSrc}
        startFrom={Math.round(props.inicioAudio * fps)}
        volume={(fr) => interpolate(fr, [0, 8, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />}
      {/* Brilho quente de fundo, que respira com os graves. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(${70 + 10 * graves}% ${45 + 6 * graves}% at 50% 58%, rgba(125,43,58,${0.55 + 0.2 * graves}) 0%, rgba(40,14,20,0.6) 45%, ${FUNDO} 80%)`,
        }}
      />
      {linhaDoTempo(props.roteiro ?? "completo").map((c) => (
        <Sequence key={c.tipo} from={Math.round(c.ini * fps)} durationInFrames={Math.round(c.d * fps)}>
          <RotulosCtx.Provider value={ROTULOS[props.idioma ?? "pt"]}>
            <TextosCtx.Provider value={textos}>
              <CenaCtx.Provider value={c}>{cena(c.tipo)}</CenaCtx.Provider>
            </TextosCtx.Provider>
          </RotulosCtx.Provider>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
