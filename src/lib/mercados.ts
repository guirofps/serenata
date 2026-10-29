// OS MERCADOS DA BALLAD, um por país (29/10/2026).
//
// Até 28/10 a Ballad tinha um mercado por DEPLOY ("eua") e o México era uma
// exceção só de dinheiro (`preco-mxn.ts`). Espanha, Colômbia, Chile e Peru
// entram aqui como LANÇAMENTO, não como teste A/B: mercado novo é canal novo,
// e quem não está neles continua vendo exatamente o que via.
//
// O país vem do acesso (`x-vercel-ip-country`), NUNCA de um redirecionamento:
// a URL é a mesma em todo país (`/es`), o Google indexa uma página só, e o
// anúncio cai onde foi anunciado. O que muda por país é o PREÇO (moeda e
// tabela), o espanhol da página (`conteudo`) e a língua do caixa do Stripe.
//
// O PREÇO NUNCA VEM DO CLIENTE. A tela e o caixa leem esta mesma tabela, mas
// quem decide o que se cobra é o servidor, pelo país da requisição de pagar.
//
// O PEDIDO CONTINUA EM DÓLAR (`valor_centavos`): painel, Google, TikTok e GA4
// leem dólar. Vendeu em euro, grava o equivalente em dólar pelo câmbio FIXO
// abaixo (`usdDe`), o mesmo que o webhook usa pra conferir o valor pago.
//
// Puro, sem imports: usado pela tela, pelo checkout, pelos webhooks (api/) e
// pelos jobs (inngest/), que rodam como Node sem o atalho `@/`.

export type Pais = "US" | "MX" | "ES" | "CO" | "CL" | "PE";
export type Moeda = "usd" | "mxn" | "eur" | "cop" | "clp" | "pen";
/**
 * Qual espanhol a página fala. `eua` é o de hoje (hispano dos EUA, spanglish
 * na letra); `mexico` herda o `eua` sem as frases que só valem lá dentro;
 * `espanha` é `vosotros`; `latam` é o neutro, sem gíria mexicana.
 */
export type VarianteConteudo = "eua" | "mexico" | "espanha" | "latam";

export type Mercado = {
  pais: Pais;
  moeda: Moeda;
  /**
   * Casas decimais da unidade menor NA API DO STRIPE. CLP é moeda sem
   * decimal (9990 = $9.990). COP o Stripe trata como 2 casas, mas o preço é
   * sempre em peso inteiro (3990000 = $39.900), porque centavo de peso
   * colombiano não existe na prática.
   */
  decimais: 0 | 2;
  /** Quantas unidades da moeda local valem US$ 1. FIXO: preço não oscila com o câmbio do dia. */
  porDolar: number;
  /** Preço em dólar (centavos) → preço local (unidade menor). O que não está aqui cai na conversão. */
  precos: Readonly<Record<number, number>>;
  /** A língua do caixa do Stripe quando a compra é em espanhol. */
  localeStripe: "es" | "es-419";
  conteudo: VarianteConteudo;
  /** O `<html lang>` do `/es` neste país. */
  tagIdioma: string;
  /**
   * A dLocal Go (OXXO, transferência) está ligada aqui? Só o México por ora:
   * Colômbia, Chile e Peru esperam o dono confirmar no painel da dLocal quais
   * `payment_type` existem em cada país (PSE, Efecty, Webpay, PagoEfectivo…).
   */
  temDlocal: boolean;
};

// ── PREÇOS PROVISÓRIOS: DECISÃO DO DONO ──────────────────────────
//
// Os números de Espanha, Colômbia, Chile e Peru são PLACEHOLDER, escritos em
// 29/10 pra o código ter o que cobrar, na mesma lógica do México (preço de
// loja do país, um pouco abaixo da conversão pura do US$ 19). Nada disso foi
// testado. Antes de ligar a mídia em qualquer um, o dono decide os quatro.
//
// A Espanha é preço FINAL ao consumidor, com IVA dentro (na UE, preço exibido
// a pessoa física tem que incluir o imposto). O registro no OSS e o repasse
// do IVA são pendência do dono, não do código.
//
// O México é a tabela de 22/10 (`preco-mxn.ts`), sem mudar um centavo.
//
// Mexeu no câmbio (`porDolar`) de um país? Pedido pendente criado antes da
// troca passa a falhar na conferência do webhook (o dólar gravado não bate
// mais) e fica retido com alerta, igual ao caso antigo do México. Trocar
// câmbio com o caixa aberto de alguém é raro, mas não é zero.

