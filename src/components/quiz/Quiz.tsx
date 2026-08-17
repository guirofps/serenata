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
import { carimbarExperimentos } from "@/lib/experimentos";
import { Variante } from "@/components/Variante";
import { AberturaProva } from "@/components/quiz/AberturaProva";
import { lembrarIdioma } from "@/components/OfereceIdioma";
import { useQuizStore } from "@/lib/quiz-store";
import { sessaoJaPagou } from "@/lib/coautoria";
import { captureLeadProgress } from "@/lib/lead-capture";
import { trackEvent, trackEventOnce } from "@/lib/track";
import {
  getOrCreateSessionId,
  getOrAssignVariant,
  sessaoGasta,
  novaSessao,
} from "@/lib/session-context";
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

// PASSOS QUE NÃO EXISTEM SEM UMA LETRA ANTES.
//
// O passo vive na URL, e a URL sobrevive a tudo: histórico, favorito, aba
// restaurada, link colado pra alguém. Em 7 dias, 40 vezes alguém chegou na
// tela de PAGAMENTO sem ter música nenhuma, e 30 dessas sessões nunca tinham
// nem começado o quiz.
//
// A trava do checkout (`checkout_barrado_sem_musica`) pegava isso no último
// instante, o que é bom, mas tarde: a pessoa já tinha visto um preço e clicado
// em pagar. E a mensagem que ela recebia dizia "volte pra sua letra e ouça
// daqui a dois minutinhos", falando de uma letra que nunca existiu.
//
// Aqui a checagem acontece na ENTRADA da tela, antes de mostrar preço nenhum.
const PRECISAM_DE_LETRA = new Set(["reveal", "oferta"]);

