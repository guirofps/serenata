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
//
// A letra corre DENTRO da própria janela, não empurrando a página.
// Antes, cada troca de linha chamava scrollIntoView e a página inteira dava
// um salto (medido: 77px de uma vez, com as fotos fixas atrás paradas). Com
// a rolagem contida, a letra desliza sob as fotos e a página fica quieta —
// que é o que faz parecer karaokê e não documento.

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
  const janelaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const atual = linhas.findIndex((l) => tempo >= l.inicio && tempo <= l.fim);
  const idxAtual = atual >= 0 ? atual : -1;

  // Acompanha a linha cantada rolando SÓ a janela da letra. Se a pessoa
  // rolar na mão, para de puxar — nada mais irritante que a página brigar
  // com o dedo.
  useEffect(() => {
    if (!autoScroll || !tocando || idxAtual < 0) return;
    const janela = janelaRef.current;
    const el = janela?.querySelector<HTMLElement>(`[data-linha="${idxAtual}"]`);
    if (!janela || !el) return;
    // scrollTo na janela, e não scrollIntoView: o segundo sobe por todos os
    // ancestrais roláveis e acabaria movendo o documento de novo.
    janela.scrollTo({
      top: el.offsetTop - janela.clientHeight / 2 + el.clientHeight / 2,
      behavior: "smooth",
    });
  }, [idxAtual, autoScroll, tocando]);

  return (
    <div
      ref={janelaRef}
      onWheel={() => setAutoScroll(false)}
      onTouchMove={() => setAutoScroll(false)}
      className="h-[58svh] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        // Esmaece nas bordas: a linha entra e sai da janela em vez de ser
        // cortada por uma aresta dura.
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)",
      }}
      data-karaoke-tempo={tempo.toFixed(1)}
      data-karaoke-atual={idxAtual}
      data-karaoke-linhas={linhas.length}
    >
      {/* Respiro em cima e embaixo pra primeira e última linha alcançarem o
          centro da janela. */}
      <div className="space-y-3 py-[26svh]">
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
                    ? // Já cantada: recua, mas continua legível.
                      "text-white/40"
                    : // Ainda por vir: mais clara que a passada, porque ler
                      // adiante é o que permite cantar junto. Estava em 25%
                      // e sumia por cima da foto.
                      "text-white/55",
              )}
            >
              {l.texto}
            </p>
          );
        })}
      </div>
    </div>
  );
}