const MX: Mercado = {
  pais: "MX",
  moeda: "mxn",
  decimais: 2,
  porDolar: 18.4,
  precos: { 1900: 19900, 4900: 54900, 1200: 12900, 1400: 14900 },
  localeStripe: "es-419",
  conteudo: "mexico",
  tagIdioma: "es-MX",
  temDlocal: true,
};

export const MERCADOS: Readonly<Record<Pais, Mercado>> = {
  US: {
    pais: "US",
    moeda: "usd",
    decimais: 2,
    porDolar: 1,
    precos: {},
    localeStripe: "es-419",
    conteudo: "eua",
    tagIdioma: "es-US",
    temDlocal: false,
  },
  MX,
  ES: {
    pais: "ES",
    moeda: "eur",
    decimais: 2,
    porDolar: 0.86,
    // €14,99 a música, €34,99 a âncora, €9,99 o vídeo, €10,99 a extra. IVA incluído.
    precos: { 1900: 1499, 4900: 3499, 1200: 999, 1400: 1099 },
    localeStripe: "es",
    conteudo: "espanha",
    tagIdioma: "es-ES",
    temDlocal: false,
  },
  CO: {
    pais: "CO",
    moeda: "cop",
    decimais: 2,
    porDolar: 3900,
    // $39.900 / $99.900 / $25.900 / $29.900, em centavos (o Stripe quer 2 casas).
    precos: { 1900: 3990000, 4900: 9990000, 1200: 2590000, 1400: 2990000 },
    localeStripe: "es-419",
    conteudo: "latam",
    tagIdioma: "es-CO",
    temDlocal: false,
  },
  CL: {
    pais: "CL",
    moeda: "clp",
    decimais: 0,
    porDolar: 950,
    // $9.990 / $24.990 / $6.490 / $7.490. Sem decimal: o número é o peso.
    precos: { 1900: 9990, 4900: 24990, 1200: 6490, 1400: 7490 },
    localeStripe: "es-419",
    conteudo: "latam",
    tagIdioma: "es-CL",
    temDlocal: false,
  },
  PE: {
    pais: "PE",
    moeda: "pen",
    decimais: 2,
    porDolar: 3.75,
    // S/ 39 / 99 / 25 / 29.
    precos: { 1900: 3900, 4900: 9900, 1200: 2500, 1400: 2900 },
    localeStripe: "es-419",
    conteudo: "latam",
    tagIdioma: "es-PE",
    temDlocal: false,
  },
};

