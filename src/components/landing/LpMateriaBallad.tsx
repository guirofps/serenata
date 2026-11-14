import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Facebook,
  Link2,
  Menu,
  MessageCircle,
  Pause,
  Play,
  X,
} from "lucide-react";
import { PresenteNoTopo } from "@/components/landing/PresenteNoTopo";
import { BarraCTA } from "@/components/landing/BarraCTA";
import { FONTES, TEMA_CLARO } from "@/lib/marca";
import { VENDEDOR_BALLAD, cnpjFormatado } from "@/lib/empresa";
import { useProfundidadeRolagem } from "@/lib/rolagem";
import { trackEvent } from "@/lib/track";
import { carimbarExperimentos } from "@/lib/experimentos";
import { carimbarLp } from "@/lib/lp-origem";
import { mostraNatal } from "@/lib/materia-tendencia";
import { paisAtual } from "@/lib/mercado-es";
import { mercadoDoPais } from "@/lib/mercados";
import { TEXTOS_TRENDING, textosMateriaEs } from "@/lib/lp-ballad";
import { exemplosDaLpBallad, tokenExemploBallad } from "@/lib/lp-ballad-exemplos";

// A MATÉRIA DA BALLAD: `/es/tendencia` e `/trending`. A irmã da `/tendencia`
// da Serenata, com o mesmo visual de portal e as mesmas regras
// (`materia-tendencia.ts` e `lp-ballad.ts`): nome de publicação NOSSO, selo de
// publicidade no topo, rodapé dizendo de quem é (marca, empresa e CNPJ, sem
// endereço), data fixa da escrita, números da própria Ballad, sem preço, sem
// botão no topo. Uma manchete só (sem teste de manchete: a Ballad não tem a
// linha `materia_titulo` no banco).

const SANS = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const COR_TEXTO = "#222";
const COR_SUAVE = "#555";
const LINHA = "#e2e2e2";
const P = "mt-5";
const ESTILO_P = { fontSize: "1.125rem", lineHeight: 1.7, color: "#333" } as const;
const ESTILO_H2 = {
  fontWeight: 800,
  fontSize: "1.5rem",
  lineHeight: 1.2,
  letterSpacing: "-0.02em",
  color: COR_TEXTO,
} as const;
const BOTAO_REDE =
  "grid h-10 w-10 place-items-center rounded-full border text-[#444] transition-colors hover:bg-[#f3f3f3]";

function Intertitulo({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-20 text-balance" style={ESTILO_H2}>
      {children}
    </h2>
  );
}

