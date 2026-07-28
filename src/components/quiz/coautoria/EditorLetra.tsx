import { useState } from "react";
import { FONTES } from "@/lib/marca";
import { aprimorarLetra } from "@/lib/coautoria";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEventOnce } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Editor da letra — a segunda etapa da coautoria.
//
// A pessoa vê a letra inteira montada em cima do refrão que escolheu, e pode:
//   - editar livremente (é o texto que vira música)
//   - "melhorar com IA" uma vez (deixa mais concreta, corta clichê)
//   - confirmar
//
// Mobile-first: textarea de altura generosa, botões empilhados, o "está
// pronta" fixo no rodapé.

export function EditorLetra({
  letraInicial,
  aoFinalizar,
  finalizando,
}: {
  letraInicial: string;
  aoFinalizar: (letra: string) => void;
  finalizando: boolean;
}) {
  const [letra, setLetra] = useState(letraInicial);
  const [aprimorando, setAprimorando] = useState(false);
  const [jaAprimorou, setJaAprimorou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function melhorar() {
    setAprimorando(true);
    setErro(null);
    try {
      const r = await aprimorarLetra({ data: { sessionId: getOrCreateSessionId(), letra } });
      setLetra(r.letra);
      setJaAprimorou(true);
      trackEventOnce("letra_aprimorada", "v1");
    } catch (err) {
      console.error("[coautoria] aprimorar falhou:", err);
      setErro("Não consegui melhorar agora. A letra continua como está.");
    } finally {
      setAprimorando(false);
    }
  }

  const ocupado = aprimorando || finalizando;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Quase lá
        </p>
        <h1
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ fontFamily: FONTES.display }}
        >
          Essa é a sua letra
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mude o que quiser, cada palavra é sua. É ela que vira música.
        </p>
      </div>

      <textarea
        value={letra}
        onChange={(e) => setLetra(e.target.value)}
        disabled={ocupado}
        spellCheck={false}
        rows={16}
        className={cn(
          "w-full rounded-2xl border border-border bg-card p-4 leading-relaxed outline-none transition-colors focus:border-primary disabled:opacity-60",
        )}
        style={{ fontFamily: FONTES.display, fontSize: "var(--t-base)" }}
      />

      {erro && <p className="text-center text-sm text-destructive">{erro}</p>}

      <button
        type="button"
        onClick={melhorar}
        disabled={ocupado || jaAprimorou}
        className={cn(
          "mx-auto inline-flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-medium transition-colors",
          jaAprimorou
            ? "border-border text-muted-foreground"
            : "border-primary/40 text-foreground hover:bg-primary/5",
          ocupado && "opacity-60",
        )}
      >
        {aprimorando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Melhorando…
          </>
        ) : jaAprimorou ? (
          <>
            <Sparkles className="h-4 w-4" /> Já melhorada
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Melhorar com IA
          </>
        )}
      </button>

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-2 pt-4">
        <Button
          size="lg"
          className="w-full"
          disabled={ocupado || !letra.trim()}
          onClick={() => aoFinalizar(letra)}
        >
          {finalizando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparando sua música…
            </>
          ) : (
            "Está pronta"
          )}
        </Button>
      </div>
    </div>
  );
}
