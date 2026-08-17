import { useEffect, useRef, useState } from "react";
import { Play, Pause, ExternalLink } from "lucide-react";
import { FONTES } from "@/lib/marca";
import { cn } from "@/lib/utils";

// Os exemplos TOCÁVEIS da home espanhola.
//
// Enxuto de propósito em relação ao brasileiro (que tem 11 músicas em 6 abas
// por relação): aqui são três, porque três é o que existe. Inventar abas com
// exemplo repetido pra parecer catálogo é a mentira que a gente não faz.
//
// São as músicas do teste de validação, geradas pelo mesmo pipeline que o
// cliente vai usar.
//
// ── OS TRÊS GÊNEROS SERVEM OS QUATRO PAÍSES ──────────────────────
//
// A primeira versão desta lista foi gravada quando o alvo era o México:
// mariachi, banda e balada. Dois de três eram gêneros mexicanos, e a home
// abria com "Mariachi".
//
// A campanha roda Argentina, Chile, Peru e Colômbia. Anunciar com mariachi
// nesses quatro é mostrar um produto de outro país logo na primeira tela, e
// os exemplos são justamente onde a pessoa decide se isso é pra ela.
//
// Balada, cumbia e bolero funcionam nos quatro sem exceção. Os dois novos
// foram gravados em 17/08 pelo mesmo pipeline, com letra escrita à mão para
// não carregar sotaque de nenhum país específico.
//
// Os mexicanos não foram apagados: as páginas-presente deles continuam de pé
// e o áudio segue no bucket. Se um dia o México virar mercado próprio, é só
// trocar esta lista de volta.

// `token` abre a PÁGINA-PRESENTE de verdade — com karaokê e tudo.
// É o argumento mais forte que existe, porque a página é o produto: no funil
// português ela é o que a pessoa toca antes de comprar, e aqui não existia.
const EXEMPLOS = [
  { slug: "es-balada", titulo: "El Frasco de Nescafé", para: "para el abuelo", genero: "Balada", token: "exesabueloa0f408be" },
  { slug: "es-cumbia", titulo: "La Trenza de los Lunes", para: "para la hija", genero: "Cumbia", token: "exescumbia7f21a9c4" },
  { slug: "es-bolero", titulo: "El Café de las Cinco", para: "para la esposa", genero: "Bolero", token: "exesbolero4c8d1e73" },
] as const;

const AUDIO_BASE =
  "https://ouwijepgctgtfzrrwpvt.supabase.co/storage/v1/object/public/exemplos";

export function ExemplosEs() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState<string | null>(null);

  // UM <audio> pros três: duas músicas tocando juntas é impossível por
  // construção, não por disciplina de código.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const fim = () => setTocando(null);
    a.addEventListener("ended", fim);
    return () => a.removeEventListener("ended", fim);
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
    try {
      await a.play();
      setTocando(slug);
    } catch {
      // Autoplay bloqueado: o próximo toque (já com gesto do usuário) passa.
      setTocando(null);
    }
  }

  return (
    <section id="ejemplo" className="bg-[var(--papel-fundo)]" style={{ paddingBlock: "var(--secao)" }}>
      <div className="mx-auto max-w-2xl px-6">
        <h2
          className="text-center text-balance"
          style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.15 }}
        >
          Escucha canciones hechas de historias reales
        </h2>
        <p
          className="mt-3 text-center text-[var(--tinta-suave)]"
          style={{ fontSize: "var(--t-sm)" }}
        >
          Cada una nació de una historia distinta. Ninguna se parece a la otra.
        </p>

        <audio ref={audioRef} preload="none" className="hidden" />

        <div className="mt-8 space-y-3">
          {EXEMPLOS.map((e) => {
            const ativo = tocando === e.slug;
            return (
              // Cartão como <div>, não como <button>: ele carrega DOIS toques
              // diferentes (ouvir e abrir o presente), e aninhar <a> dentro de
              // <button> é HTML inválido — no celular o toque vira loteria.
              <div
                key={e.slug}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border px-4 py-4 transition-colors",
                  ativo
                    ? "border-[var(--acento)] bg-[var(--papel)]"
                    : "border-[var(--tinta-fraca)]/40 bg-[var(--papel)] hover:border-[var(--acento)]/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => alternar(e.slug)}
                  aria-label={ativo ? `Pausar ${e.titulo}` : `Escuchar ${e.titulo}`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--acento)] text-[var(--papel)] transition-transform active:scale-90"
                >
                  {ativo ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate"
                    style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-lg)" }}
                  >
                    {e.titulo}
                  </p>
                  <p
                    className="mt-0.5 text-[var(--tinta-suave)]"
                    style={{ fontSize: "var(--t-xs)" }}
                  >
                    {e.para} · {e.genero}
                  </p>
                </div>

                {/* O presente DE VERDADE, aberto. É o argumento mais forte que
                    existe: a música se ouve em qualquer lugar, a página não. */}
                <a
                  href={`/p/${e.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[var(--acento)] underline underline-offset-4 hover:opacity-80"
                  style={{ fontSize: "var(--t-xs)" }}
                >
                  ver el regalo <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
