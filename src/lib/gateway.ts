// O CONTRATO DE GATEWAY DE PIX.
//
// ── POR QUE EXISTE ───────────────────────────────────────────────
//
// "Failover entre gateways" só é real se trocar de gateway for mudar um
// valor. Se for reescrever o checkout, ninguém troca — e a hora de trocar é
// exatamente a hora em que ninguém tem tempo de reescrever nada.
//
// Então o funil chama ESTE contrato. Ele não sabe se está falando com a
// Woovi, com a MillionsPay ou com o que vier depois.
//
// ── NÃO USA `@/` ─────────────────────────────────────────────────
//
// Este arquivo é carregado pelo runtime Node da Vercel (pelos webhooks em
// `api/`), e lá o alias não resolve. Foi assim que o `/api/inngest` ficou
// quatro horas fora do ar em 26/08. Só import relativo com `.js`.

/** Erro de gateway. Nunca derruba a venda: quem chama decide o fallback. */
export class ErroGateway extends Error {
  constructor(
    message: string,
    readonly gateway: string,
    /** `true` quando vale tentar outro gateway (rede, 5xx, timeout). */
    readonly tentarOutro: boolean,
  ) {
    super(message);
    this.name = "ErroGateway";
  }
}

/** A cobrança PIX, do jeito que a tela precisa dela. */
export type CobrancaPix = {
  /** Quem processou. Vai pra `pedidos.gateway`. */
  gateway: string;
  /** O id no gateway. Compõe `pedidos.payment_id`. */
  idExterno: string;
  /**
   * O EMV do PIX: a string `00020101...` que a pessoa cola no banco.
   *
   * O QR é desenhado no NAVEGADOR a partir dela. Imagem remota numa tela de
   * pagamento é mais um ponto que pode falhar, e falha em silêncio: a pessoa
   * vê um retângulo vazio e vai embora.
   */
  copiaECola: string;
  valorCentavos: number;
  /** Taxa cobrada pelo gateway, quando ele informa na criação. */
  taxaCentavos: number | null;
  expiraEm: string | null;
};

/** O que a gente pergunta quando quer saber se pagou de verdade. */
export type StatusCobranca = {
  pago: boolean;
  /** O texto cru do gateway, pra auditoria. */
  statusCru: string;
  valorCentavos: number | null;
  taxaCentavos: number | null;
  /**
   * Nome do TITULAR DA CONTA que pagou, quando o gateway informa.
   *
   * Nao confundir com `pedidos.nome_pagador`, que apesar do nome guarda a
   * pessoa HOMENAGEADA (e o `customer.name` que mandamos na cobranca). Foi
   * essa confusao que deixou um pedido de reembolso da Woovi, em 31/08, sem
   * nenhum pedido correspondente encontravel no nosso banco.
   *
   * Opcional porque nem todo gateway informa. So o nome, nunca o documento.
   */
  titularPix?: string | null;
};

export type GatewayPix = {
  /** Nome curto, sem espaço. Vai pro banco e pro painel. */
  nome: string;

  /**
   * Cria a cobrança.
   *
   * `referencia` é a chave de idempotência: chamar duas vezes com a mesma
   * referência tem que devolver a MESMA cobrança, não criar outra. É o que
   * protege de duplo-clique e de reload virarem dois PIX na conta da pessoa.
   */
  criar(args: {
    referencia: string;
    valorCentavos: number;
    descricao: string;
    nome?: string | null;
    email?: string | null;
  }): Promise<CobrancaPix>;

  /**
   * Pergunta o status NA FONTE.
   *
   * Chamado sempre que um webhook chega, mesmo quando o webhook é assinado.
   * A assinatura prova que a mensagem veio do gateway; só a consulta prova
   * que o dinheiro entrou. São coisas diferentes e as duas importam.
   */
  consultar(idExterno: string): Promise<StatusCobranca>;
};
