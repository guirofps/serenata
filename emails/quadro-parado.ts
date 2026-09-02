// VOCÊ PAGOU O QUADRO E ELE ESTÁ PARADO.
//
// ── O DEFEITO QUE ESTE E-MAIL CONSERTA ───────────────────────────
//
// Medido em 02/09: 34 quadros vendidos, 7 montados. 27 pessoas pagaram e não
// levaram nada — 79%. É o pior defeito que uma operação pode ter, e ele é
// silencioso: ninguém abre ticket dizendo "paguei e esqueci".
//
// A causa é estrutural. O quadro é o ÚNICO produto da casa que exige um passo
// depois do pagamento: escolher de qual música ele é. Todo o resto chega
// pronto. E o único aviso desse passo era um bloco no e-mail de entrega, que
// a pessoa lê no minuto em que está ansiosa pra ouvir a música.
//
// ── ISTO NÃO É MARKETING, É ENTREGA ──────────────────────────────
//
// Por isso sai pelo remetente TRANSACIONAL, o domínio raiz. Quem recebe já
// pagou, e o que este e-mail carrega é o produto dela, não uma oferta. Tratar
// como campanha seria mandar a entrega de um cliente pelo canal que existe
// pra queimar reputação.
//
// A copy segue a mesma regra: nenhum verbo de venda, nenhum preço, nenhuma
// âncora. "Você já pagou" na primeira linha, porque a primeira dúvida de quem
// recebe um e-mail sobre algo que esqueceu é se vão cobrar de novo.
//
// ── O LINK É O TOKEN, NUNCA O PAINEL ─────────────────────────────
//
// 84% dos compradores nunca entram na conta. Mandar pro `/dashboard` quem já
// pagou é exatamente onde este dinheiro parou da primeira vez.

type IdiomaEmail = "pt" | "es";

const COPY: Record<
  IdiomaEmail,
  {
    assunto: string;
    titulo: string;
    corpo: string;
    passos: string[];
    botao: string;
    aviso: string;
    ajuda: string;
    rodape: string;
  }
> = {
  pt: {
    assunto: "O seu quadro está esperando você escolher a música",
    titulo: "Seu quadro está pronto. Falta um clique.",
    corpo:
      "Você comprou o quadro e ele ficou parado esperando uma coisa só: você dizer de qual música ele é. Não precisa pagar nada de novo, é só escolher.",
    passos: [
      "Abra o link abaixo e veja a folha montada, com a letra e a sua foto.",
      "Ajuste a cor e o fundo se quiser. O fundo claro gasta bem menos tinta.",
      "Salve em PDF e mande imprimir. Numa gráfica, papel fosco A4, fica de moldura.",
    ],
    botao: "VER E MONTAR O MEU QUADRO",
    aviso:
      "Você já pagou por ele. Este link é seu e continua valendo, não tem prazo pra usar.",
    ajuda: "Se alguma coisa não abrir, é só responder este e-mail que a gente resolve.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: "Tu cuadro está esperando que elijas la canción",
    titulo: "Tu cuadro está listo. Falta un clic.",
    corpo:
      "Compraste el cuadro y quedó esperando una sola cosa: que digas de cuál canción es. No tenés que pagar nada de nuevo, solo elegir.",
    passos: [
      "Abrí el link de abajo y mirá la hoja armada, con la letra y tu foto.",
      "Ajustá el color y el fondo si querés. El fondo claro gasta mucha menos tinta.",
      "Guardalo en PDF y mandalo a imprimir. En papel mate A4 queda para enmarcar.",
    ],
    botao: "VER Y ARMAR MI CUADRO",
    aviso: "Ya lo pagaste. Este link es tuyo y sigue valiendo, no vence.",
    ajuda: "Si algo no abre, respondé este correo y lo resolvemos.",
    rodape: "Serenata · una canción hecha de la historia de quien vos querés",
  },
};

export function assuntoQuadroParado(locale: IdiomaEmail = "pt") {
  return COPY[locale].assunto;
}

export function emailQuadroParado(args: {
  /** O link direto da folha, pelo token de edição. */
  link: string;
  /** Da música que a pessoa provavelmente quer no quadro. Só pra situar. */
  titulo?: string | null;
  locale?: IdiomaEmail;
}) {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  const { link } = args;
  const titulo = (args.titulo ?? "").trim();

  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.assunto}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:34px 28px 30px;">

          <p style="margin:0;font-size:22px;line-height:1.3;color:#2a1518;">
            ${C.titulo}
          </p>

          <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:rgba(42,21,24,0.78);font-family:Helvetica,Arial,sans-serif;">
            ${C.corpo}
          </p>

          ${
            titulo
              ? `<p style="margin:10px 0 0;font-size:14px;color:rgba(42,21,24,0.55);font-family:Helvetica,Arial,sans-serif;">
            ${args.locale === "es" ? "Tu canción" : "A sua música"}: <strong style="color:#2a1518;">${titulo}</strong>
          </p>`
              : ""
          }

          <!-- O BOTÃO ANTES DA LISTA. Quem já sabe o que fazer não deve ter
               que ler três passos pra achar o caminho. -->
          <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td align="center">
            <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
              ${C.botao}
            </a>
          </td></tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border-top:1px solid rgba(42,21,24,0.10);">
            <tr><td style="padding-top:20px;">
              ${C.passos
                .map(
                  (p, i) =>
                    `<p style="margin:${i ? "10px" : "0"} 0 0;font-size:14px;line-height:1.55;color:rgba(42,21,24,0.7);font-family:Helvetica,Arial,sans-serif;"><strong style="color:#7d2b3a;">${i + 1}.</strong> ${p}</p>`,
                )
                .join("")}
            </td></tr>
          </table>

          <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid rgba(42,21,24,0.08);font-size:13px;line-height:1.55;color:rgba(42,21,24,0.6);font-family:Helvetica,Arial,sans-serif;">
            ${C.aviso}<br>${C.ajuda}
          </p>

          <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">
            ${C.rodape}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
