import { useEffect, useRef, useState } from "react";
import { gerarRefroes, montarLetra, finalizarLetra, type RefroesGerados } from "@/lib/coautoria";
import { getOrCreateSessionId } from "@/lib/session-context";
import type { LetraGerada } from "@/lib/letra-prompt";
import { useQuizStore } from "@/lib/quiz-store";
import { trackEvent, trackEventOnce } from "@/lib/track";
import { irParaCheckout } from "@/lib/checkout";
import { Button } from "@/components/ui/button";
import { MusicaDaSessao } from "@/components/quiz/MusicaDaSessao";
import { EscolherRefrao } from "@/components/quiz/coautoria/EscolherRefrao";
import { EditorLetra } from "@/components/quiz/coautoria/EditorLetra";
import { Music, QrCode } from "lucide-react";

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
const LOADING = [
  "Lendo a sua história…",
  "Procurando os detalhes que só vocês têm…",
  "Escrevendo dois caminhos pro refrão…",
];

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

export function RevealStep() {
  const respostas = useQuizStore((s) => s.respostas);
  const hidratada = useStoreHidratada();
  const [fase, setFase] = useState<Fase>({ t: "carregando", msg: LOADING[0] });
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [regerando, setRegerando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const jaComecou = useRef(false);

  // respostas VIVAS (pós-hidratação), nunca o snapshot do render.
  const vivas = () => useQuizStore.getState().respostas;
  const temHistoria = (r: Record<string, unknown>) =>
    Boolean(String(r.historia1 ?? "").trim() || String(r.historia2 ?? "").trim());

  async function carregarRefroes(regen = false) {
    if (regen) setRegerando(true);
    else setFase({ t: "carregando", msg: LOADING[0] });
    try {
      const dados = await gerarRefroes({
        data: { sessionId: getOrCreateSessionId(), respostas: vivas() },
      });
      setFase({ t: "refroes", dados });
      trackEventOnce("coautoria_refroes", "v1");
    } catch (err) {
      console.error("[coautoria] refrões falharam:", err);
      setFase({ t: "erro", msg: "Não consegui escrever agora. Tente de novo.", tentar: () => carregarRefroes() });
    } finally {
      setRegerando(false);
    }
  }

  async function escolherRefrao(refrao: string) {
    setFase({ t: "carregando", msg: "Escrevendo a letra em volta do seu refrão…" });
    trackEvent("coautoria_refrao_escolhido", {});
    try {
      const letra = await montarLetra({
        data: { sessionId: getOrCreateSessionId(), respostas: vivas(), refrao },
      });
      setFase({ t: "editando", letra });
    } catch (err) {
      console.error("[coautoria] montar letra falhou:", err);
      setFase({ t: "erro", msg: "Não consegui montar a letra. Tente de novo.", tentar: () => escolherRefrao(refrao) });
    }
  }

  async function finalizar(letraEditada: string) {
    if (fase.t !== "editando") return;
    setFinalizando(true);
    const base = fase.letra;
    try {
      await finalizarLetra({
        data: {
          sessionId: getOrCreateSessionId(),
          respostas: vivas(),
          letra: letraEditada,
          titulo: base.titulo,
          estiloSuno: base.estilo_suno,
          versoDestaque: base.verso_destaque,
        },
      });
      trackEventOnce("letra_finalizada", "v1", { titulo: base.titulo });
      setFase({ t: "revelando", letra: { ...base, letra: letraEditada } });
    } catch (err) {
      console.error("[coautoria] finalizar falhou:", err);
      setFase({ t: "erro", msg: "Não consegui preparar a música. Tente de novo.", tentar: () => finalizar(letraEditada) });
    } finally {
      setFinalizando(false);
    }
  }

  // Começa UMA vez, depois de hidratar e com história.
  useEffect(() => {
    if (!hidratada || jaComecou.current) return;
    if (!temHistoria(vivas())) {
      setFase({ t: "sem-dados" });
      return; // sem marcar jaComecou: se a história chegar, começa.
    }
    jaComecou.current = true;
    carregarRefroes();
  }, [hidratada]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frases de loading só na carga inicial dos refrões.
  useEffect(() => {
    if (fase.t !== "carregando" || fase.msg !== LOADING[0]) return;
    const id = setInterval(() => setLoadingIdx((i) => Math.min(i + 1, LOADING.length - 1)), 1600);
    return () => clearInterval(id);
  }, [fase]);

  // ── telas ──────────────────────────────────────────────────────
  if (fase.t === "carregando") {
    const msg = fase.msg === LOADING[0] ? LOADING[loadingIdx] : fase.msg;
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <Music className="h-10 w-10 animate-pulse text-primary" />
        <p className="text-lg text-muted-foreground">{msg}</p>
      </div>
    );
  }

  if (fase.t === "erro") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">{fase.msg}</p>
        <Button onClick={fase.tentar}>Tentar de novo</Button>
      </div>
    );
  }

  if (fase.t === "sem-dados") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-semibold">Faltou a parte mais importante</p>
        <p className="max-w-sm text-muted-foreground">
          Preciso da história pra escrever uma letra que seja só dela. Vamos
          voltar e me contar?
        </p>
        <a href="/criar?step=historia1" className="underline underline-offset-4">
          Contar a história
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
      />
    );
  }

  if (fase.t === "editando") {
    return (
      <EditorLetra
        letraInicial={fase.letra.letra}
        aoFinalizar={finalizar}
        finalizando={finalizando}
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
            uma música pra {nome}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{letra.titulo}</h1>
        </div>

        <div className="px-6 pb-6">
          <MusicaDaSessao letra={letra.letra} />
        </div>

        <div className="flex items-center justify-center gap-2 border-t bg-secondary/30 py-3 text-xs text-muted-foreground">
          <QrCode className="h-4 w-4" /> link + QR Code pra compartilhar
        </div>
      </div>

      <IrPagar nome={nome} />
    </div>
  );
}

// O CHECKOUT de verdade (era fake door até a Perfect Pay estar configurada).
// Leva `src` (session_id) e os UTMs, que é como o webhook casa o pagamento com
// esta música e a Utmify atribui a venda.
function IrPagar({ nome }: { nome: string }) {
  const [indo, setIndo] = useState(false);
  const email = useQuizStore((s) => s.email);

  return (
    <div>
      <Button
        size="lg"
        className="cta w-full rounded-full border-0"
        disabled={indo}
        onClick={() => {
          setIndo(true);
          trackEvent("checkout_click", { valor: 37 });
          irParaCheckout({ email: email || undefined });
        }}
      >
        {indo ? "Abrindo o pagamento…" : `Quero a música de ${nome} cantada`}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        R$ 37, pagamento único. A música completa, a página presente pra enviar,
        o MP3 e o QR Code.
      </p>
    </div>
  );
}
