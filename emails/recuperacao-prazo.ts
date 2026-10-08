import { moldura } from "./sequencia.js";
import { diaMes } from "../src/lib/recuperacao-prazo.js";

// A OFERTA COM PRAZO, braço B do teste `recuperacao_prazo` (08/10). Só
// português. A lógica de quando cada um sai mora em
// `src/lib/recuperacao-prazo.ts`; o prazo de verdade, em `cupom.ts`
// (`codigoComPrazo`).
//
// A regra da copy é a da escada: nada de contagem regressiva falsa. Aqui o
// prazo EXISTE (o servidor para de dar o desconto às 23h59 do dia escrito), e
// por isso o toque 2, que sai depois dele, diz que acabou em vez de oferecer
// de novo.

export type ToquePrazo = 1 | 2;

const PRECO = "R$ 28";

function verso(v: string | null | undefined): string {
  if (!v) return "";
  return `<p style="margin:0 0 14px;padding:14px 18px;background:#faf5ee;border-left:3px solid #7d2b3a;border-radius:8px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#2a1518;font-style:italic;">${v.replace(/\n/g, "<br>")}</p>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;">${t}</p>`;

export function assuntoPrazo(toque: ToquePrazo, nome: string): string {
  return toque === 1
    ? `Sua música está guardada. ${PRECO} até amanhã`
    : `Último lembrete sobre a música de ${nome}`;
}

export function emailPrazo(args: {
  toque: ToquePrazo;
  nome: string;
  /** `YYYY-MM-DD`, o último dia do desconto. Só o toque 1 usa. */
  prazo: string;
  link: string;
  linkDescadastro: string;
  verso?: string | null;
}): string {
  const nome = args.nome || "essa pessoa";
  if (args.toque === 1) {
    const dia = diaMes(args.prazo);
    return moldura({
      locale: "pt",
      preheader: `${PRECO} até ${dia}, às 23h59. Depois volta ao preço normal.`,
      titulo: `A música de ${nome} está guardada`,
      miolo: [
        p("Ela foi gravada com a história que você contou e continua do jeito que você deixou: as duas gravações e a letra, sem nada trocado."),
        verso(args.verso),
        p(`Até amanhã, <strong>${dia} às 23h59</strong>, ela sai por <strong>${PRECO}</strong>. Depois disso o valor volta ao normal. O prazo é de verdade: o desconto sai do pagamento sozinho quando ele acaba.`),
        p("Você recebe a música completa nas duas versões, a página presente com link e QR Code, e o MP3 pra guardar."),
      ].join(""),
      botao: `Levar por ${PRECO}`,
      link: args.link,
      linkDescadastro: args.linkDescadastro,
    });
  }
  return moldura({
    locale: "pt",
    preheader: "Depois deste eu paro de escrever sobre ela.",
    titulo: "Último lembrete",
    miolo: [
      p(`O desconto de ${PRECO} terminou, como eu tinha avisado.`),
      p(`A música de ${nome} continua guardada e dá pra levar pelo preço normal quando for a hora: um aniversário, uma data especial, ou um dia qualquer em que ela precise ouvir.`),
      verso(args.verso),
      p("Este é o último e-mail sobre essa música. Depois dele eu paro, e você não precisa fazer nada pra isso acontecer."),
    ].join(""),
    botao: `Ouvir a música de ${nome}`,
    link: args.link,
    linkDescadastro: args.linkDescadastro,
  });
}

export function textoPrazo(args: { toque: ToquePrazo; nome: string; prazo: string; link: string }): string {
  const nome = args.nome || "essa pessoa";
  if (args.toque === 1) {
    const dia = diaMes(args.prazo);
    return (
      `A música de ${nome} está guardada, do jeito que você deixou.\n\n` +
      `Até amanhã, ${dia} às 23h59, ela sai por ${PRECO}. Depois disso o valor volta ao normal.\n\n` +
      `${args.link}\n\n` +
      `Você recebe a música completa nas duas versões, a página presente com link e QR Code, e o MP3 pra guardar.`
    );
  }
  return (
    `O desconto de ${PRECO} terminou, como eu tinha avisado.\n\n` +
    `A música de ${nome} continua guardada e dá pra levar pelo preço normal quando for a hora.\n\n` +
    `${args.link}\n\n` +
    `Este é o último e-mail sobre essa música.`
  );
}
