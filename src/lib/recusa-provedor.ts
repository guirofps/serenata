// O QUE O PROVEDOR DE MÚSICA RESPONDEU, LIDO EM UM LUGAR SÓ.
//
// Puro (sem banco, sem Inngest) porque três pontas precisam da mesma leitura:
// o job (`gerarMusica`, que tira o termo barrado e tenta de novo), a
// repescagem (`repescarFalhadas`, que só volta com falha que PASSA) e o clique
// de comprar (`temMusicaDaSessao`, que refaz música falhada). Se cada uma
// tivesse a sua régua, uma delas ia acabar pagando o Suno de novo por uma
// recusa que se repete do mesmo jeito.
//
// O formato do `erro` gravado em `musicas.erro` (ver `gerarMusica`):
//   "timeout no provedor"
//   "provedor recusou 4x: <errorCode> · <errorMessage>"   (ou o status cru)
//   "teto diário de geração atingido (...)"               (o disjuntor)

/** Tira acento e cedilha. "delícia" e "delicia" viram a mesma coisa. */
export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * O PROVEDOR DIZ QUAL PALAVRA ELE BARROU. Basta ler.
 *
 * Medido em 14/08, depois que a captura do motivo entrou:
 *   "Your lyrics contain producer tag que delicia - we don't reference..."
 *   "Your tags contain artist name pressa - we don't reference..."
 *
 * O filtro de artista do Suno confunde palavra comum do português com nome de
 * gente. "que delícia" virou produtor e "pressa" virou artista. Nenhum dos dois
 * é referência a artista nenhum.
 *
 * Como a mensagem entrega o termo, dá pra tirar exatamente ele e tentar de
 * novo, em vez de repetir a mesma coisa e torcer.
 */
export function termoBarrado(motivo: string | null | undefined): string | null {
  if (!motivo) return null;
  const m = motivo.match(/(?:producer tag|artist name|artist)\s+(.+?)\s+-\s+we don't/i);
  const termo = m?.[1]?.trim();
  // Termo curto demais viraria remoção cega no texto inteiro.
  return termo && termo.length >= 3 ? termo : null;
}

/**
 * O padrão do termo no texto em NFD, IGNORANDO ACENTO.
 *
 * O PROVEDOR DEVOLVE O TERMO SEM ACENTO (08/10). A mensagem diz "producer tag
 * que delicia", e a letra tem "que delícia". A busca antiga era literal, não
 * achava nada, e o job reenviava a MESMA letra nas tentativas seguintes:
 * três recusas pagas pelo mesmo motivo, e a música marcada `falhou`.
 *
 * Cada letra do termo (já sem acento) casa com ela mesma seguida de qualquer
 * marca combinante, e o texto é varrido em NFD, onde "í" é "i" + acento.
 * Assim o termo sai do texto ORIGINAL, e o resto da letra fica intacto.
 * Espaço do termo casa com qualquer espaço, inclusive quebra de linha.
 */
function padraoDoTermo(termo: string, palavraInteira: boolean): RegExp {
  const corpo = [...semAcento(termo).trim()]
    .map((c) => (/\s/.test(c) ? "\\s+" : `${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\p{M}*`))
    .join("")
    .replace(/(\\s\+)+/g, "\\s+");
  // `\b` do JavaScript só conhece ASCII: "é" seria fronteira de palavra.
  // A borda é escrita à mão, com letra, número e marca combinante.
  const antes = palavraInteira ? "(?<![\\p{L}\\p{N}\\p{M}])" : "";
  const depois = palavraInteira ? "(?![\\p{L}\\p{N}\\p{M}])" : "";
  return new RegExp(`${antes}${corpo}${depois}`, "giu");
}

/**
 * Tira o termo barrado de um texto, sem deixar espaço duplo nem vírgula solta.
 *
 * Tenta primeiro a PALAVRA INTEIRA: tirar "pressa" de dentro de "depressa"
 * deixaria um "de" solto no meio do verso. Só se a palavra inteira não
 * aparecer é que tira o pedaço, porque aí foi o pedaço que o provedor viu.
 */
export function semOTermo(texto: string, termo: string): string {
  const nfd = texto.normalize("NFD");
  // Termo que pegava uma quebra de linha não pode juntar dois versos.
  const tirar = (m: string) => (m.includes("\n") ? "\n" : "");
  let limpo = nfd.replace(padraoDoTermo(termo, true), tirar);
  if (limpo === nfd) limpo = nfd.replace(padraoDoTermo(termo, false), tirar);
  return limpo
    .normalize("NFC")
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^[ \t,]+|[ \t,]+$/gm, "")
    .trim();
}

/**
 * FALHA QUE PASSA: vale a pena tentar de novo mais tarde.
 *
 * Timeout sempre foi. O 5xx entrou em 08/10: em 03/10, 100 leads morreram com
 * "provedor recusou 4x: 500 · Internal Error" e "500 · Audio decrypt failed",
 * e a repescagem, que só olhava `timeout%`, nunca voltou neles. Erro 500 é o
 * provedor quebrado por dentro, não a letra, e passa como a fila cheia passa.
 */
export function falhaTransitoria(erro: string | null | undefined): boolean {
  const e = String(erro ?? "").trim();
  if (/^timeout/i.test(e)) return true;
  return /^provedor recusou \d+x: 5\d\d(?!\d)/i.test(e);
}

/**
 * RECUSA DE CONTEÚDO: tentar de novo dá o mesmo resultado.
 *
 * Código 4xx do provedor ou a mensagem que aponta termo barrado. O job já
 * tirou o termo e tentou de novo dentro da mesma execução; mandar a mesma
 * letra outra vez é pagar o Suno pra ouvir a mesma recusa.
 */
export function recusaDeConteudo(erro: string | null | undefined): boolean {
  const e = String(erro ?? "").trim();
  if (!/^provedor recusou/i.test(e)) return false;
  if (/^provedor recusou \d+x: 4\d\d(?!\d)/i.test(e)) return true;
  return /producer tag|artist name|we don't reference|sensitive/i.test(e);
}
