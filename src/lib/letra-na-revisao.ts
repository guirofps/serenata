// TESTE `letra_na_revisao` (Serenata, funil pt): os refrões começam a ser
// escritos na tela de revisão, antes do toque em "Escrever a letra".
//
// ── O QUE O NÚMERO MOSTROU ───────────────────────────────────────
//
// Entre o último passo do quiz e a tela dos refrões somem 23% das pessoas,
// com ~127s de média de espera (`coautoria_pedida` -> `coautoria_refroes`).
// A Cantoria já fazia isto: a letra começa na revisão e rouba os segundos que
// a pessoa gasta conferindo as respostas.
//
// ── OS BRAÇOS ────────────────────────────────────────────────────
//
//   A = como é hoje: `gerarRefroes` só dispara quando a tela dos refrões abre.
//   B = a revisão dispara `gerarRefroes` em segundo plano assim que monta, e
//       guarda a PROMESSA aqui. A tela dos refrões reaproveita essa promessa
//       se as respostas não mudaram; se mudaram, chama de novo, como no A.
//
// ── POR QUE NÃO COBRA DUAS VEZES ─────────────────────────────────
//
// O teto de uso (`cobrarLetra`, 24 por hora por sessão) é cobrado DENTRO da
// server function, uma vez por chamada. Reaproveitar a promessa é não chamar
// de novo: uma cobrança e uma conta de tokens, as mesmas do A. O que pode
// gastar a mais é a revisão disparar e a pessoa voltar pra mudar alguma
// resposta. Por isso o teto local (`MAX_ADIANTAMENTOS`): nunca mais de dois
// adiantamentos por carregamento de página, e a mesma chave nunca dispara
// duas vezes (StrictMode e re-render não gastam nada).
//
// ── POR QUE A PROMESSA É CONSUMIDA AO SER USADA ──────────────────
//
// Ela vale UMA vez. "Outra opção" e "tentar de novo" precisam de uma chamada
// nova: devolver a mesma promessa de novo mostraria os mesmos dois refrões
// (ou o mesmo erro) pra sempre.

import type { RefroesGerados } from "@/lib/coautoria";

export const EXP_LETRA_NA_REVISAO = "letra_na_revisao";

/** O braço que a tela entende. Pela inicial, pela mesma razão de `folha-pix.ts`. */
export function letraNaRevisaoLigada(variante: string | null | undefined, locale: string): boolean {
  // Só o funil pt: o teste é da Serenata, e o `/es` divide o mesmo banco.
  if (locale !== "pt") return false;
  return String(variante ?? "").trim().toUpperCase().startsWith("B");
}

/** Dois por página: a revisão de agora e, no máximo, uma depois de editar. */
export const MAX_ADIANTAMENTOS = 2;

/**
 * JSON com as chaves em ordem. Sem isto, as mesmas respostas gravadas em
 * outra ordem (a store reidratada do navegador) dariam outra chave, e a
 * promessa pronta seria jogada fora por nada.
 */
export function jsonEstavel(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstavel).join(",")}]`;
  if (valor && typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${jsonEstavel(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valor ?? null);
}

/** FNV-1a de 32 bits. Não é segurança, é só pra a chave não carregar a história inteira. */
export function hashTexto(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Sessão + idioma + respostas. Mudou qualquer uma, é outra letra: a promessa
 * velha foi escrita pra uma história que a pessoa já corrigiu.
 */
export function chaveDosRefroes(sessionId: string, respostas: Record<string, unknown>, locale: string): string {
  return `${sessionId}:${locale}:${hashTexto(jsonEstavel(respostas))}`;
}

type Entrada = { chave: string; promessa: Promise<RefroesGerados>; pronta: boolean; desde: number };

// Uma só, de propósito: só existe uma revisão na tela por vez, e a entrada
// nova (respostas mudaram) substitui a velha.
let adiantada: Entrada | null = null;
let disparos = 0;

/**
 * Dispara `gerar` e guarda a promessa sob `chave`. Devolve `false` quando não
 * disparou (mesma chave já guardada, ou teto da página).
 */
export function adiantarRefroes(chave: string, gerar: () => Promise<RefroesGerados>): boolean {
  if (adiantada?.chave === chave) return false;
  if (disparos >= MAX_ADIANTAMENTOS) return false;
  disparos += 1;
  // `async` em volta: a chamada sai na hora, e um erro síncrono de `gerar`
  // vira promessa rejeitada em vez de estourar dentro do efeito da revisão.
  const entrada: Entrada = { chave, promessa: (async () => gerar())(), pronta: false, desde: Date.now() };
  // Um `catch` que só marca: sem ele, a falha de uma promessa que ninguém
  // chegou a usar viraria "unhandledrejection" no console de quem desistiu.
  entrada.promessa.then(
    () => {
      entrada.pronta = true;
    },
    () => {},
  );
  adiantada = entrada;
  return true;
}

/**
 * A promessa guardada pra ESTA chave, consumida (ver o cabeçalho). `null`
 * quando não há, ou quando as respostas mudaram: aí quem chama segue o A.
 */
export function pegarRefroesAdiantados(
  chave: string,
): { promessa: Promise<RefroesGerados>; pronta: boolean; idadeMs: number } | null {
  const e = adiantada;
  if (!e || e.chave !== chave) return null;
  adiantada = null;
  return { promessa: e.promessa, pronta: e.pronta, idadeMs: Date.now() - e.desde };
}

/** SÓ PARA TESTE. */
export function _resetRefroesAdiantadosParaTeste(): void {
  adiantada = null;
  disparos = 0;
}
