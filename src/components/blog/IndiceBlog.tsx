import { CartaoArtigo } from "@/components/blog/CartaoArtigo";
import { CtaCriar } from "@/components/blog/CtaCriar";
import { LayoutBlog } from "@/components/blog/LayoutBlog";
import type { SiteBlog } from "@/lib/blog/site";
import type { GrupoArtigo, ResumoArtigo } from "@/lib/blog/tipos";
import { FONTES } from "@/lib/marca";

// A LISTA DO BLOG, de qualquer site: grupos, ordem e textos vêm do site (`site.ts`).

export function IndiceBlog({ site, artigos }: { site: SiteBlog; artigos: (ResumoArtigo & { grupo: GrupoArtigo })[] }) {
  const SITE = site;
  return (
    <LayoutBlog site={SITE}>
      <section className="pt-12 text-center sm:pt-16">
        <h1 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-hero)", lineHeight: 1.08 }}>
          {SITE.textos.indice.h1}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-lg)", lineHeight: 1.55 }}>
          {SITE.textos.indice.sub}
        </p>
      </section>
      {SITE.textos.indice.grupos.map(({ grupo, titulo }) => {
        const lista = artigos.filter((a) => a.grupo === grupo);
        if (lista.length === 0) return null;
        return (
          <section key={grupo} className="mt-14">
            <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)" }}>{titulo}</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {lista.map((a) => (
                <CartaoArtigo key={a.slug} site={SITE} artigo={a} />
              ))}
            </div>
          </section>
        );
      })}
      <CtaCriar site={SITE} final />
    </LayoutBlog>
  );
}
