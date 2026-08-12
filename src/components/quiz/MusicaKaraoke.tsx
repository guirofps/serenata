import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Lock, Music, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Locale } from "@/lib/i18n";
import { t as textos } from "@/lib/textos";
import { trackEvent, trackEventOnce } from "@/lib/track";

// Karaokê REAL: a música cantada + cada palavra acendendo no instante em que
// é cantada (alignedWords do kie.ai, precisão de ms — R$ 0,013 por música).
//
// Diferente do karaokê descartado (base instrumental independente da letra,
// sincronia inventada), aqui as palavras VÊM do áudio: quem lê consegue
// cantar junto, porque o destaque segue o vocal de verdade.
//
// Janela grátis: toca até PREVIEW_S segundos; ali pausa e vira o convite de
// desbloquear a música completa (o paywall no pico emocional).

export type PalavraAlinhada = { word: string; start: number; end: number };

const PREVIEW_S = 40;

// As palavras vêm com marcadores e quebras embutidos ("[Verse 1]\nHolambra ").
// Normaliza em linhas: marcador vira rótulo, palavras agrupam por linha.
type Linha =
  | { tipo: "marcador"; texto: string }
  | { tipo: "verso"; palavras: { texto: string; start: number; end: number; idx: number }[] };

function montarLinhas(words: PalavraAlinhada[]): Linha[] {
  const linhas: Linha[] = [];
  let atual: Extract<Linha, { tipo: "verso" }> = { tipo: "verso", palavras: [] };
  let idx = 0;

  const empurra = () => {
    if (atual.palavras.length) linhas.push(atual);
    atual = { tipo: "verso", palavras: [] };
  };

  for (const w of words) {
    // Um "word" pode conter marcador + quebra + palavra ("[Chorus]\nVocê ").
    const pedacos = w.word.split("\n");
    for (let p = 0; p < pedacos.length; p++) {
      const texto = pedacos[p].trim();
      if (p > 0) empurra(); // cada \n fecha a linha corrente
      if (!texto) continue;
      if (/^\[.*\]$/.test(texto)) {
        empurra();
        linhas.push({ tipo: "marcador", texto: texto.replace(/[[\]]/g, "") });
      } else {
        atual.palavras.push({ texto, start: w.start, end: w.end, idx: idx++ });
      }
    }
  }
  empurra();
  return linhas;
}

