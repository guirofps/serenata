// O CAMINHO DE VOLTA, três dias depois da compra.
//
// ── O QUE ISTO CONSERTA ──────────────────────────────────────────
//
// Em 26/08, oito tickets de suporte num dia. Cinco eram a MESMA coisa: a
// música estava pronta, funcionando, e a pessoa não achava mais o caminho até
// ela. Um deles tinha montado a página inteira com 12 fotos e voltou uma
// semana depois achando que não tinha recebido nada.
//
// Nenhum era defeito de produto. O que falta é o caminho de VOLTA: 84% dos
// compradores nunca entram na conta, então o e-mail é a única memória que eles
// têm do link, e ele fica soterrado na caixa em três dias.
//
// ── POR QUE SÓ PRA QUEM JÁ MONTOU ────────────────────────────────
//
// Quem NÃO montou já recebe o `lembrarPresente` (3h a 96h), que é outro
// e-mail com outro pedido. Mandar os dois faria a mesma pessoa receber duas
// cobranças em uma semana, e é assim que remetente novo vira spam.
//
// A divisão fica limpa: não montou → lembrete; montou → este aqui.
//
// ── POR QUE O ASSUNTO É ASSIM ────────────────────────────────────
//
// "Seus links" com a palavra LINKS no assunto não é preguiça de copy: é o que
// a pessoa vai digitar na busca do Gmail dali a duas semanas, quando quiser
// mandar o presente pra mais alguém. O assunto deste e-mail é uma chave de
// busca, não um título.
//
// ── E POR QUE OS DOIS LINKS, SEPARADOS ───────────────────────────
//
// Os cinco tickets se dividiam em dois enganos: "onde baixo o MP3" e "qual
// link eu mando pra ela". São dois links diferentes com dois donos diferentes,
// e o e-mail de entrega os apresentava como principal e secundário, o que não
// diz a ninguém qual é qual.

type IdiomaEmail = "pt" | "es";

const COPY: Record<
  IdiomaEmail,
  {
    assunto: (n: string) => string;
    titulo: string;
    corpo: string;
    seuLinkTitulo: string;
    seuLinkTexto: string;
    seuLinkBotao: string;
    delaTitulo: string;
    delaTexto: string;
    delaBotao: string;
    rodapeAviso: string;
    rodape: string;
  }
> = {
  pt: {
    assunto: (n) => `Seus links da música de ${n} (guarde este e-mail)`,
    titulo: "Guarde este e-mail.",
    corpo:
      "É só pra você não perder o caminho de volta. Sua música não expira e a página continua no ar, mas o e-mail da compra some rápido na caixa de entrada. São dois links, e cada um serve pra uma coisa.",
    seuLinkTitulo: "1 · O link que é SEU",
    seuLinkTexto:
      "É por aqui que você <strong>baixa o MP3</strong> da música e edita a página (trocar a foto, mudar a frase, escolher a gravação). Não mande este link pra ninguém.",
    seuLinkBotao: "BAIXAR A MÚSICA / EDITAR",
    delaTitulo: "2 · O link que você MANDA",
    delaTexto:
      "É o presente em si. Quem abrir vê a homenagem com a foto e a música tocando. É este que vai no WhatsApp.",
    delaBotao: "ABRIR A PÁGINA DO PRESENTE",
    rodapeAviso:
      "Dica: no celular, o botão de baixar abre a telinha de compartilhar e você manda o áudio direto no WhatsApp.<br>Perdeu alguma coisa? Responda este e-mail que a gente resolve.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (n) => `Tus links de la canción de ${n} (guarda este correo)`,
    titulo: "Guardá este correo.",
    corpo:
      "Es solo para que no pierdas el camino de vuelta. Tu canción no expira y la página sigue en línea, pero el correo de la compra se pierde rápido en la bandeja. Son dos links, y cada uno sirve para algo distinto.",
    seuLinkTitulo: "1 · El link que es TUYO",
    seuLinkTexto:
      "Por aquí <strong>descargas el MP3</strong> de la canción y editas la página (cambiar la foto, la frase, la grabación). No le mandes este link a nadie.",
    seuLinkBotao: "DESCARGAR LA CANCIÓN / EDITAR",
    delaTitulo: "2 · El link que ENVÍAS",
    delaTexto:
      "Es el regalo en sí. Quien lo abra ve el homenaje con la foto y la canción sonando. Este es el que va por WhatsApp.",
    delaBotao: "ABRIR LA PÁGINA DEL REGALO",
    rodapeAviso:
      "Consejo: en el celu, el botón de descargar abre la pantalla de compartir y mandás el audio directo por WhatsApp.<br>¿Perdiste algo? Respondé este correo y lo resolvemos.",
    rodape: "Serenata · una canción hecha de la historia de quien vos querés",
  },
};

/** O assunto, no idioma da venda. */
export function assuntoGuardeOLink(nome: string, locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto(nome);
}

export function emailGuardeOLink(args: {
  nome: string;
  titulo: string;
  linkEditor: string;
  linkPresente: string;
  locale?: IdiomaEmail;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { nome, titulo, linkEditor, linkPresente } = args;

  // Os dois blocos têm o MESMO peso visual de propósito: aqui não existe ação
  // principal, existe um mapa. Dar destaque a um dos dois reproduziria o
  // defeito do e-mail de entrega, onde o segundo link parecia opcional.
  const bloco = (t: string, texto: string, botao: string, href: string) => `
        <tr><td style="padding:20px 34px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(42,21,24,0.12);border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#7d2b3a;font-weight:bold;">${t}</p>
              <p style="margin:8px 0 0;color:rgba(42,21,24,0.75);font-size:14px;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">${texto}</p>
              <!-- 14px de padding e não 12: com 12 o botão de uma linha só
                   media 40px de altura, abaixo dos 44 de alvo de toque. O
                   outro passava porque o texto quebrava em duas linhas, o que
                   é sorte, não desenho. -->
              <a href="${href}" style="display:inline-block;margin-top:14px;padding:14px 22px;border-radius:999px;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-weight:bold;font-size:13px;font-family:Helvetica,Arial,sans-serif;">${botao}</a>
            </td></tr>
          </table>
        </td></tr>`;

  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto(nome)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>

        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">SERENATA</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">
            ${C.titulo}
          </h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>

        <tr><td style="padding:18px 36px 0;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          ${C.corpo}
        </td></tr>
${bloco(C.seuLinkTitulo, C.seuLinkTexto, C.seuLinkBotao, linkEditor)}
${bloco(C.delaTitulo, C.delaTexto, C.delaBotao, linkPresente)}

        <tr><td style="padding:22px 36px 30px;text-align:center;color:rgba(42,21,24,0.5);font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
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
