import { useRef, useState } from "react";
import type { QuestionStep } from "@/lib/flow-engine";
import { Textarea } from "@/components/ui/textarea";
import { useDictation } from "@/lib/use-dictation";
import { trackEventOnce } from "@/lib/track";
import { cn } from "@/lib/utils";
import { Mic, Square } from "lucide-react";

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
    return { ok: false, message: `Escreva um pouco mais, faltam ${faltam} caracteres` };

  // Palavras de verdade = sequências de 2+ letras (não dígitos/símbolos).
  const palavrasReais = t.match(/[\p{L}]{2,}/gu) ?? [];
  if (palavrasReais.length < 3)
    return { ok: false, message: "Escreva com frases de verdade, pelo menos 3 palavras." };

  // Conteúdo majoritariamente não-alfabético (parede de dígitos/símbolos).
  const letras = (t.match(/\p{L}/gu) ?? []).length;
  if (letras / t.length < 0.5)
    return { ok: false, message: "Use palavras reais, evite números e símbolos soltos." };

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

  // O valor VIVO do campo, num ref.
  //
  // Não é otimização: o reconhecedor entrega vários trechos finais no MESMO
  // tick (o onresult percorre o array de resultados inteiro). Lendo `value`
  // do render, todas as chamadas enxergam o mesmo texto velho e cada uma
  // sobrescreve a anterior — quem fala perde tudo menos o último pedaço, o
  // contador anda pra trás e o botão nunca libera. O ref é atualizado na
  // hora, então trechos seguidos se acumulam de verdade.
  const vivoRef = useRef(text);
  vivoRef.current = text;

  // Ditado: o texto falado é ANEXADO ao que já existe, nunca substitui —
  // a pessoa pode alternar entre falar e digitar sem perder nada.
  const ditado = useDictation((trecho) => {
    const t = trecho.trim();
    if (!t) return;
    const base = vivoRef.current.trim();
    const novo = base ? `${base} ${t}` : t;
    vivoRef.current = novo;
    onChange(novo);
  });

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
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={step.placeholder}
          className={cn("min-h-40", ditado.gravando && "ring-2 ring-primary")}
        />
        {/* Preview do que está sendo falado (ainda não confirmado) */}
        {ditado.gravando && ditado.parcial && (
          <p className="pointer-events-none absolute inset-x-4 bottom-3 truncate text-sm italic text-muted-foreground">
            {ditado.parcial}
          </p>
        )}
      </div>

      {step.allowAudio && ditado.suportado && (
        <button
          type="button"
          onClick={() => {
            if (!ditado.gravando) trackEventOnce("audio_usado", step.id);
            ditado.alternar();
          }}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-colors",
            ditado.gravando
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-primary/40 text-foreground hover:bg-primary/5",
          )}
        >
          {ditado.gravando ? (
            <>
              <Square className="h-4 w-4 fill-current" /> Parar de gravar
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" /> Prefiro contar falando
            </>
          )}
        </button>
      )}

      {ditado.erro && <p className="text-center text-xs text-destructive">{ditado.erro}</p>}

      <div className="text-center text-xs">
        <span
          className={cn(
            "text-muted-foreground",
            !ok && touched && text.length > 0 && "text-destructive",
          )}
        >
          {message}
        </span>
      </div>
    </div>
  );
}

// Compat: booleano pro motor (usa a validação unificada).
export function storyIsValid(step: StoryQuestion, value?: string) {
  return validateStory(step, value).ok;
}
