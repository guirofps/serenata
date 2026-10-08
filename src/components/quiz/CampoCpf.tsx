import { forwardRef, useState } from "react";
import { cpfValido, formatarCpf, soDigitosCpf } from "@/lib/cpf";
import { avisoDoCpf } from "@/lib/folha-pix";

/**
 * O CPF DENTRO DO RESUMO (teste `folha_pix`, braços B e C).
 *
 * No A ele é uma tela inteira depois do "Gerar meu PIX", e 22% de quem chega
 * nela desiste. Aqui ele vira um campo colado no botão: a pessoa vê o que vai
 * pedir ANTES de decidir, e um toque gera o PIX.
 *
 * Mesma máscara e mesma régua de aviso da `TelaCpf` (`formatarCpf`,
 * `avisoDoCpf`): o número que ela confere com o olho é o mesmo nas duas.
 *
 * CPF lembrado pelo navegador aparece numa linha, com "trocar", em vez do
 * campo aberto: quem já digitou uma vez não precisa ler a explicação de novo.
 */
export const CampoCpf = forwardRef<
  HTMLInputElement,
  {
    /** Só os dígitos. */
    valor: string;
    aoMudar: (digitos: string) => void;
    /** Ela já tocou em pagar: aí o campo diz o que falta. */
    tentouPagar: boolean;
    /** Veio do navegador (`lerCpfGuardado`): mostra em linha, com "trocar". */
    lembrado: boolean;
    /** Enter no teclado numérico, com o CPF fechando, vale como tocar no botão. */
    aoEnter?: () => void;
    /** Quando ela começa a digitar, uma vez (pra leitura do teste). */
    aoComecar?: () => void;
  }
>(function CampoCpf({ valor, aoMudar, tentouPagar, lembrado, aoEnter, aoComecar }, ref) {
  const [editando, setEditando] = useState(!lembrado);
  const aviso = avisoDoCpf(valor, tentouPagar);

  // `cpfValido` de novo aqui e não só o `lembrado`: se o número em linha
  // deixasse de fechar (não deveria), a linha vira campo e diz o porquê.
  if (!editando && !aviso && cpfValido(valor)) {
    return (
      <div className="flex items-center justify-between gap-2 px-1 pb-2 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">
          CPF <span className="font-medium tabular-nums text-foreground">{formatarCpf(valor)}</span>
        </span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="shrink-0 text-xs text-primary underline underline-offset-4"
        >
          trocar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-2.5 text-left">
      <label className="block">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">CPF</span>
        <input
          ref={ref}
          // Numérico porque 99% é celular, e o teclado de letras pra digitar
          // 11 números é atrito à toa. `text` e não `number`: number recusa a
          // máscara e mostra setinha.
          inputMode="numeric"
          autoComplete="off"
          name="cpf-pix"
          // Só quando ela tocou em "trocar" no CPF lembrado. Abrir a folha
          // com o teclado subindo sozinho esconderia o preço e o botão.
          autoFocus={lembrado}
          value={formatarCpf(valor)}
          onChange={(e) => {
            const d = soDigitosCpf(e.target.value).slice(0, 11);
            if (!valor && d) aoComecar?.();
            aoMudar(d);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") aoEnter?.();
          }}
          placeholder="000.000.000-00"
          aria-invalid={Boolean(aviso)}
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base tabular-nums outline-none focus:border-ring aria-[invalid=true]:border-amber-500"
        />
      </label>
      {aviso ? (
        <p className="text-xs text-amber-700">{aviso}</p>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          O banco pede o CPF pra emitir o PIX no seu nome. Não aparece pra ninguém.
        </p>
      )}
    </div>
  );
});
