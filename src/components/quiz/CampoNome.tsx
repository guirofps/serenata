import { useState } from "react";
import type { QuestionStep } from "@/lib/flow-engine";
import { Input } from "@/components/ui/input";
import { FONTES } from "@/lib/marca";
import { Plus } from "lucide-react";

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
}: {
  step: TextQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
  respostas: Record<string, unknown>;
  onChangeExtra: (field: string, v: string) => void;
}) {
  const texto = (value ?? "").trim();
  const palavras = texto.split(/\s+/).filter(Boolean);
  const primeiro = palavras[0] ?? "";
  const composto = Boolean(step.cortarComposto) && palavras.length > 1;

  const extra = step.extra;
  const valorExtra = extra ? String(respostas[extra.field] ?? "") : "";
  const [abriuExtra, setAbriuExtra] = useState(false);
  // Já preenchido (voltou pra editar) entra ABERTO: campo escondido com
  // resposta dentro é resposta que a pessoa não sabe que deu.
  //
  // Derivado, não inicializador de useState: a store é persistida e hidrata
  // DEPOIS do mount, então no primeiro render `respostas` está vazio e um
  // `useState(() => ...)` congelaria o valor errado pra sempre.
  const extraAberto = abriuExtra || Boolean(valorExtra.trim());
  const mostraExtra = extra && (!extra.mostrarSe || extra.mostrarSe(respostas));

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
        <Eco rotulo={step.eco} modelo={step.ecoModelo} valor={texto} />
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

      {/* O campo extra (hoje: os filhos). Só depois de o nome existir, senão
          são dois campos vazios competindo pela atenção no passo em que a
          pessoa só quer digitar um nome. */}
      {mostraExtra && extra && texto && (
        <div className="pt-1">
          {!extraAberto ? (
            <button
              type="button"
              onClick={() => setAbriuExtra(true)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> {extra.rotulo}
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed p-3">
              {extra.subtexto && (
                <p className="text-left text-xs leading-relaxed text-muted-foreground">
                  {extra.subtexto}
                </p>
              )}
              <Input
                value={valorExtra}
                onChange={(e) => onChangeExtra(extra.field, e.target.value)}
                placeholder={extra.placeholder}
                maxLength={extra.maxLength}
                className="text-center"
                autoFocus
              />
              {extra.eco && valorExtra.trim() && (
                <Eco
                  rotulo={extra.eco}
                  modelo={extra.ecoModelo}
                  valor={valorExtra.trim()}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
