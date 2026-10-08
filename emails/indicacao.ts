// "O SEU LINK", o convite pro member get member — disparo único pra quem já comprou.
//
// ── O LINK VAI DENTRO DO E-MAIL, E ISSO É A DECISÃO INTEIRA ──────
//
// `/indique` exige login (`emailDaSessao`), e o magic link é de uso único e
// expira em minutos — inútil num disparo em massa. Então mandar "vá no painel
// pegar seu link" custa: abrir este e-mail, clicar, cair no /login, digitar o
// e-mail, ESPERAR UM SEGUNDO E-MAIL, abrir, clicar. Sete passos e duas caixas
// de entrada entre a pessoa e o dinheiro dela.
//
// Aqui o link já vem pronto. Ela não precisa entrar em lugar nenhum pra
// começar a ganhar — só pra sacar, que é quando ela já tem motivo.
//
// Consequência: o disparo PRECISA criar o código antes de mandar (`codigoDe`,
// em `indicacao-fns.ts`). Link com código que não está em `indicacao_codigos`
// não dá desconto nenhum — `conviteDaCompra` procura a linha e devolve `null`
// sem ela. Um e-mail desses seria pior que não mandar: o amigo clica, paga
// preço cheio, e quem indicou fica sem comissão e sem entender.
//
// ── OS NÚMEROS SAEM DE `indicacao.ts`, NUNCA ESCRITOS À MÃO ──────
//
// Este e-mail promete DINHEIRO. Um número decorado aqui que divergisse da
// regra do banco viraria promessa que o sistema não cumpre — e, diferente de
// uma copy qualquer, essa o cliente confere na calculadora.
//
// ── O PISO DE R$ 100 APARECE, E APARECE CEDO ─────────────────────
//
// A R$ 6,84 por indicação, R$ 100 são QUINZE amigos. Esconder isso no rodapé
// faria a pessoa juntar R$ 34 e descobrir sozinha que não pode sacar — que é
// como se fabrica raiva e ticket de suporte em cima de uma boa notícia.
// Está dito no corpo, com o número junto, pra a conta ser feita na hora.

import {
  PCT_DESCONTO,
  PCT_COMISSAO,
  CARENCIA_DIAS,
  SAQUE_MINIMO_CENTAVOS,
  comissaoDe,
  descontoDoConvite,
  reaisDeCentavos,
} from "../src/lib/indicacao.js";

/** O preço base do funil pt. Só pra ILUSTRAR a conta no e-mail. */
const BASE_CENTAVOS = 3800;
/** O vídeo, pra mostrar que a comissão sobe quando o amigo leva mais. */
const VIDEO_CENTAVOS = 2490;

const pagoPeloAmigo = BASE_CENTAVOS - descontoDoConvite(BASE_CENTAVOS);
const POR_AMIGO = reaisDeCentavos(comissaoDe(pagoPeloAmigo));
const POR_AMIGO_COM_VIDEO = reaisDeCentavos(comissaoDe(pagoPeloAmigo + VIDEO_CENTAVOS));
const PRECO_AMIGO = reaisDeCentavos(pagoPeloAmigo);
const MINIMO = reaisDeCentavos(SAQUE_MINIMO_CENTAVOS);

export function assuntoIndicacao(): string {
  return `O seu link: ${POR_AMIGO} por amigo que fizer a música dele`;
}

/** A mensagem pronta pra mandar no WhatsApp, já com o link dentro. */
export function mensagemPronta(link: string): string {
  return (
    `Fiz uma música personalizada pra uma pessoa que eu amo. A história dela virou letra e virou canção. ` +
    `Se você quiser fazer uma, entra pelo meu link que você ganha ${PCT_DESCONTO}% de desconto: ${link}`
  );
}

export function textoIndicacao(args: { nome: string; link: string }): string {
  return (
    `Ganhe dinheiro indicando o Serenata.\n\n` +
    `${args.nome ? `${args.nome}, o` : "O"} seu link está pronto:\n` +
    `${args.link}\n\n` +
    `Quem entrar por ele paga ${PCT_DESCONTO}% menos (${PRECO_AMIGO} em vez de R$ 38), ` +
    `e você recebe ${POR_AMIGO} por música criada, ou ${POR_AMIGO_COM_VIDEO} se a pessoa levar o vídeo junto.\n\n` +
    `O valor libera em ${CARENCIA_DIAS} dias e o saque por PIX começa em ${MINIMO}.\n\n` +
    `Seu saldo fica em https://www.serenatagift.com/indique`
  );
}

