import { TEXTO_LOCAL_PRIMEIRO as TEXTO, type PaisLocalPrimeiro } from "@/lib/local-primeiro";
import type { MetodoDlocal } from "@/lib/spei-destaque";

/** Teste `local_primeiro` (B): a escolha antes do cartão. Ver `local-primeiro.ts`. */
export function EscolhaLocal({
  pais,
  aoEscolher,
  aoCartao,
}: {
  pais: PaisLocalPrimeiro;
  aoEscolher: (metodo: MetodoDlocal) => void;
  aoCartao: () => void;
}) {
  const T = TEXTO[pais];
  return (
    <div className="mx-2 space-y-3 text-left">
      <p className="px-1 text-sm font-semibold">{T.titulo}</p>
      <button
        onClick={() => aoEscolher(T.principal.metodo)}
        className="w-full rounded-2xl border-2 border-primary bg-primary/5 px-4 py-4 text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold">{T.principal.rotulo}</span>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            {T.selo}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-snug text-muted-foreground">{T.principal.sub}</span>
      </button>
      <button
        onClick={() => aoEscolher(T.outra.metodo)}
        className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-left"
      >
        <span className="block text-sm font-medium">{T.outra.rotulo}</span>
        <span className="mt-1 block text-xs leading-snug text-muted-foreground">{T.outra.sub}</span>
      </button>
      <button onClick={aoCartao} className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-left">
        <span className="block text-sm font-medium">{T.cartao}</span>
      </button>
    </div>
  );
}
