// "A SUA PÁGINA VIROU VÍDEO", no dia seguinte à compra.
//
// ── O E-MAIL NÃO VENDE, ELE CONVIDA A ASSISTIR ───────────────────
//
// O vídeo já existe como prévia dentro do editor, montado com as fotos que
// ela subiu (ver `VideoPresenteEditor`). Então o botão não é "comprar": é
// "ver o meu vídeo". Quem abre dá o play no próprio vídeo, com a própria
// música e as próprias fotos, e a oferta está logo embaixo. Descrever um
// vídeo em texto vende menos do que qualquer segundo dele tocando.
//
// Só sai pra quem já subiu foto: sem foto a prévia é o fundo da marca, e o
// e-mail prometeria "as fotos de vocês" que não estão lá.
//
// Na Serenata, só em português: o vídeo é pago no PIX, e quem comprou no
// funil espanhol (argentino) pagou em dólar na Perfect Pay, onde o vídeo não
// existe. Mesma regra do editor e do quadro.
//
// Na Ballad Gift (16/10), em inglês e no espanhol dos hispanos dos EUA: lá o
// vídeo é vendido pelo Stripe, em dólar, nos dois idiomas (`stripe-upsell.ts`).
// A copy é escrita pra cada um, não traduzida: sem WhatsApp (o link vai por
// mensagem de texto), `tú` no espanhol, e o preço que a folha do editor mostra
// ("$12" no inglês, "US$ 12" no espanhol), que quem chama passa pronto.

import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";
import { precoVideoUsdTexto } from "../src/lib/creditos.js";
import { emDolarExplicito } from "../src/lib/i18n.js";
import { textoPrecoVideo } from "../src/lib/preco-video.js";
import { mercadoDaMoeda, textoNaMoeda } from "../src/lib/mercados.js";

export type IdiomaOfertaVideo = "pt" | "en" | "es";

// Só cai aqui se o catálogo perder o preço em dólar, e aí o job nem manda
// (ver `precoDoVideoNoEmail`): é o tipo pedindo string, não um preço de verdade.
const PRECO_USD = precoVideoUsdTexto() ?? "$12";

/**
 * Em que idioma vai o e-mail do vídeo desta compra, ou `null` = não vai.
 *
 * Serenata: só português. O espanhol de lá pagou em dólar na Perfect Pay, e o
 * editor nem mostra a oferta (`VideoPresenteEditor`, `mostraOferta`).
 * Ballad: inglês e espanhol, os dois pelo Stripe. Linha sem idioma conhecido
 * na Ballad não recebe: adivinhar o idioma de quem pagou é pior que calar.
 */
export function idiomaDaOfertaVideo(
  locale: string | null | undefined,
  ballad: boolean,
): IdiomaOfertaVideo | null {
  if (ballad) return locale === "en" || locale === "es" ? locale : null;
  return locale === "es" || locale === "en" ? null : "pt";
}

/**
 * O preço que o e-mail promete, o MESMO que a tela do editor vai cobrar.
 * Português: o braço do teste `preco_video` daquela música, em real.
 * Ballad: o dólar do catálogo, com "US$" explícito no espanhol (como a folha).
 * Quem pagou a MÚSICA em peso (México, `emPeso`) lê o preço em peso, pela
 * mesma tabela do caixa ("$129 MXN"), em qualquer idioma (28/10).
 * `null` = a Ballad sem preço em dólar no catálogo: sem preço, sem oferta.
 *
 * 29/10: o terceiro argumento é a MOEDA da compra (`moedaDaCompra`), e cada
 * mercado lê o vídeo na sua ("9,99 €", "$25.900 COP"), pela tabela de
 * `mercados.ts`. `true` continua valendo peso mexicano.
 */
export function precoDoVideoNoEmail(
  locale: IdiomaOfertaVideo,
  tokenEdicao: string | null | undefined,
  moeda: boolean | string | null = false,
): string | null {
  if (locale === "pt") return textoPrecoVideo(tokenEdicao);
  const usd = precoVideoUsdTexto();
  if (!usd) return null;
  const mercado = mercadoDaMoeda(moeda === true ? "mxn" : typeof moeda === "string" ? moeda : null);
  if (mercado && mercado.moeda !== "usd") return textoNaMoeda(mercado, usd) ?? usd;
  return locale === "es" ? emDolarExplicito(usd) : usd;
}

