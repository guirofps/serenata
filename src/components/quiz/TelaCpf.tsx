import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cpfValido, formatarCpf, soDigitosCpf } from "@/lib/cpf";

/**
 * O passo do CPF.
 *
 * Saiu de dentro do `PixTransparente` em 08/10/2026 pra a oferta da escada
 * (`/oferta/<token>`) usar a MESMA tela: lá o Asaas também pede CPF, e a
 * página recusava em vez de perguntar. Uma tela só, pra o texto e a máscara
 * não divergirem entre o funil e a recuperação.
 *
 * ── CONFERE ANTES DE MANDAR ──────────────────────────────────────
 *
 * Os digitos verificadores sao conferidos AQUI tambem, nao so no servidor.
 * Nao e desconfianca do backend: e que um CPF com erro de digitacao, indo e
 * voltando pela rede, sao tres segundos de tela parada na hora em que a
 * pessoa ja decidiu pagar. O botao so acende quando o numero fecha.
 *
 * A mascara aparece enquanto digita porque CPF sem pontuacao e dificil de
 * conferir com o olho, e conferir com o olho e exatamente o que a pessoa vai
 * fazer antes de tocar em "Gerar o PIX".
 */
export function TelaCpf({
  aviso,
  aoEnviar,
  aoVoltar,
}: {
  aviso: string | null;
  /** Recebe só os dígitos, já conferidos. */
  aoEnviar: (cpf: string) => void;
  /** Sem ele o "Voltar" some: na oferta da escada não há passo anterior. */
  aoVoltar?: () => void;
}) {
  const [valor, setValor] = useState("");
  const ok = cpfValido(valor);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card px-4 py-5 text-left">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Falta só o seu CPF</p>
        <p className="text-xs leading-snug text-muted-foreground">
          O banco pede pra emitir o PIX no seu nome. Não aparece pra ninguém e não vai pra lista
          nenhuma.
        </p>
      </div>

      <div className="space-y-1.5">
        <input
          // `inputMode` numerico abre o teclado de numeros no celular, que e
          // onde 99% do funil acontece. `type="text"` e nao `number` porque
          // number recusa a mascara e ainda mostra setinha de incremento.
          inputMode="numeric"
          autoComplete="off"
          value={formatarCpf(valor)}
          onChange={(e) => setValor(soDigitosCpf(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ok) aoEnviar(soDigitosCpf(valor));
          }}
          placeholder="000.000.000-00"
          className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base tabular-nums outline-none focus:border-ring"
          aria-label="CPF"
          aria-invalid={valor.length === 11 && !ok}
        />
        {/* So reclama quando ja tem 11 digitos: avisar "invalido" no terceiro
            numero digitado e reclamar de algo que a pessoa ainda esta fazendo. */}
        {aviso && !valor ? <p className="text-xs text-amber-700">{aviso}</p> : null}
        {valor.length === 11 && !ok ? (
          <p className="text-xs text-amber-700">Esse CPF não confere. Confere os números?</p>
        ) : null}
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!ok}
        onClick={() => aoEnviar(soDigitosCpf(valor))}
      >
        Gerar o PIX
      </Button>
      {aoVoltar ? (
        <button
          type="button"
          onClick={aoVoltar}
          className="w-full text-xs text-muted-foreground underline"
        >
          Voltar
        </button>
      ) : null}
    </div>
  );
}
