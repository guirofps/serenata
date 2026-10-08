// A DECISÃO DO AJUSTE, separada do servidor pra poder ser testada sem banco
// nem modelo. `refacao.ts` chama o Claude, passa a resposta aqui, e só faz o
// que esta função mandar.
//
// ── POR QUE MUDOU (07/10) ────────────────────────────────────────
//
// Em 7 dias, 36 compradores PAGOS tentaram o ajuste e nunca conseguiram, de
// 155 que tentaram (81 recusas "vago", 30 "falhou", 3 "curto"). Refazendo os
// pedidos reais contra o modelo, a recusa "vago" tinha duas causas:
//
// 1. A regra recusava sempre que o modelo escrevia QUALQUER coisa em `aviso`,
//    mesmo com a letra já trocada. "TI vira T.I e a pronúncia de Eloah saiu
//    estranha": o modelo trocou o TI, comentou que não sabia o que fazer com
//    Eloah, e a troca inteira foi pro lixo. Idem "tira a salsicha, não precisa
//    pôr nada" (tirou, e avisou que o bloco ficou com uma linha a menos).
// 2. O prompt mandava perguntar em vez de agir em pedido que dá pra cumprir:
//    pronúncia de nome, frase nova sem dizer onde entra, letra inteira colada.
//
// Agora a régua é a LETRA: se ela mudou de verdade, o ajuste segue (`aviso` é
// só observação). Recusa só quando a letra voltou igual e o pedido falava da
// letra, que é o caso em que regravar seria cobrar o direito por nada.

/**
 * Teto do pedido, em caracteres. A letra mais longa vista tem ~2.400, e quem
 * cola a letra nova inteira precisa caber (a Carmelina, 07/10, colou 1.480 e
 * o campo cortava em 800). 4.000 são ~1.500 tokens de entrada: centavos, e a
 * saída continua presa ao `max_tokens` do `chamarClaude`. Acima disso não é
 * pedido de ajuste, é outra coisa, e a rota gasta dinheiro (ver `cobrarUso`).
 */
export const PEDIDO_MAX = 4000;

/**
 * O pedido fala da LETRA (incluir, nome, verso, frase, pronúncia...)? "Mudar"
 * e "trocar" ficam de fora de propósito: "quero mudar a voz" é pedido de SOM.
 */
export function pedeLetra(pedido: string): boolean {
  return /\b(inclu|coloc|acrescent|adicion|remov|substitu|corrig|tir[ae]|nome|verso|frase|letra|refr|trecho|palavra|pron[uú]n)/i.test(
    pedido,
  );
}

/**
 * O pedido PARECE uma letra inteira colada? Muitas linhas curtas, sem cara de
 * instrução. Serve só pra avisar o modelo ("se for letra, ela é a nova"); quem
 * decide é ele, então errar aqui custa pouco nos dois sentidos.
 */
export function pareceLetraInteira(pedido: string): boolean {
  const linhas = pedido
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (pedido.length < 300) return false;
  if (linhas.length >= 8) {
    const curtas = linhas.filter((l) => l.length <= 90).length;
    return curtas / linhas.length >= 0.7;
  }
  // Colado do WhatsApp às vezes vem sem quebra de linha: muitas frases curtas
  // separadas por ponto ou vírgula, nenhuma palavra de instrução no começo.
  const frases = pedido.split(/[.,;!?]\s+/).filter((f) => f.trim().length > 0);
  return pedido.length >= 600 && frases.length >= 12 && !/^\s*(quero|queria|gostaria|troc|mud|tir|coloc|inclu)/i.test(pedido);
}

/** Espaço e quebra de linha não contam como mudança. */
export function normalizarLetra(s: string): string {
  return (s ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
}

/**
 * O texto que o cliente lê quando o pedido volta. Vem do modelo, então passa
 * pela regra da casa: sem travessão em texto que o cliente vê.
 */
export function textoProCliente(s: string): string {
  return (s ?? "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export type RespostaAjuste = {
  letra?: string;
  titulo?: string;
  mudou?: unknown;
  aviso?: string;
  falta?: string;
  voz?: string;
};

export type DecisaoAjuste =
  | { tipo: "letra"; letra: string; titulo: string | null }
  | { tipo: "so-som" }
  | { tipo: "vago"; falta: string };

/** Letra devolvida abaixo disto não é letra, é resposta quebrada. */
const LETRA_MIN = 80;

export const FALTA_PADRAO = "Me diz também o que você quer no lugar desse trecho.";

/**
 * Decide o que fazer com a resposta do modelo.
 *
 * - Letra mudou de verdade: segue com a letra nova, haja `aviso` ou `falta`.
 * - Letra igual e o pedido era só de som (voz/estilo novos): regrava só o som.
 * - Letra igual e o pedido falava da letra: `vago`, com a pergunta do modelo.
 *
 * Lança quando a resposta não tem letra utilizável: isso é `falhou`, não
 * `vago`, e o direito também não é gasto.
 */
export function decidirAjuste(args: {
  letraAtual: string;
  resposta: RespostaAjuste;
  pedido: string;
  mudaSom: boolean;
}): DecisaoAjuste {
  const reescrita = (args.resposta.letra ?? "").trim();
  if (reescrita.length < LETRA_MIN) throw new Error("modelo não devolveu letra");

  if (normalizarLetra(reescrita) !== normalizarLetra(args.letraAtual)) {
    return { tipo: "letra", letra: reescrita, titulo: args.resposta.titulo?.trim() || null };
  }

  // Letra intacta. Era pedido de som? Então regrava só o som. Se o pedido
  // falava da letra (o Ronaldo, 01/10: "incluir o nome dos filhos" junto com
  // voz nova), regravar só a voz gastaria o ajuste sem fazer o principal.
  if (args.mudaSom && !pedeLetra(args.pedido)) return { tipo: "so-som" };

  const falta = textoProCliente(args.resposta.falta || args.resposta.aviso || "");
  return { tipo: "vago", falta: falta || FALTA_PADRAO };
}

/** A voz que o modelo leu no texto do pedido, quando a pessoa não usou o botão. */
export function vozDoPedido(resposta: RespostaAjuste): "feminina" | "masculina" | null {
  const v = String(resposta.voz ?? "").toLowerCase().trim();
  return v === "feminina" || v === "masculina" ? v : null;
}
