import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { gerarRefroes, montarLetra, finalizarLetra, type RefroesGerados } from "@/lib/coautoria";
import { getOrCreateSessionId } from "@/lib/session-context";
import type { LetraGerada } from "@/lib/letra-prompt";
import { useQuizStore } from "@/lib/quiz-store";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { irParaCheckout } from "@/lib/checkout";
import { Button } from "@/components/ui/button";
import { MusicaDaSessao, type EstadoMusica } from "@/components/quiz/MusicaDaSessao";
import { PreviaPresente } from "@/components/quiz/PreviaPresente";
import { EscolherRefrao } from "@/components/quiz/coautoria/EscolherRefrao";
import { EditorLetra } from "@/components/quiz/coautoria/EditorLetra";
import { QrCode } from "lucide-react";
import { type Locale, caminho } from "@/lib/i18n";
import { APartirDe } from "@/components/quiz/PrecoDaOferta";
import { t } from "@/lib/textos";
import { varianteDe } from "@/lib/experimentos";

// A REVELAÇÃO — agora é COAUTORIA, não letra pronta.
//
// Fluxo: escolher o refrão (2 opções) → editar a letra montada em cima dele
// → confirmar. Só no confirmar a música dispara, porque a letra não é final
// antes disso. Continua ANTES do pagamento (regra do CLAUDE.md).
//
// É a mecânica do LoveTune, enxugada pra 2 etapas: quando a pessoa escolhe e
// edita, a letra vira dela, e pagar é quase consequência.

// Frases de loading HONESTAS. Nada de barra que trava em 99% (anti-padrão da
// Cantoria).


type Fase =
  | { t: "carregando"; msg: string }
  | { t: "refroes"; dados: RefroesGerados }
  | { t: "editando"; letra: LetraGerada }
  | { t: "revelando"; letra: LetraGerada }
  | { t: "erro"; msg: string; tentar: () => void }
  | { t: "sem-dados" };

// Com SSR a store persistida começa VAZIA e só hidrata depois do mount. Sem
// esperar, a geração dispara sem a história e a letra sai genérica. Este hook
// segura tudo até os dados existirem.
function useStoreHidratada() {
  const [hidratada, setHidratada] = useState(() =>
    typeof window === "undefined" ? false : useQuizStore.persist.hasHydrated(),
  );
  useEffect(() => {
    if (hidratada) return;
    const unsub = useQuizStore.persist.onFinishHydration(() => setHidratada(true));
    if (useQuizStore.persist.hasHydrated()) setHidratada(true);
    return unsub;
  }, [hidratada]);
  return hidratada;
}

