import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { carregarPresente } from "@/lib/presente";
import { LetraSincronizada } from "@/components/presente/LetraSincronizada";
import { Play, Pause, Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// A PÁGINA PRESENTE — o entregável.
//
// Conceito visual: o lançamento de um DISCO de uma música só, feita pra uma
// pessoa. Não imita o Spotify (o Lovepanda faz isso; é derivado e é trade
// dress dos outros). A referência é uma página de release: escuro, quente,
// tipografia editorial, e a letra acendendo sobre a música original.
//
// A pessoa abre isso pelo WhatsApp, no celular. Então: mobile primeiro, um
// gesto só pra começar (o play), e nada que atrapalhe a emoção.

export const Route = createFileRoute("/p/$token")({
  loader: async ({ params }) => {
    const presente = await carregarPresente({ data: { token: params.token } });
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
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500&display=swap",
      },
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [t, setT] = useState(0);
  const [comecou, setComecou] = useState(false);

  // rAF pro destaque da letra: timeupdate dispara ~4x/s e o acendimento
  // ficaria atrasado em relação ao que se ouve.
  useEffect(() => {
    if (!tocando) return;
    let vivo = true;
    const tick = () => {
      if (!vivo) return;
      const a = audioRef.current;
      if (a) setT(a.currentTime);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      vivo = false;
    };
  }, [tocando]);

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
      setComecou(true);
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
      className="min-h-screen bg-[#0d0a08] text-white"
      style={
        {
          // Paleta do presente: preto quente + âmbar. Escuro faz a letra
          // brilhar e deixa a foto (quando houver) dominar a capa.
          "--presente-destaque": "oklch(0.84 0.13 78)",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        } as React.CSSProperties
      }
    >
      {p.audioUrl && <audio ref={audioRef} src={p.audioUrl} preload="auto" />}

      {/* ── CAPA ─────────────────────────────────────────────── */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
        {/* Brilho quente atrás — o "calor" da capa */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 38%, color-mix(in oklch, var(--presente-destaque) 22%, transparent), transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
            uma música para
          </p>
          <h1
            className="mt-3 text-5xl leading-none sm:text-7xl"
            style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif", fontWeight: 600 }}
          >
            {p.nome}
          </h1>

          <div className="mt-10 h-px w-16 bg-white/15" />

          <p
            className="mt-8 text-xl text-white/80 sm:text-2xl"
            style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
          >
            {p.titulo}
          </p>

          {/* O gesto que começa tudo */}
          <button
            onClick={alternar}
            aria-label={tocando ? "Pausar" : "Tocar"}
            className={cn(
              "group mt-10 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-500",
              "bg-[color:var(--presente-destaque)] text-[#0d0a08]",
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

          {!comecou && (
            <p className="mt-5 text-sm text-white/40">toque para ouvir</p>
          )}
        </div>

        {comecou && (
          <ChevronDown className="absolute bottom-8 h-5 w-5 animate-bounce text-white/25" />
        )}
      </section>

      {/* ── A LETRA ──────────────────────────────────────────── */}
      {p.timestamps && p.timestamps.length > 0 && (
        <section className="mx-auto max-w-2xl px-6 py-16">
          <LetraSincronizada words={p.timestamps} tempo={t} tocando={tocando} />
        </section>
      )}

      {/* ── ENCARTE: a história que virou música ─────────────── */}
      {p.historia && (
        <section className="mx-auto max-w-2xl px-6 pb-20">
          <div className="h-px w-full bg-white/10" />
          <p className="mt-10 text-[11px] uppercase tracking-[0.3em] text-white/35">
            a história que virou música
          </p>
          <p
            className="mt-5 whitespace-pre-line text-lg leading-relaxed text-white/60"
            style={{ fontFamily: "Fraunces, ui-serif, Georgia, serif" }}
          >
            {p.historia}
          </p>
        </section>
      )}

      {/* ── RODAPÉ: baixar ───────────────────────────────────── */}
      <footer className="mx-auto max-w-2xl px-6 pb-32 text-center">
        {p.audioUrl && (
          <a
            href={p.audioUrl}
            download={`${p.titulo}.mp3`}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            <Download className="h-4 w-4" /> Baixar a música
          </a>
        )}
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
        @keyframes pulso {
          0%   { box-shadow: 0 0 0 0 color-mix(in oklch, var(--presente-destaque) 55%, transparent); }
          70%  { box-shadow: 0 0 0 26px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
      `}</style>
    </div>
  );
}
