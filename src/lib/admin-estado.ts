// QUAL TELA O PAINEL MOSTRA, quando são quatro consultas em vez de uma.
//
// Isto era um `catch` dentro do componente, e já custou uma hora em 28/08 por
// mandar TODA falha pra tela de login: o dono digitava a senha certa, a
// consulta do painel estourava o tempo no banco, e ele voltava pro login sem
// mensagem nenhuma. Da cadeira dele, "o admin não loga".
//
// Com o carregamento progressivo o problema muda de forma: agora há QUATRO
// falhas possíveis ao mesmo tempo, e elas não têm o mesmo peso. A decisão saiu
// do componente pra cá porque é regra, não renderização — e regra que já
// custou uma hora merece teste.

export type EstadoDoPainel =
  { tela: "painel" } | { tela: "login" } | { tela: "falha"; mensagem: string };

/** O que `exigirAdmin` lança quando o cookie não vale mais. */
const PEDE_SENHA = /nao-autorizado/;

const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Decide a tela a partir das falhas das consultas.
 *
 * `nucleo` é a consulta sem a qual não há painel (faturamento, funil, gráfico).
 * `acessorios` são as que enfeitam: o comparativo das setinhas, o resumo de
 * e-mail, o saldo do provedor.
 */
export function decidirEstado({
  nucleo,
  acessorios,
}: {
  nucleo: unknown;
  acessorios: Array<unknown>;
}): EstadoDoPainel {
  // LOGIN VENCE FALHA. Sessão expirada faz as quatro consultas falharem de
  // uma vez, e as acessórias podem estourar por motivo próprio no mesmo
  // instante. Se a falha ganhasse, a pessoa clicaria em "tentar de novo" pra
  // sempre — a única coisa que resolve é digitar a senha.
  if ([nucleo, ...acessorios].some((e) => e && PEDE_SENHA.test(mensagemDe(e)))) {
    return { tela: "login" };
  }

  // ACESSÓRIA FALHANDO NÃO DERRUBA O PAINEL, e esta é a regra que o
  // carregamento progressivo criou. O saldo do kie.ai é um fetch externo de 5s
  // e o resumo de e-mail é uma RPC de 13,6s: os dois falham sozinhos, com o
  // resto da operação de pé. É a mesma escolha que `admin-dados` já defende
  // por escrito — não saber a taxa de abertura é ruim, não ver o faturamento
  // é pior. Cada bloco mostra a própria ausência; a tela continua.
  if (!nucleo) return { tela: "painel" };

  // Mensagem vazia viraria uma tela de erro em branco, que não diz o que
  // fazer. `Error("")` acontece: alguns clientes de banco lançam assim.
  return { tela: "falha", mensagem: mensagemDe(nucleo) || "erro desconhecido" };
}
