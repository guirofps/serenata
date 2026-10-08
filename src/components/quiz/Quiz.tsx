import { useNavigate } from "@tanstack/react-router";
import { emailPlausivel } from "@/lib/email-limpo";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  isIntro,
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
import { quizFlow, skipDoFluxo } from "@/lib/quiz-flow";
import { aplicarTipo, numeroCanonico } from "@/lib/quiz-flow-gospel";
import { carimbarTema, idiomaTemTema, temaEfetivo, type Tema } from "@/lib/tema";
import { type Locale, TAG_IDIOMA, caminho } from "@/lib/i18n";
import { t } from "@/lib/textos";
import { sugerirEmail } from "@/lib/email-typo";
import { carimbarExperimentos, varianteDe } from "@/lib/experimentos";
import { dominioRecebeEmail } from "@/lib/dominio-email";
import { AberturaPresente } from "@/components/quiz/AberturaPresente";
import { lembrarIdioma } from "@/components/OfereceIdioma";
import { useQuizStore } from "@/lib/quiz-store";
import { sessaoJaPagou } from "@/lib/coautoria";
import { captureLeadProgress } from "@/lib/lead-capture";
import { barraSobeComTeclado, subidaDaBarra } from "@/lib/barra-teclado";
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
import { StoryStep, storyIsValid, validateStory } from "@/components/quiz/StoryStep";
import { RevealStep } from "@/components/quiz/RevealStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft } from "lucide-react";
import { SugestoesDominio } from "@/components/quiz/SugestoesDominio";
import { DepoimentoContato } from "@/components/quiz/DepoimentoContato";
import { Variante } from "@/components/Variante";
import { EXP_PROVA_BLOCOS } from "@/lib/experimentos";
import { SorteioSemanal } from "@/components/quiz/SorteioSemanal";

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

/** Tem com o que montar a revelação/oferta: o nome, ou a letra DESTA sessão. */
function temContexto(): boolean {
  const st = useQuizStore.getState();
  if ((st.respostas.nome as string)?.trim()) return true;
  return Boolean(st.letraFinal && st.letraFinal.sessionId === getOrCreateSessionId());
}

// A trava de laço do guarda acima: 2 minutos por sessão, na aba.
const CHAVE_RETOMADA = "mp_retomada";
function retomouHaPouco(sessao: string): boolean {
  try {
    const [s, t] = (sessionStorage.getItem(CHAVE_RETOMADA) ?? "").split("|");
    return s === sessao && Date.now() - Number(t) < 120_000;
  } catch {
    return false;
  }
}
function marcarRetomada(sessao: string) {
  try {
    sessionStorage.setItem(CHAVE_RETOMADA, `${sessao}|${Date.now()}`);
  } catch {
    // Sem sessionStorage: segue sem trava, como era.
  }
}

