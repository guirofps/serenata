import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Logo } from "@/components/marca/Logo";
import { ProvaSocial } from "@/components/landing/ProvaSocial";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { MARCA, FONTES, TEMA_CLARO } from "@/lib/marca";
import { useProfundidadeRolagem } from "@/lib/rolagem";
import { trackEvent } from "@/lib/track";
import { carimbarExperimentos } from "@/lib/experimentos";
import { AUDIO_EXEMPLOS, VERSAO_CAPAS, exemploPorSlug, type ExemploPt } from "@/lib/exemplos-pt";
import { BRACOS_LP, HEADLINES_LP, SLUGS_EXEMPLO_LP, cssLpHeadline } from "@/lib/lp-presente";

// A LANDING DE ANÚNCIO (11/11/2026). Desenho e teste da headline em
// `lp-presente.ts`. Pouco texto de propósito: quem chega do anúncio decide em
// segundos, e o que convence é ouvir uma música e ver gente se emocionando.

const URL = "https://www.serenatagift.com/presente";
const TITULO = "Uma música de presente, com o nome de quem você ama | Serenata";
const DESCRICAO =
  "Flores murcham, chocolate acaba. Uma música feita da história de vocês fica pra sempre. A letra sai na hora, de graça, e você ouve antes de pagar.";

const EXEMPLOS = SLUGS_EXEMPLO_LP.map((s) => exemploPorSlug(s)).filter((e): e is ExemploPt => Boolean(e));

const COMUNS = [
  { emoji: "🌹", nome: "Flores", fim: "murcham em uma semana" },
  { emoji: "🍫", nome: "Chocolate", fim: "acaba em cinco minutos" },
  { emoji: "🎁", nome: "Presente de loja", fim: "vai parar na gaveta" },
];

const PASSOS = [
  { n: "1", texto: "Você conta a história de vocês, escrevendo ou por áudio." },
  { n: "2", texto: "A letra fica pronta na hora, com o nome de quem vai ganhar. De graça." },
  { n: "3", texto: "Você ouve cantada antes de pagar e manda o link com QR Code." },
];

export const Route = createFileRoute("/presente")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      // Página de anúncio: o conteúdo de busca mora no blog e na home.
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:image", content: "https://www.serenatagift.com/og-presente.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: FONTES.googleFonts },
    ],
  }),
  component: Pagina,
});

