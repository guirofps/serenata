// OS PRODUTOS DE RECOMPRA, e quanto crédito cada um dá.
//
// Um crédito = uma música NOVA completa. Não é versão alternativa da mesma
// letra: é outro quiz, outra letra, outra música, com as duas gravações, a
// página presente, o link, o QR Code e o MP3. Exatamente o que a compra de
// R$ 38 entrega, só que mais barato porque a pessoa já é cliente e a segunda
// venda não custa anúncio nenhum.
//
// A conta que justifica o desconto (medida em 17/08):
//
//                     1a venda (R$ 38)   2a venda (R$ 28)
//   API                    R$ 0,40           R$ 0,40
//   gateway                R$ 2,30           R$ 1,90
//   ANÚNCIO                R$ 23             zero
//   sobra                  ~R$ 12            ~R$ 25,70
//
// A segunda música lucra mais que o dobro da primeira.
//
// ── CRÉDITO INVERTE A ORDEM DO PAGAMENTO ─────────────────────────
//
// O funil gera a música ANTES de cobrar, e essa regra existe pra nunca cobrar
// por algo que não foi produzido. Aqui é o contrário: ela paga, depois gera.
// Isso é seguro porque crédito é uma promessa que a gente controla, e não um
// arquivo que pode falhar no provedor. Mas é OUTRO caminho, e não deve ser
// encaixado no paywall da letra grátis.
//
// ── POR QUE NÃO EXISTE PACOTE DE 10 ──────────────────────────────
//
// Medido em 17/08: dos 290 compradores, 279 fizeram UMA música e 11 fizeram
// duas. NINGUÉM fez três. E o "pra quem" explica: 160 esposa, 30 namorada, 29
// filha, 28 marido. É presente pra uma pessoa, não coleção.
//
// Um pacote de 10 não venderia 10 músicas, daria desconto de 79% pra quem
// compraria 2, e ensinaria que a música vale R$ 8, o que envenena a percepção
// dos R$ 38 na hora que alguém printar. Se aparecer gente comprando o de 3 e
// voltando, aí sim vale criar.

export type Oferta = {
  id: "extra" | "tres" | "quadro";
  /** Quantas músicas novas o crédito libera. O quadro não dá crédito. */
  creditos: number;
  precoBrl: number;
  /** Link de checkout da Perfect Pay. */
  checkout: string;
  /**
   * `product.code` da Perfect Pay (formato PPPB...). É o jeito CERTO de
   * reconhecer a compra no webhook: sobrevive a mudança de preço, promoção e
   * cupom, que o valor não sobrevive.
   *
   * Os três foram criados como PRODUTOS separados, não como planos do produto
   * principal. Por isso a chave é `product.code` e não `plan.code`.
   */
  productCode: string;
};

// O produto principal, pra referência: product.code PPPBF7CL, plan.code
// PPLQQQ4CU, "Serenata · Música personalizada + Página presente". Descoberto
// lendo um payload REAL da auditoria, não chutando.
export const PRODUTO_PRINCIPAL = "PPPBF7CL";

/**
 * O preco cheio da musica avulsa no funil BR, em reais. E a ancora dos selos
 * de desconto do painel.
 *
 * Ele existe pra o selo poder ser VERDADE: R$ 28 contra R$ 38 e 26% de
 * desconto de verdade, e R$ 67 por tres contra R$ 114 e 41% de verdade. Selo
 * de desconto ancorado em preco inventado e alegacao falsa, e alegacao falsa
 * derruba conta no Google Ads.
 *
 * Vem de `i18n.ts` (`pt.valor`), e precisa andar junto com ele: se o funil
 * subir pra R$ 42 e isto ficar em 38, o selo passa a mentir pra baixo.
 *
 * NAO SERVE PRO FUNIL ES. La a compra foi em dolar (US$ 9,90) e os upsells
 * sao cobrados em real pela Perfect Pay: riscar "R$ 114" pra quem pagou em
 * dolar compara duas moedas diferentes. Por isso o painel so mostra o selo e
 * o preco riscado em pt.
 */
