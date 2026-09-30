// O WEBHOOK DO STRIPE CALOU? A leitura, pura, pro `vigiaWebhook` da Ballad.
//
// ── POR QUE NÃO É O MESMO SINAL DA WOOVI ─────────────────────────
//
// Na Woovi a prova de movimento é "cobrança criada": cada PIX gerado escreve
// um pedido pendente, e quem gera PIX está com o app do banco aberto. No
// Stripe o pedido pendente nasce quando o formulário de cartão ABRE, antes de
// a pessoa digitar qualquer coisa. Abrir o formulário e desistir é o caso
// comum, então "N pendentes e o webhook calado" gritaria toda noite.
//
// O sinal do Stripe é mais afiado que isso, porque a Ballad tem DUAS portas
// que confirmam o pagamento: o webhook e a `/obrigado` (o Embedded Checkout
// sempre volta pra lá, e ela chama o mesmo `confirmarSessaoStripe`). Quando o
// webhook funciona, ele grava `stripe_webhook` segundos depois de qualquer
// venda, inclusive das que a `/obrigado` confirmou primeiro. Então:
//
//   "Tem venda confirmada há mais de 20 minutos, e o webhook não disse UMA
//    palavra desde ela?"
//
// Isso não é suspeita, é fato: o Stripe já sabe que foi pago e não nos contou.
// E com o webhook calado, quem pagar e fechar a aba antes da `/obrigado`
// carregar fica sem música, que é o defeito de 18/08 de novo.
//
// SEM IMPORTS: lido por job do Inngest, e testado sem banco.

/** Tempo que o Stripe tem pra falar depois de uma venda. Normal: segundos. */
export const FOLGA_STRIPE_MIN = 20;

export type LeituraStripe = {
  /** Instantes (ms) das vendas pagas no Stripe, confirmadas por qualquer porta. */
  vendas: number[];
  /** Instante (ms) do último `stripe_webhook`, ou null se ele nunca falou. */
  ultimaFala: number | null;
  agora: number;
};

export type VeredictoStripe = {
  avisar: boolean;
  /** Vendas confirmadas depois da última fala, e já fora da folga. */
  semVoz: number;
  minutosMudo: number | null;
};

export function stripeMudo(l: LeituraStripe): VeredictoStripe {
  const corte = l.agora - FOLGA_STRIPE_MIN * 60000;
  const desde = l.ultimaFala ?? -Infinity;
  // Só conta venda que o webhook JÁ devia ter comentado: depois da última
  // fala dele, e com mais de 20 minutos. A venda dos últimos 20 minutos ainda
  // está dentro do tempo de entrega e não prova nada.
  const semVoz = l.vendas.filter((t) => Number.isFinite(t) && t > desde && t <= corte).length;
  const minutosMudo = l.ultimaFala == null ? null : Math.round((l.agora - l.ultimaFala) / 60000);
  return { avisar: semVoz > 0, semVoz, minutosMudo };
}
