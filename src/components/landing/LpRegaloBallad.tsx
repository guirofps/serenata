import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Logo } from "@/components/marca/Logo";
import { ProvaSocial } from "@/components/landing/ProvaSocial";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { Entregavel } from "@/components/landing/Entregavel";
import { BarraCTA } from "@/components/landing/BarraCTA";
import { FONTES, MARCA, TEMA_CLARO } from "@/lib/marca";
import { useProfundidadeRolagem } from "@/lib/rolagem";
import { trackEvent } from "@/lib/track";
import { carimbarExperimentos } from "@/lib/experimentos";
import { carimbarLp } from "@/lib/lp-origem";
import { paisAtual } from "@/lib/mercado-es";
import { mercadoDoPais } from "@/lib/mercados";
import { TEXTOS_GIFT, textosRegaloEs } from "@/lib/lp-ballad";
import { exemplosDaLpBallad, tokenExemploBallad } from "@/lib/lp-ballad-exemplos";

// A LANDING CURTA DA BALLAD: `/es/regalo` e `/gift`. A irmã da `/presente` da
// Serenata, com o mesmo desenho e as mesmas regras (`lp-ballad.ts`): sem botão
// no topo nem no herói, o primeiro botão é a barra de baixo, que só aparece
// depois que a headline e o vídeo saíram da tela; sem preço.

const COLUNA = "mx-auto max-w-3xl px-4 sm:px-5";

