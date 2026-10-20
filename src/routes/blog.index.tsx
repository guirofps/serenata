import { createFileRoute, notFound } from "@tanstack/react-router";
import { IndiceBlog } from "@/components/blog/IndiceBlog";
import { headDoIndice } from "@/lib/blog/seo";
import { BLOG_SERENATA } from "@/lib/blog/site";
import { resumoDoArtigo } from "@/lib/blog/tipos";
import { chaveDaMarca } from "@/lib/marca-identidade";

// A LISTA DO BLOG DA SERENATA. Só existe na Serenata (ver blog.$slug.tsx).
//
// O registro entra por `import()` no loader, que devolve só o resumo de cada
// artigo: importado no topo, o corpo de todos ia inteiro pro chunk desta página
// (mais de 200 KB) pra desenhar só cartões.

export const Route = createFileRoute("/blog/")({
  loader: async () => {
    if (chaveDaMarca() !== "serenata") throw notFound();
    const { ARTIGOS } = await import("@/conteudo/blog");
    return { artigos: ARTIGOS.map((a) => ({ grupo: a.grupo, ...resumoDoArtigo(a) })) };
  },
  head: () => headDoIndice(BLOG_SERENATA),
  component: Indice,
});

function Indice() {
  const { artigos } = Route.useLoaderData();
  return <IndiceBlog site={BLOG_SERENATA} artigos={artigos} />;
}
