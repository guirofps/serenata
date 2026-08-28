// Google Ads: tag e conversão de compra.
//
// A conversão dispara na /obrigado, que é o destino do redirect pós-pagamento
// da Perfect Pay. É o caminho padrão e o único que a conta de anúncio aceita
// sem integração de servidor (importação offline exigiria OAuth + developer
// token do Google Ads, o que não se justifica antes de escalar).
//
// LIMITAÇÃO CONHECIDA E ACEITA: se a pessoa pagar e NÃO voltar pro site (comum
// em PIX), essa venda não é contada pelo Google. O número do Google Ads tende
// a ficar ABAIXO do real — o que é seguro (não infla resultado), mas precisa
// ser lembrado ao comparar com o painel da Perfect Pay, que é a verdade.

export const GOOGLE_ADS_ID = "AW-16919557808";
const CONVERSAO = "AW-16919557808/pSbhCOqvttkcELDt74M_";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Dispara a conversão de compra. Chamada uma vez, na página de obrigado.
 *
 * A MOEDA vem junto do valor, e isso não é detalhe. Até 13/08 a conversão
 * mandava `37 BRL` cravado, inclusive nas vendas do funil espanhol, que são
 * em dólar. O Google recebia o valor errado justamente da campanha que a
 * gente está tentando descobrir se vale a pena — e otimiza em cima do que
 * recebe, não do que aconteceu.
 */
// ── O ID DA TRANSAÇÃO QUANDO O GATEWAY NÃO DEVOLVE UM ────────────
//
// A Perfect Pay mandava `?code=` no redirect, e era ele que impedia um F5 na
// página de obrigado de contar a venda duas vezes. No checkout transparente
// não existe redirect de gateway nenhum: a própria tela manda a pessoa pro
// `/obrigado` quando o webhook confirma. Sem substituto, `transaction_id`
// ficava vazio e toda recarga virava conversão nova — conversão inflada
// estraga o lance da campanha, que é o defeito mais caro dessa mesa.
//
// `sessionStorage` e NÃO a URL, de propósito: `/obrigado` fica fora de
// `rotas-sensiveis` pra que o gtag carregue lá, e o gtag manda a URL inteira
// pro Google. Pôr a referência no endereço seria copiar a chave da cobrança
// pra dentro do Analytics por conveniência de três caracteres.
const CHAVE_TX = "mp_tx";

/** Guarda o id desta compra, na hora em que o pagamento é confirmado. */
export function guardarTransacao(id: string): void {
  try {
    sessionStorage.setItem(CHAVE_TX, id);
  } catch {
    // Modo anônimo: perde a dedupe, não perde a venda.
  }
}

/** O id guardado, se houver. Some quando a aba fecha, que é o tempo certo. */
export function transacaoGuardada(): string | undefined {
  try {
    return sessionStorage.getItem(CHAVE_TX) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * O ID DA TRANSAÇÃO, e ele NUNCA pode sair vazio.
 *
 * ── O BUG QUE ISTO CONSERTA, E ELE CUSTOU CARO ───────────────────
 *
 * O Google DEDUPLICA conversão por `transaction_id`. Duas conversões com o
 * mesmo id são a mesma venda — e string vazia é um id como outro qualquer.
 * Ou seja: com o campo vazio, o Google guarda UMA e descarta todas as
 * outras, em silêncio, sem erro em lugar nenhum.
 *
 * A versão anterior fazia `args.transactionId ?? ""`. O id vinha do `?code=`
 * que a Perfect Pay devolvia no redirect, e ele NEM SEMPRE VINHA — o próprio
 * `Obrigado.tsx` já documentava isso desde que 33 compradores em 10 dias
 * caíram na tela sem botão pelo mesmo motivo. Quando não vinha, a venda
 * simplesmente não era contada.
 *
 * Medido em 28/08: 23 vendas num dia, 8 contadas pelo Google. Dois terços
 * jogados fora — e a campanha otimizando em cima do terço que sobrou.
 *
 * Com o checkout transparente virou 100% do problema, porque ali não existe
 * redirect de gateway e o `code` nunca vem.
 *
 * ── A ESCADA DE FALLBACK ─────────────────────────────────────────
 *
 * 1. o id que o chamador passou (o `code`, ou a referência do PIX guardada);
 * 2. a REFERÊNCIA guardada em `sessionStorage` pela tela do PIX;
 * 3. o id da SESSÃO, que é único por comprador e sobrevive ao F5 — então a
 *    dedupe contra recarga continua funcionando, que era o motivo do campo
 *    existir.
 *
 * Se as três falharem (modo anônimo com storage bloqueado), o campo é
 * OMITIDO. Sem id, o Google conta a conversão como única; com id vazio, ele
 * a joga fora. Omitir erra pra cima, e errar pra cima aqui é muito melhor.
 */
function idDaTransacao(passado?: string): string | undefined {
  const candidato = passado?.trim() || transacaoGuardada()?.trim();
  if (candidato) return candidato;
  try {
    // Import dinâmico não dá: isto roda dentro do gtag. `mp_session_id` é a
    // mesma chave que `session-context.ts` usa, lida direto pra não arrastar
    // aquele módulo pra cá.
    const s = localStorage.getItem("mp_session_id")?.trim();
    if (s) return s;
  } catch {
    // storage bloqueado
  }
  return undefined;
}

export function conversaoCompra(args: {
  valor?: number;
  moeda?: "BRL" | "USD";
  transactionId?: string;
}) {
  if (typeof window === "undefined" || !window.gtag) return;
  const id = idDaTransacao(args.transactionId);
  window.gtag("event", "conversion", {
    send_to: CONVERSAO,
    // Sem default mágico: o valor vem do catálogo de moeda pelo chamador.
    // Um 37 cravado aqui sobreviveria à mudança de preço e o Google passaria
    // a otimizar em cima de um número que não existe mais.
    value: args.valor ?? 38,
    currency: args.moeda ?? "BRL",
    // Presente quando existe, AUSENTE quando não existe. Nunca vazio.
    ...(id ? { transaction_id: id } : {}),
  });
}