export function Quiz({
  locale,
  stepId,
  temaUrl = null,
}: {
  locale: Locale;
  stepId?: string;
  /** `?t=` da URL, só na primeira tela: depois o tema vive em `respostas.tema`. */
  temaUrl?: Tema | null;
}) {
  const navigate = useNavigate();
  const respostas = useQuizStore((s) => s.respostas);
  const setResposta = useQuizStore((s) => s.setResposta);
  const setRespostas = useQuizStore((s) => s.setRespostas);
  const email = useQuizStore((s) => s.email);
  const setEmail = useQuizStore((s) => s.setEmail);
  const reset = useQuizStore((s) => s.reset);
  // O TEMA (gospel). A URL decide a primeira tela, inclusive no servidor; do
  // passo 2 em diante o `?t=` some da URL e quem segura é `respostas.tema`.
  const tema = temaEfetivo(temaUrl, respostas, locale);
  const QUIZ_FLOW = quizFlow(locale, tema);
  const SKIP = skipDoFluxo(tema);
  const T = t(locale);
  const rota = caminho("/criar", locale);

  const idx = indexOfId(QUIZ_FLOW, stepId);
  const step = QUIZ_FLOW[idx];
  // O total é o do funil NORMAL mesmo no gospel: é a escala que o banco
  // guarda em `furthest_step` e que o painel lê.
  const total = useMemo(() => totalQuestions(quizFlow(locale)), []);
  // Personaliza os títulos com o nome já dado (truque do HeartMoments: usar o
  // nome nos passos seguintes aumenta o compromisso). Fallback "essa pessoa"
  // cobre navegação direta por URL sem ter passado pelo passo do nome — e o
  // nome ainda resolve o gênero (ela/ele) de brinde.
  // O FALLBACK TEM IDIOMA. Estava cravado em "essa pessoa", e ele entra em
  // TODO enunciado que usa `{nome}` — "Contame una pavada de essa pessoa" foi
  // o que apareceu na tela ao abrir `/es/criar?step=historia2` direto. É o
  // caminho de quem volta pelo histórico ou por link, exatamente a pessoa que
  // menos pode ver o site tropeçar.
  const nomePessoa =
    (respostas.nome as string)?.trim() ||
    (locale === "es" ? "esa persona" : locale === "en" ? "this person" : "essa pessoa");
  const preencher = (s?: string) => s?.replace(/\{nome\}/g, nomePessoa);
  // No gospel, o número do passo normal de mesmo campo (`numeroCanonico`):
  // o `tipo` vale 0 como a abertura, e o louvor pula de 0 pra 3 em vez de
  // gravar números que no funil normal querem dizer outra pergunta.
  const qNum = tema ? numeroCanonico(quizFlow(locale), step) : questionNumber(QUIZ_FLOW, idx);
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
    //
    // O CONTEXTO É O NOME **OU** A LETRA DESTA SESSÃO (08/10). Só o nome não
    // basta: há sessões com letra pronta e `nome` vazio no servidor, e o
    // /retomar reidrata exatamente isso. O guarda olhava só o nome, mandava pro
    // /retomar, que devolvia pro reveal sem nome, que mandava pro /retomar...
    // Em 7 dias, 19 sessões presas nesse laço (uma girou 8.302 vezes em 3
    // dias), justamente quem clicou no e-mail pra ouvir a música.
    const decidirPasso = () => {
      if (!PRECISAM_DE_LETRA.has(stepId ?? "")) return;
      if (temContexto()) return;
      const sessao = getOrCreateSessionId();
      sessaoJaPagou({ data: { sessionId: sessao } })
        .then((r) => {
          if (r.pago && (r.tokenEdicao || r.token)) {
            trackEvent("passo_sem_contexto", { step: stepId, locale, saida: "editor" });
            window.location.href = `${window.location.origin}${r.tokenEdicao ? `/editar/${r.tokenEdicao}` : `/p/${r.token}`}`;
            return;
          }
          // Trava de laço: se o /retomar já devolveu esta sessão há pouco e ela
          // continua sem contexto, mandar de novo só repete o giro.
          if (r.temLetra && !retomouHaPouco(sessao)) {
            trackEvent("passo_sem_contexto", { step: stepId, locale, saida: "retomar" });
            marcarRetomada(sessao);
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
    if (PRECISAM_DE_LETRA.has(stepId ?? "") && temContexto()) {
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
    // O tema vem antes do quiz_started pelo mesmo motivo da variante: o
    // primeiro evento da sessão é o que marca a entrada no funil.
    if (temaUrl && idiomaTemTema(locale)) carimbarTema(temaUrl);
    carimbarExperimentos();
    trackEventOnce("quiz_started", "v1");
    // Guarda em que idioma esta pessoa entrou no funil. É o que permite
    // oferecer o caminho certo quando ela voltar pelo domínio raiz.
    lembrarIdioma(locale);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Grava o tema nas respostas (é o que segura o gospel do passo 2 em diante e
  // leva o tema ao prompt) e na atribuição de quem o trouxe salvo. Depois do
  // efeito de montagem de propósito: lá o `reset()` de sessão gasta apagaria.
  // A comparação evita o `setResposta`, que zera a letra já escrita.
  // ESPERA A REIDRATAÇÃO, como o `decidirPasso` acima: gravar antes e a store
  // persistida chegar depois apagaria o tema, e o quiz viraria o normal no
  // passo 2, quando o `?t=` já saiu da URL.
  useEffect(() => {
    if (!tema) return;
    const gravar = () => {
      if (useQuizStore.getState().respostas.tema !== tema) setResposta("tema", tema);
      carimbarTema(tema);
    };
    if (useQuizStore.persist.hasHydrated()) gravar();
    else return useQuizStore.persist.onFinishHydration(gravar);
  }, [tema]); // eslint-disable-line react-hooks/exhaustive-deps

  // Captura parcial de lead a cada passo alcançado (vantagem competitiva).
  useEffect(() => {
    // O `tipo` do gospel (qNum 0) é tratado como a abertura: mede, não grava
    // lead — senão ele gravaria o passo 1, que no banco quer dizer "pra quem".
    if ((isQuestion(step) && qNum > 0) || isContact(step)) {
      captureLeadProgress({
        currentStep: passoFunil || idx,
        furthestStep: passoFunil || idx,
        respostas,
        email,
        locale,
      });
      trackEvent("quiz_step", { step_id: step.id, q: qNum });
      setAvisoBloqueio(false);
    }
    // A ABERTURA é medida, mas NÃO grava lead.
    //
    // `captureLeadProgress` de propósito fica de fora: se a abertura criasse
    // linha em `quiz_responses`, o passo 1 do funil no banco passaria a
    // significar "viu a tela de abertura" e todo número histórico ficaria
    // incomparável da noite pro dia. A numeração continua a mesma; a tela
    // nova aparece só em `funnel_events`, que é onde ela precisa aparecer
    // pra responder se ela ajuda ou atrapalha.
    if (isIntro(step) || (isQuestion(step) && qNum === 0)) {
      trackEvent("quiz_step", { step_id: step.id, q: 0 });
    }
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(i: number) {
    if (i < 0) return;
    navigate({ to: rota, search: { step: QUIZ_FLOW[i].id } } as never);
  }
  const goNext = () => {
    // As respostas DA STORE, não as do render: o avanço automático da variante
    // B chama isto no mesmo toque que grava a resposta, e no `tipo` do gospel
    // é a resposta que decide o próximo passo (louvor pula "pra quem").
    const n = nextVisibleIndex(QUIZ_FLOW, idx, useQuizStore.getState().respostas, SKIP);
    if (n === -1) return; // fim → tratado na revisão
    goTo(n);
  };
  const goPrev = () => goTo(prevVisibleIndex(QUIZ_FLOW, idx, useQuizStore.getState().respostas, SKIP));

  // ── POR QUE O BOTAO NAO AVANCOU ───────────────────────────────
  //
  // O dono relatou em 31/08 que o "continuar" as vezes exige dois, tres,
  // quatro toques, de forma aleatoria. O botao era `disabled` quando a
  // resposta ainda nao valia — e botao desabilitado nao dispara evento
  // nenhum: o toque some sem deixar rastro, no navegador e no painel.
  //
  // Duas mudancas, uma de produto e uma de medicao:
  //   - ele para de ser `disabled` e passa a EXPLICAR. Continua com cara de
  //     inativo, mas responde ao toque dizendo o que falta.
  //   - todo toque que nao avanca vira `continuar_bloqueado`, com o passo.
  //     Sem isso a gente continua adivinhando; com isso, uma hora de trafego
  //     responde se e validacao, se e um passo especifico, ou se e outra
  //     coisa.
  const [avisoBloqueio, setAvisoBloqueio] = useState(false);
  // TESTE `email_confirma` (30/09): B confere o domínio no DNS e mostra o
  // e-mail grande antes de seguir. 97 de 112 compradores com e-mail que
  // voltou tinham o domínio certo e o erro ANTES do @, que só a pessoa lendo
  // o próprio endereço pega.
  const [confirmarEmail, setConfirmarEmail] = useState<{ email: string; recebe: boolean; dominio: string | null } | null>(null);
  const [conferindoEmail, setConferindoEmail] = useState(false);

  // O TECLADO ESTÁ COBRINDO O BOTÃO?
  //
  // A barra do rodapé é `sticky bottom-0`, e sticky se ancora no viewport de
  // LAYOUT. O teclado encolhe só o VISUAL. Nos passos de digitar, isso deixa o
  // botão embaixo do teclado: o primeiro toque fecha o teclado e só o segundo
  // alcança o botão. É a explicação que sobrou depois que `continuar_bloqueado`
  // deu zero (toque que chega registra) e que o clique sintético local avançou
  // sempre de primeira (não é estado atrasado nem `disabled`).
  //
  // O `interactive-widget=resizes-content` do `__root` resolve no Chrome
  // Android encolhendo o layout junto. O iOS ignora esse atributo, e é por isso
  // que a medição fica: sem ela, "consertei" seria palpite pra metade do
  // tráfego. Se este evento continuar aparecendo depois do deploy, o que sobra
  // é iOS e o conserto é outro (reposicionar pelo `visualViewport`).
  //
  // 08/10: o evento continuou (~15% das sessões nos passos de digitar) e o dono
  // reproduziu no iPhone. O conserto do iOS mora aqui embaixo, ligado por
  // aparelho até ser conferido (`barra-teclado.ts`).
  const barraRef = useRef<HTMLDivElement | null>(null);
  const corpoRef = useRef<HTMLDivElement | null>(null);
  const subidaRef = useRef(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sobe = barraSobeComTeclado();
    const conferir = () => {
      const barra = barraRef.current;
      if (!barra) return;
      if (sobe) {
        const subida = subidaDaBarra({
          fimDaBarra: barra.getBoundingClientRect().bottom,
          subidaAtual: subidaRef.current,
          visivelTopo: vv.offsetTop,
          visivelAltura: vv.height,
        });
        if (subida !== subidaRef.current) {
          subidaRef.current = subida;
          barra.style.transform = subida ? `translateY(-${subida}px)` : "";
        }
        return;
      }
      // Sem teclado aberto não há o que medir: 1px de folga absorve o
      // arredondamento de zoom que alguns aparelhos reportam.
      if (vv.height >= window.innerHeight - 1) return;
      const r = barra.getBoundingClientRect();
      const fimVisivel = vv.offsetTop + vv.height;
      // 24px e nao 1: a primeira versao disparava com 1, 4 e 5 pixels, que e
      // arredondamento do `visualViewport` e nao teclado. Das 8 leituras da
      // primeira hora, SETE eram esse ruido e uma era real (330px, no
      // historia2). Um limiar que acende com sub-pixel nao mede nada — 24px e
      // meia altura de dedo, abaixo disso ninguem erra o alvo por causa disso.
      if (r.bottom > fimVisivel + 24) {
        trackEventOnce("botao_atras_do_teclado", step.id, {
          step_id: step.id,
          coberto_px: Math.round(r.bottom - fimVisivel),
        });
      }
    };
    vv.addEventListener("resize", conferir);
    vv.addEventListener("scroll", conferir);
    return () => {
      vv.removeEventListener("resize", conferir);
      vv.removeEventListener("scroll", conferir);
      // A barra é a mesma entre passos: a subida de um não pode vazar pro próximo.
      if (barraRef.current) barraRef.current.style.transform = "";
      subidaRef.current = 0;
    };
  }, [step.id]);

  // POR QUE ELE NAO AVANCOU, com nome.
  //
  // Medido em 31/08, na primeira hora do evento `continuar_bloqueado`: cinco
  // toques em SEIS segundos no passo do contato, mais dois no historia2 e dois
  // no ocasiao. E o "botao esquisito, as vezes preciso clicar 2 ou 3 vezes".
  //
  // Nao e o botao: e a validacao recusando sem dizer o motivo. No contato e
  // pior que mudo, e enganoso — a pessoa RESPONDEU, o e-mail dela e que nao
  // passa no teste, e a tela responde "responde essa pra continuar".
  //
  // O `validateStory` ja dizia o que faltava (inclusive quantos caracteres);
  // o que faltava era chips, contato e texto terem a mesma cortesia.
  function seguirDoContato() {
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

  async function abrirConfirmacaoEmail() {
    if (conferindoEmail) return;
    const alvo = (email ?? "").trim();
    setConferindoEmail(true);
    let r = { recebe: true, dominio: null as string | null };
    try {
      r = await dominioRecebeEmail({ data: { email: alvo } });
    } catch {
      // Falha aberta: sem a consulta, só a confirmação visual.
    }
    setConferindoEmail(false);
    // Fecha o teclado: a folha de confirmação é a próxima coisa a ler.
    (document.activeElement as HTMLElement | null)?.blur?.();
    setConfirmarEmail({ email: alvo, recebe: r.recebe, dominio: r.dominio });
    trackEvent("email_confirma_mostrou", { recebe: r.recebe, locale });
  }

  function motivoBloqueio(): string {
    if (isContact(step)) {
      return (email ?? "").trim() ? T.bloqueioEmailErrado : T.bloqueioEmailVazio;
    }
    if (isQuestion(step)) {
      const v = respostas[step.field];
      if (step.input === "chips") return T.bloqueioChips;
      if (step.input === "story") return validateStory(step, v as string, locale).message;
      if (step.input === "text") return T.bloqueioTexto;
    }
    return T.faltaResponder;
  }

  // Levar a pessoa ATE o problema, e nao so contar dela. Um aviso de 12px
  // embaixo do botao e facil de nao ver com o polegar em cima dele; o campo
  // ganhando foco rola a tela e abre o teclado no lugar certo.
  function mostrarOndeFalta() {
    const campo = corpoRef.current?.querySelector<HTMLElement>("input, textarea");
    if (campo) campo.focus();
    else corpoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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
    if (isContact(step)) return emailPlausivel(email ?? "");
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
    // `px-3` e não `px-4`: 8px a mais de linha útil no celular.
    //
    // Veio da abertura, onde o título de 30px precisava de 360px pra fechar
    // em duas linhas e só tinha 343. Mas serve o quiz inteiro — é largura de
    // texto e de chip numa tela de 375px, onde ela é o recurso escasso.
    // `py-6` intocado: o problema era horizontal.
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-3 py-6">
      {/* Header: voltar + progresso.

          Some na ABERTURA: uma barra de progresso vazia antes da primeira
          pergunta anuncia "isto é um formulário de 8 etapas" exatamente no
          instante em que a tela está tentando dizer o contrário. O progresso
          começa a existir quando existe progresso. */}
      {!isIntro(step) && (
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
      )}

      {/* O entregável — visível até a pergunta 3, e não mais o quiz inteiro.
          Ele existe pra lembrar do prêmio quem ainda não sabe o que ganha
          (medido em 01/08: de 119 que entram, 29 chegam na letra). Nas três
          primeiras telas — relação, nome, ocasião — isso vale a altura que
          custa. Da 4 em diante não: quem chegou ali já leu a faixa três
          vezes, e as telas ficam pesadas justo quando o conteúdo cresce
          (estilo tem 13 chips mais a fileira de tom, e as de história pedem
          150 caracteres). A faixa passa a disputar espaço com a resposta.

          `qNum < 4` é cumulativo, então cobre também os passos que não são
          pergunta: `prova1` fica com 3 (aparece, ainda é o começo) e contato,
          revisão, revelação e oferta ficam com 8 (somem). A revelação e a
          oferta já sumiam por regra própria — a oferta lista tudo item por
          item logo abaixo, e repetir ali era ruído.

          A ABERTURA continua de fora por outro motivo: lá o presente aparece
          inteiro e animado, e a faixa seria a versão pobre da mesma
          informação, dez centímetros acima. */}
      {!isIntro(step) && qNum < 4 && (
        <FaixaPresente nome={respostas.nome as string | undefined} locale={locale} louvor={respostas.tipo === "louvor"} />
      )}

      {/* Corpo do passo */}
      <div ref={corpoRef} className="flex flex-1 flex-col justify-center">
        {isIntro(step) && locale === "en" && <MedirAbertura />}
        {isIntro(step) && (
          <AberturaPresente
            locale={locale}
            tema={tema}
            aoComecar={() => {
              // ── COMEÇAR DE NOVO COM UMA LETRA PRONTA É MÚSICA NOVA (04/10) ──
              //
              // Desde 30/09 a sessão de quem tem letra e não comprou vale 7
              // dias (pra não perder a prévia que ouviu). O efeito colateral:
              // quem começava OUTRA música nesse prazo caía na mesma linha de
              // `quiz_responses`, as respostas novas sobrescreviam as da
              // primeira, e a segunda música nunca era gerada (a primeira já
              // existia). Giovana e Killyngue, 02-03/10: capa com o nome de um
              // e letra do outro. Tocar em "começar" na abertura com uma letra
              // já pronta é pedir uma música nova: sessão nova, e a primeira
              // fica intacta, com o /retomar e a régua de e-mails dela.
              if (useQuizStore.getState().letraFinal) {
                novaSessao();
                reset();
                if (tema) setResposta("tema", tema);
                trackEventOnce("quiz_started", "v1");
              }
              // O clique é a métrica desta tela. `quiz_step` diz quantos
              // CHEGARAM na abertura; este diz quantos ela convenceu.
              trackEvent("abertura_comecar", { locale, ...(tema ? { tema } : {}) });
              goNext();
            }}
          />
        )}

        {isQuestion(step) && (
          <div className="space-y-6 text-center">
            {/* O RÓTULO VERMELHO DO BLOCO ("PRA QUEM", "A OCASIÃO") SAIU.
                Ele dava dois títulos a cada tela: um olho vermelho em caixa
                alta e, logo abaixo, a pergunta de verdade. Duas linhas
                disputando o mesmo trabalho, e a de cima não é a que importa —
                quem chega quer ler a PERGUNTA, não saber em que capítulo do
                formulário está. Sem ele a pergunta sobe e ganha a tela.

                O campo `block` continua no `quiz-flow` de propósito: ele
                registra o agrupamento das perguntas (Pra quem / A ocasião /
                O estilo / A história), que é desenho de funil e não enfeite,
                e volta a ser útil no dia em que o progresso for por seção.
                Ver a nota no `QuestionStep`. */}
            {/* O `AberturaProva` (variante B do experimento `abertura`) ficava
                AQUI, espremido acima da pergunta 1. Saiu porque a tela de
                abertura faz o mesmo trabalho com espaço pra fazer direito, e
                porque `idx === 0` agora é a abertura: o bloco nunca mais
                renderizaria de qualquer forma. O experimento em si continua
                desligado em `experimentos.ts`, e a máquina de A/B intacta. */}

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
                  // O tipo do gospel mexe em vários campos de uma vez
                  // (`aplicarTipo`): louvor preenche Deus, presente desfaz.
                  if (step.field === "tipo") setRespostas(aplicarTipo(useQuizStore.getState().respostas, String(v), locale));
                  else setResposta(step.field, v);
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

            {/* Os domínios a um toque. Vêm ANTES da correção de typo porque
                agem antes do erro: a correção conserta o que saiu torto, isto
                impede que saia. */}
            <SugestoesDominio valor={email ?? ""} onEscolher={setEmail} />

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

            {/* ── ABAIXO DO CAMPO, E SÓ NO FUNIL BRASILEIRO ──────────
                O campo continua sendo a primeira coisa da tela, e a barra do
                "continuar" é `sticky` — então a altura daqui custa rolagem, não
                alcance do botão.

                `pt` apenas, e não por preguiça de traduzir: o sorteio é de uma
                JBL entregue no Brasil, sob regulamento brasileiro, e o
                depoimento é de alguém falando português. Nada disso se resolve
                traduzindo. O funil espanhol fica exatamente como estava. */}
            {locale === "pt" && (
              /* EM TESTE A/B (`prova_blocos`): A é a tela sem nenhum dos dois,
                 B é com os dois. Ver a nota do experimento em `experimentos.ts`.

                 `<Variante>` e não `varianteDe()`, e a diferença não é estilo:
                 `varianteDe` lê o `<html>` e no servidor devolve sempre o
                 controle, então os blocos só entrariam DEPOIS da hidratação —
                 piscada e salto de layout numa tela de conversão. Assim o HTML
                 sai igual pra todo mundo e só o CSS decide, que é a razão de o
                 `<Variante>` existir.

                 O SORTEIO VEM PRIMEIRO, o depoimento embaixo. Os dois
                 respondem perguntas diferentes, e o depoimento é o mais alto
                 dos dois: em cima, ele empurrava o sorteio pra longe do campo,
                 e quem não rolasse até o fim não via o prêmio. */
              <Variante exp={EXP_PROVA_BLOCOS} v="B">
                <div className="space-y-5 pt-2">
                  <SorteioSemanal />
                  <DepoimentoContato />
                </div>
              </Variante>
            )}
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

          STICKY DE NOVO, E DESSA VEZ OPACO. É a diferença inteira.

          A primeira tentativa (09/08) foi revertida junto com o pacote que
          derrubou a passagem da pergunta 1 pra 2 de 43% pra 14%. Mas a causa
          nunca foi isolada, e o que se sabe aponta pra fora desta barra: o
          funil ESPANHOL levou as mesmas barras e ficou estável em 15-18%, e
          os 4 chips que ela cobria (Amiga, Amigo, Pet, Outro) são
          secundários — Mãe, Pai e Esposa nunca saíram do topo da lista.
          Quatro chips secundários não derrubam 60% pra 15%. O deploy tinha
          cinco mudanças juntas; esta voltou por associação, não por prova.

          O QUE ERA DEFEITO DE VERDADE: `bg-background/95 backdrop-blur-sm`.
          Enquanto grudada, a barra é pintada por cima do que estiver ali —
          e com fundo translúcido a pessoa VIA o chip por baixo. Chip visível
          que não responde ao toque é o pior defeito possível de interface: a
          pessoa toca, nada acontece, e conclui que o site quebrou.

          Fundo 100% opaco, sem blur: o chip é CORTADO na borda da barra, que
          é como todo aplicativo sinaliza "tem mais coisa aqui embaixo, role".
          Nada fica inalcançável — no fim da rolagem a barra volta pro fluxo e
          o `mt-6` garante o respiro acima dela.

          Sobe sozinha, sem tocar em `min-h-screen`, na pergunta do topo nem
          no `py-6`. Foi o pacote que não deixou ninguém saber de quem era a
          culpa da última vez. */}
      {!isIntro(step) && !isReview(step) && !isReveal(step) && !isOferta(step) && (
        <div ref={barraRef} className="sticky bottom-0 z-10 -mx-3 mt-6 border-t border-border/40 bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <Button
            size="lg"
            className="cta w-full rounded-full border-0"
            // NAO usa `disabled`: ver o bloco "POR QUE O BOTAO NAO AVANCOU".
            // O visual continua o de inativo; o que muda e ele responder.
            aria-disabled={!canAdvance}
            onClick={
              !canAdvance
                ? () => {
                    setAvisoBloqueio(true);
                    mostrarOndeFalta();
                    trackEvent("continuar_bloqueado", { step_id: step.id, q: qNum });
                  }
                : isContact(step)
                ? () => {
                    if (varianteDe("email_confirma") === "B") void abrirConfirmacaoEmail();
                    else seguirDoContato();
                  }
                : goNext
            }
          >
            {isContact(step) ? (conferindoEmail ? "…" : T.verMinhaLetra) : T.continuar}
          </Button>
          {avisoBloqueio && !canAdvance && (
            <p className="mt-2 text-center text-sm font-medium text-destructive">
              {motivoBloqueio()}
            </p>
          )}
        </div>
      )}

      {confirmarEmail && (
        <ConfirmarEmail
          locale={locale}
          email={confirmarEmail.email}
          recebe={confirmarEmail.recebe}
          dominio={confirmarEmail.dominio}
          onCerto={() => {
            trackEvent("email_confirma_ok", { recebe: confirmarEmail.recebe, locale });
            setConfirmarEmail(null);
            seguirDoContato();
          }}
          onCorrigir={() => {
            trackEvent("email_confirma_corrigir", { recebe: confirmarEmail.recebe, locale });
            setConfirmarEmail(null);
            window.setTimeout(() => corpoRef.current?.querySelector<HTMLElement>("input")?.focus(), 50);
          }}
        />
      )}
    </main>
  );
}

// ── TESTE `email_confirma`: a folha que mostra o e-mail antes de seguir ──
//
// Grande e sozinho na tela, porque o erro que ela pega (letra trocada antes
// do @) só aparece pra quem LÊ o próprio endereço com calma. Não bloqueia:
// "está certo" sempre segue, mesmo com o domínio que o DNS não achou.
const TEXTO_CONFIRMA = {
  pt: {
    titulo: "Confere o seu e-mail",
    vai: "A sua letra e a sua música vão chegar em:",
    aviso: (d: string) => `Esse endereço parece não existir: "${d}" não recebe e-mail.`,
    certo: "Está certo, continuar",
    corrigir: "Corrigir",
  },
  es: {
    titulo: "Revisa tu correo",
    vai: "Tu letra y tu canción van a llegar a:",
    aviso: (d: string) => `Esta dirección parece no existir: "${d}" no recibe correos.`,
    certo: "Está bien, continuar",
    corrigir: "Corregir",
  },
  en: {
    titulo: "Double-check your email",
    vai: "Your lyrics and your song will be sent to:",
    aviso: (d: string) => `This address looks wrong: "${d}" doesn't receive email.`,
    certo: "That's right, continue",
    corrigir: "Fix it",
  },
} as const;

function ConfirmarEmail(props: {
  locale: Locale;
  email: string;
  recebe: boolean;
  dominio: string | null;
  onCerto: () => void;
  onCorrigir: () => void;
}) {
  const T = TEXTO_CONFIRMA[props.locale] ?? TEXTO_CONFIRMA.pt;
  // Com o domínio que não existe, o botão principal vira "corrigir": é o
  // caminho certo quase sempre, mas "continuar" fica a um toque.
  const [principal, secundario] = props.recebe
    ? [
        { texto: T.certo, acao: props.onCerto },
        { texto: T.corrigir, acao: props.onCorrigir },
      ]
    : [
        { texto: T.corrigir, acao: props.onCorrigir },
        { texto: T.certo, acao: props.onCerto },
      ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-background p-6 text-center shadow-xl sm:rounded-2xl">
        <h2 className="font-display text-xl font-semibold">{T.titulo}</h2>
        <p className="text-sm text-muted-foreground">{T.vai}</p>
        <p className="break-all rounded-lg bg-muted px-3 py-3 text-lg font-semibold">{props.email}</p>
        {!props.recebe && props.dominio && (
          <p className="text-sm font-medium text-destructive">{T.aviso(props.dominio)}</p>
        )}
        <div className="flex flex-col gap-2 pt-1">
          <Button className="h-12 w-full" onClick={principal.acao}>
            {principal.texto}
          </Button>
          <Button variant="ghost" className="w-full" onClick={secundario.acao}>
            {secundario.texto}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Revisão editável. Os rótulos vivem no dicionário (`textos.ts`).

function ReviewScreen({ locale, onGerar }: { locale: Locale; onGerar: () => void }) {
  const respostas = useQuizStore((s) => s.respostas);
  const T = t(locale);
  const tema = idiomaTemTema(locale) && respostas.tema === "gospel" ? "gospel" : null;
  const ordem = ["tipo", "relacao", "nome", "filhos", "ocasiao", "estilo", "voz", "historia1", "historia2", "recado"];
  // O RÓTULO, não o valor gravado. Em inglês o valor é português (\`esposa\`,
  // \`casamento\`, \`country_en\`, \`masculina\`): é o contrato com o banco e o
  // prompt, e aparecia cru nesta tela. No português e no espanhol também
  // aparecia ("sertanejo_univ", "declaracao", "avo_f"), na última tela antes
  // da letra (auditoria 30/09): agora vale pra todo idioma.
  const rotuloDe = (campo: string, valor: string): string => {
    type Opcao = { value: string; label: string };
    for (const passo of quizFlow(locale, tema)) {
      if (!isQuestion(passo)) continue;
      // Só os passos de chip têm opções; o tipo é uma união, então lê solto.
      const p = passo as { field?: string; options?: Opcao[]; extraChips?: { field: string; options: Opcao[] } };
      const achado =
        (p.field === campo ? p.options : undefined)?.find((o) => o.value === valor) ??
        (p.extraChips?.field === campo ? p.extraChips.options : undefined)?.find((o) => o.value === valor);
      if (achado) return achado.label;
    }
    return valor;
  };
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{T.tudoCerto}</h1>
        <p className="text-muted-foreground">{T.ultimaConferida}</p>
      </div>
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border bg-card p-6 text-left text-sm">
        {ordem
          // No louvor, "Pra quem: Deus" e "Nome: Deus" repetem o que o tipo já diz.
          .filter((k) => respostas[k] && !(respostas.tipo === "louvor" && (k === "relacao" || k === "nome")))
          .map((k) => (
            <div key={k} className="border-b pb-3 last:border-0 last:pb-0">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {T.rotulos[k] ?? k}
              </span>
              <p className="mt-0.5 font-medium">
                {Array.isArray(respostas[k])
                  ? (respostas[k] as string[]).map((v) => rotuloDe(k, v)).join(", ")
                  : rotuloDe(k, respostas[k] as string)}
              </p>
            </div>
          ))}
      </div>
      {/* Sticky pelo mesmo motivo do rodapé do quiz: a lista de respostas
          empurrava este botão 221px abaixo da dobra num celular de 667px, e
          ele é o último clique antes da letra.

          Aqui o risco é ainda menor que lá: embaixo desta barra só existe
          TEXTO (a lista de respostas), então ela não tem toque nenhum pra
          matar. Fundo opaco pela mesma razão de sempre — o que fica cortado
          na borda tem que parecer cortado. */}
      <div className="sticky bottom-0 z-10 -mx-3 border-t border-border/40 bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <Button size="lg" className="cta w-full rounded-full border-0" onClick={onGerar}>
          {T.escreverLetra}
        </Button>
      </div>
    </div>
  );
}

/**
 * QUANTO TEMPO O VISITANTE FICA NA ABERTURA, E SE ROLA (30/09, só Ballad).
 *
 * Nas primeiras 24 visitas pagas da Ballad, 1 passou da abertura, contra 43%
 * (Google) e 53% (TikTok) na Serenata. Duas explicações, e sem isto não dá pra
 * separar: clique acidental de Shorts/TikTok (sai em 1 a 2s) ou a tela não
 * convence (fica, lê e vai embora). Só mede, não muda nada na tela. Uma vez
 * por sessão cada marca, pra não inflar `funnel_events`.
 */
function MedirAbertura() {
  useEffect(() => {
    const timers = [5, 15, 30].map((s) =>
      window.setTimeout(() => void trackEventOnce("abertura_tempo", `${s}s`, { segundos: s }), s * 1000),
    );
    const aoRolar = () => {
      if (window.scrollY > 80) {
        void trackEventOnce("abertura_rolou", "v1", {});
        window.removeEventListener("scroll", aoRolar);
      }
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("scroll", aoRolar);
    };
  }, []);
  return null;
}
