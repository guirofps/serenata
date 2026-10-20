import { Link } from "@tanstack/react-router";
import { ArrowRight, Headphones, Lock } from "lucide-react";
import { Logo } from "@/components/marca/Logo";
import { lembrarIdioma } from "@/components/OfereceIdioma";
import { FONTES } from "@/lib/marca";
import { rodapeBallad, type LinkRodape } from "@/lib/rodape-ballad";

// O rodapé da Ballad: home em inglês, home em espanhol e blog em espanhol.
// Textos e links em `rodape-ballad.ts` (testados); aqui só o desenho.
// `naHome`: as homes já terminam com uma chamada grande e têm a barra fixa de CTA
// embaixo; ali a faixa de chamada sai (ficaria repetida) e entra o espaço da barra.
export function RodapeBallad({
  idioma,
  naHome = false,
}: {
  idioma: "en" | "es";
  naHome?: boolean;
}) {
  const r = rodapeBallad(idioma);
  const SELOS = [Headphones, Lock];

  return (
    <footer className="border-t border-[var(--tinta-fraca)]/30 bg-[var(--papel-fundo)] text-[var(--tinta)]">
      <div className={`mx-auto max-w-6xl px-5 sm:px-6 ${naHome ? "" : "pt-14 sm:pt-20"}`}>
        {!naHome && (
          <section className="luz-vinho overflow-hidden rounded-3xl border border-[var(--tinta-fraca)]/40 bg-[var(--papel)] px-6 py-10 text-center sm:px-12 sm:py-14">
            <h2
              className="mx-auto max-w-2xl text-3xl sm:text-4xl"
              style={{ fontFamily: FONTES.display, fontWeight: 500 }}
            >
              {r.chamada.titulo}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[var(--tinta-suave)]">{r.chamada.sub}</p>
            <LinkDoRodape
              link={r.chamada.link}
              className="cta mt-7 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
            >
              {r.chamada.botao}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkDoRodape>
          </section>
        )}

        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-8">
          <div>
            <Logo tamanho="md" />
            <p className="mt-4 max-w-xs text-sm text-[var(--tinta-suave)]">{r.promessa}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {r.selos.map((s, i) => {
                const Icone = SELOS[i % SELOS.length];
                return (
                  <li key={s} className="flex items-center gap-2">
                    <Icone className="h-4 w-4 shrink-0 text-[var(--acento)]" aria-hidden />
                    {s}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-[var(--tinta-suave)]">{r.meios}</p>
          </div>

          {r.colunas.map((c) => (
            <nav key={c.titulo} aria-label={c.titulo}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tinta-suave)]">
                {c.titulo}
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                {c.links.map((l) => (
                  <li key={l.rotulo}>
                    <LinkDoRodape
                      link={l}
                      className="break-words text-[var(--tinta)] hover:text-[var(--acento)]"
                    >
                      {l.rotulo}
                    </LinkDoRodape>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 border-t border-[var(--tinta-fraca)]/30 py-8 text-xs text-[var(--tinta-fraca)] sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p>{r.copyright}</p>
            <p className="mt-1">{r.empresa}</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[var(--tinta-fraca)]/40 p-1 text-sm">
            {r.idiomas.map((i) =>
              i.atual ? (
                <span
                  key={i.locale}
                  aria-current="true"
                  className="rounded-full bg-[var(--papel)] px-4 py-1.5 font-medium text-[var(--tinta)]"
                >
                  {i.rotulo}
                </span>
              ) : (
                <LinkDoRodape
                  key={i.locale}
                  link={i.link}
                  onClick={() => lembrarIdioma(i.locale)}
                  className="rounded-full px-4 py-1.5 text-[var(--tinta-suave)] hover:text-[var(--tinta)]"
                >
                  <span lang={i.locale}>{i.rotulo}</span>
                </LinkDoRodape>
              ),
            )}
          </div>
        </div>
        {/* A barra fixa de CTA das homes cobre o fim da página. */}
        {naHome && <div className="h-20" aria-hidden />}
      </div>
    </footer>
  );
}

function LinkDoRodape({
  link,
  className,
  onClick,
  children,
}: {
  link: LinkRodape;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (link.tipo === "email") {
    return (
      <a href={link.href} className={className}>
        {children}
      </a>
    );
  }
  if (link.tipo === "artigo") {
    return (
      <Link to="/es/blog/$slug" params={{ slug: link.slug }} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to={link.to} hash={link.hash} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
