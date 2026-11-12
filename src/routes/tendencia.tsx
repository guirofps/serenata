import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Facebook, Link2, Menu, MessageCircle, Pause, Play, X } from "lucide-react";
import { PresenteNoTopo } from "@/components/landing/PresenteNoTopo";
import { BarraCTA } from "@/components/landing/BarraCTA";
import { FONTES, TEMA_CLARO } from "@/lib/marca";
import { RESPONSAVEL, cnpjFormatado } from "@/lib/empresa";
import { FAMILIAS } from "@/lib/prova-numeros";
import { useProfundidadeRolagem } from "@/lib/rolagem";
import { trackEvent } from "@/lib/track";
import { carimbarExperimentos } from "@/lib/experimentos";
import { carimbarLp } from "@/lib/lp-origem";
import { AUDIO_EXEMPLOS, VERSAO_CAPAS, exemploPorSlug, type ExemploPt } from "@/lib/exemplos-pt";
import {
  BRACOS_MATERIA,
  DATA_MATERIA,
  HORA_MATERIA,
  MANCHETES,
  NOME_PUBLICACAO,
  PARA_QUEM,
  PERIODO_PARA_QUEM,
  SLUGS_EXEMPLO_MATERIA,
  cssMateriaTitulo,
  mostraNatal,
} from "@/lib/materia-tendencia";

// A MATÉRIA DE ANÚNCIO (11/11/2026). Ângulo, regras e teste da manchete em
// `materia-tendencia.ts`.
//
// VISUAL DE PORTAL DE NOTÍCIA (Ralph, 11/11, a partir de um print): barra
// colorida com menu, selo de publicidade, manchete pesada sem serifa, linha
// fina, assinatura com avatar, botões de compartilhar e a mídia grande logo
// abaixo. O FORMATO é o de um portal; a IDENTIDADE é a nossa, e nada é de
// enfeite:
//   - a barra leva o nome da NOSSA publicação (`NOME_PUBLICACAO`, decisão do
//     Ralph) na nossa cor, e o rodapé diz que ela é da Serenata Gift;
//   - a data é a da publicação, sem relógio falso de "atualizado agora há pouco";
//   - o menu abre e os botões compartilham de verdade; não há campo de
//     pesquisa, porque não haveria o que pesquisar.
// O teste `materia-tendencia.test.ts` segura essas três coisas.
//
// Como na `/presente`: sem botão no topo. O primeiro é a barra de baixo, que
// só aparece depois que a manchete e o vídeo saem da tela.

const URL = "https://www.serenatagift.com/tendencia";
const TITULO = `${MANCHETES.A} | ${NOME_PUBLICACAO}`;
const LINHA_FINA = `Mais de ${FAMILIAS.replace("+", "")} famílias já deram uma canção com o nome e a história de quem amam. A prévia fica pronta em minutos e pode ser ouvida de graça.`;

// A tipografia de portal: uma sem serifa pesada e apertada. Só nesta página.
const INTER = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap";
const SANS = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

const EXEMPLOS = SLUGS_EXEMPLO_MATERIA.map((s) => exemploPorSlug(s)).filter((e): e is ExemploPt => Boolean(e));
const TOKEN_EXEMPLO = exemploPorSlug("antonio")?.token;

const PASSOS = [
  "Você conta a história: como se conheceram, um apelido, uma mania, uma viagem. Escrevendo ou por áudio.",
  "Em poucos minutos a história vira música, com o nome de quem vai ganhar. A prévia você ouve de graça.",
  "Quem você ama recebe a página com a música, por link ou QR Code.",
];

export const Route = createFileRoute("/tendencia")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: LINHA_FINA },
      // Página de anúncio: o conteúdo de busca mora no blog e na home.
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: MANCHETES.A },
      { property: "og:description", content: LINHA_FINA },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: FONTES.googleFonts },
      { rel: "stylesheet", href: INTER },
    ],
  }),
  component: Materia,
});

const COR_TEXTO = "#222";
const COR_SUAVE = "#555";
const LINHA = "#e2e2e2";
const P = "mt-5";
const ESTILO_P = { fontSize: "1.125rem", lineHeight: 1.7, color: "#333" } as const;
const ESTILO_H2 = { fontWeight: 800, fontSize: "1.5rem", lineHeight: 1.2, letterSpacing: "-0.02em", color: COR_TEXTO } as const;

function Intertitulo({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-20 text-balance" style={ESTILO_H2}>
      {children}
    </h2>
  );
}

// Todo botão que leva ao /criar passa por aqui: carimba a landing e a posição
// do botão na atribuição (`lp-origem.ts`) ANTES do evento, pra o evento, o lead
// e a venda saberem de qual página e de qual botão vieram.
function irProCriar(posicao: string) {
  carimbarLp("tendencia", posicao);
  void trackEvent("materia_cta", { posicao, lp: "tendencia" });
}

