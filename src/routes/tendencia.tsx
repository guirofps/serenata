import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import { Logo } from "@/components/marca/Logo";
import { VitrineVideo } from "@/components/landing/VitrineVideo";
import { PresenteNoTopo } from "@/components/landing/PresenteNoTopo";
import { BarraCTA } from "@/components/landing/BarraCTA";
import { FONTES, TEMA_CLARO } from "@/lib/marca";
import { RESPONSAVEL, cnpjFormatado } from "@/lib/empresa";
import { FAMILIAS } from "@/lib/prova-numeros";
import { useProfundidadeRolagem } from "@/lib/rolagem";
import { trackEvent } from "@/lib/track";
import { carimbarExperimentos } from "@/lib/experimentos";
import { AUDIO_EXEMPLOS, VERSAO_CAPAS, exemploPorSlug, type ExemploPt } from "@/lib/exemplos-pt";
import {
  BRACOS_MATERIA,
  DATA_MATERIA,
  MANCHETES,
  PARA_QUEM,
  PERIODO_PARA_QUEM,
  SLUGS_EXEMPLO_MATERIA,
  cssMateriaTitulo,
  mostraNatal,
} from "@/lib/materia-tendencia";

// A MATÉRIA DE ANÚNCIO (11/11/2026). Ângulo, regras e teste da manchete em
// `materia-tendencia.ts`. O formato é o de uma notícia (manchete, linha fina,
// data, intertítulos, foto com legenda, dados), mas a página é NOSSA e se diz
// publicidade no topo e no rodapé. Não imita portal nenhum.
//
// Como na `/presente`: sem botão no topo. O primeiro é a barra de baixo, que
// só aparece depois que a manchete e o vídeo saem da tela.

const URL = "https://www.serenatagift.com/tendencia";
const TITULO = `${MANCHETES.A} | Serenata`;
const LINHA_FINA = `Mais de ${FAMILIAS.replace("+", "")} famílias já deram uma canção com o nome e a história de quem amam. A prévia fica pronta em minutos e pode ser ouvida de graça.`;

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
    ],
  }),
  component: Materia,
});

const P = "mt-5 text-[var(--tinta)]";
const ESTILO_P = { fontSize: "1.0625rem", lineHeight: 1.75 } as const;
const ESTILO_H2 = { fontFamily: FONTES.display, fontWeight: 600, fontSize: "var(--t-xl)", lineHeight: 1.2 } as const;

function Intertitulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 text-balance" style={ESTILO_H2}>
      {children}
    </h2>
  );
}

