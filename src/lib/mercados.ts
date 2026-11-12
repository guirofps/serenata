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

export type Pais = "US" | "MX" | "ES" | "CO" | "CL" | "PE" | "AR";
export type Moeda = "usd" | "mxn" | "eur" | "cop" | "clp" | "pen" | "ars";
/**
 * Qual espanhol a página fala. `eua` é o de hoje (hispano dos EUA, spanglish
 * na letra); `mexico` herda o `eua` sem as frases que só valem lá dentro;
 * `espanha` é `vosotros`; `latam` é o neutro, sem gíria mexicana;
 * `argentina` é o rioplatense (`vos`), o mesmo da Serenata de agosto (12/11).
 */
export type VarianteConteudo = "eua" | "mexico" | "espanha" | "latam" | "argentina";

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
   * A dLocal Go (dinheiro e transferência) está ligada aqui? México (OXXO,
   * SPEI), Colômbia (PSE, Nequi, Efecty), Chile (Webpay, bancos) e Peru (Yape,
   * bancos, PagoEfectivo), conferidos em 29/10 com cobranças de teste.
   */
  temDlocal: boolean;
  /**
   * TESTE DE PREÇO SÓ DESTE PAÍS (12/11): o preço local de cada braço, pelas
   * mesmas chaves em dólar de `precos`. Chave que o braço não lista (vídeo,
   * extra) e braço que não está aqui (o controle "A", `fora`, lixo) caem em
   * `precos`. O `id` é o da linha na tabela `experimentos`, que só decide
   * liga/desliga e peso: o NÚMERO mora aqui. Ver `preco-local.ts`.
   */
  teste?: { id: string; bracos: Readonly<Record<string, Readonly<Record<number, number>>>> };
};

// ── PREÇOS: APROVADOS PELO DONO EM 29/10 ─────────────────────────
//
// Colômbia, Chile e Peru perto do México em reais (R$ 54 a 68 a música), preço
// de loja do país. A Espanha é o MESMO número dos EUA, em euro. O câmbio
// (`porDolar`) é o de 29/10, arredondado: é com ele que o pedido grava o
// equivalente em dólar que painel, Google e TikTok leem.
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

// ── ARGENTINA (12/11/2026) ────────────────────────────────────────
//
// A TESE DO PREÇO. Cobrar em PESO, não em dólar. Na tela, "US$ 19" pra um
// argentino é a pergunta "¿a qué dólar?": oficial, tarjeta, blue. E o cartão
// argentino que paga em moeda estrangeira leva a percepção de ganancias (~30%)
// em cima na fatura (o "dólar tarjeta" de 11/11 estava a $2.041 contra $1.570 do
// oficial). Em peso, o número da tela é o número que ela reconhece.
//
// O NÍVEL. O mesmo de Chile e Peru em reais (R$ 52 a 63 a música, ver acima):
// $15.990 ≈ US$ 10,30 ≈ R$ 57. Preço de loja em peso termina em .990, como o
// argentino vê no varejo. Âncora 2,5x (igual Chile), vídeo e extra na mesma
// proporção de Chile/Peru.
//
// O PAGAMENTO, conferido com chamadas reais em 12/11:
//   - dLocal Go (conta nova): cobrança em ARS aceita; a página deles mostra
//     Tarjeta, Efectivo (Rapipago/Pago Fácil), Transferencia bancaria e QR
//     Interoperable (QR do Mercado Pago e das carteiras). Pela dLocal o cartão
//     é LOCAL (adquirência na Argentina), sem a percepção do exterior: é por
//     isso que a Argentina é o país onde a dLocal mais deve ganhar do Stripe.
//   - Stripe (conta BR): sessão em ARS aceita (live e teste). Mas o Stripe é
//     comércio ESTRANGEIRO pro banco argentino: a percepção pode vir na fatura
//     mesmo cobrando em peso. Não dá pra conferir sem um pagamento real.
//
// O RISCO DA INFLAÇÃO. Peso perde valor todo mês (~2% ao mês em 2026). A tabela
// é FIXA: revisar `precos` e `porDolar` uma vez por mês (o mesmo número em
// reais). E o efeito do câmbio fixo no webhook vale aqui com mais força que em
// qualquer outro país: mexeu no `porDolar`, pedido pendente criado antes da troca
// (ficha de Rapipago vale dias) falha a conferência do dólar e fica retido com
// alerta. Trocar a tabela de madrugada e liberar à mão o que cair retido.
//
// Câmbio de 11/11 (dolarapi.com): oficial $1.520/$1.570, mayorista $1.535/$1.544,
// open.er-api.com $1.548. `porDolar` 1550.
const AR: Mercado = {
  pais: "AR",
  moeda: "ars",
  // O Stripe trata ARS com 2 casas; o preço é sempre em peso inteiro.
  decimais: 2,
  porDolar: 1550,
  // $15.990 / $39.990 / $9.990 / $11.990, em centavos.
  precos: { 1900: 1599000, 4900: 3999000, 1200: 999000, 1400: 1199000 },
  localeStripe: "es-419",
  conteudo: "argentina",
  tagIdioma: "es-AR",
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
    porDolar: 0.9,
    // O MESMO NÚMERO DOS EUA, em euro: €19 a música, €49 a âncora, €12 o vídeo,
    // €14 a extra. IVA incluído.
    precos: { 1900: 1900, 4900: 4900, 1200: 1200, 1400: 1400 },
    localeStripe: "es",
    conteudo: "espanha",
    tagIdioma: "es-ES",
    temDlocal: false,
  },
  CO: {
    pais: "CO",
    moeda: "cop",
    decimais: 2,
    porDolar: 3400,
    // $39.900 / $99.900 / $25.900 / $29.900, em centavos (o Stripe quer 2 casas).
    precos: { 1900: 3990000, 4900: 9990000, 1200: 2590000, 1400: 2990000 },
    localeStripe: "es-419",
    conteudo: "latam",
    tagIdioma: "es-CO",
    temDlocal: true,
    // TESTE `preco_co` (12/11, Ralph): só a MÚSICA e a âncora dela. A = hoje
    // ($39.900, riscado $99.900). B = $29.900 e C = $34.900, os dois com o
    // riscado em $74.900. Vídeo e extra ficam fixos. Desenho em
    // `docs/superpowers/specs/2026-11-12-preco-por-pais-colombia-design.md`.
    teste: {
      id: "preco_co",
      bracos: {
        B: { 1900: 2990000, 4900: 7490000 },
        C: { 1900: 3490000, 4900: 7490000 },
      },
    },
  },
  CL: {
    pais: "CL",
    moeda: "clp",
    decimais: 0,
    porDolar: 1060,
    // $9.990 / $24.990 / $6.490 / $7.490. Sem decimal: o número é o peso.
    precos: { 1900: 9990, 4900: 24990, 1200: 6490, 1400: 7490 },
    localeStripe: "es-419",
    conteudo: "latam",
    tagIdioma: "es-CL",
    temDlocal: true,
  },
  PE: {
    pais: "PE",
    moeda: "pen",
    decimais: 2,
    porDolar: 3.45,
    // S/ 39 / 99 / 25 / 29.
    precos: { 1900: 3900, 4900: 9900, 1200: 2500, 1400: 2900 },
    localeStripe: "es-419",
    conteudo: "latam",
    tagIdioma: "es-PE",
    temDlocal: true,
  },
  AR,
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
    case "ars":
      return (Math.ceil(local / 1000) * 1000 - 10) * 100; // $15.990, em centavos
  }
}

