import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { montarLinhas, type PalavraAlinhada } from "@/lib/karaoke-linhas";

export type { PalavraAlinhada };
export type Palavra = PalavraAlinhada;

// A letra acendendo palavra a palavra sobre a música original.
//
// É a ASSINATURA do produto: só existe porque a música foi gerada a partir
// desta letra (timestamps reais do vocal). Página com música de catálogo não
// consegue fazer isso — foi o que separou a gente do Lovepanda.

export function LetraSincronizada({
  words,
  tempo,
  tocando,
}: {
  words: PalavraAlinhada[];
  tempo: number;
  tocando: boolean;
}) {
  const linhas = useMemo(() => montarLinhas(words), [words]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const atual = linhas.findIndex((l) => tempo >= l.inicio && tempo <= l.fim);
  const idxAtual = atual >= 0 ? atual : -1;

  // Acompanha a linha cantada. Se a pessoa rolar na mão, para de puxar —
  // nada mais irritante que a página brigar com o dedo.
  useEffect(() => {
    if (!autoScroll || !tocando || idxAtual < 0) return;
    const el = containerRef.current?.querySelector(`[data-linha="${idxAtual}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [idxAtual, autoScroll, tocando]);

  return (
    <div
      ref={containerRef}
      onWheel={() => setAutoScroll(false)}
      onTouchMove={() => setAutoScroll(false)}
      className="space-y-3"
    >
      {linhas.map((l, i) => {
        if (l.marcador) return <div key={i} className="h-4" />;
        const passou = tempo > l.fim;
        const agora = i === idxAtual;
        return (
          <p
            key={i}
            data-linha={i}
            className={cn(
              "text-balance text-lg leading-snug transition-all duration-500 sm:text-xl",
              agora
                ? "text-[color:var(--presente-destaque)] [text-shadow:0_0_28px_color-mix(in_oklch,var(--presente-destaque)_45%,transparent)]"
                : passou
                  ? "text-white/45"
                  : "text-white/25",
            )}
          >
            {l.texto}
          </p>
        );
      })}
    </div>
  );
}
