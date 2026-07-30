import { useEffect, useRef, useState } from "react";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { Play, Pause, ArrowUpRight } from "lucide-react";

// ── DEMONSTRAÇÃO ── objeção: "me mostra"
//
// MÚSICAS REAIS, geradas neste site a partir de histórias reais, agrupadas
// por RELAÇÃO em abas (pai, mãe, esposa…). A pessoa clica na aba dela e ouve
// um exemplo do caso dela — muito mais convincente que três exemplos soltos.
//
// Trechos de 45s num bucket PÚBLICO (scratch/publicar-exemplos.mjs): 704 KB
// cada em vez dos ~5 MB da faixa cheia, e coerente com o paywall — o trecho é
// exatamente o que se ouve de graça.

type Exemplo = {
  slug: string;
  titulo: string;
  para: string;
  genero: string;
  token: string;
  capa: string;
};

const ABAS: Array<{ chave: string; rotulo: string; emoji: string; itens: Exemplo[] }> = [
  {
    chave: "pai",
    rotulo: "Pai",
    emoji: "👨",
    itens: [
      { slug: "antonio", titulo: "Seu Antônio", para: "para o pai", genero: "Sertanejo", token: "expai51378356a9", capa: "pai" },
    ],
  },
  {
    chave: "mae",
    rotulo: "Mãe",
    emoji: "👩",
    itens: [
      { slug: "eva", titulo: "Domingo na Casa da Eva", para: "para a mãe", genero: "Sertanejo", token: "533db522753f423e8b2227", capa: "mae" },
      { slug: "denise", titulo: "Mulher de Palavra", para: "para a mãe", genero: "Gospel", token: "2459f4b76e1b49c58be203", capa: "denise" },
    ],
  },
  {
    chave: "avos",
    rotulo: "Avós",
    emoji: "👵",
    itens: [
      // "Domingo de Rose" é uma homenagem real de uma neta à avó dela.
      { slug: "rose", titulo: "Domingo de Rose", para: "para a avó", genero: "MPB", token: "9296e7e9b5c2460faadd64", capa: "avo" },
      { slug: "joaquim", titulo: "Meu Rei da Sanfona", para: "para o avô", genero: "Forró", token: "exavo306216da", capa: "avoo" },
    ],
  },
  {
    chave: "filhos",
    rotulo: "Filhos",
    emoji: "👶",
    itens: [
      { slug: "theo", titulo: "Cinco Anos de Espera", para: "para o filho", genero: "Pop romântico", token: "exfilho2686eb8d", capa: "filho" },
    ],
  },
  {
    chave: "namorados",
    rotulo: "Namorados",
    emoji: "❤️",
    itens: [
      { slug: "bianca", titulo: "Café Ruim, Amor Certo", para: "para a namorada", genero: "Sertanejo", token: "exnamorada00ec1ec6", capa: "namorada" },
    ],
  },
  {
    chave: "esposa",
    rotulo: "Esposa",
    emoji: "💍",
    itens: [
      { slug: "isabela", titulo: "Desde a Escola, Isabela", para: "para a esposa", genero: "Sertanejo", token: "e406f9b4356f4a5a9e7d8e", capa: "isabela" },
    ],
  },
  {
    chave: "marido",
    rotulo: "Marido",
    emoji: "💍",
    itens: [
      { slug: "camburi", titulo: "Camburi", para: "para o marido", genero: "MPB", token: "7b89d2ed634646c4b1ee95", capa: "camburi" },
      { slug: "garga", titulo: "Gargamel", para: "para o marido", genero: "Pagode", token: "5c980fdd76344b0c81e4e1", capa: "garga" },
    ],
  },
  {
    chave: "amiga",
    rotulo: "Amiga",
    emoji: "🫂",
    itens: [
      { slug: "li", titulo: "Li, 53", para: "para a amiga", genero: "MPB", token: "7efe7bb4304d4790954603", capa: "amigas" },
    ],
  },
];

const AUDIO_BASE =
  "https://ouwijepgctgtfzrrwpvt.supabase.co/storage/v1/object/public/exemplos";

// As capas ficam em /public com cache de 30 dias. Quando uma é TROCADA (mesmo
// nome, conteúdo novo), o navegador de quem já visitou continua servindo a
// antiga — foi o que aconteceu quando `filho.webp` deixou de ser cópia da capa
// da mãe. Subir este número invalida o cache de todas de uma vez.
const VERSAO_CAPAS = 2;

