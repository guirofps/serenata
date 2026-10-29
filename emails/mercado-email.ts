// O E-MAIL EM ESPANHOL NO PAÍS DO QUIZ (Ballad, 29/10/2026).
//
// As cópias em espanhol da Ballad (`COPY_ES_EUA` de cada e-mail) foram
// escritas pro hispano dos EUA: o link vai "por mensaje" e "ustedes" fala com
// o casal. Com a Ballad vendendo na Espanha e na LatAm (`mercados.ts`), duas
// coisas mudam e só elas:
//   - na Espanha e na LatAm o presente vai pelo WhatsApp, não "por mensaje";
//   - na Espanha o casal é `vosotros` ("vuestras fotos"), e o aparelho é o
//     `móvil`.
//
// POR QUE UMA TROCA DE FRASES E NÃO UMA CÓPIA NOVA POR E-MAIL: são doze
// e-mails, cada um com a sua cópia, e uma cópia paralela por país é o mesmo
// defeito da home espanhola irmã (melhoria numa não chega na outra). Aqui a
// lista é de FRASES EXATAS que existem nas cópias de hoje, aplicada depois de
// montar o e-mail. Frase nova numa cópia não é trocada sozinha: o teste
// `mercados-conteudo.test.ts` pega "ustedes" sobrando no e-mail da Espanha.
//
// Sem dinheiro aqui: o preço que aparece em e-mail (o do vídeo) já sai na
// moeda da compra (`precoDoVideoNoEmail`). Nada muda nos EUA, no México, no
// inglês nem na Serenata.

import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";
import { mercadoDoPais } from "../src/lib/mercados.js";

const WHATSAPP: Array<[RegExp, string]> = [[/\bpor mensaje\b/g, "por WhatsApp"]];

const ESPANHA: Array<[RegExp, string]> = [
  [/\bLas fotos de ustedes\b/g, "Vuestras fotos"],
  [/\blas fotos de ustedes\b/g, "vuestras fotos"],
  [/\bla foto de ustedes\b/g, "vuestra foto"],
  [/\bla historia de ustedes\b/g, "vuestra historia"],
  [/\bEl video de ustedes\b/g, "Vuestro vídeo"],
  [/\bsolo ustedes dos entienden\b/g, "solo vosotros dos entendéis"],
  [/\bsolo ustedes dos saben\b/g, "solo vosotros dos sabéis"],
  [/\bustedes dos van\b/g, "vosotros dos vais"],
  [/\bcelular\b/g, "móvil"],
  [/\bcomputadora\b/g, "ordenador"],
];

/**
 * O e-mail (HTML, texto ou assunto) no espanhol do país do quiz. Fora da
 * Ballad, fora do espanhol, ou com país dos EUA/México/desconhecido, devolve
 * o mesmo texto.
 */
export function adaptarAoPais(conteudo: string, locale: string | null | undefined, pais: string | null | undefined): string {
  if (MARCA_ATIVA.chave !== "ballad" || locale !== "es" || !pais) return conteudo;
  const variante = mercadoDoPais(pais).conteudo;
  if (variante !== "espanha" && variante !== "latam") return conteudo;
  let s = conteudo;
  for (const [de, para] of WHATSAPP) s = s.replace(de, para);
  if (variante === "espanha") for (const [de, para] of ESPANHA) s = s.replace(de, para);
  return s;
}

/**
 * O cliente do Resend que adapta assunto, HTML e texto ao país antes de mandar,
 * no mesmo molde do `comUtm`: `noPais(comUtm(new Resend(chave)), locale, pais)`.
 * Uma linha por envio, sem mexer na montagem de cada e-mail.
 */
export function noPais<R extends { emails: { send: (p: never, ...resto: never[]) => unknown } }>(
  r: R,
  locale: string | null | undefined,
  pais: string | null | undefined,
): R {
  const emails = r.emails as unknown as { send: (...a: unknown[]) => unknown };
  const send = emails.send.bind(emails);
  emails.send = (p: unknown, ...resto: unknown[]) => {
    const e = p as { subject?: unknown; html?: unknown; text?: unknown } & Record<string, unknown>;
    const ad = (v: unknown) => (typeof v === "string" ? adaptarAoPais(v, locale, pais) : v);
    return send({ ...e, subject: ad(e.subject), html: ad(e.html), text: ad(e.text) }, ...resto);
  };
  return r;
}
