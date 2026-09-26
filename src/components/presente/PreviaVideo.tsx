import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Volume2 } from "lucide-react";
import { trackEvent } from "@/lib/track";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { Presente } from "../../../video/src/Presente";
import type { LinhaKaraoke, PropsPresente } from "../../../video/src/props";

// A PRÉVIA AO VIVO do vídeo-presente, tocando no navegador.
//
// É a MESMA composição que a Lambda renderiza (`video/src/Presente.tsx`), não
// uma imitação: o que a pessoa vê aqui é o que ela recebe em HD, menos a
// marca "prévia". Custo zero, porque quem desenha é o celular dela.
//
// Carregado sob demanda (React.lazy no VideoPresenteEditor): o Remotion não
// entra no bundle de nenhuma outra página.

const FPS = 30;
const FECHAMENTO_S = 5;
// Abre parado no card de título já com a dedicatória visível, não no quadro
// preto do segundo zero: é a "capa" que ela vê antes de apertar o play.
const QUADRO_CAPA = Math.round(2.6 * FPS);

// ── TOCA SOZINHA, SEM SOM (25/09) ────────────────────────────────
//
// A prévia esperava um toque, e o bloco é visto por quase todo mundo que abre
// o editor (103 de 119 sessões no dia 25), mas só uns 8% compravam. O momento
// que vende é ela VER as próprias fotos passando com a letra acendendo, e isso
// dependia de ela adivinhar que era pra apertar o play.
//
// Agora, com metade do player na tela, ele começa sem som (o único autoplay
// que o navegador deixa) e aparece "toque pra ouvir". O toque, em qualquer
// lugar do vídeo, liga o som e volta pro começo: a música começa do início,
// não do meio de onde o mudo estava. Saiu da tela ainda mudo, pausa.
const METADE_NA_TELA = 0.5;

export default function PreviaVideo({
  audioUrl,
  fotos,
  karaoke,
  titulo,
  dedicatoria,
  duracaoReserva,
  locale,
  para,
  semMarca,
}: {
  audioUrl: string;
  fotos: string[];
  karaoke: LinhaKaraoke[];
  titulo: string;
  dedicatoria: string;
  duracaoReserva: number;
  locale: "pt" | "es";
  para?: string;
  /** Vídeo já pago (comprado no checkout): a prévia sai sem a marca. */
  semMarca?: boolean;
}) {
  const player = useRef<PlayerRef>(null);
  const caixa = useRef<HTMLDivElement>(null);
  // "mudo" = tocando sozinho sem som, esperando o toque. Sai daqui pra sempre
  // no primeiro toque: depois disso o player é dela e se comporta normal.
  const [mudo, setMudo] = useState(true);
  const [tocando, setTocando] = useState(false);
  // A duração de verdade é a do MP3. A reserva (coluna ou última palavra)
  // não sabe do instrumental do fim, e cortar o fim é cortar a parte que emociona.
  const ultimaPalavra = karaoke.length ? karaoke[karaoke.length - 1].end : 0;
  const reserva = Math.max(duracaoReserva, ultimaPalavra + FECHAMENTO_S + 2, 20);
  const [duracaoS, setDuracaoS] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    setDuracaoS(null);
    getAudioDurationInSeconds(audioUrl)
      .then((d) => vivo && setDuracaoS(d > 5 ? d : reserva))
      .catch(() => vivo && setDuracaoS(reserva));
    return () => {
      vivo = false;
    };
  }, [audioUrl, reserva]);

  const props = useMemo<PropsPresente>(
    () => ({
      audioUrl,
      fotos,
      karaoke,
      titulo,
      dedicatoria,
      duracaoS: duracaoS ?? reserva,
      locale,
      previa: !semMarca,
      para,
    }),
    [audioUrl, fotos, karaoke, titulo, dedicatoria, duracaoS, reserva, locale, para, semMarca],
  );

  const pronto = duracaoS !== null;

  // Toca/pausa conforme entra e sai da tela, só enquanto ainda está no mudo.
  useEffect(() => {
    const el = caixa.current;
    if (!pronto || !mudo || !el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        const p = player.current;
        if (!p) return;
        if (e.intersectionRatio >= METADE_NA_TELA) {
          p.mute();
          p.play();
          trackEvent("video_previa_auto", {});
        } else if (p.isPlaying()) {
          p.pause();
        }
      },
      { threshold: [0, METADE_NA_TELA] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pronto, mudo]);

  useEffect(() => {
    const p = player.current;
    if (!pronto || !p) return;
    const aoTocar = () => setTocando(true);
    const aoPausar = () => setTocando(false);
    p.addEventListener("play", aoTocar);
    p.addEventListener("pause", aoPausar);
    return () => {
      p.removeEventListener("play", aoTocar);
      p.removeEventListener("pause", aoPausar);
    };
  }, [pronto]);

  // O toque que liga o som. Na CAPTURA, antes do clique chegar no player:
  // senão o mesmo toque que devia ligar o som pausaria o vídeo.
  function ligarSom(e: React.MouseEvent) {
    if (!mudo) return;
    const p = player.current;
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    setMudo(false);
    p.seekTo(0);
    p.unmute();
    p.play(e);
    trackEvent("video_previa_som", {});
  }

  if (duracaoS === null) {
    return (
      <div
        className="mx-auto w-full max-w-[300px] animate-pulse rounded-[var(--raio-lg)] bg-black/80"
        style={{ aspectRatio: "9 / 16" }}
      />
    );
  }

  return (
    <div ref={caixa} className="relative mx-auto w-full max-w-[300px]" onClickCapture={ligarSom}>
      <Player
        ref={player}
        component={Presente}
        inputProps={props}
        durationInFrames={Math.max(FPS * 5, Math.ceil(duracaoS * FPS))}
        fps={FPS}
        compositionWidth={1080}
        compositionHeight={1920}
        initialFrame={QUADRO_CAPA}
        initiallyMuted
        controls
        clickToPlay
        doubleClickToFullscreen
        allowFullscreen
        showVolumeControls={false}
        acknowledgeRemotionLicense
        style={{
          width: "100%",
          maxWidth: 300,
          aspectRatio: "9 / 16",
          margin: "0 auto",
          borderRadius: "var(--raio-lg)",
          overflow: "hidden",
          background: "#120a0d",
          boxShadow: "0 12px 40px rgba(42,21,24,0.25)",
        }}
      />
      {mudo && tocando && (
        <span
          className="pointer-events-none absolute left-1/2 top-[38%] inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-black/65 px-4 py-2.5 font-medium text-white backdrop-blur-sm"
          style={{ fontSize: "var(--t-sm)" }}
        >
          <Volume2 className="h-4 w-4" />
          {locale === "es" ? "Toca para escuchar" : "Toque pra ouvir"}
        </span>
      )}
    </div>
  );
}
