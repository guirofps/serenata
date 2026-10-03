import { Link } from "@tanstack/react-router";
import { FONTES } from "@/lib/marca";
import { ALTURA_TOPO, LARGURA_TOPO, imagemDoArtigo } from "@/lib/blog/seo";
import type { Artigo } from "@/lib/blog/tipos";

export function CartaoArtigo({ artigo }: { artigo: Artigo }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: artigo.slug }}
      className="group block overflow-hidden rounded-2xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel)] transition-shadow hover:shadow-lg"
    >
      <img
        src={imagemDoArtigo(artigo.slug)}
        alt={artigo.imagem.alt}
        width={LARGURA_TOPO}
        height={ALTURA_TOPO}
        loading="lazy"
        className="aspect-[16/9] w-full object-cover"
      />
      <div className="p-4">
        <p className="text-balance" style={{ fontFamily: FONTES.display, fontSize: "var(--t-lg)", lineHeight: 1.25 }}>
          {artigo.titulo}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-[var(--tinta-suave)]">{artigo.descricao}</p>
      </div>
    </Link>
  );
}