export function MusicaKaraoke({
  audioUrl,
  words,
  onDesbloquear,
  // `completo` libera a música inteira (sem a trava do preview). Usado nas
  // demos que mandamos pra alguém ouvir; o funil real nunca passa isso.
  completo = false,
  locale = "pt",
}: {
  audioUrl: string;
  words: PalavraAlinhada[];
  completo?: boolean;
  /**
   * O que fazer quando a prévia corta e a pessoa toca em "Desbloquear".
   *
   * OBRIGATÓRIO de propósito. Era opcional, e o `onDesbloquear?.()` engolia
   * a ausência em silêncio: o `MusicaDaSessao` não passava nada, e o botão
   * do pico emocional do funil não fazia coisa alguma. Medido antes do
   * conserto: 242 cliques em 28 sessões (8,6 por pessoa, uma com 40),
   * contra ~1,2 dos botões que funcionam.
   *
   * Com a prop obrigatória, o compilador não deixa isso acontecer de novo.
   */
  onDesbloquear: () => void;
  locale?: Locale;
}) {
  const T = textos(locale);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [t, setT] = useState(0);
  const [travou, setTravou] = useState(false);
  const [dur, setDur] = useState(0);

  // POPUP DO FIM DA PRÉVIA.
  //
  // O convite de comprar já existia, mas EMBAIXO da letra inteira: no celular
  // a pessoa ouvia a música cortar e o botão ficava a três telas de rolagem de
  // distância. Ela some, e o pico emocional some junto.
  //
  // O popup sobe sozinho no instante em que a música corta, sem preço (o preço
  // é a conversa da tela seguinte; aqui a pergunta é só "você quer?").
  //
  // Aparece UMA vez por sessão: quem fechou disse não, e insistir a cada play
  // vira armadilha. O bloco de baixo continua ali pra quem mudar de ideia.
  const [popup, setPopup] = useState(false);
  const jaMostrou = useRef(false);
  function fecharPopup() {
    trackEvent("popup_previa_fecha", {});
    setPopup(false);
  }

  const linhas = useMemo(() => montarLinhas(words), [words]);

  // Destaque visual: rAF (~60fps; timeupdate dispara ~4x/s e atrasaria o
  // acendimento). Só cosmético — a trava NÃO vive aqui.
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

  // TRAVA do preview: no timeupdate + seeking, nunca no rAF — navegadores
  // congelam rAF em abas em segundo plano, e a música passava do limite
  // com a aba minimizada (visto no teste). timeupdate continua disparando.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || completo) return; // modo completo: sem trava
    const trava = () => {
      if (a.currentTime >= PREVIEW_S) {
        a.pause();
        a.currentTime = PREVIEW_S;
        setT(PREVIEW_S);
        setTocando(false);
        setTravou(true);
        trackEventOnce("preview_limite", "v1");
      }
    };
    a.addEventListener("timeupdate", trava);
    a.addEventListener("seeking", trava); // seek além do limite também trava
    const onPause = () => setTocando(false);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", trava);
      a.removeEventListener("seeking", trava);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  // Meio segundo depois da música cortar: dá tempo da última palavra assentar
  // e do "…" aparecer no player. Sem a pausa, o popup pisa no fim da frase.
  useEffect(() => {
    if (!travou || jaMostrou.current) return;
    jaMostrou.current = true;
    const id = setTimeout(() => {
      setPopup(true);
      trackEvent("popup_previa_abre", {});
    }, 500);
    return () => clearTimeout(id);
  }, [travou]);

  // Voltar/ESC fecham o popup em vez de sair da página.
  useEffect(() => {
    if (!popup) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fecharPopup();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [popup]);

  // O clique é o gesto que libera o áudio (iOS bloqueia autoplay).
  async function alternar() {
    const a = audioRef.current;
    if (!a || travou) return;
    if (tocando) {
      a.pause();
      setTocando(false);
      return;
    }
    try {
      await a.play();
      setTocando(true);
      trackEventOnce("musica_play", "v1");
    } catch (err) {
      console.error("[karaoke] play falhou:", err);
    }
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
      />

      {/* Player */}
      <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3">
        <button
          type="button"
          onClick={alternar}
          disabled={travou}
          aria-label={tocando ? T.ariaPausar : T.ariaOuvir}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105",
            travou && "opacity-50",
          )}
        >
          {tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {travou
              ? T.ouviuPedacinho
              : tocando
                ? T.canteJunto
                : T.ouvirAMusica}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (t / (completo ? dur || 1 : PREVIEW_S)) * 100)}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
          {" / "}
          {completo
            ? `${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, "0")}`
            : `0:${PREVIEW_S}`}
        </span>
      </div>

      {/* Letra com destaque palavra a palavra */}
      <div className="space-y-1">
        {linhas.map((l, i) =>
          l.tipo === "marcador" ? (
            <p
              key={i}
              className="pt-3 text-[11px] uppercase tracking-widest text-muted-foreground/60"
            >
              {l.texto}
            </p>
          ) : (
            <p key={i} className="text-[15px] leading-relaxed">
              {l.palavras.map((w) => {
                const cantada = t >= w.start;
                const cantando = t >= w.start && t <= w.end + 0.15;
                return (
                  <span
                    key={w.idx}
                    className={cn(
                      "transition-colors duration-150",
                      cantada ? "text-foreground" : "text-muted-foreground/50",
                      cantando && "font-semibold text-primary",
                    )}
                  >
                    {w.texto}{" "}
                  </span>
                );
              })}
            </p>
          ),
        )}
      </div>

      {/* Paywall no pico: a música corta no melhor momento */}
      {travou && (
        <div className="space-y-3 rounded-2xl border bg-card p-5 text-center">
          <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="font-semibold">{T.musicaContinua}</p>
          <p className="text-sm text-muted-foreground">{T.desbloqueieCompleta}</p>
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              trackEvent("desbloquear_click", { origem: "inline" });
              onDesbloquear();
            }}
          >
            {T.desbloquearBotao}
          </Button>
        </div>
      )}

      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={fecharPopup}
          role="dialog"
          aria-modal="true"
          aria-label={T.popupTitulo}
        >
          <div
            className="w-full max-w-sm rounded-3xl border bg-card p-6 text-center shadow-2xl"
            style={{ animation: "serenata-sobe .28s ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <p className="font-display text-xl font-semibold">{T.popupTitulo}</p>
            <p className="mt-2 text-sm text-muted-foreground">{T.popupTexto}</p>

            <ul className="mx-auto mt-4 space-y-2 text-left text-sm">
              {T.popupItens.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Button
              size="lg"
              className="mt-5 w-full"
              onClick={() => {
                trackEvent("popup_previa_cta", {});
                setPopup(false);
                onDesbloquear();
              }}
            >
              {T.popupCta}
            </Button>
            <button
              type="button"
              onClick={fecharPopup}
              className="mt-3 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {T.popupDepois}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
