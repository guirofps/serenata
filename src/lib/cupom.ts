// SEM IMPORTS, de propósito. Este arquivo é lido pelos dois lados: pelo site
// (que resolve o alias `@`) e pelo cron do Inngest, que roda como ESM puro na
// Vercel e NÃO resolve alias. É a mesma razão pela qual `email-typo.ts` também
// não importa nada. O tipo abaixo é a cópia local de `Locale`.
//
// A ÚNICA exceção é `marca-identidade.ts`, por caminho relativo com `.js`: ele
// também não importa nada e foi escrito pra ser lido pelos três ambientes.
import { ehBallad } from "./marca-identidade.js";

type Locale = "pt" | "es" | "en";

// O CUPOM DA RECUPERAÇÃO, num lugar só.
//
// Ele existe pro último e-mail da sequência, e só pra ele. A régua veio do
// número: 285 pessoas receberam a sequência e 3 compraram depois (1,1%,
// R$ 83). É venda que já estava perdida, então desconto aqui não canibaliza
// nada — ao contrário do funil normal, onde canibalizaria tudo.
//
// POR QUE NÃO É MAIOR: no Brasil são R$ 10 de R$ 37, não os 50% que o dono
// cogitou. Essa pessoa leu a letra inteira, ouviu o trecho cantado e chegou a
// gerar o Pix: ela achou que valia R$ 37. O que travou foi dúvida ou o
// momento, não os R$ 18 de diferença. E metade de desconto diz, em voz alta,
// que o preço era mentira.
//
// A VALIDADE VIVE AQUI (`valeAte` de cada cupom). Até 26/09 ela vivia no
// painel da Perfect Pay; desde que a venda brasileira sai só pelo Asaas, quem
// aplica o desconto é o nosso servidor, e esta data é a única que existe.
// Passou dela, o e-mail sai SEM a oferta de desconto em vez de prometer um
// cupom que a cobrança já recusa: prometer desconto morto é pior que não
// oferecer nada, porque a pessoa descobre no checkout.

export type Alvo = "musica" | "extra" | "tres" | "quadro" | "video";

export type Cupom = { codigo: string; texto: string; de: string; por: string };

// DOIS JEITOS DE DESCONTAR, e eles não são o mesmo cupom com outro número.
//
// `preco_final` é o da recuperação: o preço VIRA o "por" (R$ 38 → R$ 28), e só
// na música. `fixo` é o da campanha MUSICA10 (07/10): tira um valor de
// QUALQUER compra (música, extra, quadro, vídeo), sobre o preço que aquela
// pessoa pagaria: num braço VIVO de R$ 54,90, R$ 44,90, não R$ 28. (Braço de
// peso 0 é cobrado como o controle; a tela usa `meuPlanoCobravel` pra não
// mostrar um número que o servidor não cobra.)
type CupomPrecoFinal = {
  tipo: "preco_final";
  codigo: string;
  locale: "pt" | "es";
  texto: string;
  de: string;
  por: string;
  valeAte: string;
};
type CupomFixo = {
  tipo: "fixo";
  codigo: string;
  locale: "pt";
  texto: string;
  centavos: number;
  valeAte: string;
};
type DefCupom = CupomPrecoFinal | CupomFixo;

export const MUSICA10 = "MUSICA10";

/**
 * Último dia do MUSICA10, inclusive (23h59 de Brasília). É a MESMA data que o
 * e-mail escreve (`validadeCurta`): mudou aqui, o e-mail muda junto.
 * Decidida ao ligar o envio: levas de 08/10 a ~14/10 (48.617 a 600/h), mais 7 dias.
 */
export const MUSICA10_VALE_ATE = "2026-10-21";

/** Nenhum produto sai abaixo disto com cupom fixo. */
export const PISO_CENTAVOS = 500;

// Sem cupom no inglês: a Ballad não tem régua de recuperação com desconto.
const CUPONS: DefCupom[] = [
  { tipo: "preco_final", codigo: "SRN27", locale: "pt", texto: "R$ 10", de: "R$ 38", por: "R$ 28", valeAte: "2026-10-13" },
  { tipo: "preco_final", codigo: "SRN7", locale: "es", texto: "20%", de: "US$ 9,90", por: "US$ 7,92", valeAte: "2026-10-13" },
  { tipo: "fixo", codigo: MUSICA10, locale: "pt", texto: "R$ 10", centavos: 1000, valeAte: MUSICA10_VALE_ATE },
];

