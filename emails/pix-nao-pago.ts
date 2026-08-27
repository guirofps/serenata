// O PIX QUE NÃO FOI PAGO.
//
// ── QUEM RECEBE ──────────────────────────────────────────────────
//
// Quem gerou o código e não pagou. Medido em 26/08: 550 pessoas em 14 dias,
// umas 39 por dia, e até hoje elas caíam na mesma régua de quem só leu a letra
// e foi embora. Não é a mesma pessoa: esta clicou em comprar, escolheu pagar e
// parou no último centímetro.
//
// ── POR QUE SEM DESCONTO ─────────────────────────────────────────
//
// A tentação é descontar aqui, e é errada. Este e-mail chega menos de uma hora
// depois: descontar nesse prazo ensina que basta abrir o PIX e esperar, e quem
// aprende isso nunca mais paga o preço cheio. A escada de recuperação
// (`escada.ts`) já desce o preço, dias depois, que é onde desconto é resposta
// e não reflexo.
//
// O trabalho aqui é outro: a pessoa não desistiu, ela se distraiu. O código
// PIX venceu, o app do banco fechou, o filho chamou. Este e-mail não vende
// nada novo, só devolve o botão.
//
// ── O TOM ────────────────────────────────────────────────────────
//
// Nada de "sua compra falhou" nem contagem regressiva falsa. Ela não falhou em
// nada e a música está pronta esperando. É isso que o e-mail diz.

type IdiomaEmail = "pt" | "es";

const COPY: Record<
  IdiomaEmail,
  {
    assunto: (n: string) => string;
    titulo: (n: string) => string;
    corpo: string;
    botao: string;
    ouCopie: string;
    rodapeAviso: string;
    rodape: string;
  }
> = {
  pt: {
    assunto: (n) => `A música de ${n} ficou pronta e o pagamento não entrou`,
    titulo: (n) => `A música de <em style="color:#7d2b3a;">${n}</em> está pronta e esperando você.`,
    corpo:
      "Vi que você chegou até o PIX e o pagamento não chegou a cair. Acontece: o aplicativo do banco fecha, alguém chama, o dia atropela. Nada se perdeu. A música ficou gravada e é a mesma que você vai receber.",
    botao: "PAGAR COM O MEU PIX →",
    // O CÓDIGO COPIÁVEL. Abrir link, esperar carregar e achar botão é
    // trabalho; copiar e colar no app do banco é o gesto que a pessoa já
    // domina. É o caminho mais curto entre o e-mail e o dinheiro.
    ouCopie: "Ou copie o código e cole no app do seu banco:",
    // MEDIDO: o PIX da Perfect Pay vale ~55h (mín. 45, máx. 71). O texto
    // anterior dizia que o código podia ter vencido, e era falso — além de
    // pedir à pessoa que refizesse um trabalho que ela já tinha feito.
    rodapeAviso:
      "O seu código continua valendo, é o mesmo que você gerou.<br>Se preferir pagar no cartão, a opção aparece na mesma tela.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `La canción de ${n} está lista y el pago no entró`,
    titulo: (n) => `La canción de <em style="color:#7d2b3a;">${n}</em> ya está lista y te espera.`,
    corpo:
      "Vi que llegaste hasta el pago y no alcanzó a acreditarse. Pasa: la app del banco se cierra, alguien te llama, el día atropella. No se perdió nada. La canción quedó grabada y es la misma que vas a recibir.",
    botao: "PAGAR CON MI PIX →",
    ouCopie: "O copia el código y pégalo en la app de tu banco:",
    rodapeAviso:
      "Tu código sigue siendo válido, es el mismo que generaste.<br>Si prefieres tarjeta, la opción aparece en la misma pantalla.",
    rodape: "Serenata · una canción hecha de la historia de quien tú quieres",
  },
};

/** O assunto, no idioma da venda. */
export function assuntoPixNaoPago(nome: string, locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto(nome);
}

export function emailPixNaoPago(args: {
  nome: string;
  titulo: string;
  linkCheckout: string;
  /** O código copia-e-cola do PIX dela. Ausente em pedido antigo sem URL. */
  codigo?: string | null;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { nome, titulo, linkCheckout, codigo } = args;
  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto(nome)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <!-- Logo em TEXTO: Gmail e Apple Mail bloqueiam imagem de remetente
               novo e desenham o ícone de quebrado no lugar. Ver o comentário
               longo em presente-pronto.ts. -->
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">SERENATA</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">
            ${C.titulo(nome)}
          </h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>

        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${C.corpo}
        </td></tr>

        <tr><td align="center" style="padding:26px 36px 8px;">
          <!-- Botão, nunca URL visível: cliente de e-mail corta link longo no
               fim da linha e cola a pontuação da frase nele. Um caractere a
               menos no checkout dá erro seco, sem pista. -->
          <a href="${linkCheckout}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 34px;border-radius:999px;">
            ${C.botao}
          </a>
        </td></tr>

        ${
          codigo
            ? `<tr><td style="padding:14px 36px 0;text-align:center;">
          <p style="margin:0 0 8px;color:rgba(42,21,24,0.55);font-size:12px;font-family:Helvetica,Arial,sans-serif;">${C.ouCopie}</p>
          <!-- word-break porque o codigo tem 200+ caracteres sem espaco: sem
               isso ele estoura a largura em qualquer cliente de e-mail. E
               fonte monoespacada porque a pessoa precisa CONFERIR o que colou. -->
          <p style="margin:0;padding:12px;border-radius:8px;background:#f2e9dc;border:1px solid rgba(42,21,24,0.12);color:#2a1518;font-family:Courier,monospace;font-size:11px;line-height:1.5;word-break:break-all;text-align:left;">${codigo}</p>
        </td></tr>`
            : ""
        }

        <tr><td style="padding:14px 36px 30px;text-align:center;color:rgba(42,21,24,0.5);font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
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
