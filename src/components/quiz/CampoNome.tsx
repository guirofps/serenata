import type { QuestionStep } from "@/lib/flow-engine";
import { Input } from "@/components/ui/input";
import { FONTES } from "@/lib/marca";

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

export function CampoNome({
  step,
  value,
  onChange,
}: {
  step: TextQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const texto = (value ?? "").trim();
  const palavras = texto.split(/\s+/).filter(Boolean);
  const primeiro = palavras[0] ?? "";
  const composto = Boolean(step.cortarComposto) && palavras.length > 1;

  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={step.placeholder}
        maxLength={step.maxLength}
        className="text-center"
        autoFocus
      />

      {step.eco && texto && (
        <div className="rounded-xl border border-primary/15 bg-secondary/40 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            {step.eco}
          </p>
          <p
            className="mt-1 text-lg leading-snug"
            style={{ fontFamily: FONTES.display }}
          >
            {(step.ecoModelo ?? "“{v}, essa música é pra você…”")
              .split("{v}")
              .map((pedaco, i) => (
                <span key={i}>
                  {i > 0 && <span className="font-medium">{texto}</span>}
                  <span className="text-muted-foreground">{pedaco}</span>
                </span>
              ))}
          </p>
        </div>
      )}

      {composto && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left">
          <p className="text-sm">
            Nome e sobrenome vão ser cantados inteiros. Se você chama de{" "}
            <strong>{primeiro}</strong>, fica melhor na música.
          </p>
          <button
            type="button"
            onClick={() => onChange(primeiro)}
            className="mt-2 rounded-full border-2 border-primary/40 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-primary/10"
          >
            Usar só “{primeiro}”
          </button>
        </div>
      )}
    </div>
  );
}
