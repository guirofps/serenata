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
};

export const OFERTAS: Oferta[] = [
  {
    id: "extra",
    creditos: 1,
    precoBrl: 28,
    checkout: "https://go.perfectpay.com.br/PPU38CQFE9E",
  },
  {
    id: "tres",
    creditos: 3,
    precoBrl: 67,
    checkout: "https://go.perfectpay.com.br/PPU38CQFE9J",
  },
  {
    id: "quadro",
    // O quadro não é música: é a folha A4 pra imprimir e emoldurar. Fica na
    // mesma lista porque é comprado no mesmo lugar, mas não gera crédito.
    creditos: 0,
    precoBrl: 24.9,
    checkout: "https://go.perfectpay.com.br/PPU38CQFE9O",
  },
];

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
      sub: "A letra e a foto de vocês numa folha A4, pronta pra emoldurar.",
      cta: "Quero o quadro",
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
      sub: "La letra y su foto en una hoja A4, lista para enmarcar.",
      cta: "Quiero el cuadro",
    },
  },
} as const;
