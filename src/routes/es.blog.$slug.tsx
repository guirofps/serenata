import { createFileRoute, notFound } from "@tanstack/react-router";
import { PaginaArtigo } from "@/components/blog/PaginaArtigo";
import { headDoArtigo } from "@/lib/blog/seo";
import { BLOG_BALLAD_ES } from "@/lib/blog/site";
import { resumoDoArtigo, type ResumoArtigo } from "@/lib/blog/tipos";
import { chaveDaMarca } from "@/lib/marca-identidade";

// UM ARTIGO DO BLOG DA BALLAD EM ESPANHOL (spec docs/superpowers/specs/2026-10-20-blog-ballad-es-design.md).
// O conteúdo mora em src/conteudo/blog-es; a página, em components/blog/PaginaArtigo.tsx.
// Só existe na Ballad: a Serenata também tem /es (o funil argentino) e devolve 404.
//
// O registro entra por `import()` DENTRO do loader, nunca no topo do arquivo:
// o code-split do TanStack separa o componente, não o loader, e um import
// estático aqui levava os artigos pro chunk de entrada de TODAS as páginas,
// das duas marcas (~23 KB gzip, revisão de 03/10).

export const Route = createFileRoute("/es/blog/$slug")({
  loader: async ({ params }) => {
    if (chaveDaMarca() !== "ballad") throw notFound();
    const { artigoEsPorSlug } = await import("@/conteudo/blog-es");
    const artigo = artigoEsPorSlug(params.slug);
    if (!artigo) throw notFound();
    const relacionados: ResumoArtigo[] = artigo.relacionados.flatMap((s) => {
      const r = artigoEsPorSlug(s);
      return r ? [resumoDoArtigo(r)] : [];
    });
    return { artigo, relacionados };
  },
  head: ({ loaderData }) => (loaderData ? headDoArtigo(BLOG_BALLAD_ES, loaderData.artigo) : {}),
  component: Pagina,
});

function Pagina() {
  const { artigo, relacionados } = Route.useLoaderData();
  return <PaginaArtigo site={BLOG_BALLAD_ES} artigo={artigo} relacionados={relacionados} />;
}
