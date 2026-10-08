import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Lock, Music, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Locale } from "@/lib/i18n";
import { t as textos } from "@/lib/textos";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { rotuloDaSecao } from "@/lib/karaoke-linhas";
import { familiaDoNavegador } from "@/lib/familia-navegador";
import { varianteDe } from "@/lib/experimentos";
import {
  PREVIA_PADRAO_S,
  corteDaPrevia,
  corteNoAudio,
  proximoCorte,
  type MotivoCorte,
} from "@/lib/corte-previa";
import { PrecoDaOferta } from "@/components/quiz/PrecoDaOferta";
import { meuPlanoCobravel } from "@/lib/preco";
import { descontoNaTela } from "@/lib/cupom";
import { useQuizStore } from "@/lib/quiz-store";
import { creditoNoNavegador } from "@/lib/credito-no-navegador";

// Karaokê REAL: a música cantada + cada palavra acendendo no instante em que
// é cantada (alignedWords do kie.ai, precisão de ms — R$ 0,013 por música).
//
// Diferente do karaokê descartado (base instrumental independente da letra,
// sincronia inventada), aqui as palavras VÊM do áudio: quem lê consegue
// cantar junto, porque o destaque segue o vocal de verdade.
//
// Janela grátis: toca até o limite da prévia; ali pausa e vira o convite de
// desbloquear a música completa (o paywall no pico emocional).
//
// ── TESTE `previa_refrao` (08/10) ────────────────────────────────
//
// A = 40s fixos (`PREVIA_PADRAO_S`) e o popup sem preço, como sempre foi.
// B = a prévia vai até o fim do PRIMEIRO refrão, onde o nome costuma ser
//     cantado (`corteDaPrevia`, entre 40s e 75s; sem timestamps, 60s estimados), e no
//     corte aparece um cartão com o preço e o botão logo abaixo do player, no
//     lugar do popup. Só no funil `pt`: o cartão é redigido em português.
//
// O corte de cada um vai no `preview_limite` (`previa_corte_s`), pra a
// leitura saber quantos do B cortaram de fato no refrão.

export type PalavraAlinhada = { word: string; start: number; end: number };

const EXP_PREVIA_REFRAO = "previa_refrao";

