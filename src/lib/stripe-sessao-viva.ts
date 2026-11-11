// A SESSÃO DO STRIPE QUE A CHAVE DEVOLVE PODE JÁ TER MORRIDO (11/11).
//
// O caixa reaproveita a sessão pela chave de idempotência (mesmo quiz e mesmo
// corpo = mesma sessão, por 24h: reabrir a folha não cria outra). Só que a
// resposta guardada pela idempotência é a da CRIAÇÃO, sempre `open`. Quando o
// Stripe encerra a sessão antes (antifraude depois de várias recusas do banco:
// o fiv*** teve 7 recusas e a sessão expirou 19 min depois de criada), a chave
// continuava devolvendo a sessão morta, e a folha mostrava "ya pagaste o se
// agotó el tiempo". Ele reabriu essa tela 28 vezes em 24h até conseguir pagar.
//
// Por isso, depois de pegar a sessão, o servidor pergunta o estado ATUAL dela
// (GET) e decide aqui. Regra pura, testada em `stripe-sessao-viva.test.ts`.

export type DecisaoSessao = "usa" | "ja-pago" | "nova";

/**
 * `open` serve. `complete` é pagamento feito (o webhook pode não ter chegado
 * ainda): a folha vai pro obrigado. `expired` (ou qualquer outro estado) pede
 * sessão nova. Sem conseguir ler o estado, usa a que tem, como antes: nunca
 * pior que o comportamento de antes deste conserto.
 */
export function decidirSessao(status: string | null | undefined): DecisaoSessao {
  if (!status || status === "open") return "usa";
  if (status === "complete") return "ja-pago";
  return "nova";
}

/** A chave da sessão que substitui uma morta: determinística (reabrir não cria outra) e única por morta. */
export function chaveDepoisDaMorta(chaveBase: string, idMorta: string): string {
  return `${chaveBase}:apos:${idMorta}`.slice(0, 255);
}
