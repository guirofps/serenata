import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { statusMusica } from "@/lib/gerar-letra";
import { getOrCreateSessionId } from "@/lib/session-context";
import { MusicaKaraoke, type PalavraAlinhada } from "@/components/quiz/MusicaKaraoke";
import { KaraokePlayer } from "@/components/quiz/KaraokePlayer";
import { ProgressoGeracao } from "@/components/quiz/ProgressoGeracao";
import { OuvirEnquantoEspera } from "@/components/quiz/OuvirEnquantoEspera";
import { VideoEntrega } from "@/components/quiz/VideoEntrega";
import { trackEventOnce } from "@/lib/track";
import { Music } from "lucide-react";
import { type Locale, caminho } from "@/lib/i18n";
import { t } from "@/lib/textos";

// Acompanha a música da sessão: enquanto grava, mostra uma barra de progresso
// honesta + outras músicas pra ouvir; quando fica pronta, troca pelo karaokê
// real (preview de 40s).
//
// Espera honesta: nada de barra que corre até 99% e trava. Medido, a geração
// leva de 84s a 163s. A barra reflete o tempo real (ver ProgressoGeracao), e
// as músicas tocáveis embaixo fazem a espera passar mais rápido.

// 4s (não 6): a geração leva 84s+, então polling não é o gargalo — mas perto
// do fim, 4s corta a espera entre "ficou pronta" e "apareceu".
const INTERVALO_MS = 4000;
const TENTATIVAS_MAX = 90; // ~6 minutos
// Quanto a barra fica em "Pronta! 100%" antes de revelar o player. Curto o
// bastante pra não atrasar de verdade, longo o bastante pra o olho ver a
// barra completar em vez de a peça sumir no meio.
const COMPLETAR_MS = 1000;

/** Em que pé está a música desta sessão, pro pai decidir o que mostrar. */
export type EstadoMusica = "gerando" | "pronta" | "falhou";

export function MusicaDaSessao({
  letra,
  aoMudarEstado,
  locale = "pt",
}: {
  letra: string;
  /**
   * Avisa o pai quando a prévia fica pronta (ou falha).
   *
   * Existe porque o CTA de compra não pode aparecer antes de a pessoa ouvir
   * a própria música: quem tocava nele durante o carregamento ia pro paywall
   * sem nunca ter ouvido nada, e voltar recomeçava o quiz.
   */
  aoMudarEstado?: (e: EstadoMusica) => void;
  locale?: Locale;
}) {
  const T = t(locale);
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("aguardando");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [words, setWords] = useState<PalavraAlinhada[] | null>(null);
  const [desistiu, setDesistiu] = useState(false);
  // A música existe, mas ainda estamos na animação de "Pronta!". Separa o
  // instante em que a prévia FICA pronta do instante em que ENTRA na tela.
  const [revelar, setRevelar] = useState(false);
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

  // Ficou pronta: deixa a barra completar em "Pronta! 100%" por um instante,
  // e só então revela o player. É o que faz a barra parecer que ACELEROU até
  // o fim, em vez de sumir no meio quando a música chega.
  const pronta = audioUrl !== null;
  useEffect(() => {
    if (!pronta) return;
    const t = setTimeout(() => setRevelar(true), COMPLETAR_MS);
    return () => clearTimeout(t);
  }, [pronta]);

  // Avisa o pai em que pé está. ANTES de qualquer return antecipado: hook
  // depois de `return` é hook condicional, e o React quebra.
  const falhouAgora = status === "falhou" || desistiu;
  useEffect(() => {
    aoMudarEstado?.(
      revelar && audioUrl ? "pronta" : falhouAgora ? "falhou" : "gerando",
    );
  }, [revelar, audioUrl, falhouAgora, aoMudarEstado]);

  // Já revelou: mostra o player.
  if (revelar && audioUrl) {
    // Com timestamps: karaokê real, destaque palavra a palavra + trava no
    // preview. Sem (falha tolerada no job): toca do mesmo jeito.
    return words ? (
      // `onDesbloquear` é OBRIGATÓRIO aqui, mesmo sendo opcional no tipo.
      // Sem ele o botão do paywall — o que aparece quando a prévia corta aos
      // 40s, no pico emocional do funil — chamava `onDesbloquear?.()` e o
      // `?.` engolia em silêncio: o botão não fazia nada.
      //
      // Medido em 04/08: 242 cliques em 28 sessões, 8,6 por pessoa, uma
      // delas clicou 40 vezes. Botão que funciona leva ~1,2 clique (é o que
      // os outros do funil marcam). Era gente ouvindo a música cortar e
      // socando um botão morto.
      <MusicaKaraoke
        audioUrl={audioUrl}
        words={words}
        onDesbloquear={() => navigate({ to: caminho("/criar", locale), search: { step: "oferta" } } as never)}
        locale={locale}
      />
    ) : (
      <div className="space-y-4">
        <audio controls src={audioUrl} className="w-full" />
        <KaraokePlayer letra={letra} />
      </div>
    );
  }

  const falhou = falhouAgora;

  // Demorou demais: aviso honesto (avisamos por e-mail) + a letra pra reler.
  if (falhou) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-secondary/30 px-4 py-3">
          <Music className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{T.demorouMais}</p>
            <p className="text-xs text-muted-foreground">
              {T.avisamosPorEmail}
            </p>
          </div>
        </div>
        <KaraokePlayer letra={letra} />
      </div>
    );
  }

  // Gravando (ou no instante "Pronta!" antes de revelar): barra honesta +
  // músicas pra ouvir. Quando `pronta`, a barra salta pra 100%.
  return (
    <div className="space-y-5">
      <ProgressoGeracao pronta={pronta} locale={locale} />
      {/* Entre a barra e as músicas de propósito: enquanto espera, a pessoa
          vê o ENTREGÁVEL (o que ela vai enviar) antes de se distrair ouvindo
          exemplo dos outros. */}
      <VideoEntrega />
      <OuvirEnquantoEspera locale={locale} />
    </div>
  );
}
