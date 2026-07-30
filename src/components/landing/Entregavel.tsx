import { FONTES } from "@/lib/marca";
import { Music, Images, QrCode, Download, Play, ArrowUpRight } from "lucide-react";

// O DIFERENCIAL que a home não estava mostrando: o entregável não é um MP3, é
// uma PÁGINA-PRESENTE. A música tocando, a letra acendendo em karaokê, as
// fotos de vocês passando, link + QR pra enviar. É onde a gente ganha dos
// concorrentes que "só mandam o áudio".
//
// Mostra um mockup fiel da /p/$token (foto + karaokê + play) e linka pro
// exemplo VIVO, navegável.

const OURO = "oklch(0.82 0.11 82)";

const ITENS = [
  { icone: Music, titulo: "A música tocando com a letra acendendo", texto: "Palavra por palavra, no ritmo exato do vocal. É karaokê de verdade, não legenda." },
  { icone: Images, titulo: "As fotos de vocês deslizando", texto: "As fotos passam junto com a canção e trocam nas viradas da música." },
  { icone: QrCode, titulo: "Link e QR Code pra entregar", texto: "Manda no WhatsApp, ou imprime o QR e cola num cartão ou numa caixa de bombom." },
  { icone: Download, titulo: "O MP3 pra baixar e guardar", texto: "A música é sua pra sempre, e a página fica no ar pra reabrir quando quiser." },
];