const COPY = {
  pt: {
    assunto: (n: string) => `A página de ${n} virou vídeo`,
    titulo: "A página que você montou virou vídeo.",
    corpo:
      "As fotos que você escolheu, passando no ritmo da música, com a letra acendendo palavra por palavra no instante em que é cantada. Já está montado: é só abrir e dar o play.",
    botao: "VER O MEU VÍDEO",
    // O preço vem de quem chama (teste `preco_video`, 11/10): R$ 24,90 ou R$ 19,90 conforme a música.
    rodapeAviso: (preco: string) =>
      `Assistir não custa nada. Pra baixar em HD, sem a marca de prévia, e mandar no WhatsApp ou postar no story, são ${preco}, pagamento único.`,
    rodape: "Serenata · uma música feita da história de quem você ama",
    texto: (nome: string, link: string, preco: string) =>
      `A página de ${nome} virou vídeo.\n\n` +
      `As fotos que você escolheu, passando no ritmo da música, com a letra acendendo palavra por palavra. ` +
      `Já está montado: é só abrir e dar o play.\n\n${link}\n\n` +
      `Assistir não custa nada. Pra baixar em HD e mandar no WhatsApp, são ${preco}.`,
    precoPadrao: "R$ 24,90",
  },
  en: {
    assunto: (n: string) => `${n}'s page just turned into a video`,
    titulo: "The page you made is now a video.",
    corpo:
      "The photos you picked, moving to the beat of the song, with every word of the lyrics lighting up the moment it's sung. It's already put together. Just open it and hit play.",
    botao: "WATCH MY VIDEO",
    rodapeAviso: (preco: string) =>
      `Watching is free. To download it in HD, without the preview watermark, and text it to them or post it to your story, it's ${preco}, one-time payment.`,
    rodape: `${MARCA_ATIVA.nome} · a song made from the story of someone you love`,
    texto: (nome: string, link: string, preco: string) =>
      `${nome}'s page just turned into a video.\n\n` +
      `The photos you picked, moving to the beat of the song, with the lyrics lighting up word by word. ` +
      `It's already put together. Just open it and hit play.\n\n${link}\n\n` +
      `Watching is free. To download it in HD and text it to them, it's ${preco}.`,
    precoPadrao: PRECO_USD,
  },
  es: {
    assunto: (n: string) => `La página de ${n} ya es un video`,
    titulo: "La página que armaste ya es un video.",
    corpo:
      "Las fotos que escogiste, pasando al ritmo de la canción, con la letra iluminándose palabra por palabra justo cuando se canta. Ya está listo: solo ábrelo y dale play.",
    botao: "VER MI VIDEO",
    rodapeAviso: (preco: string) =>
      `Verlo es gratis. Para descargarlo en HD, sin la marca de vista previa, y mandarlo por mensaje o subirlo a tu historia, son ${preco}, un solo pago.`,
    rodape: `${MARCA_ATIVA.nome} · una canción hecha de la historia de quien tú quieres`,
    texto: (nome: string, link: string, preco: string) =>
      `La página de ${nome} ya es un video.\n\n` +
      `Las fotos que escogiste, pasando al ritmo de la canción, con la letra iluminándose palabra por palabra. ` +
      `Ya está listo: solo ábrelo y dale play.\n\n${link}\n\n` +
      `Verlo es gratis. Para descargarlo en HD y mandarlo por mensaje, son ${preco}.`,
    precoPadrao: emDolarExplicito(PRECO_USD),
  },
};

export function assuntoVideoOferta(nome: string, locale: IdiomaOfertaVideo = "pt"): string {
  return COPY[locale].assunto(nome);
}

export function textoVideoOferta(args: {
  nome: string;
  link: string;
  preco?: string;
  locale?: IdiomaOfertaVideo;
}): string {
  const C = COPY[args.locale ?? "pt"];
  return C.texto(args.nome, args.link, args.preco ?? C.precoPadrao);
}

export function emailVideoOferta(args: {
  nome: string;
  titulo: string;
  link: string;
  preco?: string;
  locale?: IdiomaOfertaVideo;
}): string {
  const { nome, titulo, link } = args;
  const locale = args.locale ?? "pt";
  const C = COPY[locale];
  return `<!DOCTYPE html>
<html lang="${locale === "pt" ? "pt-BR" : locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto(nome)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">${MARCA_ATIVA.chave === "ballad" ? "BALLAD" : "SERENATA"}</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">${C.titulo}</h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>
        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${C.corpo}
        </td></tr>
        <tr><td align="center" style="padding:24px 36px 8px;">
          <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:15px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
            &#9654;&nbsp; ${C.botao}
          </a>
        </td></tr>
        <tr><td style="padding:10px 36px 30px;text-align:center;color:rgba(42,21,24,0.5);font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
          ${C.rodapeAviso(args.preco ?? C.precoPadrao)}
        </td></tr>
      </table>
      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">${C.rodape}</p>
    </td></tr>
  </table>
</body></html>`;
}