export function Quiz({ locale, stepId }: { locale: Locale; stepId?: string }) {
  const navigate = useNavigate();
  const QUIZ_FLOW = quizFlow(locale);
  const T = t(locale);
  const rota = locale === "es" ? "/es/criar" : "/criar";
  const respostas = useQuizStore((s) => s.respostas);
  const setResposta = useQuizStore((s) => s.setResposta);
  const email = useQuizStore((s) => s.email);
  const setEmail = useQuizStore((s) => s.setEmail);
  const reset = useQuizStore((s) => s.reset);

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
    // PRIMEIRA COISA: quem já comprou nesta sessão começa uma NOVA.
    //
    // A linha de quiz_responses é chaveada por session_id. Sem isto, a segunda
    // música reusa a linha da primeira e sobrescreve as respostas de um
    // presente já pago e já entregue. Em 15/08 um comprador pagou três vezes
    // tentando fazer a segunda e nunca conseguiu: toda volta ao funil caía na
    // sessão da primeira, e cada pagamento só recobrava a mesma música.
    //
    // Roda antes de getOrCreateSessionId pra que todo evento daqui pra frente,
    // inclusive o quiz_started, já saia com o id novo.
    if (sessaoGasta()) {
      novaSessao();
      reset();
    }

    // ENTROU DIRETO NUM PASSO QUE NÃO SE SUSTENTA SOZINHO.
    //
    // O sinal é o NOME da pessoa homenageada, não a letra. A letra ainda pode
    // estar sendo gerada quando o `reveal` monta, então exigir letra aqui
    // derrubaria gente que está no fluxo certo. O nome, não: é a segunda
    // pergunta do quiz, e não existe caminho legítimo até a oferta sem ele.
    //
    // ESPERA A REIDRATAÇÃO. A store é persistida em localStorage e o estado só
    // chega depois da hidratação; ler `respostas` direto aqui devolve `{}` até
    // pra quem preencheu o quiz inteiro. Testado: sem esta espera, o guarda
    // expulsava da oferta uma sessão com nome, e-mail e estilo gravados.
    //
    // `replace: true` pra não empilhar histórico: senão o "voltar" do celular
    // devolve a pessoa exatamente pra tela quebrada de onde ela saiu.
    // O SERVIDOR DECIDE PRA ONDE, NÃO O NAVEGADOR.
    //
    // A primeira versão mandava direto pro passo 1 quando o armazenamento
    // local estava vazio. Em 16/08 isso pegou alguém que tinha a letra PRONTA
    // no servidor e voltou pelo `?step=reveal` 21 minutos depois: o navegador
    // não tinha mais o estado, e o funil mandou a pessoa recomeçar do zero.
    // Ela tentou duas vezes e desistiu.
    //
    // Barrar continua certo (tela de letra sem letra não existe), o destino é
    // que estava errado. Agora são três saídas:
    //   pagou      -> o editor, que é onde está o presente dela
    //   tem letra  -> /retomar, que reidrata a sessão e devolve pro reveal
    //   nada       -> o passo 1, como antes
    const decidirPasso = () => {
      if (!PRECISAM_DE_LETRA.has(stepId ?? "")) return;
      const nome = (useQuizStore.getState().respostas.nome as string)?.trim();
      if (nome) return;
      const sessao = getOrCreateSessionId();
      sessaoJaPagou({ data: { sessionId: sessao } })
        .then((r) => {
          if (r.pago && (r.tokenEdicao || r.token)) {
            trackEvent("passo_sem_contexto", { step: stepId, locale, saida: "editor" });
            window.location.href = `${window.location.origin}${r.tokenEdicao ? `/editar/${r.tokenEdicao}` : `/p/${r.token}`}`;
            return;
          }
          if (r.temLetra) {
            trackEvent("passo_sem_contexto", { step: stepId, locale, saida: "retomar" });
            window.location.href = `${window.location.origin}/retomar?s=${encodeURIComponent(sessao)}`;
            return;
          }
          trackEvent("passo_sem_contexto", { step: stepId, locale, saida: "inicio" });
          navigate({ to: rota, search: { step: QUIZ_FLOW[0]?.id } as never, replace: true });
        })
        .catch(() => {
          // Consulta indisponível: o começo é o destino seguro.
          trackEvent("passo_sem_contexto", { step: stepId, locale, saida: "inicio_por_erro" });
          navigate({ to: rota, search: { step: QUIZ_FLOW[0]?.id } as never, replace: true });
        });
    };
    if (useQuizStore.persist.hasHydrated()) decidirPasso();
    else useQuizStore.persist.onFinishHydration(decidirPasso);

    // COMPRADOR NÃO VÊ PAYWALL, mesmo com o estado local intacto.
    //
    // O caso acima cobre quem chegou SEM estado. Este cobre quem chegou COM:
    // o comprador de 16/08 tinha nome e letra no navegador, voltou pelo
    // histórico, e viu a tela de oferta de novo depois de já ter pago.
    //
    // Só nos passos que mostram preço ou cortam a música. Perguntar isso no
    // passo 1 seria uma ida ao servidor por visita, pra um caso que só existe
    // depois da compra.
    //
    // FALHA ABERTA: se a consulta cair, a pessoa segue no funil normal. Barrar
    // alguém por indisponibilidade seria trocar um problema raro por um pior.
    if (PRECISAM_DE_LETRA.has(stepId ?? "") && (useQuizStore.getState().respostas.nome as string)?.trim()) {
      sessaoJaPagou({ data: { sessionId: getOrCreateSessionId() } })
        .then((r) => {
          if (!r.pago) return;
          trackEvent("funil_comprador_desviado", { step: stepId, locale });
          const destino = r.tokenEdicao
            ? `/editar/${r.tokenEdicao}`
            : r.token
              ? `/p/${r.token}`
              : null;
          if (destino) window.location.href = `${window.location.origin}${destino}`;
        })
        .catch(() => {
          /* indisponível: segue o funil */
        });
    }
    getOrCreateSessionId();
    // ANTES do quiz_started: a atribuição é lida no momento do evento, então
    // carimbar depois deixaria o primeiro evento da sessão — justamente o que
    // marca a entrada no funil — sem a variante.
    carimbarExperimentos();
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
    // VOLTOU pro `min-h-screen` e pro respiro de antes.
    //
    // `100dvh` é tecnicamente melhor: `100vh` no celular é a altura SEM a
    // barra do navegador, então o layout nasce mais alto que a área visível.
    // Mas ele entrou no mesmo deploy que derrubou a passagem da pergunta 1 de
    // 43% pra 14%, e enquanto a causa exata não estiver isolada nada daquele
    // deploy fica de pé. Volta em separado, medindo sozinho.
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
            {/* EXPERIMENTO `abertura`, só no primeiro passo: é lá que 79% vão
                embora sem tocar em nada. Nos outros passos a pessoa já
                respondeu alguma coisa e a prova não tem o mesmo trabalho a
                fazer. Nada é renderizado na variante A. */}
            {idx === 0 && (
              <Variante exp="abertura" v="B">
                <AberturaProva locale={locale} />
              </Variante>
            )}

            {/* NÃO É MAIS STICKY, e a volta é deliberada.
                Prender a pergunta no topo resolvia um problema real (com o
                teclado aberto ela saía da tela). Mas entrou junto com a barra
                de baixo, e as duas juntas derrubaram a passagem da pergunta 1
                pra 2 de 43% pra 14% nas MESMAS campanhas. Com a barra de
                baixo já provada culpada de matar 4 chips, não dá pra afirmar
                que esta aqui é inocente — e o custo de manter uma suspeita no
                ar é maior que o de reabrir um problema conhecido.
                Volta uma coisa de cada vez, medindo. */}
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{preencher(step.text)}</h1>
              {step.subtext && <p className="text-muted-foreground">{preencher(step.subtext)}</p>}
            </div>

            {step.input === "chips" && (
              <ChipsStep
                step={step}
                value={respostas[step.field]}
                onChange={(v) => {
                  setResposta(step.field, v);
                  // O TOQUE NO CHIP, que até agora não era medido.
                  //
                  // 65% dos leads PT e 88% dos ES param no passo 1. Os
                  // números existentes não distinguem os dois casos, que
                  // pedem soluções opostas:
                  //
                  //   escolheu e não tocou em "Continuar"  -> é atrito, e
                  //     sai tirando o segundo toque da frente da pessoa;
                  //   não tocou em nada                    -> é o anúncio ou
                  //     a pergunta, e mexer no botão não muda nada.
                  //
                  // A resposta não estava no banco porque a gravação do lead
                  // só acontece ao ENTRAR num passo: quem escolhe e desiste
                  // nunca chega a persistir a escolha. Uma vez por passo, por
                  // navegador, senão trocar de ideia entre chips vira volume.
                  trackEventOnce("quiz_respondeu", step.id, {
                    step_id: step.id,
                    q: qNum,
                  });

                  // VARIANTE B: escolher JÁ avança, sem o segundo toque.
                  //
                  // Hoje a pessoa toca no chip e depois tem que achar e tocar
                  // em "Continuar". Numa lista de 19 opções que ocupa a tela
                  // até 691px, o botão fica a 740px — abaixo de tudo que ela
                  // acabou de ler, e longe do dedo que acabou de escolher.
                  //
                  // Fica em B e não no controle porque esta tela recebe 100%
                  // do tráfego: se eu estiver errado, quero errar em uma
                  // campanha e não no funil inteiro. Liga duplicando uma
                  // campanha com `?f=b` na URL.
                  //
                  // Só em escolha ÚNICA e sem a segunda fileira: em `multi` o
                  // primeiro toque não é a resposta final, e onde existe
                  // `extraChips` (o tom) avançar sozinho pularia um campo que
                  // a pessoa nem viu.
                  const podeAvancar =
                    !step.multi && !step.extraChips && getOrAssignVariant() === "B";
                  // 220ms: tempo de a borda do chip acender. Sem isso a tela
                  // troca no meio do toque e parece falha, não resposta.
                  if (podeAvancar) setTimeout(goNext, 220);
                }}
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

      {/* Rodapé: continuar (some nos passos que têm CTA próprio)

          JÁ FOI STICKY, POR UM DIA, E CUSTOU CARO.
          A ideia era boa no papel: o botão nascia fora da tela em 7 dos 11
          passos, e prendê-lo na base resolvia isso. Só que a barra fica
          desenhada por cima do conteúdo, e com `bg-background/95` a pessoa
          VÊ o que está embaixo dela. Medido no ar, com a tela no topo,
          quatro chips da primeira pergunta (Amiga, Amigo, Pet, Outro)
          ficavam sob a barra: visíveis, e mortos ao toque.

          O número: a passagem da pergunta 1 pra 2 caiu de 43% (08/08, antes)
          pra 33% e depois 14%. O pior defeito de interface é o que parece
          funcionar — a pessoa toca, nada acontece, e ela conclui que o site
          está quebrado.

          Voltou pro fluxo normal. O problema que a sticky tentava resolver é
          real e continua aberto, mas se resolve encurtando a tela, não
          desenhando algo por cima dela. */}
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
      {/* Aqui embaixo não existe nada clicável (a lista de respostas é texto),
          então esta barra não podia estar matando toque nenhum. Voltou mesmo
          assim: enquanto a causa da queda não estiver isolada, NADA daquele
          deploy fica de pé. Meia reversão não prova nada.

          O rótulo continua vindo do dicionário: era a única coisa daquele
          commit que consertava um bug de verdade (a revisão espanhola exibia
          "Escrever minha letra grátis" em português). */}
      <Button size="lg" className="cta w-full rounded-full border-0" onClick={onGerar}>
        {T.escreverLetra}
      </Button>
    </div>
  );
}