/** O país do acesso no formato do cabeçalho da Vercel ("es" → "ES"). Lixo = `null`. */
export function normalizarPais(pais: string | null | undefined): string | null {
  const p = String(pais ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(p) ? p : null;
}

/** O mercado do país. País fora da lista (ou desconhecido) = EUA, o mercado de sempre. */
export function mercadoDoPais(pais: string | null | undefined): Mercado {
  const p = normalizarPais(pais);
  return (p && (MERCADOS as Record<string, Mercado>)[p]) || MERCADOS.US;
}

/** O mercado de uma moeda já cobrada (e-mail pós-compra, webhook). Desconhecida = `null`. */
export function mercadoDaMoeda(moeda: string | null | undefined): Mercado | null {
  const m = String(moeda ?? "").trim().toLowerCase();
  return Object.values(MERCADOS).find((x) => x.moeda === m) ?? null;
}

/** A língua do caixa: o inglês fica inglês; o espanhol segue o país. */
export function localeStripeDe(m: Mercado, locale: string | null | undefined): "en" | "es" | "es-419" {
  return locale === "es" ? m.localeStripe : "en";
}

/** O México de antes de 22/10: a conversão pura do dólar, pra cima no "x49/x99" (US$ 19 → $349). */
export function centavosMxnPorCambio(centavosUsd: number): number {
  const pesos = (centavosUsd / 100) * MX.porDolar;
  return (Math.ceil(pesos / 50) * 50 - 1) * 100;
}

/**
 * Preço em dólar fora da tabela, convertido e arredondado pro preço de loja de
 * cada país. Hoje nada cai aqui (os quatro preços do catálogo estão tabelados);
 * é a rede pra um braço de preço novo que alguém crie no painel.
 */
function porCambio(m: Mercado, centavosUsd: number): number {
  const local = (centavosUsd / 100) * m.porDolar;
  switch (m.moeda) {
    case "usd":
      return centavosUsd;
    case "mxn":
      return centavosMxnPorCambio(centavosUsd);
    case "eur":
      return Math.ceil(local) * 100 - 1; // 14,99
    case "pen":
      return Math.ceil(local) * 100; // S/ 39
    case "cop":
      return (Math.ceil(local / 1000) * 1000 - 100) * 100; // $39.900
    case "clp":
      return Math.ceil(local / 1000) * 1000 - 10; // $9.990
  }
}

/** O preço em dólar (centavos) na unidade menor da moeda do mercado. EUA: o próprio dólar. */
export function valorNaMoeda(m: Mercado, centavosUsd: number): number {
  if (m.moeda === "usd") return centavosUsd;
  return m.precos[centavosUsd] ?? porCambio(m, centavosUsd);
}

/** O equivalente em centavos de dólar de um valor local: o que o pedido grava (€14,99 → 1743). */
export function usdDe(m: Mercado, unidadeMenor: number): number {
  if (m.moeda === "usd") return unidadeMenor;
  // `* 100 / 10 ** decimais` primeiro: no México dá o MESMO número que o
  // `usdDoPeso` antigo (centavos ÷ 18,4), sem diferença de arredondamento.
  return Math.round((unidadeMenor * 100) / 10 ** m.decimais / m.porDolar);
}

// As moedas sem casa decimal na API do Stripe (lista deles). Serve pra
// qualquer moeda que apareça numa transação, inclusive as que não vendemos
// (a liquidação da conta é em real, que tem 2).
const SEM_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

/** Casas decimais da unidade menor de uma moeda qualquer na API do Stripe (CLP 0, BRL 2). */
export function casasDaMoeda(moeda: string | null | undefined): 0 | 2 {
  return SEM_DECIMAL.has(String(moeda ?? "").trim().toLowerCase()) ? 0 : 2;
}

/** Valor em unidade MAIOR (o que a dLocal devolve, "199.00") → unidade menor do mercado. */
export function unidadeMenorDe(m: Mercado, valorMaior: number): number {
  return Math.round(valorMaior * 10 ** m.decimais);
}

/**
 * A cobrança pagou o valor certo pra um pedido de `valorUsdCentavos`?
 * Moeda desconhecida = `false` (o webhook retém e avisa).
 *
 * `valorPago` vem na unidade menor DA MOEDA, como o Stripe manda
 * (`amount_total`). Em peso mexicano vale também o formato de antes de 22/10
 * (US$ 19 cobrado a $349 pela conversão), pra quem abriu o caixa antes da
 * troca e paga depois.
 */
export function valorPagoConfere(moeda: string | null | undefined, valorPago: number, valorUsdCentavos: number): boolean {
  const m = String(moeda ?? "usd").trim().toLowerCase();
  if (m === "usd") return valorPago === valorUsdCentavos;
  const mercado = mercadoDaMoeda(m);
  if (!mercado) return false;
  if (usdDe(mercado, valorPago) === valorUsdCentavos) return true;
  return mercado.moeda === "mxn" && valorPago === centavosMxnPorCambio(valorUsdCentavos);
}

/** Milhar com ponto, à mão (ver `formatarNaMoeda`). */
function milhar(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * O valor escrito como o país lê: "$199 MXN", "14,99 €", "$39.900 COP",
 * "$9.990 CLP", "S/ 39".
 *
 * À MÃO e não pelo `Intl.NumberFormat`, de propósito: o preço é desenhado no
 * servidor E de novo na hidratação, e o `Intl` do Node e o do celular (ICU de
 * versões diferentes) discordam em espaço fino, espaço inseparável e posição
 * do símbolo. Um espaço diferente já é "o texto não bate" na hidratação, no
 * número que a pessoa está lendo pra decidir se paga.
 */
export function formatarNaMoeda(m: Mercado, unidadeMenor: number): string {
  const maior = unidadeMenor / 10 ** m.decimais;
  switch (m.moeda) {
    case "usd":
      return `US$ ${Number.isInteger(maior) ? maior : maior.toFixed(2)}`;
    case "mxn":
      // Exatamente o texto de 21/10 (`textoEmPeso`): "$199 MXN".
      return `$${unidadeMenor / 100} MXN`;
    case "eur":
      return `${Number.isInteger(maior) ? maior : maior.toFixed(2).replace(".", ",")} €`;
    case "cop":
      return `$${milhar(maior)} COP`;
    case "clp":
      return `$${milhar(maior)} CLP`;
    case "pen":
      return `S/ ${Number.isInteger(maior) ? maior : maior.toFixed(2)}`;
  }
}

/** O número de um texto de preço em dólar ("US$ 19", "$49", "$12.50") em centavos. Sem número = `null`. */
export function centavosDoTexto(textoUsd: string): number | null {
  const m = String(textoUsd).match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const usd = Number(m[1].replace(",", "."));
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return Math.round(usd * 100);
}

/**
 * O texto de um preço em dólar escrito na moeda do mercado, pela MESMA tabela
 * do caixa. EUA (ou texto sem número) = `null`: a tela fica em dólar.
 */
export function textoNaMoeda(m: Mercado, textoUsd: string): string | null {
  if (m.moeda === "usd") return null;
  const centavos = centavosDoTexto(textoUsd);
  if (centavos == null) return null;
  return formatarNaMoeda(m, valorNaMoeda(m, centavos));
}

/** Os mercados que não cobram em dólar: um `<span>` de preço por moeda na tela. */
export const MERCADOS_LOCAIS: readonly Mercado[] = Object.values(MERCADOS).filter((m) => m.moeda !== "usd");

/**
 * O CSS que escolhe a moeda pelo `data-pais` do `<html>` (`pais-acesso.ts`).
 * Gerado desta tabela pra um país novo não depender de alguém lembrar do
 * `styles.css`. Sem carimbo, ou país fora da lista: dólar, que é o que o caixa
 * cobra fora destes países.
 */
export function cssPrecoPorPais(): string {
  const locais = MERCADOS_LOCAIS;
  const esconde = locais.map((m) => `.preco-${m.moeda}`).join(",");
  const semDolar = locais.map((m) => `html[data-pais="${m.pais}"] .preco-usd`).join(",");
  const mostra = locais.map((m) => `html[data-pais="${m.pais}"] .preco-${m.moeda}`).join(",");
  return `${esconde}{display:none}${semDolar}{display:none}${mostra}{display:inline}`;
}

/**
 * A frase que tira a dúvida da moeda antes do clique ("¿son dólares o
 * pesos?"), e diz que é o total (o Stripe não soma nada no caixa).
 */
export function fraseDaMoeda(m: Mercado): string {
  switch (m.moeda) {
    case "usd":
      return "El precio es en dólares (USD) y es el total: no se suma nada al pagar.";
    case "mxn":
      return "El precio es en pesos mexicanos (MXN) y es el total: no se suma nada al pagar.";
    case "eur":
      return "El precio es en euros, con el IVA incluido, y es el total: no se suma nada al pagar.";
    case "cop":
      return "El precio es en pesos colombianos (COP) y es el total: no se suma nada al pagar.";
    case "clp":
      return "El precio es en pesos chilenos (CLP) y es el total: no se suma nada al pagar.";
    case "pen":
      return "El precio es en soles (PEN) y es el total: no se suma nada al pagar.";
  }
}

/** "en dólares", "en euros"…: a moeda da fatura, pra a dúvida "¿cómo aparece el cargo?". */
export function naMoedaPorExtenso(m: Mercado): string {
  switch (m.moeda) {
    case "usd":
      return "en dólares";
    case "mxn":
      return "en pesos mexicanos";
    case "eur":
      return "en euros";
    case "cop":
      return "en pesos colombianos";
    case "clp":
      return "en pesos chilenos";
    case "pen":
      return "en soles";
  }
}
