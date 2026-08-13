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

export const LOCALES = ["pt", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_PADRAO: Locale = "pt";

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
  if (locale === LOCALE_PADRAO) return limpo;
  return limpo === "/" ? "/es" : `/es${limpo}`;
}

/** O que vai no `<html lang>` e no `rec.lang` do ditado por voz. */
export const TAG_IDIOMA: Record<Locale, string> = {
  pt: "pt-BR",
  // es-MX e não es-ES: o teste é no México, e o reconhecimento de voz
  // do navegador erra bastante quando o sotaque não bate com a tag.
  es: "es-MX",
};

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
};

/**
 * Um valor por idioma, com o português obrigatório.
 *
 * O `pt` ser obrigatório e o `es` opcional é de propósito: enquanto a tradução
 * não termina, o que falta CAI em português em vez de sumir da tela. Uma frase
 * na língua errada é um bug feio; uma tela em branco é uma venda perdida.
 */
export type PorIdioma<T> = { pt: T; es?: T };

export function escolher<T>(v: PorIdioma<T>, locale: Locale): T {
  return (locale === "es" ? v.es : v.pt) ?? v.pt;
}
