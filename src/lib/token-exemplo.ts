// QUAL MÚSICA É EXEMPLO PÚBLICO, e por isso nunca perde o áudio.
//
// Módulo puro (só lê as duas listas, que também são puras) pra o job de
// limpeza (`inngest/functions/limparAudioAntigo.ts`) e o teste em node
// importarem sem trazer React nem o cliente do Inngest junto.
//
// ── POR QUE O PREFIXO "ex" NÃO BASTA ─────────────────────────────
//
// Em 02/10 a limpeza passou a pular token `ex…`, e isso salvou as músicas
// que NÓS geramos como exemplo (Antônio, Joaquim, Theo, Bianca, as do /es e
// as da Ballad). Mas sete exemplos da home portuguesa são músicas REAIS
// promovidas a vitrine, com token comum de cliente: Eva, Denise, Rose,
// Isabela, Camburi, Gargamel e Li. Sem pedido pago, elas eram "quem nunca
// comprou" e o job apagou o áudio das sete entre 12 e 16/09 (achado em
// 07/10): a página `/p/<token>` abria com o play mudo.
//
// A regra agora é: exemplo é o token `ex…` (geração nossa, inclusive os
// `excriativo…` dos anúncios) OU qualquer token que esteja numa lista de
// exemplos publicada. Promover música nova a exemplo é pôr na lista, e a
// lista já protege.

import { EXEMPLOS_PT } from "./exemplos-pt.js";
import { EXEMPLOS_EN } from "./exemplos-en.js";

/** Tokens das páginas de exemplo listadas (Serenata e Ballad). */
export const TOKENS_EXEMPLO: ReadonlySet<string> = new Set(
  // Exemplo da Ballad ainda não gerado tem token vazio: string vazia nunca
  // pode virar "exemplo", senão protegeria qualquer linha sem token.
  [...EXEMPLOS_PT, ...EXEMPLOS_EN].map((e) => e.token).filter((t) => t.length > 0),
);

/**
 * A música deste token é exemplo público? Token `ex…` é geração nossa (token
 * de cliente é hexadecimal e nunca tem "x"); os outros vêm das listas.
 */
export function ehExemplo(token: string | null | undefined): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  return token.startsWith("ex") || TOKENS_EXEMPLO.has(token);
}
