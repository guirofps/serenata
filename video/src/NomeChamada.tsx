import React from "react";
import { AbsoluteFill, Audio, Composition, Img, interpolate, staticFile, useVideoConfig } from "remotion";
import { Barras, CREME, Coracao, Fundo, OURO, PLAYFAIR, POPPINS, VINHO, clamp, fade, suave, useT } from "./pecas-anuncio";

// ANÚNCIO "SUA ESPOSA SE CHAMA <NOME>?" (15/11, ideia do Ralph: música com o nome dela).
//
// Um vídeo por nome. Abre chamando o nome na tela enquanto a música (que tem o
// nome na primeira linha cantada) começa; depois a letra acende no tempo real do
// canto, com o nome em ouro; fecha com a chamada. Fica FORA do `Root.tsx` de
// propósito (entrada própria em `index-nomes.ts`): o Root é o que vai pro site da
// Lambda do vídeo-presente, e este anúncio só é renderizado no computador.

export const FPS_NOME = 30;
export const DURACAO_NOME_S = 30;
/** Segundo em que o nome é cantado (o corte do áudio é feito pra cair aqui). */
export const NOME_CANTADO_EM = 2.6;
const FIM_GANCHO = 4.4;
const CTA_EM = 23.5;

export type PalavraNome = { t: string; s: number; e: number };
export type LinhaNome = { start: number; end: number; words: PalavraNome[] };
export type PropsNome = { nome: string; audio: string; logo: string; linhas: LinhaNome[] };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

const Gancho: React.FC<{ nome: string }> = ({ nome }) => {
  const t = useT();
  const op = fade(t, FIM_GANCHO, 0.25, 0.35);
  const e1 = suave(clamp(t / 0.4));
  const e2 = suave(clamp((t - 0.35) / 0.5));
  const e3 = suave(clamp((t - 1.5) / 0.45));
  // O nome pulsa quando é cantado.
  const pulso = 1 + 0.07 * Math.exp(-Math.pow((t - NOME_CANTADO_EM - 0.15) / 0.28, 2));
  return (
    <AbsoluteFill style={{ opacity: op, alignItems: "center", justifyContent: "center", padding: "0 70px", textAlign: "center" }}>
      <div style={{ fontFamily: POPPINS, fontWeight: 600, color: CREME, fontSize: 74, lineHeight: 1.1, opacity: e1, transform: `translateY(${(1 - e1) * 30}px)` }}>
        Sua esposa se chama
      </div>
      <div
        style={{
          fontFamily: PLAYFAIR, fontWeight: 600, color: OURO, fontSize: nome.length > 8 ? 168 : 216, lineHeight: 1.08, marginTop: 10,
          opacity: e2, transform: `scale(${(0.9 + 0.1 * e2) * pulso})`, textShadow: "0 0 60px rgba(232,196,106,0.35)",
        }}
      >
        {nome}?
      </div>
      <div style={{ fontFamily: POPPINS, fontWeight: 700, color: CREME, fontSize: 64, marginTop: 46, opacity: e3, transform: `translateY(${(1 - e3) * 24}px)` }}>
        Então ouve isso 👇
      </div>
    </AbsoluteFill>
  );
};

