// O ITEM EXTRA DO CHECKOUT (order bump): qual é, quanto custa, e como ele
// viaja na referência do PIX.
//
// Até 25/09 o bump era só o quadro, e pegou ~1% de quem viu (19 em 24 dias,
// com metade do tráfego exposta). O espaço funciona; a oferta é que era fraca.
// O experimento `bump_quadro` passou a testar QUAL item vende mais por
// comprador, cada braço com o seu:
//
//   A   → nada (controle)
//   B2  → quadro, R$ 24,90 (o de sempre)
//   V   → vídeo com as fotos, R$ 19,90
//   C   → o presente completo: vídeo + quadro, R$ 29,90 (de R$ 49,80)
//
// ── O PREÇO SAI DAQUI, NUNCA DO NAVEGADOR ────────────────────────
//
// O navegador diz QUAL item quer; quanto custa é este catálogo que decide, no
// servidor (`criar-pix.ts`). Se o valor viesse de lá, o DevTools levaria
// música e vídeo por R$ 1.
//
// ── O VÍDEO VENDIDO ANTES DAS FOTOS ──────────────────────────────
//
// No checkout ela ainda não subiu foto nenhuma. O vídeo pago aqui nasce
// "esperando as fotos" (`videos.status = aguardando_fotos`) e só renderiza
// quando ela toca em "Gerar meu vídeo" no editor, ou sozinho depois de uns
// dias (`videoPendente`), pra ninguém pagar e ficar sem.

export type ItemBump = "quadro" | "video" | "completo";

export const BUMPS: Record<
  ItemBump,
  { centavos: number; sufixo: "q" | "v" | "c"; quadro: boolean; video: boolean }
> = {
  quadro: { centavos: 2490, sufixo: "q", quadro: true, video: false },
  video: { centavos: 1990, sufixo: "v", quadro: false, video: true },
  completo: { centavos: 2990, sufixo: "c", quadro: true, video: true },
};

/** Qual item o braço do experimento oferece. `null` = controle, sem bump. */
export function itemDoBraco(braco: string | null | undefined): ItemBump | null {
  if (!braco || braco === "A" || braco === "fora") return null;
  if (braco === "V") return "video";
  if (braco === "C") return "completo";
  // B2 e qualquer braço antigo que ainda esteja grudado num navegador: quadro,
  // que é o que eles viam antes.
  return "quadro";
}

export function ehItemBump(v: unknown): v is ItemBump {
  return v === "quadro" || v === "video" || v === "completo";
}

/** O valor final da cobrança: base + item. */
export function valorComItem(baseCentavos: number, item: ItemBump | null): number {
  return baseCentavos + (item ? BUMPS[item].centavos : 0);
}

/**
 * A referência do PIX, que é a chave de idempotência. O sufixo carrega o
 * item porque a Woovi recusa reaproveitar um correlationID com outro valor.
 * Sempre DEPOIS do id: o webhook corta no primeiro dois-pontos pra achar o quiz.
 *
 * `:i` marca o desconto do convite (member get member), pelo mesmo motivo: o
 * convite muda o valor, e a mesma pessoa pode abrir a folha com e sem ele
 * (o convite só vale na primeira compra, e ela pode trocar o e-mail).
 */
export function referenciaComItem(
  quizId: string,
  item: ItemBump | null,
  convite = false,
): string {
  return `serenata:${quizId}${item ? `:${BUMPS[item].sufixo}` : ""}${convite ? ":i" : ""}`;
}

/**
 * O item que uma referência carrega (`serenata:<id>:v`, e também com o
 * `:r2` que a Woovi acrescenta quando a cobrança anterior venceu).
 * Rede de segurança do webhook: a fonte da verdade é a coluna do pedido.
 */
export function itemDaReferencia(ref: string): ItemBump | null {
  const m = /^serenata:[^:]+:(q|v|c)(?::|$)/.exec(ref);
  if (!m) return null;
  return m[1] === "q" ? "quadro" : m[1] === "v" ? "video" : "completo";
}

/** O que a pessoa leva, pelas colunas do pedido (ou pela referência, na falta). */
export function oQueLeva(args: {
  bumpQuadro?: boolean | null;
  bumpVideo?: boolean | null;
  referencia?: string | null;
}): { quadro: boolean; video: boolean } {
  const pelaRef = args.referencia ? itemDaReferencia(args.referencia) : null;
  return {
    quadro: args.bumpQuadro === true || (pelaRef ? BUMPS[pelaRef].quadro : false),
    video: args.bumpVideo === true || (pelaRef ? BUMPS[pelaRef].video : false),
  };
}

/** A caixinha no checkout, por item. Sem travessão no texto (regra da casa). */
export const TEXTO_BUMP: Record<ItemBump, { titulo: string; sub: string; de?: string }> = {
  quadro: {
    titulo: "Levar o quadro pra imprimir",
    sub: "A letra e a foto numa folha pronta pra emoldurar. Sai no mesmo PIX.",
  },
  video: {
    titulo: "Levar o vídeo com as fotos",
    sub: "As fotos de vocês passando no ritmo da música, com a letra acendendo. Pra mandar no WhatsApp. Você sobe as fotos depois.",
  },
  completo: {
    titulo: "Levar o presente completo",
    sub: "O vídeo com as fotos e o quadro pra imprimir, juntos. Sai no mesmo PIX.",
    de: "R$ 49,80",
  },
};
