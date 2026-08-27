// CLICOU EM COMPRAR E NÃO CHEGOU NEM A GERAR O PEDIDO.
//
// ── O BURACO, MEDIDO EM 27/08 ────────────────────────────────────
//
// Em 7 dias, 2.577 pessoas clicaram em comprar. Dessas, 1.509 (58,6%) NUNCA
// geraram pedido nenhum — nem um PIX pendente. São ~215 por dia, contra ~39
// do PIX abandonado: é o maior vazamento sem tratamento do funil inteiro.
//
// E não é gente fria: 1.486 das 1.509 têm a música pronta esperando, e 1.504
// deixaram e-mail. Elas leram a letra, ouviram o trecho, clicaram em comprar,
// caíram no gateway e sumiram.
//
// ── POR QUE ELA É DIFERENTE DE QUEM ABANDONOU O PIX ──────────────
//
// Quem gerou PIX escolheu como pagar e parou no último centímetro: pra ela o
// e-mail devolve o código. Esta aqui parou ANTES, na tela do gateway, e o que
// travou provavelmente foi outra coisa — formulário, desconfiança, o preço
// batendo de frente pela primeira vez, ou simplesmente a vida.
//
// Por isso o texto não fala de pagamento. Ele volta pro PRODUTO: a música
// existe, tem nome, está gravada, e está esperando. O botão é consequência.
//
// ── PREÇO CHEIO ──────────────────────────────────────────────────
//
// Mesma regra do PIX e da escada: descontar meia hora depois ensina que basta
// hesitar. O link leva ao MESMO preço que ela viu, lido da config viva.

type IdiomaEmail = "pt" | "es";

const COPY: Record<
  IdiomaEmail,
  {
    assunto: (n: string) => string;
    titulo: (n: string) => string;
    corpo: string;
    lembrete: string;
    botao: string;
    rodapeAviso: string;
    rodape: string;
  }
> = {
  pt: {
    assunto: (n) => `A música de ${n} está gravada e é sua`,
    titulo: (n) => `A música de <em style="color:#7d2b3a;">${n}</em> já existe.`,
    corpo:
      "Ela foi gravada com a história que você contou, com os detalhes que só vocês dois sabem. Está aqui, inteira, esperando você.",
    // O QUE ELA LEVA, e não o que ela paga. Quem parou na tela do gateway
    // parou porque o preço apareceu antes de a entrega ficar clara.
    lembrete:
      "Você recebe a música completa nas duas versões gravadas, a página presente com link e QR Code pra enviar, e o arquivo MP3 pra guardar pra sempre.",
    botao: "OUVIR E LIBERAR A MINHA MÚSICA",
    rodapeAviso:
      "A letra continua sua de qualquer jeito, e o link não expira.<br>Se travou alguma coisa na hora de pagar, é só responder este e-mail.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `La canción de ${n} ya está grabada y es tuya`,
    titulo: (n) => `La canción de <em style="color:#7d2b3a;">${n}</em> ya existe.`,
    corpo:
      "Se grabó con la historia que contaste, con los detalles que solo ustedes dos saben. Está acá, entera, esperándote.",
    lembrete:
      "Recibís la canción completa en las dos versiones grabadas, la página regalo con link y código QR para enviarla, y el archivo MP3 para guardar para siempre.",
    botao: "ESCUCHAR Y LIBERAR MI CANCIÓN",
    rodapeAviso:
      "La letra sigue siendo tuya igual, y el link no expira.<br>Si algo se trabó al pagar, respondé este correo.",
    rodape: "Serenata · una canción hecha de la historia de quien tú quieres",
  },
};

/** O assunto, no idioma da venda. */
export function assuntoQuaseComprou(nome: string, locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto(nome);
}

export function emailQuaseComprou(args: {
  nome: string;
  titulo: string;
  link: string;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { nome, titulo, link } = args;
  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto(nome)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <!-- Logo em TEXTO: Gmail e Apple Mail bloqueiam imagem de remetente
               novo. Ver o comentário longo em presente-pronto.ts. -->
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">SERENATA</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">
            ${C.titulo(nome)}
          </h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>

        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${C.corpo}
        </td></tr>

        <tr><td style="padding:18px 36px 0;">
          <p style="margin:0;padding:14px 16px;border-radius:10px;background:rgba(125,43,58,0.05);border:1px solid rgba(125,43,58,0.12);color:rgba(42,21,24,0.8);font-size:14px;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
            ${C.lembrete}
          </p>
        </td></tr>

        <tr><td align="center" style="padding:24px 36px 8px;">
          <!-- Botão, nunca URL visível: cliente de e-mail corta link longo no
               fim da linha e cola a pontuação da frase nele. -->
          <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:15px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
            ${C.botao}
          </a>
        </td></tr>

        <tr><td style="padding:10px 36px 30px;text-align:center;color:rgba(42,21,24,0.5);font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
          ${C.rodapeAviso}
        </td></tr>
      </table>

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        ${C.rodape}
      </p>
    </td></tr>
  </table>
</body></html>`;
}
