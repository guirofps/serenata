import { useEffect, useRef, useState } from "react";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { EXEMPLOS_EN, audioDoExemplo } from "@/lib/exemplos-en";
import { trackEvent } from "@/lib/track";
import { Play, Pause, ArrowUpRight } from "lucide-react";

// OS EXEMPLOS DA HOME DA BALLAD GIFT (EUA).
//
// O papel é o mesmo do `ExemplosReais` da Serenata: músicas de verdade, que o
// funil gerou, tocáveis aqui mesmo (trecho de 45s do bucket público) e com a
// página-presente aberta a um toque. Menor que o de lá de propósito: são seis
// exemplos, sem abas por relação, até o painel dizer quais relações vendem.
//
// Só entra exemplo já GERADO (com título e token): sem isso o cartão teria
// play mudo, que é o defeito que o CLAUDE.md anota como falha do ForeverSongs.
export function ExemplosEn() {
  const exemplos = EXEMPLOS_EN.filter((e) => e.titulo && e.token && !e.soCristao);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const fim = () => setTocando(null);
    a.addEventListener("ended", fim);
    return () => a.removeEventListener("ended", fim);
  }, []);

  async function alternar(slug: string) {
    const a = audioRef.current;
    if (!a) return;
    if (tocando === slug) {
      a.pause();
      setTocando(null);
      return;
    }
    a.src = audioDoExemplo(slug);
    try {
      await a.play();
      setTocando(slug);
      trackEvent("exemplo_play", { slug, locale: "en" });
    } catch {
      setTocando(null);
    }
  }

  if (!exemplos.length) return null;

  return (
    <section id="exemplo" style={{ paddingBlock: "var(--secao)" }}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="uppercase tracking-[0.3em] text-[var(--acento)]" style={{ fontSize: "var(--t-xs)" }}>
            listen for yourself
          </p>
          <h2
            className="mx-auto mt-3 max-w-2xl text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
          >
            Songs made from real-life details
          </h2>
          <p
            className="mx-auto mt-3 max-w-lg text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.55 }}
          >
            Each one started as a few sentences about someone. Tap to hear a preview, or open the full gift page.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exemplos.map((e) => {
            const on = tocando === e.slug;
            return (
              <div
                key={e.slug}
                className="card-lift flex items-center gap-3 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/35 bg-[var(--papel)] p-3"
              >
                <button
                  onClick={() => alternar(e.slug)}
                  aria-label={on ? `Pause ${e.titulo}` : `Play ${e.titulo}`}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl"
                >
                  <img
                    src={e.capa}
                    alt=""
                    width={80}
                    height={80}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/30 text-white">
                    {on ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-0.5" />}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate"
                    style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-base)" }}
                  >
                    {e.titulo}
                  </p>
                  <p className="text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                    {e.para} · {e.genero}
                  </p>
                  <a
                    href={`/p/${e.token}`}
                    target="_blank"
                    rel="noopener"
                    onClick={() => trackEvent("exemplo_abriu_pagina", { slug: e.slug, locale: "en" })}
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 text-[var(--acento)] underline-offset-2 hover:underline",
                    )}
                    style={{ fontSize: "var(--t-xs)" }}
                  >
                    Open the gift page <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
        <audio ref={audioRef} preload="none" />
      </div>
    </section>
  );
}