/**
 * O preço em dólar (centavos) na unidade menor da moeda do mercado. EUA: o próprio dólar.
 *
 * `braco` é o do teste de preço DO PAÍS (`Mercado.teste`), já passado pela
 * regra do braço cobrável (`preco-local.ts`). Sem ele, com o controle, ou num
 * país sem teste, é a tabela de sempre.
 */
export function valorNaMoeda(m: Mercado, centavosUsd: number, braco?: string | null): number {
  if (m.moeda === "usd") return centavosUsd;
  const doBraco = precosDoBraco(m, braco)?.[centavosUsd];
  return doBraco ?? m.precos[centavosUsd] ?? porCambio(m, centavosUsd);
}

/** A tabela de um braço do teste do país. `hasOwnProperty`: "constructor" não é braço. */
function precosDoBraco(m: Mercado, braco: string | null | undefined): Readonly<Record<number, number>> | null {
  const bracos = m.teste?.bracos;
  if (!bracos || !braco || !Object.prototype.hasOwnProperty.call(bracos, braco)) return null;
  return bracos[braco];
}

/** O mercado tem preço próprio pra este braço? (O controle e o lixo não têm.) */
export function bracoTemPreco(m: Mercado, braco: string | null | undefined): boolean {
  return precosDoBraco(m, braco) != null;
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

/**
 * O valor em dólar que o ANÚNCIO recebe, no país do acesso (29/10). O caixa
 * cobra a tabela do país e o pedido grava o equivalente em dólar (US$ 19 →
 * $199 MXN → US$ 10,82; → 14,99 € → US$ 17,43); os eventos do navegador
 * (TikTok, GA4, Google) têm que mandar o MESMO número, não os US$ 19 da tela
 * americana. Nos EUA, ou com país desconhecido, o mesmo valor.
 */
export function valorUsdNoPais(valorUsd: number, pais: string | null | undefined, braco?: string | null): number {
  const m = mercadoDoPais(pais);
  if (m.moeda === "usd") return valorUsd;
  const centavos = Math.round(valorUsd * 100);
  if (!(centavos > 0)) return valorUsd;
  return usdDe(m, valorNaMoeda(m, centavos, braco)) / 100;
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
    case "ars":
      return `$${milhar(maior)} ARS`;
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
export function textoNaMoeda(m: Mercado, textoUsd: string, braco?: string | null): string | null {
  if (m.moeda === "usd") return null;
  const centavos = centavosDoTexto(textoUsd);
  if (centavos == null) return null;
  return formatarNaMoeda(m, valorNaMoeda(m, centavos, braco));
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
    case "ars":
      // Voseo, e sem prometer "no se suma nada": no cartão do exterior (Stripe)
      // o banco argentino pode somar a percepção na fatura. O que é nosso, não
      // soma: é isso que a frase diz.
      return "El precio es en pesos argentinos (ARS) y es lo que te cobramos: no sumamos nada al pagar.";
  }
}

/** "en dólares", "en euros"…: a moeda da fatura, pra a dúvida "¿cómo aparece el cargo?". */
export function naMoedaPorExtenso(m: Mercado): string {
  switch (m.moeda) {
    case "usd":
      return "en dólares";
    case "mxn":
      return "en pesos mexicanos (MXN)";
    case "eur":
      return "en euros";
    case "cop":
      return "en pesos colombianos (COP)";
    case "clp":
      return "en pesos chilenos (CLP)";
    case "pen":
      return "en soles (PEN)";
    case "ars":
      return "en pesos argentinos (ARS)";
  }
}