export function ExemplosReais() {
  const [aba, setAba] = useState(ABAS[0].chave);
  // UM único <audio> pra todos os cards: assim é impossível dois tocarem
  // juntos — a exclusividade vem da estrutura, não de coordenação.
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const andar = () => setProgresso(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    const acabou = () => {
      setTocando(null);
      setProgresso(0);
    };
    a.addEventListener("timeupdate", andar);
    a.addEventListener("ended", acabou);
    return () => {
      a.removeEventListener("timeupdate", andar);
      a.removeEventListener("ended", acabou);
    };
  }, []);

  async function alternar(slug: string) {
    const a = audioRef.current;
    if (!a) return;
    if (tocando === slug) {
      a.pause();
      setTocando(null);
      return;
    }
    a.src = `${AUDIO_BASE}/${slug}.mp3`;
    setProgresso(0);
    try {
      await a.play();
      setTocando(slug);
    } catch (err) {
      console.error("[exemplos] play falhou:", err);
      setTocando(null);
    }
  }

  const atual = ABAS.find((t) => t.chave === aba) ?? ABAS[0];

  return (
    <section id="exemplo" style={{ paddingBlock: "var(--secao)" }}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--tinta-suave)]">
            músicas de verdade
          </p>
          <h2
            className="mt-3 text-balance"
            style={{
              fontFamily: FONTES.display,
              fontWeight: 500,
              fontSize: "var(--t-3xl)",
              lineHeight: 1.15,
            }}
          >
            Ouça uma feita pra quem você quer homenagear
          </h2>
          <p
            className="mx-auto mt-3 max-w-md text-[var(--tinta-suave)]"
            style={{ fontSize: "var(--t-sm)", lineHeight: 1.55 }}
          >
            Todas foram feitas neste site, do jeito que a sua vai ser. Escolha a
            relação e toque.
          </p>
        </div>

        {/* ABAS por relação: a pessoa acha o caso dela na hora. */}
        <div
          role="tablist"
          aria-label="Exemplos por relação"
          className="mt-7 flex flex-wrap justify-center gap-2"
        >
          {ABAS.map((t) => {
            const on = t.chave === aba;
            return (
              <button
                key={t.chave}
                role="tab"
                aria-selected={on}
                onClick={() => setAba(t.chave)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 transition-all",
                  on
                    ? "border-[var(--acento)] bg-[var(--acento)] font-medium text-white shadow-[0_8px_20px_-10px_oklch(0.55_0.16_18/0.6)]"
                    : "border-[var(--tinta-fraca)] text-[var(--tinta-suave)] hover:border-[var(--acento)]/50 hover:text-[var(--tinta)]",
                )}
                style={{ fontSize: "var(--t-sm)" }}
              >
                <span aria-hidden>{t.emoji}</span>
                {t.rotulo}
              </button>
            );
          })}
        </div>

        {/* preload="none": nada de áudio baixa até alguém apertar play */}
        <audio ref={audioRef} preload="none" />

        <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-6">
          {atual.itens.map((ex) => {
            const ativo = tocando === ex.slug;
            return (
              <article
                key={ex.slug}
                className={cn(
                  "card-lift group overflow-hidden rounded-[22px] border border-transparent bg-[var(--noite)] text-[var(--creme)] sm:rounded-[28px]",
                  "shadow-[0_18px_50px_-24px_rgba(42,21,24,0.55)]",
                )}
              >
                <button
                  onClick={() => alternar(ex.slug)}
                  aria-label={ativo ? `Pausar ${ex.titulo}` : `Tocar ${ex.titulo}`}
                  className="relative block w-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ouro)]"
                >
                  <img
                    src={`/img/exemplos/${ex.capa}.webp?v=${VERSAO_CAPAS}`}
                    alt=""
                    width={560}
                    height={560}
                    loading="lazy"
                    className="foto-editorial aspect-square w-full object-cover"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(26,15,18,0.75) 0%, transparent 45%)",
                    }}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full sm:bottom-4 sm:left-4 sm:h-12 sm:w-12",
                      "bg-[var(--ouro)] text-[#1a0f12] transition-transform duration-300",
                      "group-hover:scale-110",
                      ativo && "scale-110",
                    )}
                  >
                    {ativo ? (
                      <Pause className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" />
                    ) : (
                      <Play className="h-4 w-4 translate-x-0.5 sm:h-5 sm:w-5" fill="currentColor" />
                    )}
                  </span>

                  {/* Equalizador: só no card que toca. */}
                  {ativo && (
                    <span aria-hidden className="absolute bottom-5 right-3 flex items-end gap-[3px] sm:bottom-6 sm:right-4">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="eq-barra w-[3px] rounded-full bg-[var(--ouro)]"
                          style={{ height: 16, animationDelay: `${i * 0.09}s` }}
                        />
                      ))}
                    </span>
                  )}
                </button>

                <div className="h-[3px] w-full bg-white/10">
                  <div
                    className="h-full bg-[var(--ouro)] transition-[width] duration-200 ease-linear"
                    style={{ width: ativo ? `${progresso}%` : "0%" }}
                  />
                </div>

                <div className="p-3.5 sm:p-5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 sm:text-[10px] sm:tracking-[0.25em]">
                    {ex.para} · {ex.genero}
                  </p>
                  <h3
                    className="mt-1.5 leading-snug sm:mt-2"
                    style={{
                      fontFamily: FONTES.display,
                      fontWeight: 500,
                      fontSize: "var(--t-base)",
                    }}
                  >
                    {ex.titulo}
                  </h3>
                  <a
                    href={`/p/${ex.token}`}
                    className="mt-2.5 inline-flex items-center gap-1 text-white/55 underline-offset-4 transition-colors hover:text-[var(--ouro)] hover:underline sm:mt-4 sm:gap-1.5"
                    style={{ fontSize: "var(--t-xs)" }}
                  >
                    abrir o presente <ArrowUpRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <p
          className="mt-6 text-center text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-xs)" }}
        >
          Trechos de 45 segundos. A música completa tem cerca de 4 minutos.
        </p>
      </div>
    </section>
  );
}
