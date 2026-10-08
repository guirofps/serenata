import { moldura } from "./sequencia.js";

// O PEDIDO DO VÍDEO DE REAÇÃO, braço B do teste `pedido_reacao` (08/10).
// Só português, só comprador, no 3º dia depois da compra.
//
// ── O QUE ELE PROMETE, E QUEM CUMPRE ─────────────────────────────
//
// R$ 10 na próxima música, em troca do vídeo. NINGUÉM gera cupom
// automaticamente: a resposta cai na caixa do suporte (o `replyTo`), a
// triagem separa pro dono (`ehRespostaDeReacao` em `inngest/lib/suporte.ts`),
// e é uma pessoa que confere o vídeo e manda o cupom. Por isso o texto diz
// "a gente te manda", e não "você recebe na hora".
//
// ── O CONSENTIMENTO É ESCRITO COM TODAS AS LETRAS ────────────────
//
// O vídeo pode virar anúncio, e quem aparece nele é o PRESENTEADO, que nunca
// falou com a gente. Então: anúncio só com a permissão de quem mandou, depois
// de perguntar; e só mande se quem aparece no vídeo concordar. O cupom não
// depende de deixar usar em anúncio.

/** Marca no assunto que a triagem do suporte reconhece na resposta ("Re: ..."). */
export const MARCA_ASSUNTO_REACAO = "vídeo de reação";

export function assuntoPedidoReacao(nome: string): string {
  return `Um pedido sobre o ${MARCA_ASSUNTO_REACAO} de ${nome}`;
}

const p = (t: string) => `<p style="margin:0 0 14px;">${t}</p>`;

export function emailPedidoReacao(args: {
  nome: string;
  /** `mailto:` pro suporte, com o assunto pronto. */
  linkResposta: string;
  linkDescadastro: string;
}): string {
  const nome = args.nome || "quem ganhou a música";
  return moldura({
    locale: "pt",
    preheader: "Se você filmou a hora em que ouviu, a gente adoraria ver.",
    titulo: `Como foi quando ${nome} ouviu?`,
    miolo: [
      p(`Se você já entregou a música e alguém filmou a hora em que ${nome} ouviu, a gente adoraria ver. É só <strong>responder este e-mail com o vídeo</strong> (se ele ficar grande, pode mandar o link do Google Drive).`),
      p("Como agradecimento, <strong>a gente te manda um cupom de R$ 10</strong> pra sua próxima música. Uma pessoa da equipe confere o vídeo e responde com o cupom."),
      p("Sobre o uso do vídeo: ele <strong>só aparece num anúncio da Serenata se você deixar</strong>. Antes de usar, a gente te pergunta, e se a resposta for não, ele fica só com a gente. O cupom vale do mesmo jeito. E só mande se quem aparece no vídeo estiver de acordo."),
      p("Se você ainda não entregou, tudo bem: guarda este e-mail pra quando for a hora."),
    ].join(""),
    botao: "Responder com o vídeo",
    link: args.linkResposta,
    linkDescadastro: args.linkDescadastro,
  });
}

export function textoPedidoReacao(args: { nome: string }): string {
  const nome = args.nome || "quem ganhou a música";
  return (
    `Se você já entregou a música e alguém filmou a hora em que ${nome} ouviu, a gente adoraria ver. ` +
    `É só responder este e-mail com o vídeo (se ficar grande, pode mandar o link do Google Drive).\n\n` +
    `Como agradecimento, a gente te manda um cupom de R$ 10 pra sua próxima música. ` +
    `Uma pessoa da equipe confere o vídeo e responde com o cupom.\n\n` +
    `O vídeo só aparece num anúncio da Serenata se você deixar: antes de usar, a gente te pergunta, ` +
    `e se a resposta for não, ele fica só com a gente. O cupom vale do mesmo jeito. ` +
    `E só mande se quem aparece no vídeo estiver de acordo.\n\n` +
    `Se você ainda não entregou, tudo bem: guarda este e-mail pra quando for a hora.`
  );
}
