import { createFileRoute, notFound } from "@tanstack/react-router";
import { PaginaArtigo } from "@/components/blog/PaginaArtigo";
import { headDoArtigo } from "@/lib/blog/seo";
import { BLOG_SERENATA } from "@/lib/blog/site";
import { resumoDoArtigo, type ResumoArtigo } from "@/lib/blog/tipos";
import { chaveDaMarca } from "@/lib/marca-identidade";

// UM ARTIGO DO BLOG DA SERENATA (spec docs/superpowers/specs/2026-10-02-blog-seo-design.md).
// O conteúdo mora em src/conteudo/blog; a página, em components/blog/PaginaArtigo.tsx.
// Só existe na Serenata: na Ballad o mesmo deploy devolve 404.
//
// O registro entra por `import()` DENTRO do loader, nunca no topo do arquivo:
// o code-split do TanStack separa o componente, não o loader, e um import
// estático aqui levava os artigos pro chunk de entrada de TODAS as páginas,
// das duas marcas (~23 KB gzip, revisão de 03/10).

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    if (chaveDaMarca() !== "serenata") throw notFound();
    const { artigoPorSlug } = await import("@/conteudo/blog");
    const artigo = artigoPorSlug(params.slug);
    if (!artigo) throw notFound();
    const relacionados: ResumoArtigo[] = artigo.relacionados.flatMap((s) => {
      const r = artigoPorSlug(s);
      return r ? [resumoDoArtigo(r)] : [];
    });
    return { artigo, relacionados };
  },
  head: ({ loaderData }) => (loaderData ? headDoArtigo(BLOG_SERENATA, loaderData.artigo) : {}),
  component: Pagina,
});

function Pagina() {
  const { artigo, relacionados } = Route.useLoaderData();
  return <PaginaArtigo site={BLOG_SERENATA} artigo={artigo} relacionados={relacionados} />;
}