/** Vale até 23h59min59s de Brasília do `valeAte`. */
function vale(c: DefCupom, agora: Date): boolean {
  return agora.getTime() <= Date.parse(`${c.valeAte}T23:59:59-03:00`);
}

// ── O SRN27 COM PRAZO DE CADA PESSOA (teste `recuperacao_prazo`, 08/10) ──
//
// O braço B da recuperação manda "R$ 28 até amanhã". Pra o "até amanhã" ser
// VERDADE, o prazo não pode ser o do SRN27 (uma data só pra todo mundo): ele
// vai DENTRO do código, `SRN27P` + AAMMDD, e vale até 23h59 de Brasília
// daquele dia. É o mesmo desconto do SRN27 (preço final R$ 28, só na música,
// aplicado aqui no servidor), com a validade de quem recebeu o e-mail, e
// INDEPENDENTE da validade global do SRN27: o teste não morre quando ela
// vencer.
//
// O QUE ISTO NÃO É: assinatura. Este arquivo não importa nada (o navegador lê
// ele também), então não há segredo pra assinar o prazo, e quem editar a data
// do código à mão estende o próprio desconto. O dano máximo é o mesmo R$ 10
// que o MUSICA10 já dá pra base inteira, e o horizonte abaixo impede um
// código que vale pra sempre: a data tem que estar a no máximo
// `HORIZONTE_PRAZO_DIAS` de hoje.
//
// Na venda, `pedidos.cupom` grava o código INTEIRO (`SRN27P261010`): é por
// ele que a leitura do teste separa as vendas que vieram da oferta com prazo.
const PREFIXO_COM_PRAZO = "SRN27P";
const BASE_COM_PRAZO = "SRN27";
const HORIZONTE_PRAZO_DIAS = 3;

/** `2026-10-10` → `SRN27P261010`. A data é o último dia, inclusive. */
export function codigoComPrazo(ate: string): string {
  const m = /^20(\d{2})-(\d{2})-(\d{2})$/.exec(ate);
  if (!m) throw new Error(`data inválida pro cupom com prazo: ${ate}`);
  return `${PREFIXO_COM_PRAZO}${m[1]}${m[2]}${m[3]}`;
}

