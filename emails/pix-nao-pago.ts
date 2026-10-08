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
    /**
     * Quando NAO ha codigo pra mandar.
     *
     * O rodape normal promete "o seu codigo continua valendo, e o mesmo que
     * voce gerou" — e isso e mentira quando o link vai pro checkout em vez
     * do PIX que ela abriu. Dois casos caem aqui:
     *
     *   - pedido antigo que nao guardou `pix_url` (o caminho de reserva que
     *     ja existia, e que ja mandava esse rodape errado);
     *   - gateway fora do ar, quando o codigo gerado nao pode ser pago. Em
     *     11/09/2026 a chave PIX da Woovi parou de resolver no DICT e todo
     *     codigo do dia virou papel: o e-mail continuava mandando a pessoa
     *     pra um pagamento impossivel, prometendo que valia.
     */
    botaoSemCodigo: string;
    rodapeSemCodigo: string;
    /**
     * Quem tentou no CARTÃO (08/10).
     *
     * Desde 26/09 o cartão do Asaas também deixa pedido `pendente` (análise,
     * confirmação do banco), e o job manda pra todo pendente. Este e-mail
     * dizia "você chegou até o PIX" pra quem nunca abriu PIX nenhum. O botão e
     * o rodapé são os de "sem código": o link volta pra música dela, onde ela
     * escolhe PIX ou cartão de novo.
     */
    assuntoCartao: (n: string) => string;
    corpoCartao: string;
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
    botaoSemCodigo: "CONCLUIR O PAGAMENTO →",
    rodapeSemCodigo:
      "A sua música continua guardada.<br>É só concluir o pagamento na página, por PIX ou cartão.",
    assuntoCartao: (n) => `A música de ${n} ficou pronta e a compra não foi concluída`,
    corpoCartao:
      "Vi que você tentou pagar no cartão e a compra não chegou a ser concluída. Acontece: o banco pede uma confirmação, o cartão recusa sem explicar, alguém chama. Nada se perdeu. A música ficou gravada e é a mesma que você vai receber.",
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
    botaoSemCodigo: "COMPLETAR EL PAGO →",
    rodapeSemCodigo:
      "Tu canción sigue guardada.<br>Solo falta completar el pago en la página.",
    assuntoCartao: (n) => `La canción de ${n} está lista y la compra no se completó`,
    corpoCartao:
      "Vi que intentaste pagar con tarjeta y la compra no alcanzó a completarse. Pasa: el banco pide una confirmación, la tarjeta se rechaza sin explicar, alguien te llama. No se perdió nada. La canción quedó grabada y es la misma que vas a recibir.",
    rodape: "Serenata · una canción hecha de la historia de quien vos querés",
  },
};

/** Como ela tentou pagar. Ver `meioDoPendente` em `src/lib/pix-nao-pago-regras.ts`. */
export type MeioTentado = "pix" | "cartao";

/** O assunto, no idioma da venda. */
export function assuntoPixNaoPago(nome: string, locale: IdiomaEmail = "pt", meio: MeioTentado = "pix") {
  const C = COPY[locale] ?? COPY.pt;
  return meio === "cartao" ? C.assuntoCartao(nome) : C.assunto(nome);
}

export function emailPixNaoPago(args: {
  nome: string;
  titulo: string;
  linkCheckout: string;
  /** O código copia-e-cola do PIX dela. Ausente em pedido antigo sem URL. */
  codigo?: string | null;
  locale?: IdiomaEmail;
  /** Cartão: outro texto, e nunca código (não existe código de cartão). */
  meio?: MeioTentado;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const cartao = args.meio === "cartao";
  const { nome, titulo, linkCheckout } = args;
  const codigo = cartao ? null : args.codigo;
  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${cartao ? C.assuntoCartao(nome) : C.assunto(nome)}</title></head>
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
          ${cartao ? C.corpoCartao : C.corpo}
        </td></tr>

        <tr><td align="center" style="padding:26px 36px 8px;">
          <!-- Botão, nunca URL visível: cliente de e-mail corta link longo no
               fim da linha e cola a pontuação da frase nele. Um caractere a
               menos no checkout dá erro seco, sem pista. -->
          <a href="${linkCheckout}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 34px;border-radius:999px;">
            ${codigo ? C.botao : C.botaoSemCodigo}
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
          ${codigo ? C.rodapeAviso : C.rodapeSemCodigo}
        </td></tr>
      </table>

      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
        ${C.rodape}
      </p>
    </td></tr>
  </table>
</body></html>`;
}
