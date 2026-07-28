import { useState } from "react";
import { FONTES } from "@/lib/marca";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, Check } from "lucide-react";
import type { RefroesGerados } from "@/lib/coautoria";

// Escolha do refrão — a primeira etapa da coautoria.
//
// O refrão é a parte que a pessoa vai CANTAR e RELER, então é a escolha de
// maior peso. Duas opções (não três, como o LoveTune): uma direta, uma
// lírica. Escolher já faz a letra virar dela.
//
// Mobile-first: cartões empilhados, largura cheia, alvo de toque grande. O
// botão de confirmar mora fixo no rodapé pra estar sempre no polegar.

export function EscolherRefrao({
  dados,
  aoEscolher,
  aoRegerar,
  regerando,
}: {
  dados: RefroesGerados;
  aoEscolher: (refrao: string) => void;
  aoRegerar: () => void;
  regerando: boolean;
}) {
  const [sel, setSel] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Sua letra, do seu jeito
        </p>
        <h1
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ fontFamily: FONTES.display }}
        >
          Qual refrão fica melhor?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          É a parte que mais se canta. Escolha a que te tocar, dá pra ajustar
          tudo depois.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {dados.refroes.map((refrao, i) => {
          const ativo = sel === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={ativo}
              className={cn(
                "relative rounded-2xl border-2 p-5 text-left transition-all",
                ativo
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {i === 0 ? "Opção 1" : "Opção 2"}
                </span>
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full border-2 transition-colors",
                    ativo ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {ativo && <Check className="h-3.5 w-3.5" />}
                </span>
              </div>
              <p
                className="whitespace-pre-line text-lg leading-relaxed"
                style={{ fontFamily: FONTES.display }}
              >
                {refrao}
              </p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={aoRegerar}
        disabled={regerando}
        className="mx-auto inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
      >
        <RefreshCw className={cn("h-4 w-4", regerando && "animate-spin")} />
        {regerando ? "Gerando outras…" : "Ver outras opções"}
      </button>

      {/* Rodapé fixo no polegar: só habilita com um refrão escolhido. */}
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-2 pt-4">
        <Button
          size="lg"
          className="w-full"
          disabled={sel === null}
          onClick={() => sel !== null && aoEscolher(dados.refroes[sel])}
        >
          Usar este refrão
        </Button>
      </div>
    </div>
  );
}
