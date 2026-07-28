import { useEffect, useState } from "react";

// Barra de progresso da geração da música — pra a espera "passar mais
// rápido" (a pessoa vê andar em vez de uma bolinha girando pra sempre).
//
// HONESTA, e essa é a diferença do anti-padrão da Cantoria (que chega a 99%
// em 70s e fica girando frases falsas por minutos com o backend vazio):
// aqui a barra reflete o TEMPO REAL decorrido contra a estimativa MEDIDA
// (84s a 163s de verdade). Ela enche de acordo com o relógio, segura perto
// do fim sem mentir que terminou, e o parent troca pelo player no instante
// em que a música fica pronta.

// Estimativa central do intervalo medido. A barra mira aqui; se passar,
// segura no topo com um texto honesto em vez de fingir 100%.
const ESTIMATIVA_S = 110;
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

export function ProgressoGeracao() {
  const [inicio] = useState(() => Date.now());
  const [pct, setPct] = useState(4);

  useEffect(() => {
    // Relógio: atualiza o preenchimento pelo tempo decorrido real.
    const relogio = setInterval(() => {
      const s = (Date.now() - inicio) / 1000;
      setPct(Math.min(TETO, 4 + (s / ESTIMATIVA_S) * (TETO - 4)));
    }, 400);
    return () => clearInterval(relogio);
  }, [inicio]);

  const quaseLa = pct >= TETO;
  const mensagem = MENSAGENS.find((m) => pct <= m.ate)?.texto ?? MENSAGENS[0].texto;

  return (
    <div className="rounded-2xl border bg-secondary/30 px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">
          {quaseLa ? "Quase pronta…" : mensagem}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {Math.round(pct)}%
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">
        Leva cerca de 2 minutos. Pode ir ouvindo outras aqui embaixo enquanto
        a sua fica pronta.
      </p>
    </div>
  );
}