function BotaoCriar({ posicao, texto = "Criar a música agora" }: { posicao: string; texto?: string }) {
  return (
    <Link
      to="/criar"
      onClick={() => void trackEvent("lp_presente_cta", { posicao })}
      className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
    >
      {texto} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function Pagina() {
  useProfundidadeRolagem("lp-presente");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);

  // O braço da headline vai junto com o lead desde a landing, não só a partir
  // do quiz: quem clica e volta outro dia continua no braço que viu.
  useEffect(() => carimbarExperimentos(), []);
  useEffect(() => () => audioRef.current?.pause(), []);

  // UM <audio> pros três: duas músicas tocando juntas é impossível por construção.
  async function alternar(slug: string) {
    const a = audioRef.current;
    if (!a) return;
    if (tocando === slug) {
      a.pause();
      setTocando(null);
      return;
    }
    a.src = `${AUDIO_EXEMPLOS}/${slug}.mp3`;
    try {
      await a.play();
      setTocando(slug);
      void trackEvent("lp_presente_play", { slug });
    } catch (err) {
      console.error("[lp-presente] play falhou:", err);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <style dangerouslySetInnerHTML={{ __html: cssLpHeadline() }} />
      <div className="fio-marca fixed inset-x-0 top-0 z-40" aria-hidden />
      <audio ref={audioRef} onEnded={() => setTocando(null)} preload="none" />

      <header className="sticky top-0 z-30 border-b border-[var(--tinta-fraca)]/30 bg-[var(--papel)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
          <Logo tamanho="sm" />
          <Link
            to="/criar"
            onClick={() => void trackEvent("lp_presente_cta", { posicao: "topo" })}
            className="cta rounded-full px-4 py-2 text-sm font-medium sm:px-5 sm:py-2.5"
          >
            Criar minha música
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-5">
        {/* ── HERO: a headline do teste ───────────────────────── */}
        <section className="pt-10 text-center sm:pt-16">
          <p className="uppercase tracking-[0.3em] text-[var(--acento)]" style={{ fontSize: "var(--t-xs)" }}>
            um presente que ninguém mais tem
          </p>
          <h1
            className="mx-auto mt-4 max-w-2xl text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-hero)", lineHeight: 1.08 }}
          >
            {BRACOS_LP.map((b) => {
              const h = HEADLINES_LP[b];
              return (
                <span key={b} className={b === "A" ? "lph-A" : `lph-v lph-${b}`}>
                  {h.antes}
                  <span className="texto-ouro">{h.ouro}</span>
                  {h.depois}
                </span>
              );
            })}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-lg)", lineHeight: 1.55 }}>
            Uma canção original, com o nome e a história de quem você ama. A letra sai na hora,
            de graça, e você ouve antes de pagar.
          </p>
          <div className="mt-7 flex flex-col items-center gap-4">
            <BotaoCriar posicao="hero" />
            <ProvaSocial />
          </div>
        </section>

        <section className="mt-10 sm:mt-14">
          <VitrineVideo caption="Gente de verdade ouvindo a própria música pela primeira vez" />
        </section>

        {/* ── O PRESENTE COMUM DURA POUCO ─────────────────────── */}
        <section className="mt-16 sm:mt-24">
          <h2
            className="text-balance text-center"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
          >
            Presente comum dura pouco
          </h2>
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COMUNS.map((c) => (
              <div
                key={c.nome}
                className="flex items-center gap-4 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/35 bg-white/60 p-4"
              >
                <span className="text-3xl grayscale" aria-hidden>{c.emoji}</span>
                <p style={{ fontSize: "var(--t-base)" }}>
                  <span className="font-medium">{c.nome}</span>{" "}
                  <span className="text-[var(--tinta-suave)]">{c.fim}</span>
                </p>
              </div>
            ))}
            <div className="flex items-center gap-4 rounded-[var(--raio-lg)] border border-[var(--acento)]/50 bg-[var(--acento)]/5 p-4">
              <span className="text-3xl" aria-hidden>🎵</span>
              <p style={{ fontSize: "var(--t-base)" }}>
                <span className="font-medium">Uma música</span>{" "}
                <span className="text-[var(--tinta-suave)]">com o nome dela toca pra sempre</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── OUÇA: três músicas de verdade ───────────────────── */}
        <section className="mt-16 sm:mt-24">
          <h2
            className="text-balance text-center"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
          >
            Aperte o play
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-base)" }}>
            Músicas feitas a partir da história que alguém contou.
          </p>
          <div className="mt-7 space-y-3">
            {EXEMPLOS.map((ex) => {
              const ativa = tocando === ex.slug;
              return (
                <button
                  key={ex.slug}
                  onClick={() => alternar(ex.slug)}
                  aria-label={ativa ? `Pausar ${ex.titulo}` : `Ouvir ${ex.titulo}`}
                  className={`flex w-full items-center gap-4 rounded-[var(--raio-lg)] border bg-white p-3 text-left transition-colors ${
                    ativa ? "border-[var(--acento)]" : "border-[var(--tinta-fraca)]/40"
                  }`}
                >
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <img
                      src={`/img/exemplos/${ex.capa}.webp?v=${VERSAO_CAPAS}`}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">
                      {ativa ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-0.5" />}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-base)" }}>
                      {ex.titulo}
                    </span>
                    <span className="block text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
                      {ex.para} · {ex.genero}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
            Trechos de 45 segundos. A música completa tem cerca de 4 minutos.
          </p>
        </section>

        {/* ── COMO FUNCIONA ───────────────────────────────────── */}
        <section className="mt-16 sm:mt-24">
          <ol className="space-y-3">
            {PASSOS.map((p) => (
              <li key={p.n} className="flex items-start gap-4">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]"
                  style={{ fontFamily: FONTES.display, fontWeight: 600 }}
                >
                  {p.n}
                </span>
                <p className="pt-1.5" style={{ fontSize: "var(--t-base)", lineHeight: 1.5 }}>{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── CTA FINAL ───────────────────────────────────────── */}
        <section className="mt-16 pb-20 text-center sm:mt-24">
          <h2
            className="mx-auto max-w-lg text-balance"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-2xl)", lineHeight: 1.15 }}
          >
            Um presente que vai ser ouvido de novo em todo aniversário
          </h2>
          <div className="mt-6">
            <BotaoCriar posicao="final" texto="Começar a música" />
          </div>
          <p className="mt-4 text-sm text-[var(--tinta-suave)]">A letra é grátis. Você só paga se quiser ouvir cantada.</p>
        </section>
      </main>

      <footer className="border-t border-[var(--tinta-fraca)]/30 py-8 text-center text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
        <Link to="/" className="underline underline-offset-4">{MARCA.nome}</Link> ·{" "}
        <Link to="/termos" className="underline underline-offset-4">Termos</Link> ·{" "}
        <Link to="/privacidade" className="underline underline-offset-4">Privacidade</Link>
      </footer>
    </div>
  );
}
