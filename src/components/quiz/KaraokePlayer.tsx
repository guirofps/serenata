import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEventOnce } from "@/lib/track";

// Karaokê: base instrumental por gênero + letra revelando em ritmo.
//
// Por que existe: no teste com história real, a letra LIDA em silêncio não
// segurou a emoção — e os três concorrentes lideram com áudio. A trilha dá o
// impacto emocional com custo marginal ZERO (um arquivo por gênero, reusado
// por todo mundo), sem gastar geração de música com quem não compra.
//
// A fronteira do produto continua honesta:
//   grátis = sua letra com trilha  |  pago = ela cantada de verdade.

// Trilha instrumental por gênero. VAZIO de propósito: as bases precisam sair
// do Suno (kie.ai) pra ter qualidade de verdade — um instrumental sintetizado
// soa pior que silêncio e destrói a emoção em vez de criar.
//
// São geradas UMA vez por gênero e reusadas por todos os usuários: ~R$ 0,32
// cada, custo único. Quando existirem, é só apontar aqui (ex.:
// sertanejo: "/trilhas/sertanejo.mp3") e o player liga sozinho.
// Sem trilha, o componente entrega só a letra — sem player quebrado.
const TRILHAS: Record<string, string> = {};
const TRILHA_PADRAO = "";

type Linha = { texto: string; marcador: boolean };

function parseLinhas(letra: string): Linha[] {
  return letra
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((texto) => ({ texto, marcador: /^\[.*\]$/.test(texto) }));
}

export function KaraokePlayer({ letra, genero }: { letra: string; genero?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [semMusica, setSemMusica] = useState(false);

  const linhas = useMemo(() => parseLinhas(letra), [letra]);
  const cantadas = useMemo(() => linhas.filter((l) => !l.marcador).length, [linhas]);
  const src = (genero && TRILHAS[genero]) || TRILHA_PADRAO;
  const temTrilha = Boolean(src);

  // Distribui as linhas ao longo da trilha, com uma respirada no começo.
  const LEAD_IN = 4;
  const segundosPorLinha = duracao > 0 && cantadas > 0 ? (duracao - LEAD_IN) / cantadas : 3;

  // Índice da linha cantada atual (marcadores não contam).
  const atual = Math.floor(Math.max(0, elapsed - LEAD_IN) / segundosPorLinha);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setElapsed(a.currentTime);
    const onMeta = () => setDuracao(a.duration || 0);
    const onEnd = () => setTocando(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  // O CLIQUE é o gesto que dispara o áudio — sem isso o iOS bloqueia.
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
      trackEventOnce("karaoke_play", "v1", { genero: genero ?? null });
    } catch {
      // Autoplay bloqueado ou arquivo indisponível: entrega a letra inteira.
      setSemMusica(true);
    }
  }

  // Quantas linhas cantadas já passaram, pra decidir o que está visível.
  let contadorCantadas = 0;

  return (
    <div className="space-y-4">
      {temTrilha && <audio ref={audioRef} src={src} preload="metadata" />}

      {/* Controle: é o gesto do usuário que inicia o áudio.
          Sem trilha disponível, nem aparece — letra pura é melhor que
          player quebrado ou instrumental ruim. */}
      {temTrilha && (
      <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3">
        <button
          type="button"
          onClick={alternar}
          aria-label={tocando ? "Pausar" : "Tocar"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
        >
          {tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {tocando ? "Tocando a sua letra…" : "Ouvir enquanto lê"}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: duracao ? `${(elapsed / duracao) * 100}%` : "0%" }}
            />
          </div>
        </div>
        <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      )}

      {/* A letra: revela em ritmo enquanto toca; inteira se não houver música */}
      <div className="space-y-1">
        {linhas.map((l, i) => {
          if (l.marcador) {
            return (
              <p
                key={i}
                className="pt-3 text-[11px] uppercase tracking-widest text-muted-foreground/60"
              >
                {l.texto.replace(/[[\]]/g, "")}
              </p>
            );
          }
          const idx = contadorCantadas++;
          const revelada = !temTrilha || semMusica || !tocando || idx <= atual;
          const ehAtual = temTrilha && tocando && !semMusica && idx === atual;
          return (
            <p
              key={i}
              className={cn(
                "text-[15px] leading-relaxed transition-all duration-500",
                revelada ? "opacity-100 blur-0" : "opacity-0 blur-sm",
                ehAtual && "font-semibold text-primary",
              )}
            >
              {l.texto}
            </p>
          );
        })}
      </div>
    </div>
  );
}
