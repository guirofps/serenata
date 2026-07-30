import { useEffect, useRef, useState } from "react";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { Play, Pause, ArrowUpRight } from "lucide-react";

// ── 06 · DEMONSTRAÇÃO ── objeção: "me mostra"
//
// Estas são MÚSICAS REAIS, geradas neste site a partir de histórias reais.
// É a nossa única prova social honesta enquanto não há cliente com
// depoimento (§3.5 do playbook proíbe inventar) — e é prova mais forte que
// depoimento, porque a pessoa ouve em vez de ler alguém dizendo que é bom.
//
// Trechos de 45s num bucket PÚBLICO (scratch/publicar-exemplos.mjs): 704 KB
// cada em vez dos ~5 MB da faixa cheia, e coerente com o paywall — o trecho
// é exatamente o que se ouve de graça.
//
// Capas geradas no universo da marca (noite, mesa, estrada, mar), SEM
// nenhuma pessoa: foto de gente feliz aqui seria prova social falsa.

const EXEMPLOS = [
  {
    slug: "rose",
    titulo: "Domingo de Rose",
    para: "para a mãe",
    genero: "MPB",
    token: "9296e7e9b5c2460faadd64",
  },
  {
    slug: "isabela",
    titulo: "Desde a Escola, Isabela",
    para: "para a esposa",
    genero: "Sertanejo",
    token: "e406f9b4356f4a5a9e7d8e",
  },
  {
    slug: "camburi",
    titulo: "Camburi",
    para: "para o marido",
    genero: "MPB",
    token: "7b89d2ed634646c4b1ee95",
  },
] as const;

const AUDIO_BASE =
  "https://ouwijepgctgtfzrrwpvt.supabase.co/storage/v1/object/public/exemplos";

export function ExemplosReais() {
  // UM único <audio> pra todos os cards: assim é impossível dois tocarem
  // juntos — a exclusividade vem da estrutura, não de coordenação entre
  // players.
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);

  // `timeupdate` (~4x/s) e não requestAnimationFrame: pra uma barra fina é
  // suave o bastante, não segura frame em celular fraco, e funciona mesmo
  // quando a página não está compondo frames.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const andar = () => setProgresso(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    const acabou = () => {
      setTocando(null);
      setProgresso(0);
    };
    a.addEventListener("timeupdate", andar);
    a.addEventListener("ended", acabou);
    return () => {
      a.removeEventListener("timeupdate", andar);
      a.removeEventListener("ended", acabou);
    };
  }, []);

  async function alternar(slug: string) {
    const a = audioRef.current;
    if (!a) return;
    if (tocando === slug) {
      a.pause();
      setTocando(null);
      return;
    }
    a.src = `${AUDIO_BASE}/${slug}.mp3`;
    setProgresso(0);
    try {
      await a.play();
      setTocando(slug);
    } catch (err) {
      console.error("[exemplos] play falhou:", err);
      setTocando(null);
    }
  }

  return (
    <section id="exemplo" style={{ paddingBlock: "var(--secao)" }}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--tinta-suave)]">
            músicas de verdade
          </p>
          <h2
            className="mt-4 text-balance"
            style={{
              fontFamily: FONTES.display,
              fontWeight: 500,
              fontSize: "var(--t-3xl)",
              lineHeight: 1.15,
            }}
          >
            Três histórias que viraram música aqui
          </h2>
          <p
            className="mx-auto mt-4 max-w-md text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.6 }}
          >
            Nenhuma é exemplo de catálogo. Toque e ouça. É exatamente isso que
            a pessoa recebe.
          </p>
        </div>

        {/* preload="none": nada de áudio baixa até alguém apertar play */}
        <audio ref={audioRef} preload="none" />

        <div className="mt-10 grid grid-cols-2 gap-3.5 sm:mt-12 sm:grid-cols-3 sm:gap-6">
          {EXEMPLOS.map((ex) => {
            const ativo = tocando === ex.slug;
            return (
              <article
                key={ex.slug}
                className={cn(
                  "group overflow-hidden rounded-2xl bg-[var(--noite)] text-[var(--creme)]",
                  "transition-transform duration-300 hover:-translate-y-1",
                  "shadow-[0_18px_50px_-24px_rgba(42,21,24,0.55)]",
                )}
              >
                {/* capa + play */}
                <button
                  onClick={() => alternar(ex.slug)}
                  aria-label={ativo ? `Pausar ${ex.titulo}` : `Tocar ${ex.titulo}`}
                  className="relative block w-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ouro)]"
                >
                  <img
                    src={`/img/exemplos/${ex.slug}.webp`}
                    alt=""
                    width={560}
                    height={560}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  {/* escurece a base pra o botão ter contraste em qualquer capa */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(26,15,18,0.75) 0%, transparent 45%)",
                    }}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-full",
                      "bg-[var(--ouro)] text-[#1a0f12] transition-transform duration-300",
                      "group-hover:scale-110",
                      ativo && "scale-110",
                    )}
                  >
                    {ativo ? (
                      <Pause className="h-5 w-5" fill="currentColor" />
                    ) : (
                      <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
                    )}
                  </span>
                </button>

                {/* linha de progresso — só aparece no card que toca */}
                <div className="h-[3px] w-full bg-white/10">
                  <div
                    className="h-full bg-[var(--ouro)] transition-[width] duration-200 ease-linear"
                    style={{ width: ativo ? `${progresso}%` : "0%" }}
                  />
                </div>

                <div className="p-5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                    {ex.para} · {ex.genero}
                  </p>
                  <h3
                    className="mt-2 leading-snug"
                    style={{
                      fontFamily: FONTES.display,
                      fontWeight: 500,
                      fontSize: "var(--t-lg)",
                    }}
                  >
                    {ex.titulo}
                  </h3>
                  <a
                    href={`/p/${ex.token}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-white/55 underline-offset-4 transition-colors hover:text-[var(--ouro)] hover:underline"
                    style={{ fontSize: "var(--t-xs)" }}
                  >
                    abrir o presente <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <p
          className="mt-8 text-center text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)" }}
        >
          Trechos de 45 segundos. A música completa tem cerca de 4 minutos.
        </p>
      </div>
    </section>
  );
}
