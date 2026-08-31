// O CONTRATO DE GATEWAY DE CARTÃO.
//
// Irmão do `gateway.ts` (que é de PIX) e separado dele de propósito: são
// produtos com formas diferentes. PIX cria uma cobrança e ESPERA; cartão
// tenta autorizar e responde na hora, sim ou não. Espremer os dois no mesmo
// contrato faria um deles mentir.
//
// ── NÃO USA `@/` ─────────────────────────────────────────────────
//
// Mesma regra do `gateway.ts`: este arquivo é carregado pelo runtime Node da
// Vercel (pelo webhook em `api/`), e lá o alias não resolve. Foi assim que o
// `/api/inngest` ficou quatro horas fora do ar em 26/08.

import { ErroGateway } from "./gateway.js";

export { ErroGateway };

/**
 * Os dados do cartão, como saem do formulário.
 *
 * ── ISTO NUNCA É GRAVADO, NUNCA É LOGADO ─────────────────────────
 *
 * O objeto existe pra atravessar UMA função e morrer. Não vai pro banco, não
 * vai pro `console.error`, não entra em `auditar` e não aparece em mensagem de
 * erro. Processar cartão no nosso servidor já põe a infraestrutura no escopo
 * do PCI-DSS; deixar o número cair num log transforma escopo em incidente.
 *
 * Quem mexer aqui: o teste `asaas-nao-vaza.test.ts` existe pra quebrar o build
 * se um número de cartão aparecer em qualquer string que a gente produz.
 */
export type DadosCartao = {
  numero: string;
  titular: string;
  validadeMes: string;
  validadeAno: string;
  cvv: string;
};

/**
 * O que o antifraude do gateway exige sobre o dono do cartão.
 *
 * Não é a gente que quer isso: `cpfCnpj`, `postalCode`, `addressNumber` e
 * `phone` são obrigatórios na API do Asaas. Qualquer caminho — formulário
 * nosso ou página deles — pede a mesma coisa.
 */
export type TitularCartao = {
  nome: string;
  email: string;
  cpf: string;
  cep: string;
  numeroEndereco: string;
  telefone: string;
};

/**
 * O desfecho de uma tentativa de cobrança.
 *
 * `recusado` NÃO é erro de integração: é o banco do cliente dizendo não, e a
 * tela precisa tratar isso como um caminho normal, com o cartão ainda na mão
 * da pessoa pra ela tentar outro. Erro de integração vira `ErroGateway`.
 */
export type ResultadoCartao =
  | {
      ok: true;
      gateway: string;
      idExterno: string;
      /** `true` só quando o dinheiro está garantido. Ver `pagou()`. */
      confirmado: boolean;
      /** O status cru do gateway, pra auditoria e pra entender recusa. */
      statusCru: string;
      valorCentavos: number;
      /** Últimos 4 dígitos e bandeira: o que PODE ser guardado. */
      ultimos4: string | null;
      bandeira: string | null;
    }
  | {
      ok: false;
      /** Mensagem PRA PESSOA, já em português e sem jargão de gateway. */
      motivo: string;
      statusCru: string;
    };

export type GatewayCartao = {
  /** Nome curto, sem espaço. Vai pro banco e pro painel. */
  nome: string;

  /**
   * Cobra o cartão e responde na hora.
   *
   * `ipDoPagador` é exigido pela API e tem que ser o IP de QUEM COMPRA, não o
   * do nosso servidor — a documentação do Asaas é explícita. Mandar o IP da
   * função serverless faria todo mundo parecer a mesma pessoa e envenenaria o
   * antifraude deles contra a gente.
   */
  cobrar(args: {
    valorCentavos: number;
    descricao: string;
    referencia: string;
    cartao: DadosCartao;
    titular: TitularCartao;
    ipDoPagador: string;
    parcelas?: number;
  }): Promise<ResultadoCartao>;

  /**
   * Pergunta de novo se pagou.
   *
   * ── AQUI ISTO NÃO É REDUNDÂNCIA, É A ÚNICA PROVA ─────────────
   *
   * O webhook da Woovi é assinado com RSA-SHA256, então lá a assinatura prova
   * ORIGEM e a reconsulta prova PAGAMENTO — duas perguntas, duas travas.
   *
   * O Asaas não assina nada. A autenticação do webhook deles é um token que
   * NÓS escolhemos, mandado num header (`asaas-access-token`). Um token
   * estático prova bem menos que uma assinatura: quem o obtiver forja um
   * postback inteiro. Então a reconsulta deixa de ser a segunda trava e passa
   * a ser a única — é o mesmo desenho que o CLAUDE.md registra pra MillionsPay,
   * pelo mesmo motivo.
   */
  consultar(idExterno: string): Promise<{
    confirmado: boolean;
    statusCru: string;
    valorCentavos: number | null;
    taxaCentavos: number | null;
  }>;

  /**
   * Já existe alguma cobrança com esta referência?
   *
   * ── ESTA PERGUNTA É O QUE TORNA O FAILOVER HONESTO ───────────
   *
   * Quando a chamada de cobrança estoura por rede ou timeout, a gente sabe
   * que NÃO recebeu resposta. Não sabe se o gateway processou. São coisas
   * diferentes, e tratá-las como iguais é o jeito clássico de cobrar duas
   * vezes: manda pro checkout antigo quem já tinha sido debitado aqui.
   *
   * Como a referência é nossa (`serenata:<quiz>`) e viaja como
   * `externalReference`, dá pra perguntar de fora: se apareceu qualquer
   * cobrança com ela, houve processamento e o failover está proibido.
   *
   * Falha ABERTA pro lado seguro: se nem esta consulta responder, a resposta
   * é `true` ("pode ter nascido"), o que BLOQUEIA o failover. Entre perder uma
   * venda e cobrar a pessoa duas vezes, perde-se a venda.
   */
  existeCobranca(referencia: string): Promise<boolean>;
};