export function RevealStep({ locale = "pt" }: { locale?: Locale }) {
  const T = t(locale);
  const respostas = useQuizStore((s) => s.respostas);
  const hidratada = useStoreHidratada();
  const [fase, setFase] = useState<Fase>({ t: "carregando", msg: "" });
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [regerando, setRegerando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [estadoMusica, setEstadoMusica] = useState<EstadoMusica>("gerando");
  const jaComecou = useRef(false);

  // respostas VIVAS (pós-hidratação), nunca o snapshot do render.
  const vivas = () => useQuizStore.getState().respostas;
  const temHistoria = (r: Record<string, unknown>) =>
    Boolean(String(r.historia1 ?? "").trim() || String(r.historia2 ?? "").trim());

  // ── A VARIANTE B: DIRETO AO PONTO ─────────────────────────────
  //
  // Mesmas funções do A, sem as perguntas. Escolhe o primeiro refrão sozinho,
  // monta a letra e finaliza: a pessoa sai do quiz e a próxima coisa que vê é
  // a música dela.
  //
  // O primeiro refrão não é sorteio: `gerarRefroes` devolve a lista na ordem
  // que o modelo escreveu, e a primeira é a que ele considerou melhor. É a
  // mesma que 84% das pessoas escolhem quando são perguntadas.
  //
  // Erro aqui cai na MESMA tela de erro do A, com "tentar de novo": o teste é
  // sobre atrito, não sobre robustez, e uma variante que falha diferente
  // mediria outra coisa.
  async function caminhoDireto() {
    setFase({ t: "carregando", msg: T.loadingLetra[0] });
    try {
      const dados = await gerarRefroes({
        data: { sessionId: getOrCreateSessionId(), respostas: vivas(), locale },
      });
      const letra = await montarLetra({
        data: {
          sessionId: getOrCreateSessionId(),
          respostas: vivas(),
          refrao: dados.refroes[0],
          locale,
        },
      });
      trackEventOnce("fluxo_direto", "v1");
      await finalizar(letra.letra, letra);
    } catch (err) {
      console.error("[fluxo-direto] falhou:", err);
      setFase({ t: "erro", msg: T.naoConsegui, tentar: () => caminhoDireto() });
    }
  }

  async function carregarRefroes(regen = false) {
    if (regen) setRegerando(true);
    else setFase({ t: "carregando", msg: T.loadingLetra[0] });
    try {
      const dados = await gerarRefroes({
        data: { sessionId: getOrCreateSessionId(), respostas: vivas(), locale },
      });
      setFase({ t: "refroes", dados });
      trackEventOnce("coautoria_refroes", "v1");
    } catch (err) {
      console.error("[coautoria] refrões falharam:", err);
      setFase({ t: "erro", msg: T.naoConsegui, tentar: () => carregarRefroes() });
    } finally {
      setRegerando(false);
    }
  }

  async function escolherRefrao(refrao: string) {
    setFase({ t: "carregando", msg: T.loadingRefrao });
    trackEvent("coautoria_refrao_escolhido", {});
    try {
      const letra = await montarLetra({
        data: { sessionId: getOrCreateSessionId(), respostas: vivas(), refrao, locale },
      });
      setFase({ t: "editando", letra });
    } catch (err) {
      console.error("[coautoria] montar letra falhou:", err);
      setFase({ t: "erro", msg: T.naoMontei, tentar: () => escolherRefrao(refrao) });
    }
  }

  // `baseDireta` existe pro caminho B, que finaliza sem nunca ter passado
  // pela fase "editando" (e portanto sem `fase.letra` pra ler).
  async function finalizar(letraEditada: string, baseDireta?: LetraGerada) {
    const base = baseDireta ?? (fase.t === "editando" ? fase.letra : null);
    if (!base) return;
    setFinalizando(true);
    try {
      const pedido = {
        sessionId: getOrCreateSessionId(),
        respostas: vivas(),
        letra: letraEditada,
        titulo: base.titulo,
        estiloSuno: base.estilo_suno,
        versoDestaque: base.verso_destaque,
        locale,
      };
      let r = await finalizarLetra({ data: pedido });

      // ── `musicaId` NULO NÃO É SUCESSO ─────────────────────────
      //
      // `finalizarLetra` resolve normalmente mesmo quando não conseguiu criar
      // a música, e este código tratava isso como se tudo tivesse dado certo:
      // gravava `letra_finalizada`, mostrava a letra e mandava a pessoa pra
      // oferta, onde ela era barrada por falta de música. Doze casos em 7
      // dias, todos com a letra escrita e nenhum com música.
      //
      // A causa principal está consertada no servidor (a linha do quiz agora
      // é criada em vez de faltar). Esta é a segunda camada, pra qualquer
      // OUTRA causa: uma tentativa a mais, que é grátis — sem música criada
      // não há Suno gasto, e a idempotência do servidor impede duplicar se a
      // primeira tiver funcionado no meio do caminho.
      if (!r?.musicaId) {
        trackEvent("finalizar_sem_musica", { tentativa: 1 });
        r = await finalizarLetra({ data: pedido });
        // Ainda nada: registra alto. Não dá pra consertar da tela, mas o
        // `vigiaGeracao` varre o banco de 10 em 10 minutos e este evento é o
        // que permite saber que existiu.
        if (!r?.musicaId) trackEvent("finalizar_sem_musica", { tentativa: 2 });
      }
      trackEventOnce("letra_finalizada", "v1", { titulo: base.titulo });
      // Guarda a letra final ANTES de revelar: é o que permite voltar pra
      // esta tela depois sem recomeçar a coautoria.
      useQuizStore.getState().setLetraFinal({
        titulo: base.titulo,
        letra: letraEditada,
        estiloSuno: base.estilo_suno,
        versoDestaque: base.verso_destaque,
        // De QUAL sessão é esta letra. Sem isso ela valia pra sempre, e quem
        // voltava pra escrever outra caía na revelação da anterior. Ver o
        // comentário do campo em `quiz-store.ts`.
        sessionId: getOrCreateSessionId(),
      });
      setFase({ t: "revelando", letra: { ...base, letra: letraEditada } });
    } catch (err) {
      console.error("[coautoria] finalizar falhou:", err);
      setFase({ t: "erro", msg: T.naoPreparei, tentar: () => finalizar(letraEditada) });
    } finally {
      setFinalizando(false);
    }
  }

  // Começa UMA vez, depois de hidratar e com história.
  useEffect(() => {
    if (!hidratada || jaComecou.current) return;

    // JÁ TEM LETRA? Volta direto pra revelação, sem refazer a coautoria.
    //
    // É o conserto de quem sai desta tela (pra ver a oferta, ou tocando em
    // voltar sem querer) e tenta retornar: antes caía em "Qual refrão fica
    // melhor?", perdia a letra escolhida e queimava outra chamada de IA.
    // SÓ SE A LETRA FOR DESTA SESSÃO.
    //
    // O atalho existe pra quem sai desta tela e volta (ver acima). Sem a
    // conferência de sessão ele pegava também quem começou um quiz NOVO com
    // uma letra velha guardada no navegador: a tela abria a revelação da
    // música anterior, com o título antigo, e a barra parava em ~93% pra
    // sempre — porque a checagem procura a música da sessão nova, que ainda
    // não existe.
    //
    // Reproduzido em 31/08 às 23:53, com o título de uma sessão das 21:36 na
    // tela. Letra sem `sessionId` (gravada antes desta versão) conta como de
    // outra sessão: o pior caso vira refazer a coautoria, que é o certo.
    const guardada = useQuizStore.getState().letraFinal;
    const jaEscrita = guardada?.sessionId === getOrCreateSessionId() ? guardada : null;
    if (jaEscrita) {
      jaComecou.current = true;
      setFase({
        t: "revelando",
        letra: {
          titulo: jaEscrita.titulo,
          letra: jaEscrita.letra,
          estilo_suno: jaEscrita.estiloSuno,
          verso_destaque: jaEscrita.versoDestaque,
        },
      });
      return;
    }

    if (!temHistoria(vivas())) {
      setFase({ t: "sem-dados" });
      return; // sem marcar jaComecou: se a história chegar, começa.
    }
    jaComecou.current = true;
    // A ENTRADA NA TELA, que não era medida.
    //
    // Entre o último passo do quiz (`recado`) e o primeiro sinal desta tela
    // (`coautoria_refroes`, que só dispara com a letra JÁ escrita) somem 23%
    // das pessoas — 1.446 em 7 dias, com 127s de média e 240s no p90. Sem um
    // evento aqui não dá pra saber se elas desistem digitando o recado ou
    // esperando o modelo, e as duas causas pedem conserto oposto: uma é copy,
    // a outra é latência.
    trackEventOnce("coautoria_pedida", "v1", { fluxo: varianteDe("fluxo") ?? "A" });
    // A ESCOLHA DO CAMINHO, uma vez só. `varianteDe` lê o atributo que o
    // <head> já carimbou, então não pisca nem sorteia de novo.
    if (varianteDe("fluxo") === "B") caminhoDireto();
    else carregarRefroes();
  }, [hidratada]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frases de loading só na carga inicial dos refrões.
  useEffect(() => {
    if (fase.t !== "carregando" || fase.msg !== "") return;
    const id = setInterval(() => setLoadingIdx((i) => Math.min(i + 1, T.loadingLetra.length - 1)), 1600);
    return () => clearInterval(id);
  }, [fase]);

  // ── telas ──────────────────────────────────────────────────────
  if (fase.t === "carregando") {
    const msg = fase.msg === "" ? T.loadingLetra[loadingIdx] : fase.msg;
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        {/* A espera mostra o PRESENTE, não uma bolinha girando: é o único
            momento em que a pessoa para e olha, e vem logo antes da tela em
            que a gente pede dinheiro. */}
        <PreviaPresente nome={respostas.nome as string | undefined} locale={locale} />
        <p className="text-lg text-muted-foreground">{msg}</p>
      </div>
    );
  }

  if (fase.t === "erro") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">{fase.msg}</p>
        <Button onClick={fase.tentar}>{T.tentarDeNovo}</Button>
      </div>
    );
  }

  if (fase.t === "sem-dados") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-semibold">{T.faltouImportante}</p>
        <p className="max-w-sm text-muted-foreground">
          {T.precisoDaHistoria}
        </p>
        <a href={`${caminho("/criar", locale)}?step=historia1`} className="underline underline-offset-4">
          {T.contarAHistoria}
        </a>
      </div>
    );
  }

  if (fase.t === "refroes") {
    return (
      <EscolherRefrao
        dados={fase.dados}
        aoEscolher={escolherRefrao}
        aoRegerar={() => carregarRefroes(true)}
        regerando={regerando}
        locale={locale}
      />
    );
  }

  if (fase.t === "editando") {
    return (
      <EditorLetra
        letraInicial={fase.letra.letra}
        aoFinalizar={finalizar}
        finalizando={finalizando}
        locale={locale}
      />
    );
  }

  // fase "revelando" — a música já está sendo gerada; mostra o presente.
  const letra = fase.letra;
  const nome = (respostas.nome as string) || "você";

  return (
    <div className="space-y-6">
      {/* Mockup da PÁGINA PRESENTE: a letra aparece DENTRO do presente,
          faltando só a música (que o fake door desbloqueia). */}
      <div className="overflow-hidden rounded-3xl border bg-card shadow-lg">
        <div className="bg-gradient-to-b from-primary/10 to-transparent px-6 pb-4 pt-8 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {T.umaMusicaPra} {nome}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{letra.titulo}</h1>
        </div>

        <div className="px-6 pb-6">
          <MusicaDaSessao letra={letra.letra} aoMudarEstado={setEstadoMusica} locale={locale} />
        </div>

        <div className="flex items-center justify-center gap-2 border-t bg-secondary/30 py-3 text-xs text-muted-foreground">
          <QrCode className="h-4 w-4" /> {T.linkEQr}
        </div>
      </div>

      {/* O CTA só existe DEPOIS que a prévia toca (ou falha).
          Antes ele ficava na tela durante os ~2min de geração: quem tocava
          nele ia pro paywall sem nunca ter ouvido a própria música, e voltar
          recomeçava a coautoria inteira. Além do desperdício, é a ordem
          errada — não se pede dinheiro antes de mostrar o produto. */}
      {estadoMusica === "gerando" ? (
        <p className="text-center text-sm text-muted-foreground">
          {T.prontaEmBreve}
        </p>
      ) : (
        <IrPagar nome={nome} locale={locale} />
      )}
    </div>
  );
}

