import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { carregarPresente } from "@/lib/presente";
import { LetraSincronizada } from "@/components/presente/LetraSincronizada";
import { Ambiente } from "@/components/presente/Ambiente";
import { BotaoGuardar } from "@/components/presente/BotaoGuardar";
import { FotosSincronizadas } from "@/components/presente/FotosSincronizadas";
import { Logo } from "@/components/marca/Logo";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

// A PÁGINA PRESENTE — o entregável.
//
// Conceito: o lançamento de um DISCO de uma música só, feita pra uma pessoa.
// Não imita o Spotify (o Lovepanda faz isso; é derivado e é trade dress dos
// outros). A referência é uma página de release: escuro, quente, tipografia
// editorial, e a letra acendendo sobre a música original.
//
// A pessoa abre isso pelo WhatsApp, no celular. Então: mobile primeiro, um
// gesto só pra começar (o play), e nada que atrapalhe a emoção.

// GSAP NÃO é importado no topo, e isso não é estilo — são dois bugs reais
// que já derrubaram esta rota:
//
//  1. `@gsap/react` (useGSAP) arrasta a própria cópia do React e quebra a
//     página com "Invalid hook call". Descartado: `gsap.context()` faz o
//     mesmo (escopo + limpeza) sem dependência nova.
//  2. `gsap/ScrollTrigger` toca `document` já no import. No SSR isso
//     derruba a rota inteira com HTTP 500 (visto em produção). Por isso o
//     import é DINÂMICO, dentro do efeito: nunca roda no servidor.
type Gsap = typeof import("gsap")["gsap"];

const searchSchema = (s: Record<string, unknown>) => ({
  v: s.v === 2 || s.v === "2" ? (2 as const) : undefined,
});

