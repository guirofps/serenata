import { useRef } from "react";
import type { QuestionStep } from "@/lib/flow-engine";
import { Input } from "@/components/ui/input";
import { FONTES } from "@/lib/marca";
import { trackEventOnce } from "@/lib/track";
import { type Locale } from "@/lib/i18n";
import { t } from "@/lib/textos";

// Campo de texto que MOSTRA como o valor vai sair no produto.
//
// Por que existe: o nome digitado aqui é cantado literalmente pelo Suno.
// Medido em 73 respostas, 14% escrevem mais de uma palavra, e o estrago
// aparece nas músicas já entregues: "Carlos Henrique, meu presente de Deus",
// "Fami lia" (com o typo). A pessoa não percebe porque, na cabeça dela, está
// preenchendo um cadastro, não escrevendo a letra.
//
// A correção não é travar: "Seu Joaquim", "vó Rosa" e "Dona Rosa" são jeitos
// legítimos de chamar alguém e ficaram ótimos cantados. Então a tela ECOA o
// que vai ser cantado e, quando há mais de uma palavra, OFERECE o corte em um
// toque. Quem quiser manter, mantém.

type TextQuestion = Extract<QuestionStep, { input: "text" }>;

/** O eco: como o valor vai soar cantado. `{v}` marca onde ele entra. */
function Eco({ rotulo, modelo, valor }: { rotulo: string; modelo?: string; valor: string }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-secondary/40 px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
        {rotulo}
      </p>
      <p className="mt-1 text-lg leading-snug" style={{ fontFamily: FONTES.display }}>
        {(modelo ?? "“{v}, essa música é pra você…”").split("{v}").map((pedaco, i) => (
          <span key={i}>
            {i > 0 && <span className="font-medium">{valor}</span>}
            <span className="text-muted-foreground">{pedaco}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

export function CampoNome({
  step,
  value,
  onChange,
  respostas,
  onChangeExtra,
  preencher,
  locale = "pt",
}: {
  step: TextQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
  respostas: Record<string, unknown>;
  onChangeExtra: (field: string, v: string) => void;
  /** Troca {nome} pelo nome real nos gatilhos. */
  preencher: (s: string) => string;
  locale?: Locale;
}) {
  const T = t(locale);
  const campoRef = useRef<HTMLInputElement>(null);

  // Gatilho tocado: escreve o COMEÇO da frase e devolve o cursor pro fim.
  // Diferente do campo de história, aqui SUBSTITUI em vez de somar: o recado
  // é UMA frase, e concatenar dois gatilhos daria uma linha sem sentido.
  function usarGatilho(inicio: string) {
    onChange(inicio);
    trackEventOnce("gatilho_usado", step.id);
    requestAnimationFrame(() => {
      const el = campoRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(inicio.length, inicio.length);
    });
  }

  const texto = (value ?? "").trim();
  const palavras = texto.split(/\s+/).filter(Boolean);
  const primeiro = palavras[0] ?? "";
  const composto = Boolean(step.cortarComposto) && palavras.length > 1;

  const extra = step.extra;
  const valorExtra = extra ? String(respostas[extra.field] ?? "") : "";
  const mostraExtra = extra && (!extra.mostrarSe || extra.mostrarSe(respostas));

  return (
    <div className="mx-auto w-full max-w-md space-y-3">
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

      <Input
        ref={campoRef}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={step.placeholder}
        maxLength={step.maxLength}
        className="text-center"
        autoFocus
      />

      {step.eco && texto && (
        <Eco rotulo={step.eco} modelo={step.ecoModelo} valor={texto} />
      )}

      {composto && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left">
          <p className="text-sm">{T.avisoComposto(primeiro)}</p>
          <button
            type="button"
            onClick={() => onChange(primeiro)}
            className="mt-2 rounded-full border-2 border-primary/40 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-primary/10"
          >
            {T.usarSo(primeiro)}
          </button>
        </div>
      )}

      {/* O campo extra (hoje: os filhos), como CARTÃO e sempre visível.
          Já foi um link recolhido atrás de um "+" e desapareceu: 13px cinza
          embaixo do campo principal não é uma pergunta, é uma nota de rodapé.
          Pergunta em tamanho de pergunta, ou não vale a pena existir. */}
      {mostraExtra && extra && (
        <div className="space-y-3 rounded-2xl border border-primary/20 bg-secondary/30 p-4">
          <div>
            <p className="font-display text-lg font-semibold leading-snug">
              {extra.pergunta}
            </p>
            {extra.subtexto && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {extra.subtexto}
              </p>
            )}
          </div>
          <Input
            value={valorExtra}
            onChange={(e) => onChangeExtra(extra.field, e.target.value)}
            placeholder={extra.placeholder}
            maxLength={extra.maxLength}
            className="text-center"
          />
          {extra.eco && valorExtra.trim() && (
            <Eco rotulo={extra.eco} modelo={extra.ecoModelo} valor={valorExtra.trim()} />
          )}
        </div>
      )}
    </div>
  );
}
