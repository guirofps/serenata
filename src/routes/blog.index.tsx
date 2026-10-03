import { createFileRoute, notFound } from "@tanstack/react-router";
import { CartaoArtigo } from "@/components/blog/CartaoArtigo";
import { CtaCriar } from "@/components/blog/CtaCriar";
import { LayoutBlog } from "@/components/blog/LayoutBlog";
import { ARTIGOS } from "@/conteudo/blog";
import { headDoIndice } from "@/lib/blog/seo";
import type { GrupoArtigo } from "@/lib/blog/tipos";
import { FONTES } from "@/lib/marca";
import { chaveDaMarca } from "@/lib/marca-identidade";

// A LISTA DO BLOG. Só existe na Serenata (ver blog.$slug.tsx).

const GRUPOS: { grupo: GrupoArtigo; titulo: string }[] = [
  { grupo: "pessoa", titulo: "Para quem" },
  { grupo: "ocasiao", titulo: "Datas e ocasiões" },
  { grupo: "gospel", titulo: "Gospel" },
  { grupo: "guia", titulo: "Como fazer" },
];

export const Route = createFileRoute("/blog/")({
  loader: () => {
    if (chaveDaMarca() !== "serenata") throw notFound();
    return null;
  },
  head: () => headDoIndice(),
  component: IndiceBlog,
});

function IndiceBlog() {
  return (
    <LayoutBlog>
      <section className="pt-12 text-center sm:pt-16">
        <h1 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-hero)", lineHeight: 1.08 }}>
          Blog da Serenata
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-lg)", lineHeight: 1.55 }}>
          Ideias de presente que emocionam, com músicas de verdade pra ouvir.
        </p>
      </section>
      {GRUPOS.map(({ grupo, titulo }) => {
        const lista = ARTIGOS.filter((a) => a.grupo === grupo);
        if (lista.length === 0) return null;
        return (
          <section key={grupo} className="mt-14">
            <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)" }}>{titulo}</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {lista.map((a) => (
                <CartaoArtigo key={a.slug} artigo={a} />
              ))}
            </div>
          </section>
        );
      })}
      <CtaCriar final />
    </LayoutBlog>
  );
}
