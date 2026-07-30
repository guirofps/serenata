import { useRef, useState } from "react";
import { FONTES } from "@/lib/marca";
import { Volume2, VolumeX } from "lucide-react";

// Prova social REAL: reações de pessoas que ouviram músicas que a gente fez
// nos testes (material em `materiais/`, comprimido pra web em public/video).
//
// Honestidade que protege a conta de anúncio: NÃO afirma "cliente que
// comprou" (venda ainda não existe). Afirma o que é verdade — reações reais
// de quem ouviu uma música feita por nós.
//
// Autoplay MUDO em loop (browser bloqueia autoplay com som). Um toque liga o
// áudio, que é onde a emoção mora.

export function Reacoes() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mudo, setMudo] = useState(true);

  function alternarSom() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMudo(v.muted);
    if (!v.muted) v.play().catch(() => {});
  }

  return (
    <section
      className="bg-[var(--papel-fundo)]"
      style={{ paddingBlock: "var(--secao)" }}
    >
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p
          className="uppercase tracking-[0.3em] text-[var(--acento)]"
          style={{ fontSize: "var(--t-xs)" }}
        >
          reações reais
        </p>
        <h2
          className="mx-auto mt-4 max-w-xl text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
        >
          A cara de quem ouve pela primeira vez
        </h2>
        <p
          className="mx-auto mt-4 max-w-md text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
        >
          Gente de verdade ouvindo uma música feita da própria história. É o
          que uma letra sobre a vida da pessoa provoca.
        </p>

        <div className="relative mx-auto mt-10 overflow-hidden rounded-[var(--raio-lg)] shadow-[var(--sombra-flutuante)]">
          <video
            ref={videoRef}
            src="/video/reacoes.mp4"
            poster="/video/reacoes-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="block w-full"
            onClick={alternarSom}
          />
          {/* Botão de som: a emoção está no áudio (a música + a reação). */}
          <button
            type="button"
            onClick={alternarSom}
            aria-label={mudo ? "Ativar som" : "Desativar som"}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-black/55 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
          >
            {mudo ? (
              <>
                <VolumeX className="h-4 w-4" /> Ouvir com som
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" /> Som ligado
              </>
            )}
          </button>
        </div>

        <p
          className="mt-4 text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)" }}
        >
          Reações de quem ouviu uma música feita por nós.
        </p>
      </div>
    </section>
  );
}
