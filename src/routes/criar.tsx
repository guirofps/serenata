import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { z } from "zod";
import {
  isQuestion,
  isContact,
  isReview,
  isReveal,
  isOferta,
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
import { FaixaPresente } from "@/components/quiz/FaixaPresente";
import { CampoNome } from "@/components/quiz/CampoNome";
import { TelaOferta } from "@/components/quiz/TelaOferta";
import { StoryStep, storyIsValid } from "@/components/quiz/StoryStep";
import { RevealStep } from "@/components/quiz/RevealStep";
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
  // Personaliza os títulos com o nome já dado (truque do HeartMoments: usar o
  // nome nos passos seguintes aumenta o compromisso). Fallback "essa pessoa"
  // cobre navegação direta por URL sem ter passado pelo passo do nome — e o
  // nome ainda resolve o gênero (ela/ele) de brinde.
  const nomePessoa = (respostas.nome as string)?.trim() || "essa pessoa";
  const preencher = (s?: string) => s?.replace(/\{nome\}/g, nomePessoa);
  const qNum = questionNumber(QUIZ_FLOW, idx);
  // Posição no FUNIL (não é o mesmo que o número da pergunta): o passo de
  // contato vem depois da última pergunta e precisa de um número próprio,
  // senão ele reporta o mesmo da última pergunta e o painel mostra
  // "0 completaram" mesmo com gente chegando ao fim.
  const passoFunil = isContact(step) ? total + 1 : qNum;

  useEffect(() => {
    getOrCreateSessionId();
    trackEventOnce("quiz_started", "v1");
  }, []);

  // Captura parcial de lead a cada passo alcançado (vantagem competitiva).
  useEffect(() => {
    if (isQuestion(step) || isContact(step)) {
      captureLeadProgress({
        currentStep: passoFunil || idx,
        furthestStep: passoFunil || idx,
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
        return Boolean(step.opcional) || Boolean((v as string)?.trim());
      if (step.input === "story") return storyIsValid(step, v as string);
    }
    if (isContact(step)) return /.+@.+\..+/.test(email ?? "");
    return true;
  })();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-6">
      {/* Header: voltar + progresso */}
      <div className="mb-4 flex items-center gap-3">
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

      {/* O entregável, visível o quiz inteiro. Some na revelação (que já
          mostra o presente de verdade) e na oferta (que lista tudo item por
          item logo abaixo: repetir ali era só ruído). */}
      {!isReveal(step) && !isOferta(step) && (
        <FaixaPresente nome={respostas.nome as string | undefined} />
      )}

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
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{preencher(step.text)}</h1>
              {step.subtext && <p className="text-muted-foreground">{preencher(step.subtext)}</p>}
            </div>

            {step.input === "chips" && (
              <ChipsStep
                step={step}
                value={respostas[step.field]}
                onChange={(v) => setResposta(step.field, v)}
              />
            )}
            {step.input === "text" &&
              (step.eco || step.cortarComposto ? (
                // Campos que precisam mostrar como o valor sai no produto
                // (hoje só o nome, que é cantado literalmente).
                <CampoNome
                  step={step}
                  value={respostas[step.field] as string}
                  onChange={(v) => setResposta(step.field, v)}
                />
              ) : (
                <Input
                  value={(respostas[step.field] as string) ?? ""}
                  onChange={(e) => setResposta(step.field, e.target.value)}
                  placeholder={step.placeholder}
                  maxLength={step.maxLength}
                  className="mx-auto max-w-md text-center"
                  autoFocus
                />
              ))}
            {step.input === "story" && (
              <StoryStep
                step={step}
                value={respostas[step.field] as string}
                onChange={(v) => setResposta(step.field, v)}
                preencher={(s) => preencher(s) ?? s}
                aoPular={goNext}
              />
            )}
          </div>
        )}

        {isSocialProof(step) && (
          <div className="space-y-6 text-center">
            <div className="mx-auto max-w-md">
              {step.eyebrow && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                  {step.eyebrow}
                </p>
              )}
              {step.testimonial && (
                <p className="mb-4 text-lg leading-relaxed">{step.testimonial}</p>
              )}
              {/* Vídeo REAL de quem ouviu uma música feita por nós. Mudo e sem
                  controles: emociona sem competir com o quiz nem virar um
                  player que desvia a atenção. */}
              <div
                className="overflow-hidden rounded-2xl"
                style={{ boxShadow: "0 24px 50px -24px rgba(42,21,24,0.45)" }}
              >
                <video
                  src="/video/reacoes.mp4"
                  poster="/video/reacoes-poster.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="block w-full"
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Reações de quem ouviu uma música feita por nós.
              </p>
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
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{preencher(step.text)}</h1>
              {step.subtext && <p className="text-muted-foreground">{preencher(step.subtext)}</p>}
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

        {isReview(step) && (
          <ReviewScreen onGerar={() => navigate({ to: "/criar", search: { step: "reveal" } })} />
        )}

        {isReveal(step) && <RevealStep />}

        {isOferta(step) && (
          <TelaOferta
            aoVoltar={() => navigate({ to: "/criar", search: { step: "reveal" } })}
          />
        )}
      </div>

      {/* Rodapé: continuar (some nos passos que têm CTA próprio) */}
      {!isReview(step) && !isReveal(step) && !isOferta(step) && (
        <div className="pt-8">
          <Button
            size="lg"
            className="cta w-full rounded-full border-0"
            disabled={!canAdvance}
            onClick={isContact(step) ? () => navigate({ to: "/criar", search: { step: "revisao" } }) : goNext}
          >
            {isContact(step) ? "Ver minha letra" : "Continuar"}
          </Button>
        </div>
      )}
    </main>
  );
}

// Revisão editável (rótulos legíveis). "Editar" por linha entra no polimento.
const ROTULO: Record<string, string> = {
  relacao: "Pra quem",
  nome: "Nome",
  filhos: "Filhos citados",
  ocasiao: "Ocasião",
  estilo: "Estilo",
  voz: "Voz",
  historia1: "Sobre ela(e)",
  historia2: "Uma memória",
  recado: "Sua frase",
};

function ReviewScreen({ onGerar }: { onGerar: () => void }) {
  const respostas = useQuizStore((s) => s.respostas);
  const ordem = ["relacao", "nome", "filhos", "ocasiao", "estilo", "voz", "historia1", "historia2", "recado"];
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Tudo certo?</h1>
        <p className="text-muted-foreground">Última conferida antes de escrever a letra.</p>
      </div>
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border bg-card p-6 text-left text-sm">
        {ordem
          .filter((k) => respostas[k])
          .map((k) => (
            <div key={k} className="border-b pb-3 last:border-0 last:pb-0">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {ROTULO[k] ?? k}
              </span>
              <p className="mt-0.5 font-medium">
                {Array.isArray(respostas[k]) ? (respostas[k] as string[]).join(", ") : (respostas[k] as string)}
              </p>
            </div>
          ))}
      </div>
      <Button size="lg" className="cta w-full rounded-full border-0" onClick={onGerar}>
        Escrever minha letra grátis
      </Button>
    </div>
  );
}
