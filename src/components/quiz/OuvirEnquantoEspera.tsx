import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

// "Enquanto a sua fica pronta, ouça outras" — a jogada da tela de espera do
// LoveTune, e a mais honesta dela: enquanto o Suno grava (~2min), a pessoa
// escuta músicas reais nossas. A espera passa mais rápido porque ela está
// fazendo algo, e ainda vê a qualidade do que vai receber.
//
// Trechos de 45s no bucket público (os mesmos da landing). UM único <audio>
// pros três: é impossível dois tocarem juntos, a exclusividade é estrutural.

const CLIPES = [
  { slug: "rose", titulo: "Domingo de Rose", para: "para a mãe" },
  { slug: "isabela", titulo: "Desde a Escola, Isabela", para: "para a esposa" },
  { slug: "camburi", titulo: "Camburi", para: "para o marido" },
] as const;

const AUDIO_BASE =
  "https://ouwijepgctgtfzrrwpvt.supabase.co/storage/v1/object/public/exemplos";

export function OuvirEnquantoEspera() {
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
    a.src = `${AUDIO_BASE}/${slug}.mp3`;
    try {
      await a.play();
      setTocando(slug);
    } catch (err) {
      console.error("[espera] play falhou:", err);
      setTocando(null);
    }
  }

  return (
    <div>
      <p className="mb-3 text-center text-xs uppercase tracking-wide text-muted-foreground">
        enquanto isso, ouça outras
      </p>

      {/* preload none: nada baixa até tocar */}
      <audio ref={audioRef} preload="none" />

      <ul className="space-y-2">
        {CLIPES.map((c) => {
          const ativo = tocando === c.slug;
          return (
            <li key={c.slug}>
              <button
                onClick={() => alternar(c.slug)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors",
                  ativo ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className="relative shrink-0">
                  <img
                    src={`/img/exemplos/${c.slug}.webp`}
                    alt=""
                    width={52}
                    height={52}
                    loading="lazy"
                    className="rounded-xl object-cover"
                    style={{ width: 52, height: 52 }}
                  />
                  <span
                    className={cn(
                      "absolute inset-0 grid place-items-center rounded-xl bg-black/35 text-white transition-opacity",
                      ativo ? "opacity-100" : "opacity-90",
                    )}
                  >
                    {ativo ? (
                      <Pause className="h-5 w-5" fill="currentColor" />
                    ) : (
                      <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
                    )}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{c.para}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