// Daqui NÃO se vai mais direto pro gateway: vai pra tela de oferta
// (`?step=oferta`), que é a última superfície nossa antes do formulário da
// Perfect Pay. O `checkout_click` mudou de lugar junto — ele agora marca o
// clique em PAGAR, não o clique em "quero saber". Assim o funil separa quem
// desiste ao ver o preço de quem desiste no formulário de cartão.
function IrPagar({ nome, locale }: { nome: string; locale: Locale }) {
  const navigate = useNavigate();
  const T = t(locale);

  return (
    <div>
      <Button
        size="lg"
        className="cta w-full rounded-full border-0"
        onClick={() => {
          trackEvent("ver_oferta_click", {});
          navigate({ to: caminho("/criar", locale), search: { step: "oferta" } } as never);
        }}
      >
        {T.queroCantada(nome)}
      </Button>
      {/* O preço vinha CRAVADO aqui, em português e em real: o funil
          espanhol mostrava "A partir de R$ 37" no pico emocional, logo depois
          da pessoa ouvir a própria música. Depois passou a sair do catálogo de
          moeda; desde 18/08 sai do PLANO sorteado pra esta pessoa.
          Este é o primeiro preço que ela lê no funil inteiro — se ele não
          acompanhasse o teste, metade do tráfego leria um número aqui e
          encontraria outro na tela seguinte. */}
      <APartirDe
        locale={locale}
        frase={T.aPartirDe}
        className="mt-3 text-center text-xs text-muted-foreground"
      />
    </div>
  );
}
