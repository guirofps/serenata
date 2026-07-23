import { useState } from "react";
import type { QuestionStep } from "@/lib/flow-engine";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type StoryQuestion = Extract<QuestionStep, { input: "story" }>;

// Validação anti-lixo unificada (inspirada no LoveTune): a MESMA função decide
// a mensagem sob o campo e se o botão libera — sem isso, a mensagem "Perfeito"
// contradizia o botão travado. Devolve o motivo específico pra mostrar.
export function validateStory(
  step: StoryQuestion,
  value?: string,
): { ok: boolean; message: string } {
  const t = (value ?? "").trim();

  if (t.length === 0) return { ok: false, message: `Escreva pelo menos ${step.minChars} caracteres` };

  const faltam = step.minChars - t.length;
  if (faltam > 0)
    return { ok: false, message: `Escreva um pouco mais — faltam ${faltam} caracteres` };

  // Palavras de verdade = sequências de 2+ letras (não dígitos/símbolos).
  const palavrasReais = t.match(/[\p{L}]{2,}/gu) ?? [];
  if (palavrasReais.length < 3)
    return { ok: false, message: "Escreva com frases de verdade — pelo menos 3 palavras." };

  // Conteúdo majoritariamente não-alfabético (parede de dígitos/símbolos).
  const letras = (t.match(/\p{L}/gu) ?? []).length;
  if (letras / t.length < 0.5)
    return { ok: false, message: "Use palavras reais — evite números e símbolos soltos." };

  // Repetição excessiva do mesmo caractere (ex: "aaaaaa", "333333").
  if (/(.)\1{5,}/.test(t))
    return { ok: false, message: "Evite repetir o mesmo caractere várias vezes seguidas." };

  return { ok: true, message: "Perfeito ✓" };
}

// Campo de história com validação anti-lixo + chips-gatilho de detalhe concreto.
// Gravação de áudio real entra na task de MediaRecorder; aqui fica o gancho.
export function StoryStep({
  step,
  value,
  onChange,
}: {
  step: StoryQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const text = value ?? "";
  const { ok, message } = validateStory(step, text);

  return (
    <div className="space-y-3">
      {step.triggers && step.triggers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {step.triggers.map((tr) => (
            <span
              key={tr}
              className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground"
            >
              {tr}
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
            ok ? "text-muted-foreground" : "text-muted-foreground",
            !ok && touched && text.length > 0 && "text-destructive",
          )}
        >
          {message}
        </span>
        {step.allowAudio && (
          <button
            type="button"
            className="text-primary underline underline-offset-2"
            onClick={() => alert("Gravação de áudio: em construção")}
          >
            Prefiro contar falando
          </button>
        )}
      </div>
    </div>
  );
}

// Compat: booleano pro motor (usa a validação unificada).
export function storyIsValid(step: StoryQuestion, value?: string) {
  return validateStory(step, value).ok;
}
