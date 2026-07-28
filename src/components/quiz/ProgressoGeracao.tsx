import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Barra de progresso da geração da música — pra a espera "passar mais
// rápido" (a pessoa vê andar em vez de uma bolinha girando pra sempre).
//
// HONESTA, e essa é a diferença do anti-padrão da Cantoria (que chega a 99%
// em 70s e fica girando frases falsas por minutos com o backend vazio):
// aqui a barra reflete o TEMPO REAL decorrido contra a estimativa MEDIDA
// (84s a 163s de verdade). Ela enche de acordo com o relógio, segura perto
// do fim sem mentir que terminou, e o parent troca pelo player no instante
// em que a música fica pronta.

// Estimativa central, MEDIDA no banco: das músicas geradas, a mediana é 133s
// e 6 de 8 caíram entre 111s e 146s (só o retry anti-artista estoura pra
// ~13min). A barra mira nos 135s; se passar, segura no topo com um texto
// honesto em vez de fingir 100%.
const ESTIMATIVA_S = 135;
const TETO = 93; // nunca "completa" sozinha: só a música pronta leva a 100%

// Mensagens amarradas ao PROGRESSO, não a um timer separado: assim a frase
// reflete o quanto a barra andou e nunca fica "ajustando os detalhes" com a
// barra no começo. Mapeiam de leve as etapas reais (o Suno grava o áudio,
// depois vêm os timestamps), sem prometer precisão falsa.
const MENSAGENS: Array<{ ate: number; texto: string }> = [
  { ate: 28, texto: "Encontrando o tom da sua história…" },
  { ate: 58, texto: "Gravando a voz…" },
  { ate: 84, texto: "Dando ritmo às palavras…" },
  { ate: TETO, texto: "Ajustando os últimos detalhes…" },
];

export function ProgressoGeracao({ pronta = false }: { pronta?: boolean }) {
  const [inicio] = useState(() => Date.now());
  const [pct, setPct] = useState(4);

  useEffect(() => {
    // Quando a música fica pronta, o relógio para: quem manda no
    // preenchimento passa a ser o `pronta`, que salta pra 100%.
    if (pronta) return;
    const relogio = setInterval(() => {
      const s = (Date.now() - inicio) / 1000;
      setPct(Math.min(TETO, 4 + (s / ESTIMATIVA_S) * (TETO - 4)));
    }, 400);
    return () => clearInterval(relogio);
  }, [inicio, pronta]);

  // A prévia NÃO é presa por timer: no instante em que a música fica pronta,
  // a barra completa pra 100% (a transição de width anima o salto) e o player
  // entra logo em seguida. A barra é estimativa; o gatilho é a música real.
  const pctFinal = pronta ? 100 : pct;
  const quaseLa = !pronta && pct >= TETO;
  const mensagem = pronta
    ? "Pronta!"
    : MENSAGENS.find((m) => pct <= m.ate)?.texto ?? MENSAGENS[0].texto;

  return (
    <div className="rounded-2xl border bg-secondary/30 px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn("text-sm font-medium", pronta && "text-primary")}>
          {quaseLa ? "Quase pronta…" : mensagem}
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
          Leva cerca de 2 minutos. Pode ir ouvindo outras aqui embaixo enquanto
          a sua fica pronta.
        </p>
      )}
    </div>
  );
}
