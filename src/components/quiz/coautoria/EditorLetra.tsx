import { useRef, useState } from "react";
import { FONTES } from "@/lib/marca";
import { aprimorarLetra } from "@/lib/coautoria";
import { getOrCreateSessionId } from "@/lib/session-context";
import { trackEventOnce } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale } from "@/lib/i18n";
import { t } from "@/lib/textos";

// Editor da letra — a segunda etapa da coautoria.
//
// A pessoa vê a letra inteira montada em cima do refrão que escolheu, e pode:
//   - editar livremente (é o texto que vira música)
//   - "melhorar com IA" uma vez (deixa mais concreta, corta clichê)
//   - confirmar
//
// Mobile-first: textarea de altura generosa, botões empilhados, o "está
// pronta" fixo no rodapé.

export function EditorLetra({
  letraInicial,
  aoFinalizar,
  finalizando,
  locale = "pt",
}: {
  letraInicial: string;
  aoFinalizar: (letra: string) => void;
  finalizando: boolean;
  locale?: Locale;
}) {
  const T = t(locale);
  const [letra, setLetra] = useState(letraInicial);
  const [aprimorando, setAprimorando] = useState(false);
  const [jaAprimorou, setJaAprimorou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // ── A LETRA CONTINUA ABAIXO, E ISSO PRECISA APARECER ──────────
  //
  // A caixa rola, mas a barra de rolagem do celular é invisível enquanto
  // ninguém rola — e quem não sabe que dá pra rolar não rola. O dono viu
  // isso em 31/08: a letra corta no meio de um verso e a pessoa pode achar
  // que acabou ali, e confirmar sem ter lido metade.
  //
  // O sinal não pode depender da barra do sistema (o iOS ignora estilo de
  // scrollbar). Então é desenhado por nós: um degradê no pé da caixa mais
  // uma seta, que somem quando ela chega no fim.
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [temMais, setTemMais] = useState(false);
  function conferirFim(el: HTMLTextAreaElement) {
    // 8px de folga: arredondamento de subpixel faz a conta nunca fechar
    // exata, e sem a folga o aviso ficaria aceso pra sempre no fim.
    setTemMais(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }

  async function melhorar() {
    setAprimorando(true);
    setErro(null);
    try {
      const r = await aprimorarLetra({ data: { sessionId: getOrCreateSessionId(), letra } });
      setLetra(r.letra);
      setJaAprimorou(true);
      trackEventOnce("letra_aprimorada", "v1");
    } catch (err) {
      console.error("[coautoria] aprimorar falhou:", err);
      setErro(T.falhouMelhorar);
    } finally {
      setAprimorando(false);
    }
  }

  const ocupado = aprimorando || finalizando;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Quase lá
        </p>
        <h1
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ fontFamily: FONTES.display }}
        >
          Essa é a sua letra
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mude o que quiser, cada palavra é sua. É ela que vira música.
        </p>
      </div>

      <div className="relative">
        <textarea
          ref={areaRef}
          value={letra}
          onChange={(e) => {
            setLetra(e.target.value);
            conferirFim(e.currentTarget);
          }}
          onScroll={(e) => conferirFim(e.currentTarget)}
          // Mede na montagem: a letra ja chega maior que a caixa, entao o
          // aviso precisa nascer aceso, sem esperar interacao nenhuma.
          disabled={ocupado}
          spellCheck={false}
          rows={16}
          className={cn(
            "w-full rounded-2xl border border-border bg-card p-4 leading-relaxed outline-none transition-colors focus:border-primary disabled:opacity-60",
          )}
          style={{ fontFamily: FONTES.display, fontSize: "var(--t-base)" }}
        />
        {temMais && (
          <>
            {/* Degrade no pe da caixa: o texto "some" em vez de ser cortado
                em linha reta, que e o que faz o olho entender que continua. */}
            <div className="pointer-events-none absolute inset-x-[1px] bottom-[1px] h-16 rounded-b-2xl bg-gradient-to-t from-card via-card/80 to-transparent" />
            <button
              type="button"
              onClick={() => {
                const el = areaRef.current;
                if (el) el.scrollBy({ top: el.clientHeight * 0.8, behavior: "smooth" });
              }}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm"
            >
              {T.temMaisLetra}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {erro && <p className="text-center text-sm text-destructive">{erro}</p>}

      <button
        type="button"
        onClick={melhorar}
        disabled={ocupado || jaAprimorou}
        className={cn(
          "mx-auto inline-flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-medium transition-colors",
          jaAprimorou
            ? "border-border text-muted-foreground"
            : "border-primary/40 text-foreground hover:bg-primary/5",
          ocupado && "opacity-60",
        )}
      >
        {aprimorando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Melhorando…
          </>
        ) : jaAprimorou ? (
          <>
            <Sparkles className="h-4 w-4" /> Já melhorada
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Melhorar com IA
          </>
        )}
      </button>

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-2 pt-4">
        <Button
          size="lg"
          className="w-full"
          disabled={ocupado || !letra.trim()}
          onClick={() => aoFinalizar(letra)}
        >
          {finalizando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {T.preparandoSua}
            </>
          ) : (
            T.estaPronta
          )}
        </Button>
      </div>
    </div>
  );
}
