import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { z } from "zod";
import {
  isQuestion,
  isContact,
  isReview,
  isSocialProof,
  nextVisibleIndex,
  prevVisibleIndex,
  indexOfId,
  questionNumber,
  totalQuestions,
} from "@/lib/flow-engine";
import { QUIZ_FLOW, QUIZ_SKIP } from "@/lib/quiz-flow";
import { useQuizStore } from "@/lib/quiz-store";
import { captureLeadProgress } from "@/lib/lead-capture";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { getOrCreateSessionId } from "@/lib/session-context";
import { ChipsStep } from "@/components/quiz/ChipsStep";
import { StoryStep, storyIsValid } from "@/components/quiz/StoryStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft } from "lucide-react";

// Passo na URL (?step=<id>): reload não zera, back do navegador funciona.
const searchSchema = z.object({ step: z.string().optional() });

export const Route = createFileRoute("/criar")({
  validateSearch: searchSchema,
  component: Criar,
});

function Criar() {
  const navigate = useNavigate();
  const { step: stepId } = Route.useSearch();
  const respostas = useQuizStore((s) => s.respostas);
  const setResposta = useQuizStore((s) => s.setResposta);
  const email = useQuizStore((s) => s.email);
  const setEmail = useQuizStore((s) => s.setEmail);

  const idx = indexOfId(QUIZ_FLOW, stepId);
  const step = QUIZ_FLOW[idx];
  const total = useMemo(() => totalQuestions(QUIZ_FLOW), []);
  const qNum = questionNumber(QUIZ_FLOW, idx);

  useEffect(() => {
    getOrCreateSessionId();
    trackEventOnce("quiz_started", "v1");
  }, []);

  // Captura parcial de lead a cada passo alcançado (vantagem competitiva).
  useEffect(() => {
    if (isQuestion(step) || isContact(step)) {
      captureLeadProgress({
        currentStep: qNum || idx,
        furthestStep: qNum || idx,
        respostas,
        email,
      });
      trackEvent("quiz_step", { step_id: step.id, q: qNum });
    }
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(i: number) {
    if (i < 0) return;
    navigate({ to: "/criar", search: { step: QUIZ_FLOW[i].id } });
  }
  const goNext = () => {
    const n = nextVisibleIndex(QUIZ_FLOW, idx, respostas, QUIZ_SKIP);
    if (n === -1) return; // fim → tratado na revisão
    goTo(n);
  };
  const goPrev = () => goTo(prevVisibleIndex(QUIZ_FLOW, idx, respostas, QUIZ_SKIP));

  // "Continuar" habilitado?
  const canAdvance = (() => {
    if (isQuestion(step)) {
      const v = respostas[step.field];
      if (step.input === "chips")
        return Array.isArray(v) ? v.length > 0 : Boolean(v);
      if (step.input === "text")
        return step.id === "recado" || Boolean((v as string)?.trim()); // recado é opcional
      if (step.input === "story") return storyIsValid(step, v as string);
    }
    if (isContact(step)) return /.+@.+\..+/.test(email ?? "");
    return true;
  })();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-6">
      {/* Header: voltar + progresso */}
      <div className="mb-8 flex items-center gap-3">
        {idx > 0 && (
          <button onClick={goPrev} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <Progress value={qNum ? (qNum / total) * 100 : 4} className="flex-1" />
        {isQuestion(step) && (
          <span className="text-xs text-muted-foreground">
            {qNum}/{total}
          </span>
        )}
      </div>

      {/* Corpo do passo */}
      <div className="flex flex-1 flex-col justify-center">
        {isQuestion(step) && (
          <div className="space-y-6 text-center">
            {step.block && (
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {step.block}
              </p>
            )}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{step.text}</h1>
              {step.subtext && <p className="text-muted-foreground">{step.subtext}</p>}
            </div>

            {step.input === "chips" && (
              <ChipsStep
                step={step}
                value={respostas[step.field]}
                onChange={(v) => setResposta(step.field, v)}
              />
            )}
            {step.input === "text" && (
              <Input
                value={(respostas[step.field] as string) ?? ""}
                onChange={(e) => setResposta(step.field, e.target.value)}
                placeholder={step.placeholder}
                maxLength={step.maxLength}
                className="mx-auto max-w-md text-center"
                autoFocus
              />
            )}
            {step.input === "story" && (
              <StoryStep
                step={step}
                value={respostas[step.field] as string}
                onChange={(v) => setResposta(step.field, v)}
              />
            )}
          </div>
        )}

        {isSocialProof(step) && (
          <div className="space-y-6 text-center">
            <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 shadow-sm">
              {step.eyebrow && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
                  {step.eyebrow}
                </p>
              )}
              {step.testimonial && (
                <p className="text-lg italic leading-relaxed">"{step.testimonial}"</p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              O presente de{" "}
              <strong className="text-foreground">
                {(respostas.nome as string) || "quem você ama"}
              </strong>{" "}
              está começando a nascer.
            </p>
          </div>
        )}

        {isContact(step) && (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{step.text}</h1>
              {step.subtext && <p className="text-muted-foreground">{step.subtext}</p>}
            </div>
            <Input
              type="email"
              inputMode="email"
              value={email ?? ""}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="mx-auto max-w-md text-center"
              autoFocus
            />
          </div>
        )}

        {isReview(step) && <ReviewPlaceholder />}
      </div>

      {/* Rodapé: continuar */}
      {!isReview(step) && (
        <div className="pt-8">
          <Button
            size="lg"
            className="w-full"
            disabled={!canAdvance}
            onClick={isContact(step) ? () => goToReview(navigate) : goNext}
          >
            {isSocialProof(step) ? "Continuar" : isContact(step) ? "Ver minha letra" : "Continuar"}
          </Button>
        </div>
      )}
    </main>
  );
}

function goToReview(navigate: ReturnType<typeof useNavigate>) {
  navigate({ to: "/criar", search: { step: "revisao" } });
}

// Placeholder da revisão — a geração da letra coautorada entra na próxima task.
function ReviewPlaceholder() {
  const respostas = useQuizStore((s) => s.respostas);
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tudo certo?</h1>
      <p className="text-muted-foreground">
        Última conferida antes de escrever a letra.
      </p>
      <div className="mx-auto max-w-md space-y-2 rounded-2xl border bg-card p-6 text-left text-sm">
        {Object.entries(respostas).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b pb-2 last:border-0">
            <span className="text-muted-foreground">{k}</span>
            <span className="text-right font-medium">{Array.isArray(v) ? v.join(", ") : v}</span>
          </div>
        ))}
      </div>
      <Button size="lg" className="w-full" disabled>
        Escrever minha letra grátis (em construção)
      </Button>
    </div>
  );
}
