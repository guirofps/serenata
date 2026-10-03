import { Pause, Play } from "lucide-react";
import { FONTES } from "@/lib/marca";
import { capaDoExemplo, type ExemploPt } from "@/lib/exemplos-pt";

type Props = { exemplo: ExemploPt; tocando: boolean; onAlternar: () => void };

export function CartaoMusica({ exemplo, tocando, onAlternar }: Props) {
  return (
    <figure className="my-8 flex items-center gap-4 rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4">
      <img
        src={capaDoExemplo(exemplo)}
        alt={`Capa da música ${exemplo.titulo}`}
        width={96}
        height={96}
        loading="lazy"
        className="h-20 w-20 shrink-0 rounded-xl object-cover"
      />
      <figcaption className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--acento)]">
          {exemplo.para} · {exemplo.genero}
        </p>
        <p className="mt-1 truncate" style={{ fontFamily: FONTES.display, fontSize: "var(--t-lg)" }}>
          {exemplo.titulo}
        </p>
        <p className="text-sm text-[var(--tinta-suave)]">Música real, feita neste site. Trecho de 45 segundos.</p>
      </figcaption>
      <button
        type="button"
        onClick={onAlternar}
        aria-label={tocando ? `Pausar ${exemplo.titulo}` : `Tocar ${exemplo.titulo}`}
        className="cta flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      >
        {tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
    </figure>
  );
}
