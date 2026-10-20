import { createFileRoute, notFound } from "@tanstack/react-router";
import { IndiceBlog } from "@/components/blog/IndiceBlog";
import { headDoIndice } from "@/lib/blog/seo";
import { BLOG_BALLAD_ES } from "@/lib/blog/site";
import { resumoDoArtigo } from "@/lib/blog/tipos";
import { chaveDaMarca } from "@/lib/marca-identidade";

// A LISTA DO BLOG DA BALLAD EM ESPANHOL. Só existe na Ballad (ver es.blog.$slug.tsx).
//
// O registro entra por `import()` no loader, que devolve só o resumo de cada
// artigo: importado no topo, o corpo de todos ia inteiro pro chunk desta página
// (mais de 200 KB) pra desenhar só cartões.

export const Route = createFileRoute("/es/blog/")({
  loader: async () => {
    if (chaveDaMarca() !== "ballad") throw notFound();
    const { ARTIGOS_ES } = await import("@/conteudo/blog-es");
    return { artigos: ARTIGOS_ES.map((a) => ({ grupo: a.grupo, ...resumoDoArtigo(a) })) };
  },
  head: () => headDoIndice(BLOG_BALLAD_ES),
  component: Indice,
});

function Indice() {
  const { artigos } = Route.useLoaderData();
  return <IndiceBlog site={BLOG_BALLAD_ES} artigos={artigos} />;
}