const Letra: React.FC<{ nome: string; linhas: LinhaNome[]; audio: string }> = ({ nome, linhas, audio }) => {
  const t = useT();
  const op = Math.min(clamp((t - FIM_GANCHO + 0.2) / 0.4), clamp((CTA_EM + 0.2 - t) / 0.4));
  if (op <= 0) return null;
  // Linha atual: a última que já começou (entra 0,35s antes de cantar).
  let i = 0;
  for (let k = 0; k < linhas.length; k++) if (linhas[k].start - 0.35 <= t) i = k;
  const alvo = semAcento(nome);
  const linha = (l: LinhaNome | undefined, atual: boolean) =>
    l ? (
      <div style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: atual ? 82 : 58, lineHeight: 1.16, marginBottom: 34, opacity: atual ? 1 : 0.32, letterSpacing: -1 }}>
        {l.words.map((w, k) => {
          const aceso = atual && t >= w.s - 0.12;
          const ehNome = semAcento(w.t) === alvo;
          return (
            <span key={k} style={{ display: "inline-block", marginRight: "0.24em", color: ehNome ? OURO : CREME, opacity: atual ? (aceso ? 1 : 0.38) : 1,
              fontFamily: ehNome ? PLAYFAIR : POPPINS, fontSize: ehNome && atual ? 100 : undefined, transform: `translateY(${aceso ? 0 : 6}px)` }}>
              {w.t}
            </span>
          );
        })}
      </div>
    ) : null;
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <div style={{ position: "absolute", top: 210, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "18px 38px", borderRadius: 999, background: "rgba(125,43,58,0.55)", border: `2px solid ${OURO}55` }}>
          <Coracao tam={40} cor={OURO} />
          <span style={{ fontFamily: POPPINS, fontWeight: 600, color: CREME, fontSize: 44 }}>Uma música pra {nome}</span>
        </div>
      </div>
      <div style={{ position: "absolute", top: 640, left: 80, right: 80, textAlign: "center" }}>
        {linha(linhas[i], true)}
        {linha(linhas[i + 1], false)}
      </div>
      <div style={{ position: "absolute", bottom: 330, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Barras audio={audio} largura={760} inicio={0} />
      </div>
    </AbsoluteFill>
  );
};

const Chamada: React.FC<{ logo: string }> = ({ logo }) => {
  const t = useT() - CTA_EM;
  if (t < 0) return null;
  const e = (d: number) => suave(clamp((t - d) / 0.5));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 80px", textAlign: "center" }}>
      <div style={{ fontFamily: POPPINS, fontWeight: 700, color: CREME, fontSize: 80, lineHeight: 1.1, opacity: e(0.1), transform: `translateY(${(1 - e(0.1)) * 30}px)` }}>
        Faça uma música com
      </div>
      <div style={{ fontFamily: PLAYFAIR, fontWeight: 600, color: OURO, fontSize: 92, lineHeight: 1.12, marginTop: 8, opacity: e(0.5) }}>
        o nome e a história dela
      </div>
      <div style={{ marginTop: 70, padding: "34px 64px", borderRadius: 999, background: OURO, color: "#3b1820", fontFamily: POPPINS, fontWeight: 700, fontSize: 58,
        opacity: e(1.0), transform: `scale(${0.92 + 0.08 * e(1.0)})`, boxShadow: "0 18px 60px rgba(232,196,106,0.3)" }}>
        Ouça a prévia grátis
      </div>
      <div style={{ fontFamily: POPPINS, fontWeight: 600, color: CREME, fontSize: 46, marginTop: 34, opacity: e(1.4) }}>Clique em saiba mais</div>
      <Img src={staticFile(logo)} style={{ width: 480, marginTop: 90, opacity: e(1.6) }} />
    </AbsoluteFill>
  );
};

export const NomeChamada: React.FC<PropsNome> = ({ nome, audio, logo, linhas }) => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: VINHO }}>
      <Fundo gospel={false} />
      <Audio src={staticFile(audio)} volume={(f) => interpolate(f, [0, 0.5 * fps, durationInFrames - 2.5 * fps, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <Gancho nome={nome} />
      <Letra nome={nome} linhas={linhas} audio={audio} />
      <Chamada logo={logo} />
    </AbsoluteFill>
  );
};

export const RaizNomes: React.FC = () => (
  <Composition
    id="NomeChamada"
    component={NomeChamada}
    durationInFrames={DURACAO_NOME_S * FPS_NOME}
    fps={FPS_NOME}
    width={1080}
    height={1920}
    defaultProps={{ nome: "Ana", audio: "", logo: "", linhas: [] } as PropsNome}
  />
);
