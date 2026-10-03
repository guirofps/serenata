import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { CartaoArtigo } from "@/components/blog/CartaoArtigo";
import { CorpoArtigo } from "@/components/blog/CorpoArtigo";
import { CtaCriar } from "@/components/blog/CtaCriar";
import { LayoutBlog } from "@/components/blog/LayoutBlog";
import { contarPalavras, parsearCorpo } from "@/lib/blog/markdown";
import { ALTURA_TOPO, LARGURA_TOPO, dataBr, headDoArtigo, imagemDoArtigo, minutosDeLeitura } from "@/lib/blog/seo";
import { resumoDoArtigo, type ResumoArtigo } from "@/lib/blog/tipos";
import { FONTES } from "@/lib/marca";
import { chaveDaMarca } from "@/lib/marca-identidade";
import { useProfundidadeRolagem } from "@/lib/rolagem";

// UM ARTIGO DO BLOG (spec docs/superpowers/specs/2026-10-02-blog-seo-design.md).
// O conteúdo mora em src/conteudo/blog; o <head>, em src/lib/blog/seo.ts.
// Só existe na Serenata: na Ballad o mesmo deploy devolve 404.
//
// O registro entra por `import()` DENTRO do loader, nunca no topo do arquivo:
// o code-split do TanStack separa o componente, não o loader, e um import
// estático aqui levava os dez artigos pro chunk de entrada de TODAS as
// páginas, das duas marcas (~23 KB gzip, revisão de 03/10).

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
  head: ({ loaderData }) => (loaderData ? headDoArtigo(loaderData.artigo) : {}),
  component: PaginaArtigo,
});

function PaginaArtigo() {
  const { artigo, relacionados } = Route.useLoaderData();
  useProfundidadeRolagem(`blog-${artigo.slug}`);
  const blocos = useMemo(() => parsearCorpo(artigo.corpo), [artigo.corpo]);
  const minutos = minutosDeLeitura(contarPalavras(blocos));

  return (
    <LayoutBlog tema={artigo.tema}>
      <article className="pt-8 sm:pt-12">
        <nav aria-label="Caminho" className="text-sm text-[var(--tinta-suave)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link to="/">Início</Link></li>
            <li aria-hidden>›</li>
            <li><Link to="/blog">Blog</Link></li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="min-w-0 truncate">{artigo.titulo}</li>
          </ol>
        </nav>

        <h1
          className="mt-6 text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.12 }}
        >
          {artigo.titulo}
        </h1>
        <p className="mt-4 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-lg)", lineHeight: 1.55 }}>
          {artigo.descricao}
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[var(--tinta-suave)]">
          Atualizado em <time dateTime={artigo.atualizadoEm}>{dataBr(artigo.atualizadoEm)}</time> · {minutos} min de
          leitura
        </p>

        <img
          src={imagemDoArtigo(artigo.slug)}
          alt={artigo.imagem.alt}
          width={LARGURA_TOPO}
          height={ALTURA_TOPO}
          fetchPriority="high"
          decoding="async"
          className="mt-8 aspect-[16/9] w-full rounded-3xl object-cover"
        />

        <CorpoArtigo blocos={blocos} tema={artigo.tema} />

        <section className="mt-16">
          <h2
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.2 }}
          >
            Perguntas frequentes
          </h2>
          <div className="mt-6 divide-y divide-[var(--tinta-fraca)]/40 border-y border-[var(--tinta-fraca)]/40">
            {artigo.faq.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
                <p className="mt-3 text-[var(--tinta-suave)]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <CtaCriar tema={artigo.tema} final />

        {relacionados.length > 0 && (
          <section className="mt-16">
            <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)" }}>Leia também</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {relacionados.map((r) => (
                <CartaoArtigo key={r.slug} artigo={r} />
              ))}
            </div>
          </section>
        )}
      </article>
    </LayoutBlog>
  );
}