export const PRECO_CHEIO = 38;

export const OFERTAS: Oferta[] = [
  {
    id: "extra",
    creditos: 1,
    precoBrl: 28,
    checkout: "https://go.perfectpay.com.br/PPU38CQFE9E",
    productCode: "PPPBFA6E",
  },
  {
    id: "tres",
    creditos: 3,
    precoBrl: 67,
    checkout: "https://go.perfectpay.com.br/PPU38CQFE9J",
    productCode: "PPPBFA6G",
  },
  {
    id: "quadro",
    // O quadro não é música: é a folha A4 pra imprimir e emoldurar. Fica na
    // mesma lista porque é comprado no mesmo lugar, mas não gera crédito.
    creditos: 0,
    precoBrl: 24.9,
    checkout: "https://go.perfectpay.com.br/PPU38CQFE9O",
    productCode: "PPPBFA6H",
  },
];

/**
 * Qual oferta foi comprada, e por qual caminho o webhook descobriu.
 *
 * DOIS CAMINHOS, e a ordem importa:
 *
 * 1. `product.code`, que é como os três foram criados na Perfect Pay. É
 *    estável: sobrevive a mudança de preço, a promoção e o cupom.
 * 2. O VALOR, enquanto o código não estiver cadastrado. Funciona hoje e quebra
 *    no dia que um preço mudar, então é ponte, não destino.
 *
 * Devolve `null` quando não reconhece NADA, e aí o webhook alerta em vez de
 * engolir: pagar e não receber é o pior defeito possível, e sumir em silêncio
 * é como ele acontece.
 */
export function reconhecerOferta(
  productCode: string | null,
  valorReais: number | null,
): { oferta: Oferta; via: "codigo" | "valor" } | null {
  if (productCode) {
    const porCodigo = OFERTAS.find((o) => o.productCode && o.productCode === productCode);
    if (porCodigo) return { oferta: porCodigo, via: "codigo" };
    // O produto principal não é upsell: não credita nada, e também não é
    // "desconhecido" que mereça alerta.
    if (productCode === PRODUTO_PRINCIPAL) return null;
  }
  if (valorReais != null) {
    // Tolerância de 1 centavo: o gateway às vezes devolve 28.00 e às vezes
    // 27.999999 dependendo de como o número trafegou.
    const porValor = OFERTAS.find((o) => Math.abs(o.precoBrl - valorReais) < 0.011);
    if (porValor) return { oferta: porValor, via: "valor" };
  }
  return null;
}

/** Texto de cada oferta, nos dois idiomas do produto. */
export const TEXTO_OFERTA = {
  pt: {
    extra: {
      titulo: "Mais uma música",
      sub: "Uma música nova, completa, pra outra pessoa que você ama.",
      cta: "Quero mais uma",
    },
    tres: {
      titulo: "Três músicas",
      sub: "Leve três, pague duas. Os créditos não expiram.",
      cta: "Quero as três",
      selo: "mais escolhido",
    },
    quadro: {
      titulo: "O quadro da música",
      sub: "A letra da música e a foto de vocês numa folha A4, com o QR Code que toca a música. Você salva em PDF aqui, manda imprimir, compra uma moldura de A4 e pendura na parede.",
      cta: "Quero o quadro",
      exemplo: "ver um exemplo",
    },
  },
  es: {
    extra: {
      titulo: "Una canción más",
      sub: "Una canción nueva, completa, para otra persona que amas.",
      cta: "Quiero una más",
    },
    tres: {
      titulo: "Tres canciones",
      sub: "Llévate tres, paga dos. Los créditos no vencen.",
      cta: "Quiero las tres",
      selo: "el más elegido",
    },
    quadro: {
      titulo: "El cuadro de la canción",
      sub: "La letra de la canción y su foto en una hoja A4, con el código QR que reproduce la canción. La guardas en PDF aquí, la mandas a imprimir, compras un marco A4 y la cuelgas en la pared.",
      cta: "Quiero el cuadro",
      exemplo: "ver un ejemplo",
    },
  },
} as const;
