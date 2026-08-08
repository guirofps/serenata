import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
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
import { quizFlow, QUIZ_SKIP } from "@/lib/quiz-flow";
import { type Locale, TAG_IDIOMA } from "@/lib/i18n";
import { t } from "@/lib/textos";
import { sugerirEmail } from "@/lib/email-typo";
import { lembrarIdioma } from "@/components/OfereceIdioma";
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

export function Quiz({ locale, stepId }: { locale: Locale; stepId?: string }) {
  const navigate = useNavigate();
  const QUIZ_FLOW = quizFlow(locale);
  const T = t(locale);
  const rota = locale === "es" ? "/es/criar" : "/criar";
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
    // Guarda em que idioma esta pessoa entrou no funil. É o que permite
    // oferecer o caminho certo quando ela voltar pelo domínio raiz.
    lembrarIdioma(locale);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Captura parcial de lead a cada passo alcançado (vantagem competitiva).
  useEffect(() => {
    if (isQuestion(step) || isContact(step)) {
      captureLeadProgress({
        currentStep: passoFunil || idx,
        furthestStep: passoFunil || idx,
        respostas,
        email,
        locale,
      });
      trackEvent("quiz_step", { step_id: step.id, q: qNum });
    }
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(i: number) {
    if (i < 0) return;
    navigate({ to: rota, search: { step: QUIZ_FLOW[i].id } } as never);
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
        <FaixaPresente nome={respostas.nome as string | undefined} locale={locale} />
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
                respostas={respostas}
                onChangeExtra={setResposta}
              />
            )}
            {step.input === "text" &&
              (step.eco || step.cortarComposto || step.extra || step.triggers ? (
                // Campos que precisam mostrar como o valor sai no produto
                // (hoje só o nome, que é cantado literalmente).
                <CampoNome
                  step={step}
                  value={respostas[step.field] as string}
                  onChange={(v) => setResposta(step.field, v)}
                  respostas={respostas}
                  onChangeExtra={setResposta}
                  preencher={(s) => preencher(s) ?? s}
                  locale={locale}
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
                locale={locale}
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
                {T.reacoesLegenda}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {T.oPresenteDe}{" "}
              <strong className="text-foreground">
                {(respostas.nome as string) || T.quemVoceAma}
              </strong>{" "}
              {T.estaNascendo}
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
              placeholder={T.emailPlaceholder}
              className="mx-auto max-w-md text-center"
              autoFocus
            />

            {/*
              E-MAIL DIGITADO ERRADO, corrigido a um toque.

              9,2% da base tem endereço que não existe: `gmail.comm`,
              `gmail.co`, `gmail.com.br`, um caso com o telefone colado no
              fim. A validação daqui era `/.+@.+\..+/`, que aprova tudo isso.

              O custo não é o e-mail de recuperação que não chega — é que o
              e-mail é o ÚNICO canal do produto. Quem digita errado e compra
              paga, não recebe a música, não recebe o link de acesso, e não
              tem como reclamar. Até agora nenhum comprador caiu nisso, o que
              é sorte e não desenho.

              SUGERE, não bloqueia. O palpite acerta em tudo que testamos, mas
              domínio de empresa é imprevisível, e travar o botão de quem
              digitou certo custa a venda inteira. Aqui a pessoa lê, decide, e
              corrige com um toque.
            */}
            {(() => {
              const sugestao = sugerirEmail(email ?? "");
              if (!sugestao || sugestao === (email ?? "").trim().toLowerCase()) return null;
              return (
                <button
                  type="button"
                  onClick={() => {
                    setEmail(sugestao);
                    trackEvent("email_typo_corrigido", { de: email, para: sugestao });
                  }}
                  className="mx-auto block rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted/70"
                >
                  {T.emailQuisDizer}{" "}
                  <strong className="font-semibold text-foreground underline underline-offset-4">
                    {sugestao}
                  </strong>
                  ?
                </button>
              );
            })()}
          </div>
        )}

        {isReview(step) && (
          <ReviewScreen locale={locale} onGerar={() => navigate({ to: rota, search: { step: "reveal" } } as never)} />
        )}

        {isReveal(step) && <RevealStep locale={locale} />}

        {isOferta(step) && (
          <TelaOferta
            locale={locale}
            aoVoltar={() => navigate({ to: rota, search: { step: "reveal" } } as never)}
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
            onClick={
              isContact(step)
                ? () => {
                    // O E-MAIL SÓ EXISTE AQUI.
                    //
                    // A captura de lead roda no useEffect da TROCA de passo,
                    // ou seja, quando a pessoa CHEGA no contato — com o campo
                    // ainda vazio. Ela digita, clica, e vai pra revisão, que
                    // não é question nem contact e não dispara captura
                    // nenhuma. O e-mail digitado nunca era gravado.
                    //
                    // Medido em 07/08: de 150 pessoas que chegaram neste
                    // passo, só 65 (43%) tinham e-mail no banco. Os 43% eram
                    // quem voltava pro passo e refazia o efeito. As outras 85
                    // digitaram e a gente perdeu — e é exatamente a lista de
                    // quem abandona o checkout.
                    captureLeadProgress({
                      currentStep: passoFunil,
                      furthestStep: passoFunil,
                      respostas,
                      email,
                      locale,
                    });
                    navigate({ to: rota, search: { step: "revisao" } } as never);
                  }
                : goNext
            }
          >
            {isContact(step) ? T.verMinhaLetra : T.continuar}
          </Button>
        </div>
      )}
    </main>
  );
}

// Revisão editável. Os rótulos vivem no dicionário (`textos.ts`).

function ReviewScreen({ locale, onGerar }: { locale: Locale; onGerar: () => void }) {
  const respostas = useQuizStore((s) => s.respostas);
  const T = t(locale);
  const ordem = ["relacao", "nome", "filhos", "ocasiao", "estilo", "voz", "historia1", "historia2", "recado"];
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{T.tudoCerto}</h1>
        <p className="text-muted-foreground">{T.ultimaConferida}</p>
      </div>
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border bg-card p-6 text-left text-sm">
        {ordem
          .filter((k) => respostas[k])
          .map((k) => (
            <div key={k} className="border-b pb-3 last:border-0 last:pb-0">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {T.rotulos[k] ?? k}
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
