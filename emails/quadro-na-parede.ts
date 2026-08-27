// O QUADRO, uma semana depois da compra.
//
// ── POR QUE UM E-MAIL SÓ PRO QUADRO ──────────────────────────────
//
// Ele já é oferecido no e-mail de entrega, e vende: 23 quadros contra 5
// músicas extras e 0 pacotes de três. Só que ali ele é um bloco no rodapé de
// uma mensagem cujo trabalho é outro — a pessoa acabou de comprar, está
// ansiosa pra montar o presente, e não é hora de vender de novo.
//
// Aqui é. Uma semana depois ela já entregou, já viu a reação, e a memória do
// momento é o melhor argumento que existe pro quadro: transformar aquilo em
// coisa física, na parede.
//
// ── POR QUE 7 DIAS ───────────────────────────────────────────────
//
// O `guardeOLink` sai no dia 3 e o `volteCriar` de 5 a 30. Sete dias cai
// depois do primeiro e no meio do segundo, o que é aceitável porque são
// ofertas diferentes: um convida a criar OUTRA música, este transforma a que
// ela já tem. Quem comprar o quadro provavelmente não quer segunda música na
// mesma semana, e vice-versa.
//
// ── O ARGUMENTO É A REAÇÃO, NÃO O PRODUTO ────────────────────────
//
// "Folha A4 com QR Code" descreve o objeto e não vende nada. O que vende é a
// cena: a pessoa que recebeu a música vendo ela na parede, e a visita
// apontando a câmera pra ouvir. O objeto é o meio.

type IdiomaEmail = "pt" | "es";

const SITE = "https://www.serenatagift.com";

const COPY: Record<
  IdiomaEmail,
  {
    assunto: (n: string) => string;
    titulo: string;
    corpo: string;
    comoFunciona: string[];
    botao: string;
    rodapeAviso: string;
    rodape: string;
  }
> = {
  pt: {
    assunto: (n) => `E se a música de ${n} ficasse na parede?`,
    titulo: "A música já é dela. Agora ela pode ficar na parede.",
    corpo:
      "Faz uma semana que você entregou. Se a reação foi o que a gente costuma ver por aqui, a música virou uma coisa que vocês dois vão lembrar. E coisa assim merece existir fora do celular.",
    comoFunciona: [
      "A letra inteira e a foto de vocês numa folha A4, pronta pra emoldurar.",
      "Um QR Code no canto: quem passar aponta a câmera e ouve a música.",
      "Você baixa o arquivo e manda imprimir em qualquer gráfica ou papelaria.",
    ],
    botao: "VER O QUADRO DA MINHA MÚSICA",
    rodapeAviso:
      "Pagamento único, sem assinatura. O quadro usa a mesma música e a mesma foto que você já montou.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `¿Y si la canción de ${n} quedara en la pared?`,
    titulo: "La canción ya es suya. Ahora puede quedar en la pared.",
    corpo:
      "Hace una semana que la entregaste. Si la reacción fue la que solemos ver por acá, esa canción se volvió algo que ustedes dos van a recordar. Y algo así merece existir fuera del celular.",
    comoFunciona: [
      "La letra completa y la foto de ustedes en una hoja A4, lista para enmarcar.",
      "Un código QR en la esquina: quien pase apunta la cámara y escucha la canción.",
      "Descargás el archivo y lo mandás a imprimir en cualquier imprenta.",
    ],
    botao: "VER EL CUADRO DE MI CANCIÓN",
    rodapeAviso:
      "Pago único, sin suscripción. El cuadro usa la misma canción y la misma foto que ya armaste.",
    rodape: "Serenata · una canción hecha de la historia de quien tú quieres",
  },
};

/** O assunto, no idioma da venda. */
export function assuntoQuadro(nome: string, locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto(nome);
}

export function emailQuadro(args: {
  nome: string;
  titulo: string;
  link: string;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { nome, titulo, link } = args;
  const itens = C.comoFunciona
    .map(
      (t) =>
        `<tr><td style="padding:0 0 10px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
        `<td valign="top" style="padding-right:10px;color:#7d2b3a;font-size:15px;line-height:1.5;">·</td>` +
        `<td style="color:rgba(42,21,24,0.75);font-size:14px;line-height:1.55;font-family:Helvetica,Arial,sans-serif;">${t}</td>` +
        `</tr></table></td></tr>`,
    )
    .join("");

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
            ${C.titulo}
          </h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>

        <!-- A MINIATURA DA MOLDURA. "Folha A4 com QR Code" não desenha nada na
             cabeça de ninguém; a imagem resolve em meio segundo. É a mesma do
             e-mail de entrega e do editor. -->
        <tr><td align="center" style="padding:24px 34px 0;">
          <img src="${SITE}/img/quadro-exemplo.jpg" width="150" alt="" style="display:block;border:7px solid #2c211a;border-radius:2px;background:#f6f2ea;padding:7px;">
        </td></tr>

        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${C.corpo}
        </td></tr>

        <tr><td style="padding:16px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itens}</table>
        </td></tr>

        <tr><td align="center" style="padding:22px 36px 8px;">
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
