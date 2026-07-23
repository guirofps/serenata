import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { MusicaKaraoke, type PalavraAlinhada } from "@/components/quiz/MusicaKaraoke";
import { cn } from "@/lib/utils";

// Rota de DEMONSTRAÇÃO do karaokê real, com músicas de exemplo já geradas.
// Serve pra sentir a experiência antes de plugar no pipeline por usuário.
// Não linkada do funil; morre quando o reveal ganhar o player real (Fase 2).

const EXEMPLOS: Record<string, { slug: string; nome: string; titulo: string; versoes: number }> = {
  camila: { slug: "camila", nome: "Camila", titulo: "Taça de Vinho em Holambra", versoes: 2 },
  luiza: { slug: "luiza", nome: "Luiza", titulo: "De Amiga pra Esposa", versoes: 2 },
  maria: { slug: "maria", nome: "Maria", titulo: "Strogonoff da Maria", versoes: 2 },
};

export const Route = createFileRoute("/demo-musica")({
  validateSearch: z.object({
    m: z.string().optional(),
    v: z.coerce.number().optional(),
  }),
  component: Demo,
});

function Demo() {
  const { m, v } = Route.useSearch();
  const chave = m && EXEMPLOS[m] ? m : "camila";
  const ex = EXEMPLOS[chave];
  const versao = v === 2 ? 2 : 1;
  const base = `/exemplos/${ex.slug}-v${versao}`;

  const [words, setWords] = useState<PalavraAlinhada[] | null>(null);

  useEffect(() => {
    setWords(null);
    fetch(`${base}.json`)
      .then((r) => r.json())
      .then((j) => setWords(j.words))
      .catch((e) => console.error("[demo] timestamps:", e));
  }, [base]);

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      {/* Seletor de exemplo e versão */}
      <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
        {Object.values(EXEMPLOS).map((e) => (
          <Link
            key={e.slug}
            to="/demo-musica"
            search={{ m: e.slug, v: 1 }}
            className={cn(
              "rounded-full border-2 px-4 py-1.5 text-sm transition-colors",
              e.slug === chave
                ? "border-primary bg-primary/10 font-semibold"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {e.nome}
          </Link>
        ))}
        <span className="mx-1 text-muted-foreground/40">|</span>
        {[1, 2].map((n) => (
          <Link
            key={n}
            to="/demo-musica"
            search={{ m: chave, v: n }}
            className={cn(
              "rounded-full border-2 px-3 py-1.5 text-sm transition-colors",
              n === versao
                ? "border-primary bg-primary/10 font-semibold"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            v{n}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border bg-card shadow-lg">
        <div className="bg-gradient-to-b from-primary/10 to-transparent px-6 pb-4 pt-8 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            uma música pra {ex.nome}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{ex.titulo}</h1>
        </div>
        <div className="px-6 pb-6">
          {words ? (
            <MusicaKaraoke
              key={base}
              audioUrl={`${base}.mp3`}
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
