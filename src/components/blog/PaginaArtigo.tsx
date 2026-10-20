import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { CartaoArtigo } from "@/components/blog/CartaoArtigo";
import { CorpoArtigo } from "@/components/blog/CorpoArtigo";
import { CtaCriar } from "@/components/blog/CtaCriar";
import { LayoutBlog } from "@/components/blog/LayoutBlog";
import { contarPalavras, parsearCorpo } from "@/lib/blog/markdown";
import { ALTURA_TOPO, LARGURA_TOPO, imagemDoArtigo, minutosDeLeitura } from "@/lib/blog/seo";
import type { SiteBlog } from "@/lib/blog/site";
import type { Artigo, ResumoArtigo } from "@/lib/blog/tipos";
import { FONTES } from "@/lib/marca";
import { useProfundidadeRolagem } from "@/lib/rolagem";

// UM ARTIGO DO BLOG, de qualquer site (`site.ts`): as rotas `blog.$slug.tsx`
// (Serenata) e `es.blog.$slug.tsx` (Ballad em espanhol) só carregam e passam o site.

export function PaginaArtigo({ site, artigo, relacionados }: { site: SiteBlog; artigo: Artigo; relacionados: ResumoArtigo[] }) {
  const SITE = site;
  useProfundidadeRolagem(`blog-${artigo.slug}`);
  const blocos = useMemo(() => parsearCorpo(artigo.corpo), [artigo.corpo]);
  const minutos = minutosDeLeitura(contarPalavras(blocos));
  const t = SITE.textos.artigo;

  return (
    <LayoutBlog site={SITE} tema={artigo.tema}>
      <article className="pt-8 sm:pt-12">
        <nav aria-label={t.caminho} className="text-sm text-[var(--tinta-suave)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link to={SITE.textos.layout.inicio}>{t.inicio}</Link></li>
            <li aria-hidden>›</li>
            <li>{SITE.prefixo === "/blog" ? <Link to="/blog">{t.blog}</Link> : <Link to="/es/blog">{t.blog}</Link>}</li>
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
          {t.atualizadoEm} <time dateTime={artigo.atualizadoEm}>{SITE.data(artigo.atualizadoEm)}</time> · {minutos}{" "}
          {t.minLeitura}
        </p>

        <img
          src={imagemDoArtigo(SITE, artigo)}
          alt={artigo.imagem.alt}
          width={LARGURA_TOPO}
          height={ALTURA_TOPO}
          fetchPriority="high"
          decoding="async"
          className="mt-8 aspect-[16/9] w-full rounded-3xl object-cover"
        />

        <CorpoArtigo site={SITE} blocos={blocos} tema={artigo.tema} />

        <section className="mt-16">
          <h2
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.2 }}
          >
            {t.faq}
          </h2>
          <div className="mt-6 divide-y divide-[var(--tinta-fraca)]/40 border-y border-[var(--tinta-fraca)]/40">
            {artigo.faq.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown
                    aria-hidden
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--acento)] transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 text-[var(--tinta-suave)]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <CtaCriar site={SITE} tema={artigo.tema} final />

        {relacionados.length > 0 && (
          <section className="mt-16">
            <h2 style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)" }}>{t.leiaTambem}</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {relacionados.map((r) => (
                <CartaoArtigo key={r.slug} site={SITE} artigo={r} />
              ))}
            </div>
          </section>
        )}
      </article>
    </LayoutBlog>
  );
}
