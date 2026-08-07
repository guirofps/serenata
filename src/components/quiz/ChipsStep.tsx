import type { QuestionStep } from "@/lib/flow-engine";
import { cn } from "@/lib/utils";

// Passo de escolha por chips com emoji. Seleção única (padrão) ou múltipla.
export function ChipsStep({
  step,
  value,
  onChange,
  respostas,
  onChangeExtra,
}: {
  step: Extract<QuestionStep, { input: "chips" }>;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  respostas?: Record<string, unknown>;
  onChangeExtra?: (field: string, v: string) => void;
}) {
  const selected = new Set(
    Array.isArray(value) ? value : value ? [value] : [],
  );

  function toggle(v: string) {
    if (step.multi) {
      const next = new Set(selected);
      next.has(v) ? next.delete(v) : next.add(v);
      onChange([...next]);
    } else {
      onChange(v);
    }
  }

  const extra = step.extraChips;
  const valorExtra = extra ? String(respostas?.[extra.field] ?? "") : "";

  return (
    <div className="space-y-6">
    <div className="flex flex-wrap justify-center gap-2.5">
      {step.options.map((opt) => {
        const on = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm transition-all",
              on
                ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/40",
            )}
          >
            {opt.emoji && <span aria-hidden>{opt.emoji}</span>}
            {opt.label}
            {opt.tag && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  on
                    ? "bg-primary/20 text-primary"
                    : "bg-primary/10 text-primary",
                )}
              >
                {opt.tag}
              </span>
            )}
          </button>
        );
      })}
    </div>

      {/* A SEGUNDA fileira (hoje: o tom). Opcional de propósito: quem não
          escolher deixa o modelo decidir pela ocasião e pela história, que é
          o que já acontecia antes deste campo existir. */}
      {extra && onChangeExtra && (
        <div className="border-t pt-5">
          <p className="mb-3 text-sm text-muted-foreground">{extra.pergunta}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {extra.options.map((opt) => {
              const on = valorExtra === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  // Tocar de novo no mesmo chip LIMPA: é como se desfaz uma
                  // escolha opcional sem um botão de "nenhum" ocupando espaço.
                  onClick={() => onChangeExtra(extra.field, on ? "" : opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-all",
                    on
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {opt.emoji && <span aria-hidden>{opt.emoji}</span>}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