function BotaoCriar({ posicao }: { posicao: string }) {
  return (
    <Link
      to="/criar"
      onClick={() => void trackEvent("materia_cta", { posicao })}
      className="cta cta-pulse inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-medium"
    >
      Criar minha música <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function Materia() {
  useProfundidadeRolagem("materia-tendencia");
  const audioRef = useRef<HTMLAudioElement>(null);
  // A barra de baixo espera ESTE bloco sair da tela: manchete + vídeo.
  const topoRef = useRef<HTMLElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);

  // O braço da manchete vai junto com o lead desde a matéria, não só a partir
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
      void trackEvent("materia_play", { slug });
    } catch (err) {
      console.error("[materia] play falhou:", err);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[var(--tinta)]" style={TEMA_CLARO}>
      <style dangerouslySetInnerHTML={{ __html: cssMateriaTitulo() }} />
      <audio ref={audioRef} onEnded={() => setTocando(null)} preload="none" />

      {/* ── CABEÇALHO: a nossa marca e o selo. Sem botão. ───── */}
      <header className="border-b border-[var(--tinta-fraca)]/40">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-5">
          <Logo tamanho="sm" />
          <span
            className="rounded border border-[var(--tinta-fraca)]/60 px-2 py-0.5 uppercase tracking-[0.14em] text-[var(--tinta-suave)]"
            style={{ fontSize: "0.6875rem" }}
          >
            Publicidade
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-5">
        <article>
          {/* ── MANCHETE, LINHA FINA, ASSINATURA, VÍDEO ───────── */}
          <section ref={topoRef} className="pt-7 sm:pt-10">
            <p className="font-semibold uppercase tracking-[0.16em] text-[var(--acento)]" style={{ fontSize: "var(--t-xs)" }}>
              Presentes
            </p>
            <h1
              className="mt-3 text-balance"
              style={{ fontFamily: FONTES.display, fontWeight: 600, fontSize: "clamp(1.75rem, 6.2vw, 2.6rem)", lineHeight: 1.12 }}
            >
              {BRACOS_MATERIA.map((b) => (
                <span key={b} className={b === "A" ? "mtt-A" : `mtt-v mtt-${b}`}>
                  {MANCHETES[b]}
                </span>
              ))}
            </h1>
            <p className="mt-4 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-lg)", lineHeight: 1.5 }}>
              {LINHA_FINA}
            </p>
            <p
              className="mt-5 border-y border-[var(--tinta-fraca)]/40 py-3 text-[var(--tinta-suave)]"
              style={{ fontSize: "var(--t-xs)" }}
            >
              Por <span className="font-medium text-[var(--tinta)]">Redação Serenata</span> · {DATA_MATERIA} · Leitura de 3 minutos
            </p>

            <div className="mt-6">
              <VitrineVideo
                selo="reações reais"
                caption="Momento em que famílias ouvem pela primeira vez a música feita com a própria história."
              />
            </div>
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
          <figure className="mt-6 rounded-[var(--raio-lg)] border border-[var(--tinta-fraca)]/40 p-4 sm:p-5">
            <figcaption className="font-medium" style={{ fontSize: "var(--t-sm)" }}>
              Para quem as músicas são feitas
            </figcaption>
            <div className="mt-4 space-y-3">
              {PARA_QUEM.map((p) => (
                <div key={p.rotulo}>
                  <div className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--t-sm)" }}>
                    <span>{p.rotulo}</span>
                    <span className="font-semibold tabular-nums">{p.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--tinta-fraca)]/25">
                    <div className="h-full rounded-full bg-[var(--acento)]" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
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
          <div className="mt-7">
            <PresenteNoTopo />
          </div>
          {TOKEN_EXEMPLO && (
            <p className="mt-4 text-center">
              <a
                href={`/p/${TOKEN_EXEMPLO}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => void trackEvent("materia_exemplo", {})}
                className="inline-flex items-center gap-1.5 font-medium text-[var(--acento)] underline underline-offset-4"
                style={{ fontSize: "var(--t-sm)" }}
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
          <p className="mt-3 text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-xs)" }}>
            Trechos de 45 segundos. A música completa tem cerca de 4 minutos.
          </p>

          {/* ── COMO FUNCIONA ────────────────────────────────── */}
          <Intertitulo>Como fazer uma</Intertitulo>
          <ol className="mt-5 space-y-4">
            {PASSOS.map((texto, i) => (
              <li key={texto} className="flex items-start gap-4">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--acento)]/10 text-[var(--acento)]"
                  style={{ fontFamily: FONTES.display, fontWeight: 600 }}
                >
                  {i + 1}
                </span>
                <p className="pt-1" style={ESTILO_P}>{texto}</p>
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
          <section className="mt-12 rounded-[var(--raio-lg)] border border-[var(--acento)]/40 bg-[var(--acento)]/5 px-5 py-8 text-center">
            <h2 className="mx-auto max-w-md text-balance" style={ESTILO_H2}>
              Ouça a prévia da sua música de graça
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-[var(--tinta-suave)]" style={{ fontSize: "var(--t-base)", lineHeight: 1.55 }}>
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
        className="mx-auto mt-12 max-w-2xl border-t border-[var(--tinta-fraca)]/40 px-4 pb-28 pt-6 text-[var(--tinta-suave)] sm:px-5"
        style={{ fontSize: "var(--t-xs)", lineHeight: 1.6 }}
      >
        <p>
          Este conteúdo é publicidade da {RESPONSAVEL.nome}, CNPJ {cnpjFormatado(RESPONSAVEL.cnpj)}. Os números citados são
          da própria empresa.
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
        aoClicar={() => void trackEvent("materia_cta", { posicao: "barra" })}
      />
    </div>
  );
}
