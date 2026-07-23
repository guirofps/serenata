import { useState } from "react";
import type { QuestionStep } from "@/lib/flow-engine";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Campo de história com validação anti-lixo (mín. de caracteres, palavras
// reais) + chips-gatilho de detalhe concreto. Gravação de áudio entra na
// task de MediaRecorder; aqui deixamos o gancho "prefiro contar falando".
export function StoryStep({
  step,
  value,
  onChange,
}: {
  step: Extract<QuestionStep, { input: "story" }>;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const text = value ?? "";
  const faltam = Math.max(0, step.minChars - text.trim().length);

  return (
    <div className="space-y-3">
      {step.triggers && step.triggers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {step.triggers.map((t) => (
            <span
              key={t}
              className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={step.placeholder}
        className="min-h-40"
      />
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "text-muted-foreground",
            touched && faltam > 0 && "text-destructive",
          )}
        >
          {faltam > 0
            ? `Escreva um pouco mais — faltam ${faltam} caracteres`
            : "Perfeito ✓"}
        </span>
        {step.allowAudio && (
          <button
            type="button"
            className="text-primary underline underline-offset-2"
            // Gancho: a gravação de áudio real entra na próxima task.
            onClick={() => alert("Gravação de áudio: em construção")}
          >
            Prefiro contar falando
          </button>
        )}
      </div>
    </div>
  );
}

// Validação usada pelo motor pra habilitar o "Continuar".
export function storyIsValid(step: Extract<QuestionStep, { input: "story" }>, value?: string) {
  const t = (value ?? "").trim();
  if (t.length < step.minChars) return false;
  // Anti-lixo básico: pelo menos 3 palavras de 2+ letras.
  const palavras = t.split(/\s+/).filter((w) => w.length >= 2);
  return palavras.length >= 3;
}
