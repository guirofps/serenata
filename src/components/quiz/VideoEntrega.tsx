import { type Locale } from "@/lib/i18n";
import { t } from "@/lib/textos";
// COMO O PRESENTE CHEGA, enquanto a música grava.
//
// Gravação real de uma entrega: a conversa no WhatsApp com o link, o toque, a
// página abrindo e a letra acendendo. É o entregável inteiro em 24 segundos,
// no momento em que a pessoa está parada esperando e com a decisão de compra
// logo abaixo.
//
// MUDO, em loop e sem controles, pelo mesmo motivo do vídeo de reações do
// quiz: aqui embaixo tocam as músicas de exemplo, e dois áudios competindo
// seria pior que nenhum. O trabalho deste vídeo é visual — a conversa, o
// toque, a letra acendendo — e nada disso precisa de som.
//
// 0,9 MB de propósito (24s, 640px, sem faixa de áudio). O original tinha
// 52 MB: num 4G do interior isso nunca carregaria, e a tela ficaria com um
// buraco justamente na hora mais delicada.


export function VideoEntrega({ locale = "pt" }: { locale?: Locale }) {
  const T = t(locale);
  return (
    <div className="rounded-2xl border bg-secondary/30 px-4 py-4">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
        {T.isSoQueVaiEnviar}
      </p>

      <div
        className="mx-auto mt-3 w-full max-w-[180px] overflow-hidden rounded-xl"
        style={{ boxShadow: "0 18px 38px -18px rgba(42,21,24,0.5)" }}
      >
        <video
          src="/video/entrega.mp4"
          poster="/video/entrega-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="block w-full"
        />
      </div>

      <p className="mx-auto mt-3 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        {T.comoVaiChegar}
      </p>
    </div>
  );
}
