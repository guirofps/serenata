import { useEffect, useRef, useState } from "react";
import { statusMusica } from "@/lib/gerar-letra";
import { getOrCreateSessionId } from "@/lib/session-context";
import { MusicaKaraoke, type PalavraAlinhada } from "@/components/quiz/MusicaKaraoke";
import { KaraokePlayer } from "@/components/quiz/KaraokePlayer";
import { trackEventOnce } from "@/lib/track";
import { Music, Loader2 } from "lucide-react";

// Acompanha a música da sessão: enquanto grava, mostra a letra + um aviso
// honesto; quando fica pronta, troca pelo karaokê real (preview de 40s).
//
// Espera honesta: nada de barra que corre até 99% e trava. Medido, a geração
// leva de 84s a 163s — dizemos "em torno de 2 minutos" e não prometemos menos.

const INTERVALO_MS = 6000;
const TENTATIVAS_MAX = 60; // ~6 minutos

export function MusicaDaSessao({ letra }: { letra: string }) {
  const [status, setStatus] = useState<string>("aguardando");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [words, setWords] = useState<PalavraAlinhada[] | null>(null);
  const [desistiu, setDesistiu] = useState(false);
  const tentativas = useRef(0);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;

    async function checar() {
      if (!vivo) return;
      try {
        const r = await statusMusica({ data: { sessionId: getOrCreateSessionId() } });
        if (!vivo) return;
        setStatus(r.status);
        if (r.status === "pronta" && r.audioUrl) {
          setAudioUrl(r.audioUrl);
          setWords(r.timestamps ?? null);
          trackEventOnce("musica_pronta", "v1");
          return; // para o polling
        }
        if (r.status === "falhou") return;
      } catch (err) {
        console.error("[musica] polling falhou:", err);
      }
      tentativas.current += 1;
      if (tentativas.current >= TENTATIVAS_MAX) {
        setDesistiu(true);
        return;
      }
      timer = setTimeout(checar, INTERVALO_MS);
    }

    checar();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, []);

  // Pronta: karaokê real, com destaque palavra a palavra e trava no preview.
  if (audioUrl && words) {
    return <MusicaKaraoke audioUrl={audioUrl} words={words} />;
  }
  // Pronta mas sem timestamps: toca do mesmo jeito (falha tolerada no job).
  if (audioUrl) {
    return (
      <div className="space-y-4">
        <audio controls src={audioUrl} className="w-full" />
        <KaraokePlayer letra={letra} />
      </div>
    );
  }

  const falhou = status === "falhou" || desistiu;

  return (
    <div className="space-y-4">
      {/* Aviso honesto enquanto grava */}
      <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-secondary/30 px-4 py-3">
        {falhou ? (
          <Music className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {falhou ? "A gravação demorou mais que o esperado" : "Sua música está sendo gravada…"}
          </p>
          <p className="text-xs text-muted-foreground">
            {falhou
              ? "Assim que ficar pronta, avisamos no seu e-mail."
              : "Leva cerca de 2 minutos. Pode ir lendo a letra abaixo."}
          </p>
        </div>
      </div>

      <KaraokePlayer letra={letra} />
    </div>
  );
}
