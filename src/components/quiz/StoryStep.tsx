import { useEffect, useRef, useState } from "react";
import type { QuestionStep } from "@/lib/flow-engine";
import { Textarea } from "@/components/ui/textarea";
import { useDictation } from "@/lib/use-dictation";
import { trackEventOnce } from "@/lib/track";
import { type Locale, TAG_IDIOMA } from "@/lib/i18n";
import { t as textos } from "@/lib/textos";
import { cn } from "@/lib/utils";
import { Mic, Square } from "lucide-react";

type StoryQuestion = Extract<QuestionStep, { input: "story" }>;

// Validação anti-lixo unificada (inspirada no LoveTune): a MESMA função decide
// a mensagem sob o campo e se o botão libera — sem isso, a mensagem "Perfeito"
// contradizia o botão travado. Devolve o motivo específico pra mostrar.
export function validateStory(
  step: StoryQuestion,
  value?: string,
  locale: Locale = "pt",
): { ok: boolean; message: string } {
  const T = textos(locale);
  const t = (value ?? "").trim();

  // Campo vazio NÃO leva cobrança. "Escreva pelo menos 120 caracteres" antes
  // de a pessoa digitar a primeira letra lê como tarefa de casa, e este é o
  // passo onde 14 de 49 desistem. Vira cota só depois que ela começou.
  if (t.length === 0) return { ok: false, message: T.duasLinhas };

  const faltam = step.minChars - t.length;
  if (faltam > 0)
    return { ok: false, message: T.faltamChars(faltam) };

  // Palavras de verdade = sequências de 2+ letras (não dígitos/símbolos).
  const palavrasReais = t.match(/[\p{L}]{2,}/gu) ?? [];
  if (palavrasReais.length < 3)
    return { ok: false, message: T.frasesDeVerdade };

  // Conteúdo majoritariamente não-alfabético (parede de dígitos/símbolos).
  const letras = (t.match(/\p{L}/gu) ?? []).length;
  if (letras / t.length < 0.5)
    return { ok: false, message: T.palavrasReais };

  // Repetição excessiva do mesmo caractere (ex: "aaaaaa", "333333").
  if (/(.)\1{5,}/.test(t))
    return { ok: false, message: T.naoRepita };

  return { ok: true, message: T.perfeito };
}

// Campo de história com validação anti-lixo + chips-gatilho de detalhe concreto.
// Gravação de áudio real entra na task de MediaRecorder; aqui fica o gancho.
// Quanto tempo travado antes de oferecer a saída. Curto demais vira atalho
// pra todo mundo; longo demais chega depois de a pessoa já ter fechado a aba.
const SEGUNDOS_ATE_OFERECER_SAIDA = 25;
const CHARS_QUE_CONTAM_COMO_TRAVADO = 20;

export function StoryStep({
  step,
  value,
  onChange,
  preencher = (s) => s,
  aoPular,
  locale = "pt",
}: {
  step: StoryQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
  /** Troca {nome} pelo nome do homenageado (vem da rota). */
  preencher?: (s: string) => string;
  /** Avança sem responder. Só usado quando o passo permite pular. */
  aoPular?: () => void;
  locale?: Locale;
}) {
  const T = textos(locale);
  const [touched, setTouched] = useState(false);
  const text = value ?? "";
  const { ok, message } = validateStory(step, text, locale);

  // A saída aparece só pra quem TRAVOU: passou o tempo e quase não escreveu.
  // Quem está digitando nunca vê o link, então não perde ninguém que ia
  // responder.
  const [tempoEsgotado, setTempoEsgotado] = useState(false);
  useEffect(() => {
    if (!step.permitePular) return;
    const id = setTimeout(() => setTempoEsgotado(true), SEGUNDOS_ATE_OFERECER_SAIDA * 1000);
    return () => clearTimeout(id);
  }, [step.permitePular, step.id]);
  const mostrarSaida =
    Boolean(step.permitePular && aoPular) &&
    tempoEsgotado &&
    text.trim().length < CHARS_QUE_CONTAM_COMO_TRAVADO;

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
  }, TAG_IDIOMA[locale]);

  // Gatilho tocado: escreve o COMEÇO da frase e devolve o cursor pro fim,
  // com o teclado já aberto. É a diferença entre "escreva sobre a memória de
  // vocês" (página em branco, trava) e "O apelido que eu dou pra ela é ___"
  // (só completar).
  const areaRef = useRef<HTMLTextAreaElement>(null);
  function usarGatilho(inicio: string) {
    const base = vivoRef.current.trimEnd();
    // Tocar duas vezes no mesmo gatilho não repete a frase: se ela já é a
    // última linha e ainda está vazia, só devolve o cursor pra lá.
    if (base.endsWith(inicio.trimEnd())) {
      areaRef.current?.focus();
      return;
    }
    const novo = base ? `${base}\n${inicio}` : inicio;
    vivoRef.current = novo;
    onChange(novo);
    trackEventOnce("gatilho_usado", step.id);
    requestAnimationFrame(() => {
      const el = areaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(novo.length, novo.length);
      el.scrollTop = el.scrollHeight;
    });
  }

  return (
    <div className="space-y-3">
      {step.triggers && step.triggers.length > 0 && (
        <>
          <p className="text-center text-xs text-muted-foreground">
            {T.semIdeia}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {step.triggers.map((tr) => (
              <button
                key={tr.rotulo}
                type="button"
                onClick={() => usarGatilho(preencher(tr.inicio))}
                className="rounded-full border border-primary/25 bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground active:scale-95"
              >
                {tr.rotulo}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="relative">
        <Textarea
          ref={areaRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={step.placeholder ? preencher(step.placeholder) : undefined}
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
              <Square className="h-4 w-4 fill-current" /> {T.pararGravar}
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" /> {T.preferoFalar}
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

      {mostrarSaida && (
        <p className="text-center">
          <button
            type="button"
            onClick={() => {
              trackEventOnce("pulou_memoria", step.id);
              aoPular?.();
            }}
            className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            {T.naoLembro}
          </button>
        </p>
      )}
    </div>
  );
}

// Compat: booleano pro motor (usa a validação unificada).
export function storyIsValid(step: StoryQuestion, value?: string, locale: Locale = "pt") {
  return validateStory(step, value, locale).ok;
}