export function LpRegaloBallad({ idioma }: { idioma: "es" | "en" }) {
  const es = idioma === "es";
  const lp = es ? "regalo" : "gift";
  const evento = es ? "lp_regalo_cta" : "lp_gift_cta";
  const criar = es ? "/es/criar" : "/criar";
  // O país do acesso, o mesmo que o servidor carimbou no `<html>` (como a home `/es`).
  const t = es ? textosRegaloEs(mercadoDoPais(paisAtual()).conteudo) : TEXTOS_GIFT;
  const exemplos = exemplosDaLpBallad(idioma);
  const tokenExemplo = tokenExemploBallad(idioma);

  useProfundidadeRolagem(`lp-${lp}`);
  const audioRef = useRef<HTMLAudioElement>(null);
  const heroiRef = useRef<HTMLElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);

  useEffect(() => {
    carimbarExperimentos();
    carimbarLp(lp);
  }, [lp]);
  useEffect(() => () => audioRef.current?.pause(), []);

  // Todo botão que leva ao quiz passa por aqui: carimba a landing e a posição
  // ANTES do evento (`lp-origem.ts`).
  function irProCriar(posicao: string) {
    carimbarLp(lp, posicao);
    void trackEvent(evento, { posicao, lp });
  }

  async function alternar(slug: string, audio: string) {
    const a = audioRef.current;
    if (!a) return;
    if (tocando === slug) {
      a.pause();
      setTocando(null);
      return;
    }
    a.src = audio;
    try {
      await a.play();
      setTocando(slug);
      void trackEvent(`lp_${lp}_play`, { slug });
    } catch (err) {
      console.error(`[lp-${lp}] play falhou:`, err);
    }
  }

  const titulo2 = {
    fontFamily: FONTES.display,
    fontWeight: 500,
    fontSize: "var(--t-2xl)",
    lineHeight: 1.15,
  } as const;

  function BotaoCriar({ posicao }: { posicao: string }) {
    return (
      <Link
        to={criar}
        onClick={() => irProCriar(posicao)}
        className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
      >
        {t.botao} <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--papel)] text-[var(--tinta)]" style={TEMA_CLARO}>
      <div className="fio-marca fixed inset-x-0 top-0 z-40" aria-hidden />
      <audio ref={audioRef} onEnded={() => setTocando(null)} preload="none" />

      <header className="border-b border-[var(--tinta-fraca)]/30">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-3 sm:px-5 sm:py-4">
          <Logo tamanho="sm" />
        </div>
      </header>

      <main>
        {/* ── HERÓI: headline + reações. Sem botão. ── */}
        <section ref={heroiRef} className={`${COLUNA} pt-8 text-center sm:pt-14`}>
          <p
            className="uppercase tracking-[0.3em] text-[var(--acento)]"
            style={{ fontSize: "var(--t-xs)" }}
          >
            {t.olho}
          </p>
          <h1
            className="mx-auto mt-4 max-w-2xl text-balance"
            style={{
              fontFamily: FONTES.display,
              fontWeight: 500,
              fontSize: "var(--t-hero)",
              lineHeight: 1.08,
            }}
          >
            {t.headline.antes}
            <span className="texto-ouro">{t.headline.ouro}</span>
            {t.headline.depois}
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-lg)", lineHeight: 1.55 }}
          >
            {t.sub}
          </p>
          <div className="mt-8 sm:mt-10">
            <VitrineVideo caption={t.legendaVideo} selo={t.seloVideo} />
          </div>
          <div className="mt-7 flex justify-center">
            <ProvaSocial locale={idioma} />
          </div>
        </section>

        {/* ── O PRESENTE COMUM DURA POUCO ── */}
        <section className={`${COLUNA} mt-16 sm:mt-24`}>
          <h2 className="text-balance text-center" style={titulo2}>
            {t.tituloComuns}
          </h2>
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {t.comuns.map((c) => (
              <div
                key={c.nome}
                className="flex items-center gap-4 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/35 bg-white/60 p-4"
              >
                <span className="text-3xl grayscale" aria-hidden>
                  {c.emoji}
                </span>
                <p style={{ fontSize: "var(--t-base)" }}>
                  <span className="font-medium">{c.nome}</span>{" "}
                  <span className="text-[var(--tinta-suave)]">{c.fim}</span>
                </p>
              </div>
            ))}
            <div className="flex items-center gap-4 rounded-[var(--raio-lg)] border border-[var(--acento)]/50 bg-[var(--acento)]/5 p-4">
              <span className="text-3xl" aria-hidden>
                🎵
              </span>
              <p style={{ fontSize: "var(--t-base)" }}>
                <span className="font-medium">{t.musica.nome}</span>{" "}
                <span className="text-[var(--tinta-suave)]">{t.musica.fim}</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── O QUE A PESSOA RECEBE: a página-presente ── */}
        <div className="mt-12 sm:mt-16">
          <Entregavel exemploToken={tokenExemplo} locale={idioma} />
        </div>
        <section className={`${COLUNA} text-center`}>
          <BotaoCriar posicao="presente" />
          <p className="mt-3 text-sm text-[var(--tinta-suave)]">{t.depoisBotao}</p>
        </section>

        {/* ── OUÇA: três músicas de verdade (some se a lista estiver vazia) ── */}
        {exemplos.length > 0 && (
          <section className={`${COLUNA} mt-16 sm:mt-24`}>
            <h2 className="text-balance text-center" style={titulo2}>
              {t.tituloOuvir}
            </h2>
            <p
              className="mx-auto mt-3 max-w-md text-center text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-base)" }}
            >
              {t.subOuvir}
            </p>
            <div className="mt-7 space-y-3">
              {exemplos.map((ex) => {
                const ativa = tocando === ex.slug;
                return (
                  <button
                    key={ex.slug}
                    onClick={() => alternar(ex.slug, ex.audio)}
                    aria-label={ativa ? t.pausar(ex.titulo) : t.ouvir(ex.titulo)}
                    className={`flex w-full items-center gap-4 rounded-[var(--raio-lg)] border bg-white p-3 text-left transition-colors ${
                      ativa ? "border-[var(--acento)]" : "border-[var(--tinta-fraca)]/40"
                    }`}
                  >
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <img
                        src={ex.capa}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">
                        {ativa ? (
                          <Pause className="h-6 w-6" />
                        ) : (
                          <Play className="h-6 w-6 translate-x-0.5" />
                        )}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate"
                        style={{
                          fontFamily: FONTES.display,
                          fontWeight: 500,
                          fontSize: "var(--t-base)",
                        }}
                      >
                        {ex.titulo}
                      </span>
                      <span
                        className="block text-[var(--tinta-suave)]"
                        style={{ fontSize: "var(--t-xs)" }}
                      >
                        {ex.para} · {ex.genero}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p
              className="mt-3 text-center text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-xs)" }}
            >
              {t.notaTrechos}
            </p>
          </section>
        )}

        {/* ── COMO FUNCIONA ── */}
        <section className={`${COLUNA} mt-16 sm:mt-24`}>
          <h2 className="text-balance text-center" style={titulo2}>
            {t.tituloPassos}
          </h2>
          <ol className="mx-auto mt-7 max-w-xl space-y-4">
            {t.passos.map((texto, i) => (
              <li key={texto} className="flex items-start gap-4">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]"
                  style={{ fontFamily: FONTES.display, fontWeight: 600 }}
                >
                  {i + 1}
                </span>
                <p className="pt-1.5" style={{ fontSize: "var(--t-base)", lineHeight: 1.5 }}>
                  {texto}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── CTA FINAL ── */}
        <section className={`${COLUNA} mt-16 pb-16 text-center sm:mt-24`}>
          <h2 className="mx-auto max-w-lg text-balance" style={titulo2}>
            {t.tituloFinal}
          </h2>
          <div className="mt-6">
            <BotaoCriar posicao="final" />
          </div>
          <p className="mt-4 text-sm text-[var(--tinta-suave)]">{t.subFinal}</p>
        </section>
      </main>

      <footer
        className="border-t border-[var(--tinta-fraca)]/30 pb-28 pt-8 text-center text-[var(--tinta-suave)]"
        style={{ fontSize: "var(--t-xs)" }}
      >
        <Link to={es ? "/es" : "/"} className="underline underline-offset-4">
          {MARCA.nome}
        </Link>{" "}
        ·{" "}
        <Link to="/termos" className="underline underline-offset-4">
          {t.termos}
        </Link>{" "}
        ·{" "}
        <Link to="/privacidade" className="underline underline-offset-4">
          {t.privacidade}
        </Link>
      </footer>

      <BarraCTA
        alvoRef={heroiRef}
        locale={idioma}
        destino={criar}
        rotulo={t.barra.rotulo}
        titulo={t.barra.titulo}
        sub={t.barra.sub}
        aoClicar={() => irProCriar("barra")}
      />
    </div>
  );
}
