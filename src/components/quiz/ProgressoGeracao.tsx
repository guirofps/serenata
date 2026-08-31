import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { type Locale } from "@/lib/i18n";
import { t } from "@/lib/textos";

// Barra de progresso da geração da música — pra a espera "passar mais
// rápido" (a pessoa vê andar em vez de uma bolinha girando pra sempre).
//
// HONESTA, e essa é a diferença do anti-padrão da Cantoria (que chega a 99%
// em 70s e fica girando frases falsas por minutos com o backend vazio):
// aqui a barra reflete o TEMPO REAL decorrido contra a estimativa MEDIDA
// (84s a 163s de verdade). Ela enche de acordo com o relógio, segura perto
// do fim sem mentir que terminou, e o parent troca pelo player no instante
// em que a música fica pronta.

// ── A BARRA FOI RECALIBRADA: A ESPERA ENCOLHEU 4x ────────────────
//
// A régua antiga era linear em 135s, e vinha de quando a tela esperava o MP3
// final. Desde 30/08 a barra chega a 100% com a PRÉVIA (`pronta` no
// `MusicaDaSessao` é `audioUrl ?? previaUrl`), e a prévia é outro mundo.
//
// Medido no banco em 31/08, 77 gerações reais, do pedido até `previa_em`:
//
//   p25 26s · MEDIANA 36s · p75 37s · p90 50s · p95 90s
//   87% chegam em até 45s
//
// Com a régua de 135s a barra estava em 28% na mediana. Ou seja: ela pulava
// de 28% direto pra 100%. A pessoa lia "28%" e no instante seguinte a música
// tocava — o oposto da sensação que o número existe pra dar, e desperdiçando
// justamente a coisa que a gente conquistou (sair de ~120s pra ~36s).
//
// ── POR QUE EXPONENCIAL E NÃO LINEAR EM 45s ──────────────────────
//
// Trocar 135 por 45 resolveria a mediana e criaria um defeito pior na cauda:
// os 13% que passam de 45s ficariam PARADOS no teto de 93%. Barra congelada
// é exatamente o que está anotado no CLAUDE.md como falha da Cantoria ("chega
// a 99% em 70s e fica girando frases falsas por minutos").
//
// A curva abaixo se aproxima do teto sem nunca encostar, então ela corre no
// começo e continua andando na cauda:
//
//    5s 26%  ·  20s 64%  ·  36s 81%  ·  50s 87%  ·  90s 92%
//
// Na mediana chega em 81% (contra 28%), e quem espera 90s ainda vê o número
// subir em vez de encarar uma barra travada.
const TAU_S = 18;
const INICIO = 4;
const TETO = 93; // nunca T.completa sozinha: só a música pronta leva a 100%

/** Quanto a barra mostra depois de `s` segundos. Ver o bloco acima. */
export function pctEm(s: number): number {
  return INICIO + (TETO - INICIO) * (1 - Math.exp(-s / TAU_S));
}

// Mensagens amarradas ao PROGRESSO, não a um timer separado: assim a frase
// reflete o quanto a barra andou e nunca fica T.ajustandoDetalhes com a
// barra no começo. Mapeiam de leve as etapas reais (o Suno grava o áudio,
// depois vêm os timestamps), sem prometer precisão falsa.
//
// OS LIMIARES MUDARAM JUNTO COM A CURVA, e tinham que mudar. Eram 28/58/84
// numa reta de 135s, o que dava trocas aos 36s, 82s e 121s. Na curva nova os
// MESMOS números cairiam aos 5,7s, 16,8s e 41s — a primeira frase apareceria
// por menos de seis segundos, tempo que não dá nem pra ler.
//
// Recalculados pra dividir a espera de verdade (mediana 36s) em pedaços que
// se leem: ~10s, ~12s, ~18s, e o quarto pra quem passou disso.
function mensagens(locale: Locale): Array<{ ate: number; texto: string }> {
  const T = t(locale);
  return [
    { ate: 42, texto: T.loadingMusica[0] }, // até ~10s
    { ate: 67, texto: T.gravandoVoz }, //       até ~22s
    { ate: 83, texto: T.loadingMusica[1] }, // até ~40s
    { ate: TETO, texto: T.loadingMusica[2] },
  ];
}

/**
 * Depois de quantos segundos a espera vira "está quase".
 *
 * ── POR QUE POR TEMPO E NÃO POR PORCENTAGEM ──────────────────────
 *
 * Era `pct >= TETO`, e isso funcionava porque a reta ENCOSTAVA no teto aos
 * 135s. A curva nova se aproxima do teto sem nunca alcançar, então a
 * comparação seria falsa pra sempre e a frase honesta nunca apareceria.
 *
 * 75s cobre com folga o p90 medido (50s) e chega antes do p95 (90s): quem
 * espera mais que isso é caso raro de verdade, e é a essa pessoa que a tela
 * deve parar de narrar etapas e admitir que está demorando.
 */
const QUASE_APOS_S = 75;

export function ProgressoGeracao({ pronta = false, locale = "pt" }: { pronta?: boolean; locale?: Locale }) {
  const T = t(locale);
  const MENSAGENS = mensagens(locale);
  const [inicio] = useState(() => Date.now());
  const [pct, setPct] = useState(INICIO);
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    // Quando a música fica pronta, o relógio para: quem manda no
    // preenchimento passa a ser o `pronta`, que salta pra 100%.
    if (pronta) return;
    const relogio = setInterval(() => {
      const s = (Date.now() - inicio) / 1000;
      setSegundos(s);
      setPct(Math.min(TETO, pctEm(s)));
    }, 400);
    return () => clearInterval(relogio);
  }, [inicio, pronta]);

  // A prévia NÃO é presa por timer: no instante em que a música fica pronta,
  // a barra completa pra 100% (a transição de width anima o salto) e o player
  // entra logo em seguida. A barra é estimativa; o gatilho é a música real.
  const pctFinal = pronta ? 100 : pct;
  const quaseLa = !pronta && segundos >= QUASE_APOS_S;
  const mensagem = pronta
    ? T.prontaBang
    : MENSAGENS.find((m) => pct <= m.ate)?.texto ?? MENSAGENS[0].texto;

  return (
    <div className="rounded-2xl border bg-secondary/30 px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn("text-sm font-medium", pronta && "text-primary")}>
          {quaseLa ? T.quasePronta : mensagem}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {Math.round(pctFinal)}%
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pctFinal}%` }}
        />
      </div>

      {!pronta && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          {T.levaDoisMinutos}
        </p>
      )}
    </div>
  );
}
