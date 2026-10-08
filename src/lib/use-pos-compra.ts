import { useEffect, useState } from "react";
import { varianteDe } from "@/lib/experimentos";
import { lerContextoPosCompra, type ContextoPosCompra } from "@/lib/pos-compra-contexto";

// Os dois ganchos dos testes do pós-compra (08/10).

/**
 * O braço desta pessoa, lido DEPOIS de montar.
 *
 * O editor é renderizado no servidor, onde `varianteDe` devolve sempre o
 * controle. Ler no render faria o cliente hidratar com o B uma árvore que o
 * servidor montou com o A (erro de hidratação, a árvore inteira refeita). Até
 * o efeito rodar, volta `null`: quem usa trata como "ainda não sei" e não
 * mostra nada nem mede nada.
 *
 * `elegivel = false` (fora do funil pt) devolve o controle sem nem perguntar.
 */
export function useBraco(id: string, elegivel = true): string | null {
  const [braco, setBraco] = useState<string | null>(null);
  useEffect(() => {
    setBraco(elegivel ? varianteDe(id) : "A");
  }, [id, elegivel]);
  return braco;
}

/** O contexto da compra, buscado só quando `ligado` (o braço B). */
export function useContextoPosCompra(
  tokenEdicao: string | null | undefined,
  ligado: boolean,
): ContextoPosCompra | null {
  const [ctx, setCtx] = useState<ContextoPosCompra | null>(null);
  useEffect(() => {
    if (!ligado || !tokenEdicao) return;
    let vivo = true;
    void lerContextoPosCompra(tokenEdicao).then((c) => {
      if (vivo) setCtx(c);
    });
    return () => {
      vivo = false;
    };
  }, [tokenEdicao, ligado]);
  return ctx;
}
