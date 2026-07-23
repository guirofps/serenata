import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MusicaKaraoke, type PalavraAlinhada } from "@/components/quiz/MusicaKaraoke";

// Rota de DEMONSTRAÇÃO do karaokê real, com a música de exemplo da Camila.
// Serve pra sentir a experiência antes de plugar no pipeline por usuário.
// Não linkada de lugar nenhum; morre quando o reveal ganhar o player real.

export const Route = createFileRoute("/demo-musica")({
  component: Demo,
});

function Demo() {
  const [words, setWords] = useState<PalavraAlinhada[] | null>(null);

  useEffect(() => {
    fetch("/exemplos/camila-v1.json")
      .then((r) => r.json())
      .then((j) => setWords(j.words))
      .catch((e) => console.error("[demo] timestamps:", e));
  }, []);

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-lg">
        <div className="bg-gradient-to-b from-primary/10 to-transparent px-6 pb-4 pt-8 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            uma música pra Camila
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Taça de Vinho em Holambra</h1>
        </div>
        <div className="px-6 pb-6">
          {words ? (
            <MusicaKaraoke
              audioUrl="/exemplos/camila-v1.mp3"
              words={words}
              onDesbloquear={() => alert("Aqui entraria o checkout (Fase 3)")}
            />
          ) : (
            <p className="py-8 text-center text-muted-foreground">Carregando…</p>
          )}
        </div>
      </div>
    </main>
  );
}