export function emailIndicacao(args: {
  nome: string;
  link: string;
  linkPainel: string;
  linkDescadastro: string;
}): string {
  const { nome, link, linkPainel, linkDescadastro } = args;
  // A HEADLINE É A OFERTA, O NOME ABRE O CORPO.
  //
  // Pedido do dono em 27/09: a manchete diz o que a pessoa ganha, em vez de
  // anunciar que um link existe. A personalização não se perde — ela só desce
  // uma linha, pra primeira frase do texto, onde continua fazendo o trabalho
  // de dizer "isto é pra você" sem tomar o lugar da oferta.
  const abertura = nome ? `${nome}, você` : "Você";
  const zap = `https://wa.me/?text=${encodeURIComponent(mensagemPronta(link))}`;

  const linha = (n: string, texto: string) =>
    `<tr>
      <td width="34" valign="top" style="padding:0 0 14px;">
        <div style="width:24px;height:24px;border-radius:999px;background:#7d2b3a;color:#faf5ee;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;text-align:center;line-height:24px;">${n}</div>
      </td>
      <td valign="top" style="padding:2px 0 14px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.6;">${texto}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${assuntoIndicacao()}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Quem entrar pelo seu link paga ${PCT_DESCONTO}% menos, e você recebe ${POR_AMIGO} por música.</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <div style="margin:0 auto 18px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;">SERENATA</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">Ganhe dinheiro indicando o Serenata.</h1>
        </td></tr>

        <tr><td style="padding:20px 36px 0;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${abertura} já fez uma música pra alguém e sabe o que aconteceu quando ela ouviu.
          Quem esteve por perto naquele momento provavelmente pensou a mesma coisa:
          <em>eu queria fazer uma dessas</em>.
          <br><br>
          Agora dá pra oferecer isso, e receber por cada uma que nascer.
        </td></tr>

        <!-- O LINK: é o produto deste e-mail, então é o maior elemento da tela. -->
        <tr><td style="padding:26px 36px 0;">
          <div style="border:1px dashed rgba(125,43,58,0.4);border-radius:12px;background:#fffdf9;padding:18px 16px;text-align:center;">
            <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.5px;color:#a89296;text-transform:uppercase;">o seu link</div>
            <div style="margin-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:17px;font-weight:bold;color:#7d2b3a;word-break:break-all;line-height:1.45;">${link}</div>
          </div>
        </td></tr>

        <tr><td align="center" style="padding:20px 36px 4px;">
          <a href="${zap}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:15px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
            MANDAR NO WHATSAPP
          </a>
          <div style="margin-top:10px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#a89296;">
            abre com a mensagem já escrita, é só escolher pra quem
          </div>
        </td></tr>

        <tr><td style="padding:26px 36px 0;">
          <div style="height:1px;background:rgba(42,21,24,0.1);"></div>
        </td></tr>

        <tr><td style="padding:24px 36px 0;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.5px;color:#a89296;text-transform:uppercase;padding-bottom:16px;">como funciona</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${linha("1", `Você manda o link. Quem entrar por ele paga <strong style="color:#2a1518;">${PRECO_AMIGO}</strong> em vez de R$ 38. ${PCT_DESCONTO}% de desconto é o seu presente pra essa pessoa.`)}
            ${linha("2", `Quando a música dela fica pronta e paga, <strong style="color:#2a1518;">${POR_AMIGO}</strong> entram na sua conta. Se ela levar o vídeo junto, <strong style="color:#2a1518;">${POR_AMIGO_COM_VIDEO}</strong>.`)}
            ${linha("3", `O valor libera em ${CARENCIA_DIAS} dias e o saque por PIX começa em <strong style="color:#2a1518;">${MINIMO}</strong>, são cerca de ${Math.ceil(SAQUE_MINIMO_CENTAVOS / comissaoDe(pagoPeloAmigo))} músicas. Não tem teto: quanto mais gente, mais entra.`)}
          </table>
        </td></tr>

        <tr><td align="center" style="padding:10px 36px 0;">
          <a href="${linkPainel}" style="color:#7d2b3a;font-family:Helvetica,Arial,sans-serif;font-size:14px;text-decoration:underline;">
            Ver o meu saldo e sacar
          </a>
        </td></tr>

        <tr><td style="padding:28px 36px 34px;text-align:center;">
          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#a89296;">
            Serenata · uma música feita da história de quem você ama<br>
            <a href="${linkDescadastro}" style="color:#a89296;text-decoration:underline;">não quero mais receber e-mails</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
