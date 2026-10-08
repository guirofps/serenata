import { FORA } from "@/lib/experimentos";

// O QUE O `/retomar` DEVOLVE AO NAVEGADOR NOVO, além da letra (08/10).
//
// Quem abre o e-mail de recuperação em OUTRO aparelho chega sem nada no
// navegador. Duas coisas se perdiam no caminho:
//
// 1. O BRAÇO. O `/retomar` gravava `mp_exp:*` no localStorage, mas
//    `varianteDe` lê o atributo `data-exp-*` do `<html>`, que o script inline
//    carimba UMA vez, no carregamento. O `/criar` é rota do cliente, o script
//    não roda de novo, e a pessoa via o braço que ESTE aparelho acabou de
//    sortear: preço diferente do que o e-mail prometeu e leitura suja.
//
// 2. A ATRIBUIÇÃO. A RPC `upsert_quiz_response` SUBSTITUI `attribution` por
//    qualquer objeto não vazio que o cliente mande. O aparelho novo manda o
//    dele (sem `gclid`, às vezes com `utm_source=email`), e a primeira
//    captura de lead depois do `/retomar` apagava o clique do anúncio da
//    linha: a venda que voltava pelo e-mail não casava mais com campanha
//    nenhuma no upload de conversões. O conserto é do lado do cliente
//    (mandar o objeto mesclado), sem mexer na RPC.
//
// Puro de propósito: o teste segura as duas regras sem navegador.

type Atrib = Record<string, unknown>;

/**
 * O registro do servidor POR CIMA do que este aparelho capturou: o registro
 * é o primeiro toque de verdade (o clique do anúncio). Chaves que só o
 * aparelho tem sobrevivem.
 */
export function mesclarAtribuicao(local: Atrib | null | undefined, registro: Atrib | null | undefined): Atrib | null {
  const reg = registro && typeof registro === "object" && Object.keys(registro).length ? registro : null;
  if (!reg) return local ?? null;
  const out: Atrib = { ...(local ?? {}), ...reg };
  if (!out.captured_at) out.captured_at = new Date().toISOString();
  return out;
}

/**
 * Os braços do registro que ainda valem: experimento ATIVO e variante que
 * existe nele (ou `fora`). Braço de experimento desligado ou variante apagada
 * não vira atributo: `varianteDe` devolveria um nome que nenhuma tela conhece.
 */
export function bracosQueValem(
  exp: Record<string, unknown> | null | undefined,
  ativos: Array<{ id: string; variantes: Array<{ nome: string }> }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!exp) return out;
  for (const e of ativos) {
    const v = exp[e.id];
    if (typeof v !== "string" || !v) continue;
    if (v === FORA || e.variantes.some((x) => x.nome === v)) out[e.id] = v;
  }
  return out;
}