/** O último dia do código com prazo (`YYYY-MM-DD`), ou `null` se não for um. */
export function prazoDoCodigo(codigo: string | null | undefined): string | null {
  const k = String(codigo ?? "").trim().toUpperCase();
  const m = /^SRN27P(\d{2})(\d{2})(\d{2})$/.exec(k);
  if (!m) return null;
  const [ano, mes, dia] = [2000 + Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${ano}-${m[2]}-${m[3]}`;
}

function cupomComPrazo(k: string, agora: Date): CupomPrecoFinal | null {
  const ate = prazoDoCodigo(k);
  const base = CUPONS.find((x): x is CupomPrecoFinal => x.tipo === "preco_final" && x.codigo === BASE_COM_PRAZO);
  if (!ate || !base) return null;
  const c: CupomPrecoFinal = { ...base, codigo: k, valeAte: ate };
  if (!vale(c, agora)) return null;
  const fim = Date.parse(`${ate}T23:59:59-03:00`);
  if (fim - agora.getTime() > (HORIZONTE_PRAZO_DIAS + 1) * 86400000) return null;
  return c;
}

function acharCupom(codigo: string | null | undefined, agora: Date): DefCupom | null {
  const k = String(codigo ?? "").trim().toUpperCase();
  if (!k) return null;
  if (k.startsWith(PREFIXO_COM_PRAZO)) return cupomComPrazo(k, agora);
  const c = CUPONS.find((x) => x.codigo === k);
  return c && vale(c, agora) ? c : null;
}

/** O nome que a TELA mostra: o código com prazo aparece como o SRN27 que ele é. */
function rotulo(codigo: string): string {
  return codigo.startsWith(PREFIXO_COM_PRAZO) ? BASE_COM_PRAZO : codigo;
}

function centavosDoTexto(t: string): number {
  return Math.round(Number(t.replace(/[^\d,]/g, "").replace(",", ".")) * 100);
}

/** "R$ 38", "R$ 14,90": o formato do resto do site. */
function reais(centavos: number): string {
  const s = (centavos / 100).toFixed(2).replace(".", ",");
  return `R$ ${s.endsWith(",00") ? s.slice(0, -3) : s}`;
}

/** O cupom de PREÇO FINAL do idioma (o da recuperação). Assinatura de sempre. */
export function cupomAtivo(locale: Locale, agora = new Date()): Cupom | null {
  if (locale === "en") return null;
  // A Ballad não tem cupom em idioma nenhum. O cupom espanhol (SRN7) é da
  // Serenata, existe como produto da Perfect Pay e o Stripe não sabe dele:
  // mostrar "US$ 7" na tela e cobrar US$ 19 no caixa seria o "lê um número,
  // paga outro" que este arquivo existe pra impedir.
  if (ehBallad()) return null;
  const c = CUPONS.find(
    (x): x is CupomPrecoFinal => x.tipo === "preco_final" && x.locale === locale && vale(x, agora),
  );
  return c ? { codigo: c.codigo, texto: c.texto, de: c.de, por: c.por } : null;
}

/**
 * O preço com cupom, no servidor. Só em real (o Asaas não cobra dólar), só
 * código vigente, e nunca SOBE o preço.
 */
export function centavosComCupom(
  baseCentavos: number,
  codigo: string | null | undefined,
  agora = new Date(),
  alvo: Alvo = "musica",
): number {
  const c = acharCupom(codigo, agora);
  if (!c || c.locale !== "pt") return baseCentavos;
  if (c.tipo === "preco_final") {
    if (alvo !== "musica") return baseCentavos;
    const por = centavosDoTexto(c.por);
    return por > 0 ? Math.min(baseCentavos, por) : baseCentavos;
  }
  if (baseCentavos <= PISO_CENTAVOS) return baseCentavos;
  return Math.max(baseCentavos - c.centavos, PISO_CENTAVOS);
}

/** O código normalizado, SÓ quando ele baixou o preço. É o que vai pro pedido. */
export function codigoAplicado(
  baseCentavos: number,
  codigo: string | null | undefined,
  agora = new Date(),
  alvo: Alvo = "musica",
): string | null {
  if (centavosComCupom(baseCentavos, codigo, agora, alvo) >= baseCentavos) return null;
  return acharCupom(codigo, agora)?.codigo ?? null;
}

/**
 * O desconto que a TELA mostra. Mesma conta da cobrança, então o número que
 * a pessoa lê é o que o QR cobra. Fora do português, só o cupom da
 * recuperação daquele idioma (o checkout dele é outro), com `porCentavos` nulo.
 */
export function descontoNaTela(
  codigo: string | null | undefined,
  locale: Locale,
  baseCentavos: number,
  alvo: Alvo = "musica",
  agora = new Date(),
): (Cupom & { porCentavos: number | null }) | null {
  if (locale !== "pt") {
    const c = cupomAtivo(locale, agora);
    const k = String(codigo ?? "").trim().toUpperCase();
    return c && k === c.codigo ? { ...c, porCentavos: null } : null;
  }
  const por = centavosComCupom(baseCentavos, codigo, agora, alvo);
  if (por >= baseCentavos) return null;
  const c = acharCupom(codigo, agora);
  if (!c) return null;
  return { codigo: rotulo(c.codigo), texto: c.texto, de: reais(baseCentavos), por: reais(por), porCentavos: por };
}

/**
 * O valor que o webhook do upsell aceita. Com cupom, vale a data em que o
 * PEDIDO NASCEU: quem gerou o PIX às 23h50 do último dia e pagou à 00h10 pagou
 * o preço que a tela prometeu, e tem que receber.
 */
export function valorEsperadoDoUpsell(
  precoCatalogoCentavos: number,
  alvo: Alvo,
  pedido: { cupom?: string | null; created_at?: string | null } | null,
): number {
  if (!pedido?.cupom) return precoCatalogoCentavos;
  const quando = pedido.created_at ? new Date(pedido.created_at) : new Date();
  return centavosComCupom(precoCatalogoCentavos, pedido.cupom, quando, alvo);
}

/** "20/10": a validade como o e-mail escreve. */
export function validadeCurta(codigo: string): string {
  const c = CUPONS.find((x) => x.codigo === codigo.trim().toUpperCase());
  if (!c) return "";
  const [, m, d] = c.valeAte.split("-");
  return `${d}/${m}`;
}
