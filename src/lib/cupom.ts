// SEM IMPORTS, de propósito. Este arquivo é lido pelos dois lados: pelo site
// (que resolve o alias `@`) e pelo cron do Inngest, que roda como ESM puro na
// Vercel e NÃO resolve alias. É a mesma razão pela qual `email-typo.ts` também
// não importa nada. O tipo abaixo é a cópia local de `Locale`.
type Locale = "pt" | "es";

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
// A VALIDADE VIVE NO PAINEL DA PERFECT PAY, não aqui. O que existe aqui é uma
// data de segurança: passou dela, o e-mail sai SEM a oferta de desconto em vez
// de prometer um cupom que o gateway já recusa. Prometer desconto morto é pior
// que não oferecer nada, porque a pessoa descobre no checkout, que é o pior
// lugar possível pra descobrir qualquer coisa.
//
// Se você mexer na validade lá, mexa aqui junto.

export type Cupom = { codigo: string; texto: string; de: string; por: string };

const CUPONS: Record<Locale, Cupom> = {
  pt: { codigo: "SRN27", texto: "R$ 10", de: "R$ 38", por: "R$ 28" },
  es: { codigo: "SRN7", texto: "20%", de: "US$ 9,90", por: "US$ 7,92" },
};

/** Último dia em que o cupom vale. Espelha o painel da Perfect Pay. */
const VALE_ATE = "2026-10-13";

export function cupomAtivo(locale: Locale, agora = new Date()): Cupom | null {
  // Comparação por string ISO: `2026-10-13` > `2026-10-12` funciona e não
  // depende de fuso, que aqui não importa (a diferença é de um dia, e o
  // gateway é quem decide de verdade).
  if (agora.toISOString().slice(0, 10) > VALE_ATE) return null;
  return CUPONS[locale] ?? CUPONS.pt;
}
