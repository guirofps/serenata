// AS FORMAS DA ABA DE AUTOMAÇÕES — só tipos e rótulos.
//
// Este arquivo entra no bundle do cliente, então ele NÃO conhece os templates
// de `emails/` nem a tabela da escada. O catálogo de verdade (qual régua
// existe, quando cada e-mail sai, o HTML de cada um) mora em
// `automacoes.server.ts` e chega ao cliente pela server function, já
// renderizado. Ver a regra de higiene no CLAUDE.md: nada de rota
// administrativa no bundle.

export type Remetente = "transacional" | "recuperacao";

export type Fase = "antes" | "compra" | "depois";

export type EmailDaAutomacao = {
  /** A etiqueta gravada em `emails_enviados.template`. É a chave das estatísticas. */
  template: string;
  nome: string;
  /** Quando sai, em relação ao passo anterior ou ao gatilho. Texto pra gente ler. */
  quando: string;
  /** Idiomas em que existe versão. `es` só onde o template tem COPY em espanhol. */
  idiomas: Array<"pt" | "es">;
};

export type Automacao = {
  /** O `id` da função no Inngest, ou o nome do webhook quando não é cron. */
  id: string;
  nome: string;
  fase: Fase;
  /** Como é disparada: cron traduzido pra gente, ou o evento. */
  gatilho: string;
  quemRecebe: string;
  /** Quem NÃO recebe, quando a exclusão é a regra que importa. */
  quemNao?: string;
  remetente: Remetente;
  /** Onde mora o código, pra quem quiser mexer. */
  arquivo: string;
  emails: EmailDaAutomacao[];
};

/**
 * O que saiu e o que voltou de UM template, no período.
 *
 * Conta ENVIO, não evento nem pessoa: cada linha de `emails_enviados` é um
 * e-mail que saiu, e "abriram" é quantos desses foram abertos ao menos uma
 * vez. Por pessoa (como a aba E-mail faz) esconderia o segundo toque do PIX
 * e os dez degraus da escada, que são envios distintos pra mesma pessoa.
 */
export type EstatisticaTemplate = {
  template: string;
  enviados: number;
  entregues: number;
  abriram: number;
  clicaram: number;
  voltaram: number;
  /** Quem clicou em descadastrar tendo este como o ÚLTIMO e-mail recebido. */
  descadastros: number;
  /**
   * Compras cujo último e-mail antes do pagamento foi este (last-touch entre
   * os e-mails, não entre todas as origens). Só conta quem pagou DEPOIS de
   * receber, em até 30 dias.
   */
  vendas: number;
  receita: number;
};

export type PainelAutomacoes = {
  automacoes: Automacao[];
  /** Por template. Template sem envio no período não aparece aqui. */
  estatisticas: EstatisticaTemplate[];
  /** Etiquetas que saíram no período e o catálogo não conhece: régua nova sem mapa. */
  desconhecidos: EstatisticaTemplate[];
  /** O que faltou: consulta que falhou, migration que não rodou. */
  avisos: string[];
};

export type PreviewEmail = {
  template: string;
  locale: "pt" | "es";
  assunto: string;
  html: string;
  /** Vazio quando o template não tem versão nesse idioma. */
  aviso?: string;
};

export const FASES: Record<Fase, string> = {
  antes: "Antes de comprar",
  compra: "A compra",
  depois: "Depois da compra",
};

export const REMETENTES: Record<Remetente, { rotulo: string; endereco: string }> = {
  transacional: { rotulo: "transacional", endereco: "contato@serenatagift.com" },
  recuperacao: { rotulo: "recuperação", endereco: "ola@envio.serenatagift.com" },
};