/** "0:40", "1:02": o tempo do player. */
function relogio(s: number): string {
  const inteiro = Math.floor(s);
  return `${Math.floor(inteiro / 60)}:${String(inteiro % 60).padStart(2, "0")}`;
}

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
        linhas.push({ tipo: "marcador", texto: rotuloDaSecao(texto) });
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
  letra,
  onDesbloquear,
  aoTravar,
  // `completo` libera a música inteira (sem a trava do preview). Usado nas
  // demos que mandamos pra alguém ouvir; o funil real nunca passa isso.
  completo = false,
  locale = "pt",
}: {
  audioUrl: string;
  /**
   * Timestamps pra acender palavra por palavra. `null` quando a musica ainda
   * esta na PREVIA: eles so nascem com o arquivo final, uns 60s depois.
   *
   * Sem eles o player continua o mesmo — o que muda e a letra aparecer
   * estatica em vez de sincronizada. Antes esse caso caia num `<audio
   * controls>` cru do navegador, e a tela mais emocionante do funil ficava
   * com cara de anexo de e-mail.
   */
  words: PalavraAlinhada[] | null;
  /** A letra crua, usada quando `words` ainda nao existe. */
  letra?: string;
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
  /**
   * Avisa o pai que a previa acabou e o paywall subiu.
   *
   * Existe pra a tela de espera saber a hora de recolher o pedido de WhatsApp:
   * ele acompanha a musica tocando, mas some quando o paywall aparece — pedir
   * telefone por cima do momento de decidir a compra e trocar a venda pelo
   * insumo do atendimento.
   */
  aoTravar?: () => void;
  locale?: Locale;
}) {
  const T = textos(locale);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [t, setT] = useState(0);
  const [travou, setTravou] = useState(false);
  const [dur, setDur] = useState(0);

  // O braço é lido UMA vez: o carimbo do `<html>` não muda durante a visita,
  // e este componente só monta no cliente (depois do polling da música).
  const [braco] = useState(() => varianteDe(EXP_PREVIA_REFRAO));
  const noRefrao = !completo && locale === "pt" && braco === "B";
  // No B, enquanto os timestamps não existem (a prévia por stream chega ~60s
  // antes deles), o corte é o fim ESTIMADO do refrão, 60s. Quando eles chegam
  // com a música ainda tocando e antes do corte calculado, vale o calculado;
  // se ela já passou dele, fica a estimativa (`proximoCorte`), porque trocar
  // voltaria o áudio. Depois do corte, nada muda. No A, 40s e pronto.
  const calculado = useMemo<{ s: number; motivo: MotivoCorte | "controle" }>(
    () => (noRefrao ? corteDaPrevia(words, letra) : { s: PREVIA_PADRAO_S, motivo: "controle" }),
    [noRefrao, words, letra],
  );
  const [corte, setCorte] = useState(calculado);
  const travouRef = useRef(false);
  useEffect(() => {
    if (!noRefrao) return;
    setCorte((vigente) =>
      proximoCorte(vigente, calculado, audioRef.current?.currentTime ?? 0, travouRef.current),
    );
  }, [noRefrao, calculado]);
  // O corte nunca passa do fim do arquivo (só no B; o A fica como era).
  const limite = noRefrao ? corteNoAudio(corte.s, dur) : corte.s;
  // A trava roda num listener montado uma vez só; o ref é como ela enxerga o
  // corte de agora.
  const corteRef = useRef(corte);
  corteRef.current = corte;

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

  const linhas = useMemo(() => montarLinhas(words ?? []), [words]);

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
      const { s, motivo } = corteRef.current;
      const lim = noRefrao ? corteNoAudio(s, a.duration) : s;
      if (a.currentTime >= lim) {
        travouRef.current = true;
        a.pause();
        a.currentTime = lim;
        setT(lim);
        setTocando(false);
        setTravou(true);
        aoTravar?.();
        trackEventOnce("preview_limite", "v1", {
          previa_refrao: braco,
          previa_corte_s: lim,
          previa_corte_motivo: motivo,
        });
      }
    };
    a.addEventListener("timeupdate", trava);
    a.addEventListener("seeking", trava); // seek além do limite também trava
    // B: arquivo mais curto que o corte (prévia parcial) trava no fim dele, e
    // o cartão aparece do mesmo jeito.
    if (noRefrao) a.addEventListener("ended", trava);
    const onPause = () => setTocando(false);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", trava);
      a.removeEventListener("seeking", trava);
      a.removeEventListener("ended", trava);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  // Meio segundo depois da música cortar: dá tempo da última palavra assentar
  // e do "…" aparecer no player. Sem a pausa, o popup pisa no fim da frase.
  //
  // No braço B do `previa_refrao` não há popup: o cartão com o preço sobe no
  // mesmo meio segundo, embaixo do player.
  const [cartao, setCartao] = useState(false);
  const cartaoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!travou || jaMostrou.current) return;
    jaMostrou.current = true;
    const id = setTimeout(() => {
      if (noRefrao) {
        setCartao(true);
        trackEventOnce("previa_cartao_abre", "v1", { previa_corte_s: corteRef.current.s });
        return;
      }
      setPopup(true);
      trackEvent("popup_previa_abre", {});
    }, 500);
    return () => clearTimeout(id);
  }, [travou, noRefrao]);

  // Quem estava lendo o refrão já rolou pra baixo do player: o cartão entra
  // na tela sozinho. `nearest` não mexe em nada se ele já estiver visível.
  useEffect(() => {
    if (!cartao) return;
    cartaoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [cartao]);

  // O preço do cartão é o MESMO da oferta, pelas mesmas peças: o braço que o
  // servidor cobra (`meuPlanoCobravel`) e o cupom pela conta da cobrança
  // (`descontoNaTela`), mostrados por `PrecoDaOferta`. Nada calculado aqui.
  const cupom = useQuizStore((s) => s.cupom);
  const descontado = noRefrao
    ? descontoNaTela(cupom, locale, Math.round((Number(meuPlanoCobravel(locale).valor) || 0) * 100))
    : null;
  // Quem já comprou neste navegador pode ter crédito, e a oferta mostra o
  // crédito no lugar do preço. Aqui não se sabe o saldo sem ir ao servidor:
  // na dúvida, o cartão sai sem preço.
  const [podeTerCredito] = useState(
    () => typeof window !== "undefined" && creditoNoNavegador() !== null,
  );

  // Voltar/ESC fecham o popup em vez de sair da página.
  useEffect(() => {
    if (!popup) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fecharPopup();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [popup]);

  // O clique é o gesto que libera o áudio (iOS bloqueia autoplay).
  // ── A TROCA DA PRÉVIA PELO ARQUIVO FINAL NÃO PODE PARAR A MÚSICA ──
  //
  // A tela revela pela PRÉVIA (o stream que chega ~40s antes) e, quando o
  // arquivo final fica pronto, `audioUrl` muda. Trocar o `src` de um <audio>
  // tocando faz o navegador recomeçar do zero e PARAR: a pessoa apertava play,
  // ouvia uns segundos e a música morria no meio (visto pelo dono na Ballad em
  // 29/09; na Serenata é o mesmo código, só com janela menor).
  //
  // Agora a troca guarda o segundo e o estado: carrega o arquivo novo, volta
  // pro mesmo ponto e, se estava tocando, continua sozinha. A trava dos 40s
  // continua valendo, porque ela olha o `currentTime`, não o arquivo.
  const [fonte, setFonte] = useState(audioUrl);
  const retomar = useRef<{ em: number; tocando: boolean } | null>(null);
  useEffect(() => {
    if (audioUrl === fonte) return;
    const a = audioRef.current;
    if (a && (a.currentTime > 0 || !a.paused)) {
      retomar.current = { em: a.currentTime, tocando: !a.paused };
    }
    setFonte(audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);
  function aoCarregar(e: React.SyntheticEvent<HTMLAudioElement>) {
    const a = e.currentTarget;
    setDur(a.duration || 0);
    const r = retomar.current;
    if (!r) return;
    retomar.current = null;
    a.currentTime = r.em;
    if (r.tocando) {
      a.play()
        .then(() => setTocando(true))
        .catch(() => setTocando(false));
    }
  }

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
      // O PLAY RECUSADO ERA INVISÍVEL (08/10). Do lado da pessoa é o botão
      // que não toca; do nosso, nenhum rastro. O nome do erro separa a
      // política de autoplay (`NotAllowedError`) de arquivo que não abre
      // (`NotSupportedError`), e a família do navegador diz onde acontece
      // (app do Instagram, Safari do iPhone...), sem mandar o user agent.
      trackEvent("musica_play_falhou", {
        erro: err instanceof Error ? err.name || "Error" : "desconhecido",
        navegador: familiaDoNavegador(typeof navigator !== "undefined" ? navigator.userAgent : ""),
        prontidao: a.readyState,
      });
    }
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        src={fonte}
        preload="auto"
        onLoadedMetadata={aoCarregar}
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
              style={{ width: `${Math.min(100, (t / (completo ? dur || 1 : limite)) * 100)}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
          {" / "}
          {completo
            ? `${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, "0")}`
            : relogio(limite)}
        </span>
      </div>

      {/* Braço B do `previa_refrao`: o cartão de compra no lugar do popup,
          logo abaixo do player, no instante em que o refrão termina. */}
      {cartao && (
        <div
          ref={cartaoRef}
          className="scroll-my-4 space-y-4 rounded-2xl border-2 border-primary/25 bg-primary/5 px-5 py-6 text-center"
          style={{ animation: "serenata-sobe .28s ease-out" }}
        >
          <div>
            <p className="font-display text-xl font-semibold">{T.popupTitulo}</p>
            <p className="mt-2 text-sm text-muted-foreground">{T.popupTexto}</p>
          </div>
          <ul className="mx-auto space-y-2 text-left text-sm">
            {T.popupItens.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {!podeTerCredito && (
            <div>
              <PrecoDaOferta locale={locale} hojePor="hoje por" descontado={descontado} />
              <p className="mt-1 text-xs text-muted-foreground">
                Pagamento único. Não é assinatura.
              </p>
            </div>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              trackEvent("desbloquear_click", { origem: "cartao_refrao" });
              onDesbloquear();
            }}
          >
            {T.popupCta}
          </Button>
        </div>
      )}

      {/* Letra: sincronizada quando ha timestamps, estatica enquanto e previa */}
      <div className="space-y-1">
        {!linhas.length && letra
          ? letra
              .split(String.fromCharCode(10))
              .map((linha, i) =>
                /^\[.*\]$/.test(linha.trim()) ? (
                  <p
                    key={i}
                    className="pt-3 text-[11px] uppercase tracking-widest text-muted-foreground/60"
                  >
                    {rotuloDaSecao(linha.trim())}
                  </p>
                ) : (
                  <p key={i} className="text-[15px] leading-relaxed">
                    {linha}
                  </p>
                ),
              )
          : null}
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

      {/* Paywall no pico: a música corta no melhor momento. No braço B do
          `previa_refrao` o cartão de cima já faz este papel. */}
      {travou && !noRefrao && (
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
