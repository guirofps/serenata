import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Logo } from "@/components/marca/Logo";
import { MARCA, FONTES, TEMA_CLARO } from "@/lib/marca";
import { cnpjFormatado } from "@/lib/empresa";
import { ProvaImediata, Dor, Beneficios, Oferta, FAQ } from "@/components/landing/Secoes";
import { ExemplosEn } from "@/components/landing/ExemplosEn";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { Entregavel } from "@/components/landing/Entregavel";
import { ProQuemE } from "@/components/landing/ProQuemE";
import { BarraCTA } from "@/components/landing/BarraCTA";
import { PresenteNoTopo } from "@/components/landing/PresenteNoTopo";
import { ProvaSocial } from "@/components/landing/ProvaSocial";
import { useProfundidadeRolagem } from "@/lib/rolagem";
import { exemploEn } from "@/lib/exemplos-en";
import { ArrowRight, Menu, X } from "lucide-react";

// A HOME DA BALLAD GIFT (EUA).
//
// É a home BRASILEIRA (`routes/index.tsx`), seção por seção, na mesma ordem e
// com as mesmas decisões medidas lá: o botão dentro da primeira tela, o vídeo
// antes do botão no celular, a prova logo abaixo do CTA, "pra quem é" em
// posição nobre, o entregável antes dos benefícios, sem preço na home (ele
// vive na oferta, junto do teste). Não é a home espanhola: aquela é irmã da
// brasileira e não recebe as melhorias. Esta é CÓPIA ESTRUTURAL de propósito,
// com a copy redigida em inglês.
//
// O que sai: o botão de WhatsApp (não existe nos EUA) e a seleção de idioma
// (a Ballad é um site só de inglês). A prova social FICA: os clientes são os
// mesmos e o produto é o mesmo (dono, 30/09). Tirar prova, contador ou
// depoimento de uma marca é decisão do dono, nunca de quem adapta o código.
//
// DÍVIDA, a mesma da home espanhola: melhoria feita na home brasileira não
// aparece aqui sozinha. Quando a Ballad provar que vende, fundir as duas.

const PASSOS = [
  {
    n: "01",
    titulo: "Tell the story",
    texto:
      "Who they are, what you've lived through, the little detail only you two know. Type it or just say it.",
  },
  {
    n: "02",
    titulo: "Read the lyrics right away",
    texto:
      "In seconds, free. Made from the details you shared: the nickname, the food, the place. No canned lines.",
  },
  {
    n: "03",
    titulo: "Send the gift",
    texto:
      "The recorded song becomes a page with the lyrics lighting up on the beat. A link that's all yours, ready to send.",
  },
];

// O pai, como na home brasileira: o exemplo da página-presente aberta a um toque.
const TOKEN_EXEMPLO = exemploEn("en-dad")?.token || undefined;

