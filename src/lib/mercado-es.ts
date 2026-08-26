// QUAL ESPANHOL ESTAMOS VENDENDO.
//
// A rota `/es` é uma só, mas o país que ela atende não é. Até 26/08 a verba
// ia pra Argentina, Chile, Peru e Colômbia; a partir do teste da Espanha ela
// aponta pra lá. São mercados incompatíveis em três frentes, e é por isso que
// isto é um interruptor e não uma tradução:
//
//   GRAMÁTICA   Espanha usa `vosotros`, `os` e `vuestro`. O prompt latino
//               PROIBIA essas formas por escrito ("nada de conjugaciones
//               peninsulares"). Escrever pra Espanha com a regra latina
//               produz um texto que soa estrangeiro na primeira linha.
//   CLICHÊ      A lista de frases gastas é outra. Clichê é local, e a lista
//               de clichês é o que separa letra boa de letra de cartão de
//               loja — está escrito no próprio prompt.
//   GÊNERO      Vallenato, tango, cumbia e huayno são de lá; copla, rumba e
//               cantautor são daqui. Um seletor cheio de gênero que a pessoa
//               não reconhece é pior que um seletor curto.
//
// ── POR QUE UM INTERRUPTOR, E NÃO UM LOCALE NOVO ─────────────────
//
// Um `es-ES` de verdade significaria rota nova, canonical novo, SEO dividido
// e o dobro de páginas pra manter — a mesma dívida que fez a home espanhola
// ficar 19 dias com quatro defeitos sem ninguém ver. Pra um TESTE isso é caro
// demais.
//
// Como a verba vai inteira pra um país de cada vez, uma constante resolve: o
// espanhol que sai é o do mercado ativo. Voltar pra LatAm é trocar esta linha.
//
// ── A DEPENDÊNCIA QUE NÃO ESTÁ NO CÓDIGO ─────────────────────────
//
// Isto SÓ está certo enquanto a mídia apontar pra Espanha. Se sobrar campanha
// em Argentina ou Colômbia, aquele visitante vai receber `vosotros` e copla,
// que é pior pra ele do que estava antes. Trocar aqui e não trocar no Google
// Ads é o único jeito de esta mudança piorar as duas pontas ao mesmo tempo.

export type MercadoEs = "latam" | "espanha";

/** O mercado que a rota `/es` atende hoje. */
export const MERCADO_ES: MercadoEs = "espanha";

export const ehEspanha = () => MERCADO_ES === "espanha";
