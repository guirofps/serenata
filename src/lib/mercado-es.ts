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

// ── POR QUE A ARGENTINA É UMA POSIÇÃO PRÓPRIA ────────────────────
//
// `latam` é espanhol NEUTRO, desenhado pra atender Argentina, Chile, Peru e
// Colômbia na mesma verba. Neutro é o certo quando a verba é dividida — e é
// o errado quando ela vai inteira pra um país só.
//
// O prompt neutro proíbe o voseo POR ESCRITO ("usa tú, nunca vos"). Só que
// nenhum argentino diz "tú eres mi": diz "vos sos". Uma canção de amor em
// `tú` pra um argentino soa como novela mexicana dublada — entendível e
// estrangeira, que é o pior lugar pra um presente.
//
// Muda também o clichê ("mariposas en la panza", não "en el estómago") e o
// gênero: rock nacional e cuarteto são de lá e não existem na lista neutra.
//
// ── OS HISPANOS DOS EUA SÃO O MERCADO DA BALLAD, NÃO UMA POSIÇÃO DA CHAVE ──
//
// O `/es` do balladgift.com atende o hispano que mora nos Estados Unidos
// (maioria de origem mexicana, depois centro-americano e caribenho). É `tú`
// e `ustedes` como no `latam`, mas com três diferenças que fazem dele um
// mercado próprio: paga em dólar pelo Stripe, a história às vezes vem em
// inglês ou em spanglish, e o regional mexicano vai na frente do seletor.
//
// Ele NÃO é uma posição a mais na linha de baixo: quem decide é a MARCA do
// deploy (`ehBallad`). A Serenata continua na Argentina, a Ballad fica nos
// EUA, e trocar o mercado de uma nunca mexe na outra. Onde o código pergunta
// `ehArgentina()` / `ehEspanha()`, a Ballad cai no ramo neutro (`tú`), que é
// o certo pra ela; onde precisa de mais que isso, pergunta `ehEua()`.
//
// ── NA BALLAD, O PAÍS DO ACESSO ESCOLHE O ESPANHOL (29/10/2026) ──
//
// A Ballad passou a vender no México, na Espanha, na Colômbia, no Chile e no
// Peru (`mercados.ts`). O deploy é um só e a URL também (`/es`), então quem
// decide é o PAÍS da requisição (`x-vercel-ip-country`), lido no servidor e
// carimbado no `<html data-pais>` do HTML que ele manda. Nada de redirecionar
// por IP: a URL anunciada é a URL que abre, em todo país.
//
//   EUA      → `eua`      o de sempre (spanglish na letra, regional mexicano)
//   México   → `mexico`   o `eua` sem as frases que só valem dentro dos EUA
//   Espanha  → `espanha`  `vosotros`, copla e cantautor (já existia, sem porta)
//   CO/CL/PE → `latam`    neutro, `tú`, com o gênero do país na frente
//   resto    → `eua`      como era antes de 29/10
//
// A Serenata não muda: continua na Argentina, pela marca.
//
// ── DE ONDE VEM O PAÍS, EM CADA LADO ─────────────────────────────
//
// Este arquivo é puro (roda no navegador, no servidor e nos jobs), então ele
// não lê cabeçalho nenhum: pergunta a uma FONTE. No navegador a fonte padrão
// é o `data-pais` do `<html>`, que o servidor já mandou carimbado, e por isso
// a hidratação vê o mesmo país que desenhou o HTML. No servidor, o middleware
// de `start.ts` liga a fonte do cabeçalho (`pais-requisicao.server.ts`). Nos
// jobs e webhooks não há requisição de visitante: quem precisa do mercado lá
// passa o país gravado na linha do quiz (`quiz_responses.pais`) como
// argumento, e sem argumento vale o padrão de sempre (EUA).
import { ehBallad } from "./marca-identidade.js";
import { mercadoDoPais } from "./mercados.js";

export type MercadoEs = "latam" | "espanha" | "argentina" | "eua" | "mexico";

/** O país do `<html data-pais>`, no navegador. Fora dele, ninguém sabe. */
function paisDoDocumento(): string | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.getAttribute("data-pais");
}

let fontePais: () => string | null | undefined = paisDoDocumento;

/** O servidor troca a fonte pela do cabeçalho da requisição (`pais-requisicao.server.ts`). */
export function definirFontePais(fonte: () => string | null | undefined): void {
  fontePais = fonte;
}

/** O país desta requisição (servidor) ou desta página (navegador). Fonte que falha = `null`. */
export function paisAtual(): string | null {
  try {
    return fontePais() ?? null;
  } catch {
    return null;
  }
}

/**
 * O mercado que a rota `/es` atende NESTA requisição. Na Serenata, a linha do
 * `return` final continua sendo a chave (Argentina hoje).
 *
 * `pais` explícito vence a fonte: é como os jobs e o servidor da letra dizem
 * "este quiz é da Espanha" sem depender de quem está pedindo agora.
 *
 * FUNÇÃO e não `const`, e a razão é chata mas real: com `const MERCADO_ES =
 * "latam"` o TypeScript estreita o valor pro literal e passa a acusar
 * `MERCADO_ES === "espanha"` como comparação impossível — ou seja, o código
 * PARA DE COMPILAR dependendo de qual mercado está ativo. O tipo de retorno
 * declarado impede esse estreitamento, e as duas posições da chave compilam
 * igual.
 */
export function mercadoEs(pais?: string | null): MercadoEs {
  if (ehBallad()) return mercadoDoPais(pais === undefined ? paisAtual() : pais).conteudo;
  return "argentina";
}

export const ehEspanha = (pais?: string | null) => mercadoEs(pais) === "espanha";
export const ehArgentina = (pais?: string | null) => mercadoEs(pais) === "argentina";
/** Só os EUA. Pra o que vale também no México (a base americana), `herdaEua`. */
export const ehEua = (pais?: string | null) => mercadoEs(pais) === "eua";
export const ehMexico = (pais?: string | null) => mercadoEs(pais) === "mexico";
export const ehLatam = (pais?: string | null) => mercadoEs(pais) === "latam";
/**
 * EUA ou México: o conteúdo nascido pros hispanos dos EUA (gêneros com o
 * regional mexicano na frente, exemplos, copy do Stripe). O México herda tudo,
 * menos o que fala de morar nos EUA e de dólar.
 */
export const herdaEua = (pais?: string | null) => {
  const m = mercadoEs(pais);
  return m === "eua" || m === "mexico";
};
