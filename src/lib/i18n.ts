// IDIOMA — a peça que separa os dois funis sem duplicar o site.
//
// Regra de ouro: o funil português NÃO muda. Nem de URL, nem de comportamento,
// nem de string. `pt` é o default em todo lugar, e todo caminho que não diz
// explicitamente "espanhol" continua caindo em português.
//
// De onde vem o idioma, por superfície:
//
//   | superfície                | fonte                                    |
//   |---------------------------|------------------------------------------|
//   | home, quiz, login, obrig. | o prefixo `/es` da rota                  |
//   | página presente `/p/…`    | a COLUNA locale do registro              |
//   | editor `/editar/…`        | a COLUNA locale do registro              |
//   | os 4 e-mails              | a COLUNA locale do registro              |
//
// As três últimas não têm URL de onde tirar: a página presente é aberta pelo
// presenteado (que nunca passou pelo funil), o editor chega por e-mail, e os
// e-mails saem de webhook e cron, sem navegador. Por isso o idioma é gravado
// no banco no primeiro passo do quiz. Ver a migration 20260807000000_locale.

import { chaveDaMarca, ehBallad } from "./marca-identidade.js";

export const LOCALES = ["pt", "es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

// O idioma padrão é o da MARCA do deploy: português na Serenata, inglês na
// Ballad Gift (EUA). A Ballad é outro site, com outro domínio e outro banco,
// e lá não existe português: todo caminho sem idioma explícito cai em inglês.
// Na Serenata nada muda: `pt` continua sendo o padrão em todo lugar.
export const LOCALE_PADRAO: Locale = chaveDaMarca() === "ballad" ? "en" : "pt";

/** Aceita qualquer coisa vinda do banco/URL e devolve um idioma válido. */
export function normalizarLocale(v: unknown): Locale {
  return LOCALES.includes(v as Locale) ? (v as Locale) : LOCALE_PADRAO;
}

/**
 * O idioma de um caminho. `/es`, `/es/criar` → "es"; qualquer outra coisa
 * → "pt".
 *
 * `/espanhol` ou `/estilos` NÃO viram espanhol: o segmento tem que ser
 * exatamente `es`. Parece exagero até alguém criar uma rota nova começando
 * com "es" e o funil inteiro trocar de idioma sozinho.
 */
export function localeDaRota(pathname: string): Locale {
  // Nas DUAS marcas o `/es` é espanhol: na Serenata é o funil argentino, na
  // Ballad é o dos hispanos dos EUA. Fora dele, o idioma padrão do deploy
  // (português numa, inglês na outra).
  return /^\/es(\/|$)/.test(pathname) ? "es" : LOCALE_PADRAO;
}

/**
 * Monta um caminho no idioma dado. `caminho("/criar", "es")` → "/es/criar".
 *
 * Usar isto em vez de escrever "/es/..." na mão é o que permite um dia mudar
 * de prefixo pra subdomínio sem caçar string por string.
 */
export function caminho(rota: string, locale: Locale): string {
  const limpo = rota.startsWith("/") ? rota : `/${rota}`;
  // Só o espanhol tem prefixo. O inglês é o idioma padrão do site dele (a
  // Ballad), então as rotas são as mesmas, sem prefixo nenhum.
  if (locale !== "es" || locale === LOCALE_PADRAO) return limpo;
  return limpo === "/" ? "/es" : `/es${limpo}`;
}

/** O que vai no `<html lang>` e no `rec.lang` do ditado por voz. */
export const TAG_IDIOMA: Record<Locale, string> = {
  pt: "pt-BR",
  // es-MX e não es-ES: o teste é no México, e o reconhecimento de voz
  // do navegador erra bastante quando o sotaque não bate com a tag.
  // Na Ballad o espanhol é o dos hispanos dos EUA: `es-US` (ver `tagIdioma`).
  es: "es-MX",
  en: "en-US",
};

/**
 * A tag do idioma NESTE deploy. Use isto, e não `TAG_IDIOMA` direto.
 *
 * O espanhol da Ballad declara `es-US`: é o que o Google entende como "espanhol
 * pra quem está nos EUA" no `<html lang>` e no hreflang, e o reconhecimento de
 * voz do Chrome tem o modelo `es-US` treinado justamente no sotaque de lá (que
 * mistura inglês no meio da frase). Na Serenata nada muda.
 */
export function tagIdioma(locale: Locale): string {
  if (locale === "es" && ehBallad()) return "es-US";
  return TAG_IDIOMA[locale];
}

/** Moeda e formato do preço. */
export const MOEDA: Record<
  Locale,
  { simbolo: string; valor: number; texto: string; ancora: string }
> = {
  pt: { simbolo: "R$", valor: 38, texto: "R$ 38", ancora: "R$ 97" },
  // US$ e não MXN: a Perfect Pay cobra o internacional em dólar. E 9 e não
  // 12,99 porque a Cántale (o concorrente escalado no México, com página
  // compartilhável inclusa) cobra 12,99 — entrar 30% abaixo do líder é a
  // mesma jogada que a gente fez contra a LoveTune no Brasil.
  // PREÇO ANUNCIADO = TOTAL DO CHECKOUT.
  //
  // O site prometia US$ 9 e a tela de pagamento cobrava US$ 9,68: o checkout
  // internacional (Centerpag) soma 7,5% de "Impuestos Aplicables" sobre o
  // valor do produto. Número que muda no caixa é desconfiança no momento mais
  // caro do funil, com a pessoa já decidida a pagar.
  //
  // A saída foi anunciar o total. Com o produto a US$ 9,21 no painel, o
  // imposto dá US$ 0,69 e o cliente vê exatamente US$ 9,90 — o que ele leu.
  // A ancoragem contra a Cántale (US$ 12,99) continua de pé.
  es: { simbolo: "US$", valor: 9.9, texto: "US$ 9,90", ancora: "US$ 24" },
  // Ballad Gift (EUA). US$ 19 contra os US$ 18,99 da Send a Serenade, o
  // concorrente que roda o nosso modelo lá, mas que NÃO deixa ouvir antes de
  // comprar: a prévia cantada é o que justifica não entrar por baixo. O Stripe
  // cobra exatamente isto (sem imposto somado no caixa), então o anunciado é
  // o total. A âncora é a mesma proporção da Serenata (38 contra 97).
  en: { simbolo: "$", valor: 19, texto: "$19", ancora: "$49" },
};

/**
 * "$19" vira "US$ 19". Texto que já diz a moeda fica como está.
 *
 * Pro espanhol da Ballad: numa tela em espanhol o "$" sozinho é peso mexicano
 * pra boa parte de quem lê, e o número tem que ser, sem conversão mental, o que
 * o Stripe cobra (em dólar).
 */
export function emDolarExplicito(texto: string): string {
  return texto.replace(/^\s*\$\s*/, "US$ ");
}

/**
 * A moeda do idioma NESTE deploy. Use isto, e não `MOEDA[locale]` direto.
 *
 * `MOEDA.es` é o preço da Serenata em espanhol (US$ 9,90, cobrado pela
 * Perfect Pay). No espanhol da Ballad quem cobra é o Stripe, pela mesma linha
 * `preco` do banco que cobra o inglês: o preço é o do inglês (US$ 19). Ler
 * `MOEDA.es` lá seria anunciar 9,90 e cobrar 19, o defeito que `preco.ts`
 * existe pra impedir.
 */
export function moeda(locale: Locale): (typeof MOEDA)[Locale] {
  if (locale === "es" && ehBallad()) {
    const en = MOEDA.en;
    return { ...en, simbolo: "US$", texto: emDolarExplicito(en.texto), ancora: emDolarExplicito(en.ancora) };
  }
  return MOEDA[locale];
}

/**
 * Um valor por idioma, com o português obrigatório.
 *
 * O `pt` ser obrigatório e o `es` opcional é de propósito: enquanto a tradução
 * não termina, o que falta CAI em português em vez de sumir da tela. Uma frase
 * na língua errada é um bug feio; uma tela em branco é uma venda perdida.
 */
export type PorIdioma<T> = { pt: T; es?: T; en?: T };

// O inglês também cai no português quando falta, pelo mesmo motivo do
// espanhol. Mas lá isso é bug de verdade (o americano não lê nada), e o teste
// `ingles-completo.test.ts` existe pra que nenhuma tela do funil chegue lá.
export function escolher<T>(v: PorIdioma<T>, locale: Locale): T {
  return (locale === "es" ? v.es : locale === "en" ? v.en : v.pt) ?? v.pt;
}
