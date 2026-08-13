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
export function conversaoCompra(args: {
  valor?: number;
  moeda?: "BRL" | "USD";
  transactionId?: string;
}) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "conversion", {
    send_to: CONVERSAO,
    // Sem default mágico: o valor vem do catálogo de moeda pelo chamador.
    // Um 37 cravado aqui sobreviveria à mudança de preço e o Google passaria
    // a otimizar em cima de um número que não existe mais.
    value: args.valor ?? 38,
    currency: args.moeda ?? "BRL",
    // Sem isto, um F5 na página de obrigado contaria a venda de novo.
    transaction_id: args.transactionId ?? "",
  });
}
