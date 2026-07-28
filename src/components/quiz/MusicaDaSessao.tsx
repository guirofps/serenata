import { useEffect, useRef, useState } from "react";
import { statusMusica } from "@/lib/gerar-letra";
import { getOrCreateSessionId } from "@/lib/session-context";
import { MusicaKaraoke, type PalavraAlinhada } from "@/components/quiz/MusicaKaraoke";
import { KaraokePlayer } from "@/components/quiz/KaraokePlayer";
import { ProgressoGeracao } from "@/components/quiz/ProgressoGeracao";
import { OuvirEnquantoEspera } from "@/components/quiz/OuvirEnquantoEspera";
import { trackEventOnce } from "@/lib/track";
import { Music } from "lucide-react";

// Acompanha a música da sessão: enquanto grava, mostra uma barra de progresso
// honesta + outras músicas pra ouvir; quando fica pronta, troca pelo karaokê
// real (preview de 40s).
//
// Espera honesta: nada de barra que corre até 99% e trava. Medido, a geração
// leva de 84s a 163s. A barra reflete o tempo real (ver ProgressoGeracao), e
// as músicas tocáveis embaixo fazem a espera passar mais rápido.

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

  // Demorou demais: aviso honesto (avisamos por e-mail) + a letra pra reler.
  if (falhou) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-secondary/30 px-4 py-3">
          <Music className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">A gravação demorou mais que o esperado</p>
            <p className="text-xs text-muted-foreground">
              Assim que ficar pronta, avisamos no seu e-mail.
            </p>
          </div>
        </div>
        <KaraokePlayer letra={letra} />
      </div>
    );
  }

  // Gravando: barra honesta + músicas pra ouvir enquanto espera.
  return (
    <div className="space-y-5">
      <ProgressoGeracao />
      <OuvirEnquantoEspera />
    </div>
  );
}