export function Entregavel({ exemploToken }: { exemploToken?: string }) {
  return (
    // A NOITE no meio do papel. É a narrativa da marca acontecendo na home:
    // você navega no claro e, quando o assunto é o PRESENTE, entra na noite —
    // que é exatamente o mundo em que a página-presente vive. Volta pro claro
    // logo depois.
    <section
      id="entregavel"
      className="relative overflow-hidden bg-[#150c0f]"
      style={
        {
          paddingBlock: "calc(var(--secao) * 1.15)",
          // O mundo CLARO não define --creme (ele só existe no TEMA_ESCURO), e
          // sem isto os textos caíam na tinta quase preta — invisíveis aqui.
          // Declarar as duas variáveis na própria seção faz dela uma ilha de
          // noite dentro do papel.
          "--creme": "#f7f0e8",
          "--ouro": "oklch(0.84 0.12 84)",
          color: "#f7f0e8",
        } as React.CSSProperties
      }
    >
      {/* Luz de janela na noite: âmbar forte de um lado, vinho do outro. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(52% 42% at 80% 8%, oklch(0.82 0.11 82 / 0.20), transparent 62%), radial-gradient(48% 44% at 8% 96%, oklch(0.55 0.16 18 / 0.28), transparent 64%)",
        }}
      />
      {/* Emenda com o papel: degradê nas duas bordas, pra a noite não entrar
          como um bloco colado. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: "linear-gradient(to bottom, #faf5ee, transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
        style={{ background: "linear-gradient(to top, #faf5ee, transparent)" }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-7 px-6 sm:gap-12 lg:grid-cols-2 lg:gap-16">
        {/* ── copy + itens ── */}
        <div className="order-2 lg:order-1">
          <p className="uppercase tracking-[0.3em] text-[var(--ouro)]" style={{ fontSize: "var(--t-xs)" }}>
            o presente, por completo
          </p>
          <h2
            className="mt-4 text-balance text-[var(--creme)]"
            style={{ fontFamily: FONTES.display, fontWeight: 500, fontSize: "var(--t-3xl)", lineHeight: 1.12 }}
          >
            Não é só uma música.{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(100deg, oklch(0.86 0.12 84), oklch(0.74 0.13 60))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              É a página que você envia.
            </span>
          </h2>
          <p
            className="mt-4 text-white/60"
            style={{ fontSize: "var(--t-base)", lineHeight: 1.65 }}
          >
            Os outros mandam um arquivo de áudio que se perde no WhatsApp. Aqui, quem
            recebe abre um link e vive um momento: a música, a letra acendendo, as
            fotos de vocês e o nome dela na capa.
          </p>

          <ul className="mt-6 space-y-3.5 sm:mt-8 sm:space-y-5">
            {ITENS.map((i) => (
              <li key={i.titulo} className="flex gap-3 sm:gap-4">
                <span
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--ouro)] sm:h-10 sm:w-10"
                  style={{
                    background: "oklch(0.82 0.11 82 / 0.12)",
                    boxShadow: "inset 0 0 0 1px oklch(0.82 0.11 82 / 0.28)",
                  }}
                >
                  <i.icone className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </span>
                <div>
                  <h3 className="font-medium leading-snug text-[var(--creme)]" style={{ fontSize: "var(--t-sm)" }}>
                    {i.titulo}
                  </h3>
                  <p className="mt-0.5 text-white/50" style={{ fontSize: "var(--t-xs)", lineHeight: 1.5 }}>
                    {i.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {exemploToken && (
            <a
              href={`/p/${exemploToken}`}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-medium text-[#150c0f] transition-transform hover:scale-[1.03] active:scale-95"
              style={{
                fontSize: "var(--t-sm)",
                backgroundImage:
                  "linear-gradient(135deg, oklch(0.88 0.12 86), oklch(0.76 0.13 74))",
                boxShadow: "0 14px 34px -14px oklch(0.82 0.11 82 / 0.55)",
              }}
            >
              Abrir um presente de exemplo <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* ── mockup fiel da página-presente ── */}
        <div className="order-1 lg:order-2">
          <figure className="relative mx-auto w-full max-w-[190px] sm:max-w-[300px]">
            {/* brilho dourado por trás */}
            <div
              aria-hidden
              className="absolute -inset-6 -z-10 rounded-[3rem] opacity-70 blur-2xl"
              style={{ background: "radial-gradient(60% 55% at 50% 30%, oklch(0.78 0.10 82 / 0.30), transparent 70%)" }}
            />
            {/* foto-card flutuante, sugerindo a galeria que passa */}
            <div
              aria-hidden
              className="absolute -right-3 -top-5 z-10 hidden rotate-[6deg] overflow-hidden rounded-xl border-4 border-[#f4ece0] shadow-xl sm:block"
              style={{ width: 96 }}
            >
              <img src="/img/exemplo-pai.webp" alt="" className="block aspect-square w-full object-cover" />
            </div>

            <div
              className="overflow-hidden rounded-[2.2rem] border-[9px] border-[#1a1512] bg-[#0d0a08]"
              style={{ boxShadow: "var(--sombra-flutuante)" }}
            >
              <div className="relative flex aspect-[9/16] flex-col items-center px-5 pt-9 text-center">
                {/* foto de fundo + gradiente, como na página real */}
                <img src="/img/exemplo-pai.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to bottom, rgba(13,10,8,0.55) 0%, rgba(13,10,8,0.82) 52%, #0d0a08 100%)" }}
                />
                <div className="relative z-10 flex h-full flex-col items-center">
                  <p className="text-[8px] uppercase tracking-[0.3em] text-white/50">uma música para</p>
                  <p className="mt-1.5 text-3xl text-white" style={{ fontFamily: FONTES.display, fontWeight: 600 }}>
                    Antônio
                  </p>
                  <div
                    className="mt-4 grid h-11 w-11 place-items-center rounded-full"
                    style={{ backgroundColor: OURO }}
                  >
                    <Play className="ml-0.5 h-4 w-4 text-[#0d0a08]" fill="#0d0a08" />
                  </div>
                  {/* karaokê: a letra acendendo (uma linha acesa) */}
                  <div className="mt-auto space-y-1.5 pb-6 text-left">
                    <p className="text-[11px] leading-snug text-white/30">Seu Antônio, homem de fé</p>
                    <p
                      className="text-[11px] font-medium leading-snug"
                      style={{ color: OURO, textShadow: `0 0 18px ${OURO}` }}
                    >
                      Acordava antes do sol nascer
                    </p>
                    <p className="text-[11px] leading-snug text-white/30">Pra nunca faltar nada em casa</p>
                    <p className="text-[11px] leading-snug text-white/20">O senhor é meu herói, meu pai</p>
                  </div>
                </div>
              </div>
            </div>
            <figcaption className="mt-4 text-center text-white/45" style={{ fontSize: "var(--t-xs)" }}>
              É assim que o presente abre. Toque pra ver ao vivo.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
