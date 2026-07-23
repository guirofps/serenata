import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/marca/Logo";
import { MARCA, FONTES, TEMA_CLARO } from "@/lib/marca";
import { Play, ArrowRight, Menu, X } from "lucide-react";

// Landing da Serenata — mundo CLARO.
//
// O site é claro (papel quente); a PÁGINA-PRESENTE é escura (a noite da
// serenata). A passagem de um pro outro é a narrativa: você navega no claro
// e, quando abre o presente, entra na noite.
//
// Decisão de docs/quiz-fase1.md: mostrar o ENTREGÁVEL antes de pedir
// qualquer coisa. Por isso tem uma música real, tocável, aqui.

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
    texto:
      "Quem é a pessoa, o que vocês viveram, aquele detalhe que só vocês dois sabem. Pode escrever ou falar.",
  },
  {
    n: "02",
    titulo: "Leia a letra na hora",
    texto:
      "Em segundos, de graça. Feita com os detalhes que você contou — o apelido, a comida, o lugar. Não é frase pronta.",
  },
  {
    n: "03",
    titulo: "Envie o presente",
    texto:
      "A música gravada vira uma página com a letra acendendo no ritmo. Um link só seu, pronto pra mandar.",
  },
];

function Home() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo tamanho="sm" />

          <nav className="hidden items-center gap-8 text-sm text-[var(--tinta-suave)] sm:flex">
            <a href="#como-funciona" className="transition-colors hover:text-[var(--tinta)]">
              Como funciona
            </a>
            <a href="#exemplo" className="transition-colors hover:text-[var(--tinta)]">
              Ouvir um exemplo
            </a>
            <Link
              to="/criar"
              className="rounded-full bg-[var(--tinta)] px-5 py-2.5 font-medium text-[var(--papel)] transition-transform hover:scale-[1.03]"
            >
              Criar minha música
            </Link>
          </nav>

          <button
            onClick={() => setMenuAberto((v) => !v)}
            className="sm:hidden"
            aria-label="Menu"
          >
            {menuAberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuAberto && (
          <div className="border-t border-[var(--tinta-fraca)]/30 px-6 py-4 sm:hidden">
            <a href="#como-funciona" className="block py-2 text-sm" onClick={() => setMenuAberto(false)}>
              Como funciona
            </a>
            <a href="#exemplo" className="block py-2 text-sm" onClick={() => setMenuAberto(false)}>
              Ouvir um exemplo
            </a>
            <Link
              to="/criar"
              className="mt-3 block rounded-full bg-[var(--tinta)] px-5 py-3 text-center text-sm font-medium text-[var(--papel)]"
            >
              Criar minha música
            </Link>
          </div>
        )}
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="text-center lg:text-left">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--ambar)]">
            presente que se ouve
          </p>
          <h1
            className="mt-5 text-balance text-4xl leading-[1.06] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: FONTES.display, fontWeight: 500 }}
          >
            Uma música feita da história de quem você ama
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-[var(--tinta-suave)] lg:mx-0">
            Conte a história. A letra fica pronta na hora, de graça. A música
            cantada vira uma página que você envia — com a letra acendendo no
            ritmo, no nome de quem vai receber.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
            <Link
              to="/criar"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--ambar)] px-8 py-4 text-base font-medium text-white transition-transform hover:scale-[1.03] active:scale-95"
            >
              Criar minha música <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#exemplo"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--tinta-fraca)] px-6 py-4 text-base transition-colors hover:bg-[var(--papel-fundo)]"
            >
              <Play className="h-4 w-4" fill="currentColor" /> Ouvir um exemplo
            </a>
          </div>
          <p className="mt-4 text-sm text-[var(--tinta-suave)]">
            A letra é grátis. Você só paga se quiser ouvir cantada.
          </p>
        </div>

        {/* a reação — é o produto funcionando */}
        <figure className="relative">
          <img
            src="/img/hero-1.png"
            alt="Mulher ouvindo uma música na cozinha, com a mão no peito, emocionada"
            className="w-full rounded-3xl object-cover shadow-[0_24px_70px_-24px_rgba(32,24,15,0.45)]"
            loading="eager"
          />
        </figure>
      </section>

      {/* ── COMO FUNCIONA ───────────────────────────────────── */}
      <section id="como-funciona" className="bg-[var(--papel-fundo)] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2
            className="text-center text-3xl sm:text-4xl"
            style={{ fontFamily: FONTES.display, fontWeight: 500 }}
          >
            Como funciona
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {PASSOS.map((p) => (
              <div key={p.n}>
                <p className="text-xs tracking-[0.3em] text-[var(--ambar)]">{p.n}</p>
                <h3
                  className="mt-3 text-xl"
                  style={{ fontFamily: FONTES.display, fontWeight: 500 }}
                >
                  {p.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--tinta-suave)]">
                  {p.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXEMPLO REAL ────────────────────────────────────── */}
      <section id="exemplo" className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h2
          className="text-3xl sm:text-4xl"
          style={{ fontFamily: FONTES.display, fontWeight: 500 }}
        >
          Um presente de verdade, feito aqui
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[var(--tinta-suave)]">
          Essa música nasceu de uma história real contada nesse site. Abre e
          escuta — é exatamente isso que a pessoa recebe.
        </p>

        <div className="mt-10 overflow-hidden rounded-3xl bg-[var(--noite)] p-8 text-[var(--creme)]">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">
            uma música para
          </p>
          <p className="mt-2 text-4xl" style={{ fontFamily: FONTES.display, fontWeight: 500 }}>
            Eva
          </p>
          <p className="mt-1 text-sm text-white/50">Domingo na Casa da Eva</p>
          <a
            href="/p/533db522753f423e8b2227"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[oklch(0.84_0.13_78)] px-7 py-3.5 text-sm font-medium text-[#0d0a08] transition-transform hover:scale-[1.03]"
          >
            <Play className="h-4 w-4" fill="currentColor" /> Abrir esse presente
          </a>
        </div>
      </section>

      {/* ── FECHAMENTO ──────────────────────────────────────── */}
      <section className="bg-[var(--papel-fundo)] py-24 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <p
            className="text-balance text-3xl leading-snug sm:text-4xl"
            style={{ fontFamily: FONTES.display, fontWeight: 400 }}
          >
            Presente todo mundo esquece.
            <br />
            Uma música feita pra você, não.
          </p>
          <Link
            to="/criar"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--ambar)] px-8 py-4 text-base font-medium text-white transition-transform hover:scale-[1.03] active:scale-95"
          >
            Começar agora <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-[var(--tinta-fraca)]/30 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <Logo tamanho="sm" />
            <p className="mt-2 max-w-xs text-sm text-[var(--tinta-suave)]">
              {MARCA.promessa}.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--tinta-suave)]">
            <a href="#como-funciona" className="hover:text-[var(--tinta)]">
              Como funciona
            </a>
            <a href="#exemplo" className="hover:text-[var(--tinta)]">
              Exemplo
            </a>
            <Link to="/criar" className="hover:text-[var(--tinta)]">
              Criar música
            </Link>
          </nav>
        </div>
        <p className="mt-10 text-center text-xs text-[var(--tinta-fraca)]">
          {MARCA.dominio} · © {new Date().getFullYear()} {MARCA.nome}
        </p>
      </footer>
    </div>
  );
}
