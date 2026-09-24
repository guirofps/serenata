import { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
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

export default function PreviaVideo({
  audioUrl,
  fotos,
  karaoke,
  titulo,
  dedicatoria,
  duracaoReserva,
  locale,
}: {
  audioUrl: string;
  fotos: string[];
  karaoke: LinhaKaraoke[];
  titulo: string;
  dedicatoria: string;
  duracaoReserva: number;
  locale: "pt" | "es";
}) {
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
      previa: true,
    }),
    [audioUrl, fotos, karaoke, titulo, dedicatoria, duracaoS, reserva, locale],
  );

  if (duracaoS === null) {
    return (
      <div
        className="mx-auto w-full max-w-[300px] animate-pulse rounded-[var(--raio-lg)] bg-black/80"
        style={{ aspectRatio: "9 / 16" }}
      />
    );
  }

  return (
    <Player
      component={Presente}
      inputProps={props}
      durationInFrames={Math.max(FPS * 5, Math.ceil(duracaoS * FPS))}
      fps={FPS}
      compositionWidth={1080}
      compositionHeight={1920}
      initialFrame={QUADRO_CAPA}
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
  );
}
