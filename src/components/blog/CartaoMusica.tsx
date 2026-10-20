import { Pause, Play } from "lucide-react";
import { FONTES } from "@/lib/marca";
import type { ExemploBlog, SiteBlog } from "@/lib/blog/site";

type Props = { site: SiteBlog; exemplo: ExemploBlog; tocando: boolean; onAlternar: () => void };

export function CartaoMusica({ site, exemplo, tocando, onAlternar }: Props) {
  const t = site.textos.musica;
  return (
    <figure className="my-8 flex items-center gap-4 rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel-fundo)] p-4">
      <img
        src={exemplo.capa}
        alt={t.capa(exemplo.titulo)}
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
        <p className="text-sm text-[var(--tinta-suave)]">{t.legenda}</p>
      </figcaption>
      <button
        type="button"
        onClick={onAlternar}
        aria-label={tocando ? t.pausar(exemplo.titulo) : t.tocar(exemplo.titulo)}
        className="cta flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      >
        {tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
    </figure>
  );
}
