import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/marca/Logo";
import { MARCA, FONTES, CSS_VARS } from "@/lib/marca";
import { Play, ArrowRight } from "lucide-react";

// Landing da Serenata.
//
// Decisão registrada em docs/quiz-fase1.md: ninguém entra no quiz sem saber o
// que vai receber. Por isso a landing mostra o ENTREGÁVEL (uma música real,
// tocável) antes de pedir qualquer coisa — e não promessas genéricas.

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${MARCA.nome} — ${MARCA.promessa}` },
      {
        name: "description",
        content:
          "Conte a história de alguém querido e receba a letra de uma música personalizada na hora, de graça. A música completa vira uma página presente pra você enviar.",
      },
      { property: "og:title", content: `${MARCA.nome} — ${MARCA.promessa}` },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: FONTES.googleFonts },
    ],
  }),
  component: Home,
});

const PASSOS = [
  {
    n: "01",
    titulo: "Conte a história",
    texto: "Quem é a pessoa, o que vocês viveram, aquele detalhe que só vocês sabem.",
  },
  {
    n: "02",
    titulo: "Leia a letra na hora",
    texto: "Em segundos, de graça. Feita com os detalhes que você contou — não com frase pronta.",
  },
  {
    n: "03",
    titulo: "Receba a música e a página",
    texto: "A canção gravada, com a letra acendendo no ritmo, num link pronto pra você enviar.",
  },
];

function Home() {
  return (
    <div className="min-h-screen bg-[var(--noite)] text-[var(--creme)]" style={CSS_VARS}>
      {/* topo */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo tamanho="sm" className="text-[var(--creme)]" />
        <Link
          to="/criar"
          className="text-sm text-[var(--bruma)] transition-colors hover:text-[var(--creme)]"
        >
          Criar minha música
        </Link>
      </header>

      {/* hero */}
      <section className="relative mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(55% 45% at 50% 30%, color-mix(in oklch, var(--ambar) 16%, transparent), transparent 70%)",
          }}
        />
        <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--bruma)]">
          presente que se ouve
        </p>
        <h1
          className="mt-6 text-balance text-4xl leading-[1.05] sm:text-6xl"
          style={{ fontFamily: FONTES.display, fontWeight: 500 }}
        >
          Uma música feita da história de quem você ama
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--bruma)]">
          Conte a história. A letra fica pronta na hora, de graça. A música
          cantada vira uma página que você envia — com a letra acendendo no
          ritmo, no nome de quem vai receber.
        </p>

        <Link
          to="/criar"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--ambar)] px-8 py-4 text-base font-medium text-[var(--noite)] transition-transform hover:scale-[1.03] active:scale-95"
        >
          Criar minha música <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-sm text-[var(--sussurro)]">
          A letra é grátis. Você só paga se quiser ouvir cantada.
        </p>
      </section>

      {/* exemplo real — mostra o entregável antes de pedir qualquer coisa */}
      <section className="mx-auto max-w-2xl px-6 pb-24">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[var(--noite-suave)]">
          <div className="border-b border-white/5 px-6 py-4 text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--sussurro)]">
              um presente de verdade, feito aqui
            </p>
          </div>
          <div className="px-6 py-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--bruma)]">
              uma música para
            </p>
            <p
              className="mt-2 text-3xl"
              style={{ fontFamily: FONTES.display, fontWeight: 500 }}
            >
              Eva
            </p>
            <p className="mt-1 text-sm text-[var(--bruma)]">Domingo na Casa da Eva</p>

            <a
              href="/p/533db522753f423e8b2227"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--ambar)]/40 px-6 py-3 text-sm text-[var(--creme)] transition-colors hover:bg-[var(--ambar)]/10"
            >
              <Play className="h-4 w-4 text-[var(--ambar)]" fill="currentColor" />
              Ouvir esse presente
            </a>
          </div>
        </div>
      </section>

      {/* como funciona */}
      <section className="mx-auto max-w-4xl px-6 pb-28">
        <div className="grid gap-10 sm:grid-cols-3">
          {PASSOS.map((p) => (
            <div key={p.n}>
              <p className="text-xs tracking-[0.3em] text-[var(--ambar)]">{p.n}</p>
              <h3
                className="mt-3 text-xl"
                style={{ fontFamily: FONTES.display, fontWeight: 500 }}
              >
                {p.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--bruma)]">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* fechamento */}
      <section className="mx-auto max-w-3xl px-6 pb-32 text-center">
        <div className="mx-auto h-px w-16 bg-white/10" />
        <p
          className="mt-12 text-balance text-2xl leading-snug sm:text-3xl"
          style={{ fontFamily: FONTES.display, fontWeight: 400 }}
        >
          Presente todo mundo esquece.
          <br />
          Uma música feita pra você, não.
        </p>
        <Link
          to="/criar"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--ambar)] px-8 py-4 text-base font-medium text-[var(--noite)] transition-transform hover:scale-[1.03] active:scale-95"
        >
          Começar <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-white/5 px-6 py-10 text-center">
        <Logo tamanho="sm" className="text-[var(--bruma)]" />
        <p className="mt-3 text-xs text-[var(--sussurro)]">{MARCA.dominio}</p>
      </footer>
    </div>
  );
}