function BotaoCriar({ posicao }: { posicao: string }) {
  return (
    <Link
      to="/criar"
      onClick={() => irProCriar(posicao)}
      className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold"
    >
      Criar minha música <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

const BOTAO_REDE =
  "grid h-10 w-10 place-items-center rounded-full border text-[#444] transition-colors hover:bg-[#f3f3f3]";

/** Os quatro botões de compartilhar. Abrem a rede de verdade; o último copia o link. */
function Compartilhar() {
  const [copiado, setCopiado] = useState(false);
  const texto = encodeURIComponent(`${MANCHETES.A} ${URL}`);
  const link = encodeURIComponent(URL);
  const medir = (rede: string) => void trackEvent("materia_compartilhar", { rede });
  async function copiar() {
    medir("link");
    try {
      await navigator.clipboard.writeText(URL);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error("[materia] copiar o link falhou:", err);
    }
  }
  return (
    <div className="flex items-center gap-2.5">
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${link}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => medir("facebook")}
        aria-label="Compartilhar no Facebook"
        className={BOTAO_REDE}
        style={{ borderColor: LINHA }}
      >
        <Facebook className="h-[18px] w-[18px]" />
      </a>
      <a
        href={`https://api.whatsapp.com/send?text=${texto}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => medir("whatsapp")}
        aria-label="Compartilhar no WhatsApp"
        className={BOTAO_REDE}
        style={{ borderColor: LINHA }}
      >
        <MessageCircle className="h-[18px] w-[18px]" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${texto}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => medir("x")}
        aria-label="Compartilhar no X"
        className={BOTAO_REDE}
        style={{ borderColor: LINHA }}
      >
        <X className="h-[18px] w-[18px]" />
      </a>
      <button
        onClick={copiar}
        aria-label={copiado ? "Link copiado" : "Copiar o link"}
        className={BOTAO_REDE}
        style={{ borderColor: LINHA }}
      >
        {copiado ? <Check className="h-[18px] w-[18px]" /> : <Link2 className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

function Materia() {
  useProfundidadeRolagem("materia-tendencia");
  const audioRef = useRef<HTMLAudioElement>(null);
  // A barra de baixo espera ESTE bloco sair da tela: manchete + vídeo.
  const topoRef = useRef<HTMLElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  // O braço da manchete vai junto com o lead desde a matéria, não só a partir
  // do quiz: quem clica e volta outro dia continua no braço que viu.
  useEffect(() => {
    carimbarExperimentos();
    carimbarLp("tendencia");
  }, []);
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
      void trackEvent("materia_play", { slug });
    } catch (err) {
      console.error("[materia] play falhou:", err);
    }
  }

  return (
    <div className="min-h-screen bg-white" style={{ ...TEMA_CLARO, fontFamily: SANS, color: COR_TEXTO }}>
      <style dangerouslySetInnerHTML={{ __html: cssMateriaTitulo() }} />
      <audio ref={audioRef} onEnded={() => setTocando(null)} preload="none" />

      {/* ── BARRA DO TOPO: menu, a nossa marca e a editoria. Sem botão de venda. ── */}
      <header className="relative bg-[var(--acento)] text-white">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-4 px-4 sm:h-14 sm:px-6">
          <button
            onClick={() => setMenu((v) => !v)}
            aria-expanded={menu}
            aria-controls="menu-materia"
            className="flex items-center gap-2 font-semibold uppercase"
            style={{ fontSize: "0.75rem", letterSpacing: "0.12em" }}
          >
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            {/* No celular fica só o ícone: o nome da publicação precisa do espaço. */}
            <span className="hidden sm:inline">Menu</span>
            <span className="sr-only sm:hidden">Menu</span>
          </button>
          <span
            className="whitespace-nowrap"
            style={{ fontWeight: 800, fontSize: "clamp(1.0625rem, 4.8vw, 1.375rem)", letterSpacing: "-0.035em", lineHeight: 1 }}
          >
            {NOME_PUBLICACAO}
          </span>
          <span className="border-l border-white/40 pl-4 text-white/90" style={{ fontSize: "0.9375rem" }}>
            Presentes
          </span>
        </div>
        {menu && (
          <nav
            id="menu-materia"
            className="absolute inset-x-0 top-full z-40 border-b bg-white text-[#222] shadow-lg"
            style={{ borderColor: LINHA }}
          >
            <ul className="mx-auto max-w-5xl px-4 py-2 sm:px-6" style={{ fontSize: "1rem" }}>
              <li><Link to="/" className="block py-3 font-medium">Página inicial</Link></li>
              <li className="border-t" style={{ borderColor: LINHA }}>
                <a href="#como-fazer" onClick={() => setMenu(false)} className="block py-3 font-medium">Como funciona</a>
              </li>
              <li className="border-t" style={{ borderColor: LINHA }}>
                <Link to="/blog" className="block py-3 font-medium">Blog</Link>
              </li>
              <li className="border-t" style={{ borderColor: LINHA }}>
                <Link
                  to="/criar"
                  onClick={() => irProCriar("menu")}
                  className="block py-3 font-medium text-[var(--acento)]"
                >
                  Criar minha música
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[46rem] px-4 sm:px-6">
        <article>
          {/* ── SELO, MANCHETE, LINHA FINA, ASSINATURA, VÍDEO ─── */}
          <section ref={topoRef} className="pt-7 sm:pt-10">
            <span
              className="inline-block rounded-[3px] border px-2 py-1 font-semibold uppercase"
              style={{ fontSize: "0.6875rem", letterSpacing: "0.16em", color: COR_SUAVE, borderColor: "#bdbdbd" }}
            >
              Publicidade
            </span>
            <h1
              className="mt-4 text-balance"
              style={{ fontWeight: 800, fontSize: "clamp(1.85rem, 7.4vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.035em" }}
            >
              {BRACOS_MATERIA.map((b) => (
                <span key={b} className={b === "A" ? "mtt-A" : `mtt-v mtt-${b}`}>
                  {MANCHETES[b]}
                </span>
              ))}
            </h1>
            <p className="mt-4" style={{ fontSize: "clamp(1.0625rem, 4.4vw, 1.3rem)", lineHeight: 1.5, color: COR_SUAVE }}>
              {LINHA_FINA}
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
                  N
                </span>
                <div style={{ fontSize: "0.9375rem", lineHeight: 1.35 }}>
                  <p>
                    Por <span className="font-semibold">Redação {NOME_PUBLICACAO}</span>
                  </p>
                  <p style={{ color: "#777", fontSize: "0.8125rem" }}>
                    {DATA_MATERIA} {HORA_MATERIA}
                  </p>
                </div>
              </div>
              <Compartilhar />
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
              <figcaption className="mt-2.5" style={{ fontSize: "0.8125rem", lineHeight: 1.45, color: "#777" }}>
                Momento em que famílias ouvem pela primeira vez a música feita com a própria história.
              </figcaption>
            </figure>
          </section>

          {/* ── ABERTURA ─────────────────────────────────────── */}
          <p className={`${P} mt-8`} style={ESTILO_P}>
            Flores, perfume e chocolate são os presentes de sempre. Mas um formato diferente vem ganhando espaço entre os
            brasileiros: a música feita sob medida, com o nome e a história de quem vai receber. Na Serenata, plataforma
            brasileira que cria essas canções, mais de {FAMILIAS.replace("+", "")} famílias já deram uma de presente.
          </p>
          <p className={P} style={ESTILO_P}>
            A ideia é simples. A pessoa conta a história (como o casal se conheceu, um apelido, uma mania, uma viagem) e
            ela vira uma canção original que fala exatamente disso. Quem ganha ouve o próprio nome cantado, numa música
            que ninguém mais tem.
          </p>

          {/* ── PARA QUEM ────────────────────────────────────── */}
          <Intertitulo>Quase metade é para a esposa</Intertitulo>
          <p className={P} style={ESTILO_P}>
            Um levantamento da Serenata com as {PERIODO_PARA_QUEM}, mostra para quem os brasileiros mais fazem: 47% foram
            para a esposa e 12% para a namorada. O restante se divide entre mães, pais, filhos, avós e amigos.
          </p>
          <figure className="mt-6 rounded-md border p-4 sm:p-5" style={{ borderColor: LINHA, background: "#fafafa" }}>
            <figcaption className="font-semibold" style={{ fontSize: "0.9375rem" }}>
              Para quem as músicas são feitas
            </figcaption>
            <div className="mt-4 space-y-3">
              {PARA_QUEM.map((p) => (
                <div key={p.rotulo}>
                  <div className="flex items-baseline justify-between gap-3" style={{ fontSize: "0.9375rem" }}>
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
              Fonte: Serenata, {PERIODO_PARA_QUEM}.
            </p>
          </figure>

          {/* ── POR QUE ──────────────────────────────────────── */}
          <Intertitulo>O que a música tem que a flor não tem</Intertitulo>
          <p className={P} style={ESTILO_P}>
            Flores murcham em uma semana. Chocolate acaba em minutos. Presente de loja pode parar no fundo da gaveta. A
            música tem uma coisa que nenhum deles tem: foi feita para uma pessoa só, com detalhes que só aquela família
            conhece, e continua tocando no aniversário seguinte.
          </p>

          {/* ── O QUE A PESSOA RECEBE ────────────────────────── */}
          <Intertitulo>O presente não chega como um arquivo de áudio</Intertitulo>
          <p className={P} style={ESTILO_P}>
            Quem recebe abre um link no celular e encontra uma página com o próprio nome na capa: a música tocando, a
            letra acendendo palavra por palavra e as fotos da família passando. O link pode ir por mensagem ou virar um QR
            Code colado num cartão ou numa caixa de bombom.
          </p>
          <div className="mt-7" style={{ fontFamily: FONTES.texto }}>
            <PresenteNoTopo />
          </div>
          {TOKEN_EXEMPLO && (
            <p className="mt-4 text-center">
              <a
                href={`/p/${TOKEN_EXEMPLO}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => void trackEvent("materia_exemplo", {})}
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--acento)] underline underline-offset-4"
                style={{ fontSize: "0.9375rem" }}
              >
                Abrir um presente de exemplo <ArrowUpRight className="h-4 w-4" />
              </a>
            </p>
          )}

          {/* ── OUÇA ─────────────────────────────────────────── */}
          <Intertitulo>Ouça três músicas feitas assim</Intertitulo>
          <div className="mt-5 space-y-3">
            {EXEMPLOS.map((ex) => {
              const ativa = tocando === ex.slug;
              return (
                <button
                  key={ex.slug}
                  onClick={() => alternar(ex.slug)}
                  aria-label={ativa ? `Pausar ${ex.titulo}` : `Ouvir ${ex.titulo}`}
                  className="flex w-full items-center gap-4 rounded-md border bg-white p-3 text-left transition-colors"
                  style={{ borderColor: ativa ? "var(--acento)" : LINHA }}
                >
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded">
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
                    <span className="block truncate font-semibold" style={{ fontSize: "1.0625rem" }}>
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
            Trechos de 45 segundos. A música completa tem cerca de 4 minutos.
          </p>

          {/* ── COMO FUNCIONA ────────────────────────────────── */}
          <Intertitulo id="como-fazer">Como fazer uma</Intertitulo>
          <ol className="mt-5 space-y-4">
            {PASSOS.map((texto, i) => (
              <li key={texto} className="flex items-start gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--acento)] font-semibold text-white">
                  {i + 1}
                </span>
                <p className="pt-0.5" style={ESTILO_P}>{texto}</p>
              </li>
            ))}
          </ol>

          {mostraNatal() && (
            <p className={`${P} mt-8`} style={ESTILO_P}>
              Para quem está pensando no Natal: a música fica pronta no mesmo dia, então dá tempo mesmo para quem deixa o
              presente para a última semana.
            </p>
          )}

          {/* ── CAIXA FINAL ──────────────────────────────────── */}
          <section
            className="mt-12 rounded-md border-t-4 border-[var(--acento)] px-5 py-8 text-center"
            style={{ background: "#f6f6f6" }}
          >
            <h2 className="mx-auto max-w-md text-balance" style={ESTILO_H2}>
              Ouça a prévia da sua música de graça
            </h2>
            <p className="mx-auto mt-3 max-w-sm" style={{ fontSize: "1rem", lineHeight: 1.55, color: COR_SUAVE }}>
              Conte a história de vocês agora. A prévia fica pronta em poucos minutos.
            </p>
            <div className="mt-6">
              <BotaoCriar posicao="final" />
            </div>
          </section>
        </article>
      </main>

      {/* ── RODAPÉ: de quem é o conteúdo ────────────────────── */}
      <footer
        className="mx-auto mt-12 max-w-[46rem] border-t px-4 pb-28 pt-6 sm:px-6"
        style={{ fontSize: "0.8125rem", lineHeight: 1.6, color: "#777", borderColor: LINHA }}
      >
        <p>
          {NOME_PUBLICACAO} é um espaço de conteúdo da {RESPONSAVEL.nome}, CNPJ {cnpjFormatado(RESPONSAVEL.cnpj)}. Este
          conteúdo é publicidade, e os números citados são da própria empresa.
        </p>
        <p className="mt-2">
          <Link to="/" className="underline underline-offset-4">Página inicial</Link> ·{" "}
          <Link to="/termos" className="underline underline-offset-4">Termos</Link> ·{" "}
          <Link to="/privacidade" className="underline underline-offset-4">Privacidade</Link>
        </p>
      </footer>

      <BarraCTA
        alvoRef={topoRef}
        rotulo="Criar minha música"
        titulo="Uma música com o nome de quem você ama"
        sub="A prévia é grátis"
        aoClicar={() => irProCriar("barra")}
      />
    </div>
  );
}
