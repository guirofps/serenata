import { useEffect, useRef, useState } from "react";
import { gerarLetra } from "@/lib/gerar-letra";
import type { LetraGerada } from "@/lib/letra-prompt";
import { useQuizStore } from "@/lib/quiz-store";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Music, RefreshCw, QrCode, Play } from "lucide-react";

// Frases de loading HONESTAS (a letra fica pronta em ~6s de verdade). Nada de
// barra de teatro que trava em 99% — o anti-padrão da Cantoria.
const LOADING = [
  "Lendo a sua história…",
  "Procurando os detalhes que só vocês têm…",
  "Escolhendo as palavras certas…",
  "Escrevendo o refrão…",
];

type Estado =
  | { fase: "gerando" }
  | { fase: "pronta"; letra: LetraGerada }
  | { fase: "erro"; msg: string };

export function RevealStep() {
  const respostas = useQuizStore((s) => s.respostas);
  const [estado, setEstado] = useState<Estado>({ fase: "gerando" });
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [refez, setRefez] = useState(false);
  const jaGerou = useRef(false);

  async function gerar() {
    setEstado({ fase: "gerando" });
    setLoadingIdx(0);
    try {
      const letra = await gerarLetra({ data: { respostas } });
      setEstado({ fase: "pronta", letra });
      trackEventOnce("letra_gerada", "v1", { titulo: letra.titulo });
    } catch (err) {
      console.error("[reveal] falha ao gerar letra:", err);
      setEstado({ fase: "erro", msg: "Não consegui escrever agora. Tente de novo." });
    }
  }

  // Gera uma vez ao montar (a revisão já mandou pra cá).
  useEffect(() => {
    if (jaGerou.current) return;
    jaGerou.current = true;
    gerar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Roda as frases de loading enquanto gera.
  useEffect(() => {
    if (estado.fase !== "gerando") return;
    const t = setInterval(() => setLoadingIdx((i) => Math.min(i + 1, LOADING.length - 1)), 1600);
    return () => clearInterval(t);
  }, [estado.fase]);

  if (estado.fase === "gerando") {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <div className="animate-pulse">
          <Music className="h-10 w-10 text-primary" />
        </div>
        <p className="text-lg text-muted-foreground">{LOADING[loadingIdx]}</p>
      </div>
    );
  }

  if (estado.fase === "erro") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">{estado.msg}</p>
        <Button onClick={gerar}>Tentar de novo</Button>
      </div>
    );
  }

  const { letra } = estado;
  const nome = (respostas.nome as string) || "você";

  return (
    <div className="space-y-6">
      {/* Mockup da PÁGINA PRESENTE: a letra aparece DENTRO do presente,
          faltando só a música (que é o que o fake door desbloqueia). */}
      <div className="overflow-hidden rounded-3xl border bg-card shadow-lg">
        {/* Capa */}
        <div className="bg-gradient-to-b from-primary/10 to-transparent px-6 pb-4 pt-8 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            uma música pra {nome}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{letra.titulo}</h1>
        </div>

        {/* Player travado (a música é o que se paga) */}
        <div className="mx-6 mb-4 flex items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Play className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="h-1.5 rounded-full bg-border">
              <div className="h-full w-0 rounded-full bg-primary" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">2:47</span>
        </div>

        {/* A letra */}
        <div className="px-6 pb-6">
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground">
            {letra.letra}
          </pre>
        </div>

        {/* Rodapé do presente */}
        <div className="flex items-center justify-center gap-2 border-t bg-secondary/30 py-3 text-xs text-muted-foreground">
          <QrCode className="h-4 w-4" /> link + QR Code pra compartilhar
        </div>
      </div>

      {/* 1 refação grátis (vira coautoria) — botão de comprar visível ao lado */}
      <div className="flex flex-col gap-3">
        {!refez && (
          <button
            onClick={() => {
              setRefez(true);
              trackEvent("letra_refacao", {});
              gerar();
            }}
            className="mx-auto inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Não ficou a sua cara? Escrever de novo (grátis)
          </button>
        )}

        {/* FAKE DOOR (Fase 1): mede intenção sem gerar música nenhuma. */}
        <FakeDoor nome={nome} />
      </div>
    </div>
  );
}

function FakeDoor({ nome }: { nome: string }) {
  const [clicou, setClicou] = useState(false);
  const email = useQuizStore((s) => s.email);

  if (clicou) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        <p className="font-semibold">Você está na fila 🎉</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Estamos abrindo aos poucos. Assim que a sua vez chegar, a gente te
          avisa em <strong className="text-foreground">{email || "seu e-mail"}</strong> pra
          você ouvir a música de {nome} cantada e montar o presente.
        </p>
      </div>
    );
  }

  return (
    <Button
      size="lg"
      className="w-full"
      onClick={() => {
        setClicou(true);
        // A métrica que decide a Fase 1: intenção de compra real.
        trackEvent("fake_door_click", {});
      }}
    >
      Quero ouvir ela cantada e montar o presente
    </Button>
  );
}
