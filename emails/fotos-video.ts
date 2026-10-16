// "COLOQUE AS FOTOS DE VOCÊS", pra quem comprou e não subiu nenhuma foto.
//
// ── POR QUE ESTE E-MAIL EXISTE ───────────────────────────────────
//
// Em 25/09, de 40 compradores só 19 tinham foto na página, e os 3 vídeos
// vendidos saíram todos desses 19. Sem foto, a prévia do vídeo é o fundo da
// marca e o botão de compra nem aparece. O e-mail do vídeo (`video-oferta.ts`)
// só vai pra quem tem foto, então a outra metade não recebia nada.
//
// ── ELE NÃO VENDE O VÍDEO, ELE PEDE AS FOTOS ─────────────────────
//
// O pedido é pequeno e bom pra ela de qualquer jeito: a página que ela manda
// fica mais bonita com as fotos. O link cai no bloco do vídeo, onde o botão
// "Escolher as fotos" abre a galeria do celular; as fotos sobem, a prévia se
// monta na frente dela, e só então aparece a oferta. O preço vai no rodapé
// pra ninguém se sentir enganado ao ver a oferta depois.
//
// Na Ballad Gift (16/10), em inglês e no espanhol dos EUA, pelo mesmo motivo
// do `video-oferta.ts`: lá o vídeo se vende no Stripe, em dólar, nos dois.
// Escrito pra cada um, sem WhatsApp, com o preço que a folha do editor mostra.

import { MARCA_ATIVA } from "../src/lib/marca-identidade.js";
import { precoDoVideoNoEmail, type IdiomaOfertaVideo } from "./video-oferta.js";

const COPY = {
  pt: {
    assunto: (n: string) => `Coloque as fotos de vocês na música de ${n}`,
    titulo: "A página ainda está sem as fotos de vocês.",
    corpo:
      "Escolha umas fotos no celular e veja acontecer: elas passam no ritmo da música, com a letra acendendo palavra por palavra no instante em que é cantada. Leva um minuto, e a página que você manda fica muito mais bonita.",
    botao: "ESCOLHER AS FOTOS",
    // O preço vem de quem chama (teste `preco_video`, 11/10): R$ 24,90 ou R$ 19,90 conforme a música.
    rodapeAviso: (preco: string) =>
      `Colocar as fotos e assistir não custa nada. Se quiser o vídeo em HD pra mandar no WhatsApp ou postar no story, são ${preco}, pagamento único.`,
    rodape: "Serenata · uma música feita da história de quem você ama",
    texto: (nome: string, link: string, preco: string) =>
      `A página de ${nome} ainda está sem as fotos de vocês.\n\n` +
      `Escolha umas fotos no celular e veja elas passando no ritmo da música, com a letra acendendo palavra por palavra. ` +
      `Leva um minuto:\n\n${link}\n\n` +
      `Colocar as fotos e assistir não custa nada. O vídeo em HD, pra mandar no WhatsApp, sai por ${preco}.`,
    precoPadrao: "R$ 24,90",
  },
  en: {
    assunto: (n: string) => `Add your photos to ${n}'s song`,
    titulo: "Your page is still missing your photos.",
    corpo:
      "Pick a few photos from your phone and watch what happens: they move to the beat of the song, with every word of the lyrics lighting up the moment it's sung. It takes a minute, and the page you send looks so much better.",
    botao: "CHOOSE MY PHOTOS",
    rodapeAviso: (preco: string) =>
      `Adding photos and watching is free. If you want the HD video to text to them or post to your story, it's ${preco}, one-time payment.`,
    rodape: `${MARCA_ATIVA.nome} · a song made from the story of someone you love`,
    texto: (nome: string, link: string, preco: string) =>
      `${nome}'s page is still missing your photos.\n\n` +
      `Pick a few photos from your phone and watch them move to the beat of the song, with the lyrics lighting up word by word. ` +
      `It takes a minute:\n\n${link}\n\n` +
      `Adding photos and watching is free. The HD video, ready to text to them, is ${preco}.`,
    precoPadrao: precoDoVideoNoEmail("en", null) ?? "$12",
  },
  es: {
    assunto: (n: string) => `Pon sus fotos en la canción de ${n}`,
    titulo: "A tu página todavía le faltan sus fotos.",
    corpo:
      "Escoge unas fotos de tu celular y mira lo que pasa: se mueven al ritmo de la canción, con la letra iluminándose palabra por palabra justo cuando se canta. Toma un minuto, y la página que vas a mandar queda mucho más bonita.",
    botao: "ESCOGER LAS FOTOS",
    rodapeAviso: (preco: string) =>
      `Poner las fotos y verlo es gratis. Si quieres el video en HD para mandarlo por mensaje o subirlo a tu historia, son ${preco}, un solo pago.`,
    rodape: `${MARCA_ATIVA.nome} · una canción hecha de la historia de quien tú quieres`,
    texto: (nome: string, link: string, preco: string) =>
      `A la página de ${nome} todavía le faltan sus fotos.\n\n` +
      `Escoge unas fotos de tu celular y míralas pasar al ritmo de la canción, con la letra iluminándose palabra por palabra. ` +
      `Toma un minuto:\n\n${link}\n\n` +
      `Poner las fotos y verlo es gratis. El video en HD, para mandarlo por mensaje, cuesta ${preco}.`,
    precoPadrao: precoDoVideoNoEmail("es", null) ?? "US$ 12",
  },
};

export function assuntoFotosVideo(nome: string, locale: IdiomaOfertaVideo = "pt"): string {
  return COPY[locale].assunto(nome);
}

export function textoFotosVideo(args: {
  nome: string;
  link: string;
  preco?: string;
  locale?: IdiomaOfertaVideo;
}): string {
  const C = COPY[args.locale ?? "pt"];
  return C.texto(args.nome, args.link, args.preco ?? C.precoPadrao);
}

export function emailFotosVideo(args: {
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
            ${C.botao}
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
