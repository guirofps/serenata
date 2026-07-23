import { useEffect, useRef, useState } from "react";
import { gerarLetra } from "@/lib/gerar-letra";
import type { LetraGerada } from "@/lib/letra-prompt";
import { useQuizStore } from "@/lib/quiz-store";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { KaraokePlayer } from "@/components/quiz/KaraokePlayer";
import { Music, RefreshCw, QrCode } from "lucide-react";

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
  | { fase: "erro"; msg: string }
  | { fase: "sem-dados" };

// Com SSR, a store persistida começa VAZIA e só hidrata do localStorage depois
// do mount. Sem esperar por isso, a geração dispara sem a história e a letra
// sai genérica (bug real: reload na tela de reveal produzia letra vazia de
// detalhes). Este hook segura a geração até os dados existirem de verdade.
function useStoreHidratada() {
  const [hidratada, setHidratada] = useState(() =>
    typeof window === "undefined" ? false : useQuizStore.persist.hasHydrated(),
  );
  useEffect(() => {
    if (hidratada) return;
    const unsub = useQuizStore.persist.onFinishHydration(() => setHidratada(true));
    // Se já hidratou entre o render e o efeito, não fica esperando pra sempre.
    if (useQuizStore.persist.hasHydrated()) setHidratada(true);
    return unsub;
  }, [hidratada]);
  return hidratada;
}

export function RevealStep() {
  const respostas = useQuizStore((s) => s.respostas);
  const hidratada = useStoreHidratada();
  const [estado, setEstado] = useState<Estado>({ fase: "gerando" });
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [refez, setRefez] = useState(false);
  const jaGerou = useRef(false);

  async function gerar() {
    setEstado({ fase: "gerando" });
    setLoadingIdx(0);
    try {
      // getState() = estado VIVO da store (pós-hidratação). Não usar o snapshot
      // do render: com SSR ele ainda pode estar vazio e a letra sairia genérica.
      const respostasVivas = useQuizStore.getState().respostas;
      const letra = await gerarLetra({ data: { respostas: respostasVivas } });
      setEstado({ fase: "pronta", letra });
      trackEventOnce("letra_gerada", "v1", { titulo: letra.titulo });
    } catch (err) {
      console.error("[reveal] falha ao gerar letra:", err);
      setEstado({ fase: "erro", msg: "Não consegui escrever agora. Tente de novo." });
    }
  }

  // Gera UMA vez, e só depois que a store hidratou e a história existe.
  // Falhe alto, não adivinhe: sem história, não gera letra genérica.
  const temHistoriaRender = Boolean(
    String(respostas.historia1 ?? "").trim() || String(respostas.historia2 ?? "").trim(),
  );
  useEffect(() => {
    if (!hidratada || jaGerou.current) return;
    // Confere no estado VIVO, não no snapshot do render (que pode estar
    // atrasado logo após a hidratação e faria a letra sair sem história).
    const r = useQuizStore.getState().respostas;
    const temHistoria = Boolean(
      String(r.historia1 ?? "").trim() || String(r.historia2 ?? "").trim(),
    );
    if (!temHistoria) {
      setEstado({ fase: "sem-dados" });
      return; // sem marcar jaGerou: se a história chegar depois, gera.
    }
    jaGerou.current = true;
    gerar();
  }, [hidratada, temHistoriaRender]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Sem história (link direto / storage limpo): manda de volta pro quiz em vez
  // de escrever uma letra que serviria pra qualquer pessoa.
  if (estado.fase === "sem-dados") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-semibold">Faltou a parte mais importante</p>
        <p className="max-w-sm text-muted-foreground">
          Preciso da história pra escrever uma letra que seja só dela. Vamos
          voltar e me contar?
        </p>
        <a href="/criar?step=historia1" className="underline underline-offset-4">
          Contar a história
        </a>
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

        {/* Karaokê: trilha instrumental + letra revelando em ritmo.
            O que falta ainda é a VOZ — e é isso que o fake door desbloqueia. */}
        <div className="px-6 pb-6">
          <KaraokePlayer letra={letra.letra} genero={respostas.estilo as string} />
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