export function LpMateriaBallad({ idioma, url }: { idioma: "es" | "en"; url: string }) {
  const es = idioma === "es";
  const lp = es ? "tendencia_es" : "trending";
  const evento = es ? "materia_es_cta" : "materia_en_cta";
  const criar = es ? "/es/criar" : "/criar";
  const t = es ? textosMateriaEs(mercadoDoPais(paisAtual()).conteudo) : TEXTOS_TRENDING;
  const exemplos = exemplosDaLpBallad(idioma);
  const tokenExemplo = tokenExemploBallad(idioma);

  useProfundidadeRolagem(`materia-${lp}`);
  const audioRef = useRef<HTMLAudioElement>(null);
  const topoRef = useRef<HTMLElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    carimbarExperimentos();
    carimbarLp(lp);
  }, [lp]);
  useEffect(() => () => audioRef.current?.pause(), []);

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
      void trackEvent(`materia_${lp}_play`, { slug });
    } catch (err) {
      console.error(`[materia-${lp}] play falhou:`, err);
    }
  }

  const medir = (rede: string) => void trackEvent("materia_compartilhar", { rede, lp });
  const textoShare = encodeURIComponent(`${t.manchete} ${url}`);
  const linkShare = encodeURIComponent(url);
  async function copiar() {
    medir("link");
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error("[materia] copiar o link falhou:", err);
    }
  }

  function BotaoCriar({ posicao }: { posicao: string }) {
    return (
      <Link
        to={criar}
        onClick={() => irProCriar(posicao)}
        className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold"
      >
        {t.botao} <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <div
      className="min-h-screen bg-white"
      style={{ ...TEMA_CLARO, fontFamily: SANS, color: COR_TEXTO }}
    >
      <audio ref={audioRef} onEnded={() => setTocando(null)} preload="none" />

      {/* ── BARRA DO TOPO: menu, a nossa publicação e a editoria. Sem botão de venda. ── */}
      <header className="relative bg-[var(--acento)] text-white">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 px-4 sm:h-14 sm:px-6">
          <button
            onClick={() => setMenu((v) => !v)}
            aria-expanded={menu}
            aria-controls="menu-materia"
            aria-label={menu ? t.menu.fechar : t.menu.abrir}
            className="flex items-center gap-2 font-semibold uppercase"
            style={{ fontSize: "0.75rem", letterSpacing: "0.12em" }}
          >
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="hidden sm:inline">{t.menu.abrir}</span>
          </button>
          <span
            className="whitespace-nowrap"
            style={{
              fontWeight: 800,
              fontSize: "clamp(1.0625rem, 4.8vw, 1.375rem)",
              letterSpacing: "-0.035em",
              lineHeight: 1,
            }}
          >
            {t.publicacao}
          </span>
          <span
            className="border-l border-white/40 pl-4 text-white/90"
            style={{ fontSize: "0.9375rem" }}
          >
            {t.editoria}
          </span>
        </div>
        {menu && (
          <nav
            id="menu-materia"
            className="absolute inset-x-0 top-full z-40 border-b bg-white text-[#222] shadow-lg"
            style={{ borderColor: LINHA }}
          >
            <ul className="mx-auto max-w-5xl px-4 py-2 sm:px-6" style={{ fontSize: "1rem" }}>
              <li>
                <Link to={es ? "/es" : "/"} className="block py-3 font-medium">
                  {t.menu.inicio}
                </Link>
              </li>
              <li className="border-t" style={{ borderColor: LINHA }}>
                <a href="#como" onClick={() => setMenu(false)} className="block py-3 font-medium">
                  {t.menu.como}
                </a>
              </li>
              {es && (
                <li className="border-t" style={{ borderColor: LINHA }}>
                  <Link to="/es/blog" className="block py-3 font-medium">
                    {t.menu.blog}
                  </Link>
                </li>
              )}
              <li className="border-t" style={{ borderColor: LINHA }}>
                <Link
                  to={criar}
                  onClick={() => irProCriar("menu")}
                  className="block py-3 font-medium text-[var(--acento)]"
                >
                  {t.menu.criar}
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[46rem] px-4 sm:px-6">
        <article>
          {/* ── SELO, MANCHETE, LINHA FINA, ASSINATURA, VÍDEO ── */}
          <section ref={topoRef} className="pt-7 sm:pt-10">
            <span
              className="inline-block rounded-[3px] border px-2 py-1 font-semibold uppercase"
              style={{
                fontSize: "0.6875rem",
                letterSpacing: "0.16em",
                color: COR_SUAVE,
                borderColor: "#bdbdbd",
              }}
            >
              {t.selo}
            </span>
            <h1
              className="mt-4 text-balance"
              style={{
                fontWeight: 800,
                fontSize: "clamp(1.85rem, 7.4vw, 3rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.035em",
              }}
            >
              {t.manchete}
            </h1>
            <p
              className="mt-4"
              style={{
                fontSize: "clamp(1.0625rem, 4.4vw, 1.3rem)",
                lineHeight: 1.5,
                color: COR_SUAVE,
              }}
            >
              {t.linhaFina}
            </p>

            <div
              className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-y py-3.5"
              style={{ borderColor: LINHA }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--acento)] font-semibold text-white"
                  aria-hidden
                >
                  {t.publicacao.charAt(0)}
                </span>
                <div style={{ fontSize: "0.9375rem", lineHeight: 1.35 }}>
                  <p className="font-semibold">{t.por}</p>
                  <p style={{ color: "#777", fontSize: "0.8125rem" }}>{t.data}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${linkShare}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => medir("facebook")}
                  aria-label={t.compartilhar.facebook}
                  className={BOTAO_REDE}
                  style={{ borderColor: LINHA }}
                >
                  <Facebook className="h-[18px] w-[18px]" />
                </a>
                {/* WhatsApp só no espanhol: é como se manda link na América Latina; nos EUA, por mensagem. */}
                {es && (
                  <a
                    href={`https://api.whatsapp.com/send?text=${textoShare}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => medir("whatsapp")}
                    aria-label={t.compartilhar.whatsapp}
                    className={BOTAO_REDE}
                    style={{ borderColor: LINHA }}
                  >
                    <MessageCircle className="h-[18px] w-[18px]" />
                  </a>
                )}
                <a
                  href={`https://twitter.com/intent/tweet?text=${textoShare}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => medir("x")}
                  aria-label={t.compartilhar.x}
                  className={BOTAO_REDE}
                  style={{ borderColor: LINHA }}
                >
                  <X className="h-[18px] w-[18px]" />
                </a>
                <button
                  onClick={copiar}
                  aria-label={copiado ? t.compartilhar.copiado : t.compartilhar.copiar}
                  className={BOTAO_REDE}
                  style={{ borderColor: LINHA }}
                >
                  {copiado ? (
                    <Check className="h-[18px] w-[18px]" />
                  ) : (
                    <Link2 className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            <figure className="mt-6">
              <div className="relative overflow-hidden bg-black">
                <video
                  src="/video/reacoes.mp4"
                  poster="/video/reacoes-poster.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="block w-full"
                />
              </div>
              <figcaption
                className="mt-2.5"
                style={{ fontSize: "0.8125rem", lineHeight: 1.45, color: "#777" }}
              >
                {t.legendaVideo}
              </figcaption>
            </figure>
          </section>

          {/* ── ABERTURA ── */}
          <p className={`${P} mt-8`} style={ESTILO_P}>
            {t.abertura[0]}
          </p>
          <p className={P} style={ESTILO_P}>
            {t.abertura[1]}
          </p>

          {/* ── PARA QUEM (números da Ballad) ── */}
          <Intertitulo>{t.tituloParaQuem}</Intertitulo>
          <p className={P} style={ESTILO_P}>
            {t.paraQuem}
          </p>
          <figure
            className="mt-6 rounded-md border p-4 sm:p-5"
            style={{ borderColor: LINHA, background: "#fafafa" }}
          >
            <figcaption className="font-semibold" style={{ fontSize: "0.9375rem" }}>
              {t.graficoTitulo}
            </figcaption>
            <div className="mt-4 space-y-3">
              {t.grafico.map((p) => (
                <div key={p.rotulo}>
                  <div
                    className="flex items-baseline justify-between gap-3"
                    style={{ fontSize: "0.9375rem" }}
                  >
                    <span>{p.rotulo}</span>
                    <span className="font-semibold tabular-nums">{p.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-sm bg-[#e6e6e6]">
                    <div className="h-full bg-[var(--acento)]" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4" style={{ fontSize: "0.75rem", color: "#777" }}>
              {t.fonte}
            </p>
          </figure>

          {/* ── POR QUE ── */}
          <Intertitulo>{t.tituloPorque}</Intertitulo>
          <p className={P} style={ESTILO_P}>
            {t.porque}
          </p>

          {/* ── O QUE A PESSOA RECEBE ── */}
          <Intertitulo>{t.tituloRecebe}</Intertitulo>
          <p className={P} style={ESTILO_P}>
            {t.recebe}
          </p>
          <div className="mt-7" style={{ fontFamily: FONTES.texto }}>
            <PresenteNoTopo locale={idioma} />
          </div>
          {tokenExemplo && (
            <p className="mt-4 text-center">
              <a
                href={`/p/${tokenExemplo}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => void trackEvent("materia_exemplo", { lp })}
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--acento)] underline underline-offset-4"
                style={{ fontSize: "0.9375rem" }}
              >
                {t.abrirExemplo} <ArrowUpRight className="h-4 w-4" />
              </a>
            </p>
          )}

          {/* ── OUÇA (some se a lista estiver vazia) ── */}
          {exemplos.length > 0 && (
            <>
              <Intertitulo>{t.tituloOuvir}</Intertitulo>
              <div className="mt-5 space-y-3">
                {exemplos.map((ex) => {
                  const ativa = tocando === ex.slug;
                  return (
                    <button
                      key={ex.slug}
                      onClick={() => alternar(ex.slug, ex.audio)}
                      aria-label={ativa ? t.pausar(ex.titulo) : t.ouvir(ex.titulo)}
                      className="flex w-full items-center gap-4 rounded-md border bg-white p-3 text-left transition-colors"
                      style={{ borderColor: ativa ? "var(--acento)" : LINHA }}
                    >
                      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded">
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
                          className="block truncate font-semibold"
                          style={{ fontSize: "1.0625rem" }}
                        >
                          {ex.titulo}
                        </span>
                        <span className="block" style={{ fontSize: "0.8125rem", color: "#777" }}>
                          {ex.para} · {ex.genero}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3" style={{ fontSize: "0.8125rem", color: "#777" }}>
                {t.notaTrechos}
              </p>
            </>
          )}

          {/* ── COMO FUNCIONA ── */}
          <Intertitulo id="como">{t.tituloComo}</Intertitulo>
          <ol className="mt-5 space-y-4">
            {t.passos.map((texto, i) => (
              <li key={texto} className="flex items-start gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--acento)] font-semibold text-white">
                  {i + 1}
                </span>
                <p className="pt-0.5" style={ESTILO_P}>
                  {texto}
                </p>
              </li>
            ))}
          </ol>

          {mostraNatal() && (
            <p className={`${P} mt-8`} style={ESTILO_P}>
              {t.natal}
            </p>
          )}

          {/* ── CAIXA FINAL ── */}
          <section
            className="mt-12 rounded-md border-t-4 border-[var(--acento)] px-5 py-8 text-center"
            style={{ background: "#f6f6f6" }}
          >
            <h2 className="mx-auto max-w-md text-balance" style={ESTILO_H2}>
              {t.caixaTitulo}
            </h2>
            <p
              className="mx-auto mt-3 max-w-sm"
              style={{ fontSize: "1rem", lineHeight: 1.55, color: COR_SUAVE }}
            >
              {t.caixaSub}
            </p>
            <div className="mt-6">
              <BotaoCriar posicao="final" />
            </div>
          </section>
        </article>
      </main>

      {/* ── RODAPÉ: de quem é o conteúdo (marca, empresa e CNPJ; sem endereço) ── */}
      <footer
        className="mx-auto mt-12 max-w-[46rem] border-t px-4 pb-28 pt-6 sm:px-6"
        style={{ fontSize: "0.8125rem", lineHeight: 1.6, color: "#777", borderColor: LINHA }}
      >
        <p>{t.rodape(VENDEDOR_BALLAD.razaoSocial, cnpjFormatado(VENDEDOR_BALLAD.cnpj))}</p>
        <p className="mt-2">
          <Link to={es ? "/es" : "/"} className="underline underline-offset-4">
            {t.inicio}
          </Link>{" "}
          ·{" "}
          <Link to="/termos" className="underline underline-offset-4">
            {t.termos}
          </Link>{" "}
          ·{" "}
          <Link to="/privacidade" className="underline underline-offset-4">
            {t.privacidade}
          </Link>
        </p>
      </footer>

      <BarraCTA
        alvoRef={topoRef}
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