export const Route = createFileRoute("/p/$token")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ v: search.v }),
  loader: async ({ params, deps }) => {
    const presente = await carregarPresente({
      data: { token: params.token, versao: deps.v },
    });
    if (!presente) throw notFound();
    return presente;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.titulo} — para ${loaderData.nome}` : "Um presente" },
      {
        name: "description",
        content: loaderData
          ? `Uma música feita só para ${loaderData.nome}.`
          : "Uma música feita só para você.",
      },
      // O link vai ser colado no WhatsApp: a prévia precisa ser bonita.
      { property: "og:title", content: loaderData?.titulo ?? "Um presente" },
      {
        property: "og:description",
        content: loaderData ? `Uma música feita só para ${loaderData.nome}.` : "",
      },
      { property: "og:type", content: "music.song" },
    ],
  }),
  component: PaginaPresente,
  notFoundComponent: () => (
    <main className="grid min-h-screen place-items-center bg-[#0d0a08] px-6 text-center">
      <div>
        <p className="text-2xl text-white/80">Esse presente não existe (ou expirou).</p>
        <p className="mt-2 text-sm text-white/40">Confira o link com quem te enviou.</p>
      </div>
    </main>
  ),
});

function PaginaPresente() {
  const p = Route.useLoaderData();
  const { token } = Route.useParams();
  const audioRef = useRef<HTMLAudioElement>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const capaRef = useRef<HTMLElement>(null);
  // Guarda o gsap depois do import dinâmico, pra usar fora do efeito.
  const gsapRef = useRef<Gsap | null>(null);
  const [tocando, setTocando] = useState(false);
  const [t, setT] = useState(0);
  const [comecou, setComecou] = useState(false);

  // Relógio da letra: rAF mantém o acendimento colado no vocal (timeupdate
  // dispara ~4x/s e atrasa visivelmente). `timeupdate` fica junto como rede
  // de segurança — em ambiente que não compõe frames, rAF não roda.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const pelosEventos = () => setT(a.currentTime);
    a.addEventListener("timeupdate", pelosEventos);
    if (!tocando) return () => a.removeEventListener("timeupdate", pelosEventos);
    let vivo = true;
    const tick = () => {
      if (!vivo) return;
      setT(a.currentTime);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      vivo = false;
      a.removeEventListener("timeupdate", pelosEventos);
    };
  }, [tocando]);

  // ── ABERTURA ──────────────────────────────────────────────
  // O H1 renderiza VISÍVEL no HTML e só então é animado com gsap.from():
  // nada de opacity:0 no CSS, que mataria o LCP se o JS falhasse (§5.5).
  useEffect(() => {
    let vivo = true;
    let ctx: { revert: () => void } | undefined;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (!vivo) return; // desmontou antes do chunk chegar
      gsap.registerPlugin(ScrollTrigger);
      gsapRef.current = gsap;

      // `gsap.context` com escopo na raiz: os seletores só enxergam esta
      // página, e o revert() no cleanup desfaz tudo (essencial em SPA, senão
      // ScrollTrigger vaza entre navegações).
      ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        // Quem pediu menos movimento recebe a página parada — sem exceção.
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const abertura = gsap
            .timeline({ defaults: { ease: "power3.out" } })
            .from("[data-abre]", { y: 26, opacity: 0, duration: 0.9, stagger: 0.13 })
            .from("[data-abre-fio]", { scaleX: 0, duration: 0.7 }, "-=0.5")
            // O play anima SÓ escala, nunca opacidade.
            //
            // Bug real relatado no celular ("aparece e logo some"):
            // gsap.from() escreve o estado inicial INLINE assim que o tween
            // é criado, mas este só começa ~1,15s depois. Com opacity:0 no
            // estado inicial, o botão ficava invisível nessa janela inteira
            // — e some de vez se o relógio de animação parar.
            //
            // Escala não tem esse problema: em qualquer ponto da animação o
            // botão continua visível e clicável. Ele é o ÚNICO controle da
            // página; não pode depender de animação pra existir.
            .from("[data-abre-play]", { scale: 0.72, duration: 0.6 }, "-=0.35");

          // REDE DE SEGURANÇA — bug real relatado no celular: o botão de
          // play sumia.
          //
          // `gsap.from()` escreve opacity:0 inline assim que o tween é
          // criado, e o play só começa a animar ~1,15s depois. Se o relógio
          // de animação parar nessa janela — o iOS estrangula rAF durante
          // scroll e ao trocar de app, e o GSAP ainda chega por import
          // dinâmico — o botão fica invisível PARA SEMPRE. E ele é o único
          // controle da página: sem ele o presente não abre.
          //
          // `progress(1)` aplica o estado final na hora, sem depender do
          // ticker. Se a animação já terminou, é no-op.
          const seguro = window.setTimeout(() => {
            if (abertura.progress() < 1) abertura.progress(1);
          }, 3500);

          // Seções abaixo sobem quando entram na tela.
          //
          // `immediateRender: false` é obrigatório aqui, não estilo: sem ele
          // o gsap.from() zera a opacidade de TODAS as seções no mount, e se
          // o ScrollTrigger não disparar (erro, motor sem frames, chunk que
          // não chegou) a LETRA E O RODAPÉ somem pra sempre. Com ele, o
          // conteúdo nasce visível e a animação é só um bônus.
          gsap.utils.toArray<HTMLElement>("[data-revela]").forEach((el) => {
            gsap.from(el, {
              y: 34,
              opacity: 0,
              duration: 0.8,
              ease: "power3.out",
              immediateRender: false,
              scrollTrigger: { trigger: el, start: "top 88%" },
            });
          });

          // NÃO existe parallax na capa de propósito. Ele foi removido: a
          // capa muda de ALTURA quando a música começa (ver `comecou`), e
          // ScrollTrigger com scrub sobre um elemento que muda de layout
          // trabalha com medidas velhas. Entre um efeito discreto no scroll
          // e a letra chegando na tela no play, a segunda ganha.

          // Limpeza do matchMedia: evita o seguro disparar depois de sair
          // da página (navegação em SPA).
          return () => window.clearTimeout(seguro);
        });
      }, raizRef);
    })();

    return () => {
      vivo = false;
      ctx?.revert();
    };
  }, []);

  // O CLIQUE é o gesto que libera o áudio (iOS bloqueia autoplay).
  async function alternar() {
    const a = audioRef.current;
    if (!a) return;
    if (tocando) {
      a.pause();
      setTocando(false);
      return;
    }
    try {
      await a.play();
      setTocando(true);
      if (!comecou) {
        setComecou(true);
        // A capa "acende" no primeiro play: o momento de abrir o presente.
        // Opcional de propósito — se o chunk do GSAP ainda não chegou, o
        // play não pode falhar por causa de um enfeite.
        gsapRef.current?.fromTo(
          capaRef.current,
          { filter: "brightness(1)" },
          { filter: "brightness(1.25)", duration: 0.5, yoyo: true, repeat: 1 },
        );
      }
    } catch (err) {
      console.error("[presente] play falhou:", err);
    }
  }

  const dur = p.duracaoS ?? 0;
  const prog = dur ? Math.min(100, (t / dur) * 100) : 0;
  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div
      ref={raizRef}
      className="relative min-h-screen bg-[#0d0a08] text-white"
      style={
        {
          // Paleta do presente: preto quente + âmbar. Escuro faz a letra
          // brilhar e deixa a foto (quando houver) dominar a capa.
          "--presente-destaque": "oklch(0.84 0.13 78)",
          "--presente-vinho": "oklch(0.55 0.16 18)",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        } as React.CSSProperties
      }
    >
      {/* Com galeria, as fotos VIRAM o ambiente: dois fundos concorrendo
          brigariam. Sem galeria, o ambiente de gradiente segura a cena. */}
      {p.galeria.length > 0 ? (
        <FotosSincronizadas
          fotos={p.galeria}
          secoes={p.secoes}
          tempo={t}
          duracao={p.duracaoS ?? 0}
        />
      ) : (
        <Ambiente intenso={tocando} />
      )}

      {p.audioUrl && <audio ref={audioRef} src={p.audioUrl} preload="auto" />}

      {/* ── CAPA ─────────────────────────────────────────────── */}
      {/* Antes do play a capa ocupa a tela inteira: é o convite, e o único
          gesto possível é apertar. Depois do play ela ENCOLHE e a letra sobe
          — a lição medida no Lovepanda, cujo presente inteiro cabe numa tela
          (720px, sem rolar). O nosso conteúdo principal é a letra acendendo;
          deixá-la abaixo da dobra era esconder o que temos de melhor. */}
      <section
        ref={capaRef}
        className={cn(
          "relative flex flex-col items-center justify-center px-6 text-center",
          "transition-[min-height,padding] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
          comecou ? "min-h-[46svh] py-10" : "min-h-[100svh]",
        )}
      >
        {/* Foto do comprador, quando existe: vira o FUNDO da capa, não um
            quadradinho ao lado. É o rosto de quem recebe dominando a tela.
            Escurecida o suficiente pra o nome continuar legível sobre
            qualquer foto — clara, escura ou estourada. */}
        {p.fotoUrl && (
          <div aria-hidden className="absolute inset-0 overflow-hidden">
            <img
              src={p.fotoUrl}
              alt=""
              className="h-full w-full object-cover"
              style={{ filter: "saturate(0.85)" }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(13,10,8,0.62) 0%, rgba(13,10,8,0.78) 55%, #0d0a08 100%)",
              }}
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center">
          <p
            data-abre
            className="text-[11px] uppercase tracking-[0.35em] text-white/45"
          >
            uma música para
          </p>
          <h1
            data-abre
            className={cn(
              "mt-3 leading-none transition-[font-size] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
              comecou ? "text-4xl sm:text-5xl" : "text-5xl sm:text-7xl",
            )}
            style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif", fontWeight: 600 }}
          >
            {p.nome}
          </h1>

          <div
            data-abre-fio
            className={cn(
              "h-px w-16 bg-white/20 transition-[margin] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]",
              comecou ? "mt-5" : "mt-10",
            )}
          />

          <p
            data-abre
            className={cn(
              "text-white/80 transition-[margin,font-size] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]",
              comecou ? "mt-4 text-lg" : "mt-8 text-xl sm:text-2xl",
            )}
            style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
          >
            {p.titulo}
          </p>

          {/* O gesto que começa tudo.
              TAMANHO FIXO de propósito: só a margem muda quando a capa
              encolhe. Alvo de toque que muda de tamanho no meio do uso é
              pior que um estável — e 80px é confortável no polegar. */}
          <button
            data-abre-play
            onClick={alternar}
            aria-label={tocando ? "Pausar" : "Tocar"}
            className={cn(
              "group flex h-20 w-20 items-center justify-center rounded-full transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]",
              comecou ? "mt-6" : "mt-10",
              // A cor NÃO vem de var(--presente-destaque) aqui: se o
              // navegador não entender oklch, a variável fica inválida e o
              // fundo vira transparente — o botão some. Ver o @supports no
              // fim do arquivo.
              "text-[#0d0a08]",
              "hover:scale-105 active:scale-95",
              !comecou &&
                "shadow-[0_0_0_0_color-mix(in_oklch,var(--presente-destaque)_60%,transparent)] animate-[pulso_2.6s_ease-out_infinite]",
            )}
          >
            {tocando ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 translate-x-0.5" fill="currentColor" />
            )}
          </button>

          {!comecou && <p data-abre className="mt-5 text-sm text-white/40">toque para ouvir</p>}

          {/* Dedicatória: a voz do comprador, com as palavras dele. É a única
              coisa nesta página que não foi gerada. */}
          {p.dedicatoria && (
            <p
              data-abre
              className="mt-10 max-w-sm text-balance text-white/70"
              style={{
                fontFamily: "Fraunces, ui-serif, Georgia, serif",
                fontSize: "var(--t-base)",
                lineHeight: 1.65,
              }}
            >
              {p.dedicatoria}
            </p>
          )}
        </div>

        {/* A seta de "role pra baixo" saiu junto com a capa de tela cheia:
            com a capa encolhida a letra já aparece sozinha, e a seta viraria
            ruído sobrepondo o conteúdo. */}
      </section>

      {/* ── A LETRA ──────────────────────────────────────────── */}
      {p.timestamps && p.timestamps.length > 0 ? (
        <section data-revela className="relative mx-auto max-w-2xl px-6 py-16">
          <LetraSincronizada words={p.timestamps} tempo={t} tocando={tocando} />
        </section>
      ) : (
        // Sem sincronia (é o caso da segunda gravação): a letra aparece
        // inteira e parada. Acender no tempo errado seria pior que não acender.
        p.letra && (
          <section data-revela className="relative mx-auto max-w-2xl px-6 py-16">
            <p
              className="whitespace-pre-line text-lg leading-relaxed text-white/45 sm:text-xl"
              style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
            >
              {p.letra.replace(/^\[.*\]\s*$/gm, "").trim()}
            </p>
          </section>
        )
      )}

      {/* ── AS DUAS GRAVAÇÕES ────────────────────────────────── */}
      {p.temAlternativa && (
        <section data-revela className="relative mx-auto max-w-2xl px-6 pb-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">
            a mesma letra, duas gravações
          </p>
          <div className="mt-5 inline-flex rounded-full border border-white/15 p-1">
            {([1, 2] as const).map((n) => (
              <Link
                key={n}
                to="/p/$token"
                params={{ token }}
                search={{ v: n === 2 ? (2 as const) : undefined }}
                className={cn(
                  "rounded-full px-5 py-2 text-sm transition-colors",
                  p.versao === n
                    ? "bg-[color:var(--presente-destaque)] text-[#0d0a08]"
                    : "text-white/55 hover:text-white",
                )}
              >
                {n === 1 ? "Versão 1" : "Versão 2"}
              </Link>
            ))}
          </div>
          {p.versao === 2 && (
            <p className="mt-4 text-xs text-white/35">
              Nesta a letra não acende — a sincronia é da gravação 1.
            </p>
          )}
        </section>
      )}

      {/* A "história que virou música" foi REMOVIDA daqui de propósito.
          Ela mostrava o texto cru do quiz — do jeito que o comprador digitou,
          com pressa, no celular. Vinha logo depois de uma música que quase
          sempre melhora muito o que ele escreveu, então o efeito era desfazer
          o encanto: a pessoa via a homenagem e em seguida o rascunho dela.
          O que vale é o entregável, não a matéria-prima. A voz do comprador
          na página é a DEDICATÓRIA, que ele escolhe e escreve com calma. */}

      {/* ── RODAPÉ: guardar / enviar ─────────────────────────── */}
      <footer data-revela className="relative mx-auto max-w-2xl px-6 pb-32 text-center">
        {p.audioUrl && (
          <BotaoGuardar audioUrl={p.audioUrl} titulo={p.titulo} nome={p.nome} />
        )}
        {/* A marca assinando o presente. Logo em vez da palavra escrita: a
            página vai circular no WhatsApp da família inteira, e é o único
            lugar onde a Serenata aparece. `escuro` clareia o vinho pra ela
            existir sobre a noite. */}
        <a
          href="/"
          className="mt-12 inline-flex flex-col items-center gap-2 opacity-45 transition-opacity duration-150 hover:opacity-80"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">
            feito com
          </span>
          <Logo tamanho="sm" escuro />
        </a>
      </footer>

      {/* ── PLAYER FIXO (aparece depois do primeiro play) ────── */}
      {comecou && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0d0a08]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-3">
            <button
              onClick={alternar}
              aria-label={tocando ? "Pausar" : "Tocar"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--presente-destaque)] text-[#0d0a08]"
            >
              {tocando ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white/85">{p.titulo}</p>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-[color:var(--presente-destaque)]"
                  style={{ width: `${prog}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-white/40">
              {mmss(t)} / {mmss(dur)}
            </span>
          </div>
        </div>
      )}

      <style>{`
        /* O botão de play é o ÚNICO controle da página: sem ele o presente
           não abre. Por isso a cor nasce de um hex que todo navegador
           entende, e só depois é substituída pelo oklch onde há suporte.
           Usar var(--presente-destaque) direto tornava o fundo transparente
           em navegador antigo — botão invisível. */
        [data-abre-play] { background-color: #f0b95f; }
        @supports (color: oklch(0.84 0.13 78)) {
          [data-abre-play] { background-color: var(--presente-destaque); }
        }
        @keyframes pulso {
          0%   { box-shadow: 0 0 0 0 color-mix(in oklch, var(--presente-destaque) 55%, transparent); }
          70%  { box-shadow: 0 0 0 26px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
      `}</style>
    </div>
  );
}