export function HomeEn() {
  useProfundidadeRolagem("home");
  const [menuAberto, setMenuAberto] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <div className="fio-marca fixed inset-x-0 top-0 z-40" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo tamanho="sm" />
          <nav className="hidden items-center gap-8 text-sm text-[var(--tinta-suave)] sm:flex">
            <a href="#como-funciona" className="transition-colors hover:text-[var(--tinta)]">
              How it works
            </a>
            <a href="#exemplo" className="transition-colors hover:text-[var(--tinta)]">
              Hear an example
            </a>
            <Link to="/login" className="transition-colors hover:text-[var(--tinta)]">
              Sign in
            </Link>
            <Link to="/criar" className="cta rounded-full px-5 py-2.5 font-medium">
              Create my song
            </Link>
          </nav>
          <div className="flex items-center gap-3 sm:hidden">
            <Link
              to="/criar"
              className="cta inline-flex h-11 items-center rounded-full px-4 font-medium"
              style={{ fontSize: "var(--t-sm)" }}
            >
              Create
            </Link>
            <button
              onClick={() => setMenuAberto((v) => !v)}
              aria-label="Menu"
              className="-mr-2 grid h-11 w-11 place-items-center"
            >
              {menuAberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuAberto && (
          <div className="border-t border-[var(--tinta-fraca)]/30 px-6 py-4 sm:hidden">
            <a href="#como-funciona" className="flex h-11 items-center text-sm" onClick={() => setMenuAberto(false)}>
              How it works
            </a>
            <a href="#exemplo" className="flex h-11 items-center text-sm" onClick={() => setMenuAberto(false)}>
              Hear an example
            </a>
            <Link to="/login" className="flex h-11 items-center text-sm" onClick={() => setMenuAberto(false)}>
              Sign in
            </Link>
            <Link to="/criar" className="cta mt-3 block rounded-full px-5 py-3 text-center text-sm font-medium">
              Create my song
            </Link>
          </div>
        )}
      </header>

      {/* ── 01 · HERO (H1 visível no HTML, sem depender de JS) ── */}
      <section ref={heroRef} className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full opacity-60"
            style={{ background: "oklch(0.82 0.11 82)", filter: "blur(140px)" }}
          />
          <div
            className="absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full opacity-40"
            style={{ background: "oklch(0.62 0.17 18)", filter: "blur(130px)" }}
          />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="text-center lg:text-left">
            <a
              href="#pra-quem-e"
              className="badge-marca inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-medium text-[var(--acento)] transition-transform hover:scale-105"
              style={{ fontSize: "var(--t-xs)" }}
            >
              🎁 for your wife, mom, dad, grandma or in loving memory
            </a>
            <p className="mt-5 uppercase tracking-[0.35em] text-[var(--acento)]" style={{ fontSize: "var(--t-xs)" }}>
              a gift you can hear
            </p>
            <h1
              className="mt-5 text-balance"
              style={{
                fontFamily: FONTES.display,
                fontWeight: 500,
                fontSize: "var(--t-hero)",
                lineHeight: 1.06,
                letterSpacing: "-0.02em",
              }}
            >
              A song made from the <span className="texto-ouro">story</span> of someone you love
            </h1>
            <p
              className="mx-auto mt-5 max-w-lg text-[var(--tinta-suave)] lg:mx-0"
              style={{ fontSize: "var(--t-lg)", lineHeight: 1.55 }}
            >
              Your lyrics are ready in seconds, free.
            </p>

            <div className="mt-6 lg:hidden">
              <VitrineVideo caption="real reactions to songs we made" selo="real reactions" />
            </div>

            <div className="mt-7 flex flex-col items-center gap-3 lg:mt-9 lg:items-start">
              <Link
                to="/criar"
                className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
              >
                Create my song <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-3 text-sm text-[var(--tinta-suave)]">
              The lyrics and a sung preview are free. You only pay for the full song and the gift page ready to send.
            </p>

            {/* A mesma prova social da home portuguesa, no mesmo lugar: os
                clientes são os mesmos, é o mesmo produto (dono, 30/09). */}
            <ProvaSocial locale="en" />

            <div className="mt-8 lg:hidden">
              <PresenteNoTopo locale="en" />
            </div>
          </div>

          <div className="hidden space-y-8 lg:block">
            <VitrineVideo caption="real reactions to songs we made" selo="real reactions" />
            <PresenteNoTopo locale="en" />
          </div>
        </div>
      </section>

      <ProvaImediata locale="en" />
      <ProQuemE exemploToken={TOKEN_EXEMPLO} locale="en" />
      <Dor locale="en" />

      <section id="como-funciona" className="bg-[var(--papel-fundo)]" style={{ paddingBlock: "var(--secao)" }}>
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl sm:text-4xl" style={{ fontFamily: FONTES.display, fontWeight: 500 }}>
            How it works
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {PASSOS.map((p) => (
              <div key={p.n}>
                <p className="text-xs tracking-[0.3em] text-[var(--acento)]">{p.n}</p>
                <h3 className="mt-3 text-xl" style={{ fontFamily: FONTES.display, fontWeight: 500 }}>
                  {p.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--tinta-suave)]">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Entregavel exemploToken={TOKEN_EXEMPLO} locale="en" />
      <Beneficios locale="en" />
      <ExemplosEn />
      <Oferta locale="en" />
      <FAQ locale="en" />

      <section className="luz-ouro bg-[var(--papel-fundo)] text-center" style={{ paddingBlock: "var(--secao)" }}>
        <div className="mx-auto max-w-2xl px-6">
          <p
            className="text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 400, fontSize: "var(--t-3xl)", lineHeight: 1.25 }}
          >
            Everyone forgets a gift.
            <br />
            A song made for you, <span className="texto-ouro">never</span>.
          </p>
          <Link
            to="/criar"
            className="cta mt-10 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="fio-marca opacity-70" aria-hidden />
      <footer className="py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <Logo tamanho="sm" />
            <p className="mt-2 max-w-xs text-sm text-[var(--tinta-suave)]">{MARCA.promessa}.</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--tinta-suave)]">
            <a href="#como-funciona" className="hover:text-[var(--tinta)]">
              How it works
            </a>
            <a href="#exemplo" className="hover:text-[var(--tinta)]">
              Examples
            </a>
            <Link to="/criar" className="hover:text-[var(--tinta)]">
              Create a song
            </Link>
            <Link to="/termos" className="hover:text-[var(--tinta)]">
              Terms
            </Link>
            <Link to="/privacidade" className="hover:text-[var(--tinta)]">
              Privacy
            </Link>
            <a href={`mailto:${MARCA.emailContato}`} className="hover:text-[var(--tinta)]">
              {MARCA.emailContato}
            </a>
          </nav>
        </div>
        <p className="mt-10 text-center text-xs text-[var(--tinta-fraca)]">
          {MARCA.dominio} · © {new Date().getFullYear()} {MARCA.nome}
        </p>
        {/* Quem vende, como na Serenata (marca + registro), sem nome de pessoa.
            Provisório: o dono está abrindo um CNPJ novo (29/09). */}
        <p className="mt-1 text-center text-xs text-[var(--tinta-fraca)]">
          Operated by a company registered in Brazil · CNPJ {cnpjFormatado()}
        </p>
        <div className="h-16" aria-hidden />
      </footer>

      <BarraCTA alvoRef={heroRef} locale="en" />
    </div>
  );
}
