// "O VÍDEO DE VOCÊS ESTÁ PRONTO": sai quando o render termina.
//
// Mesma casca do `presente-pronto.ts` (marca em texto, botão cheio vinho).
// O botão leva pro EDITOR pelo token, não pro painel: 84% dos compradores
// nunca entram na conta, e o editor abre sem login nenhum.

type Idioma = "pt" | "es";

const COPY = {
  pt: {
    assunto: (titulo: string) => `O vídeo de "${titulo}" está pronto`,
    titulo: "O vídeo de vocês está pronto",
    texto:
      "As fotos passando no ritmo da música, com a letra acendendo palavra por palavra. Já dá pra assistir, baixar e mandar no WhatsApp ou postar no story.",
    botao: "VER E BAIXAR O VÍDEO",
    guarde: "Este link é seu e não expira. Guarde este e-mail.",
    rodape: "Serenata · uma música feita da história de quem você ama",
  },
  es: {
    assunto: (titulo: string) => `El video de "${titulo}" está listo`,
    titulo: "El video de ustedes está listo",
    texto:
      "Sus fotos pasando al ritmo de la canción, con la letra encendiéndose palabra por palabra. Ya puedes verlo, descargarlo y mandarlo por WhatsApp o subirlo a tu historia.",
    botao: "VER Y DESCARGAR EL VIDEO",
    guarde: "Este link es tuyo y no vence. Guarda este correo.",
    rodape: "Serenata · una canción hecha de la historia de quien amas",
  },
} as const;

export function assuntoVideoPronto(titulo: string, locale: Idioma = "pt"): string {
  return (COPY[locale] ?? COPY.pt).assunto(titulo);
}

export function emailVideoPronto(args: {
  titulo: string;
  linkVideo: string;
  locale?: Idioma;
}): string {
  const C = COPY[args.locale ?? "pt"] ?? COPY.pt;
  return `<!DOCTYPE html>
<html lang="${args.locale === "es" ? "es" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${C.titulo}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <div style="margin:0 auto 16px;font-size:22px;letter-spacing:3px;color:#7d2b3a;">SERENATA</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">${C.titulo}</h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${args.titulo}”</p>
        </td></tr>
        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">${C.texto}</td></tr>
        <tr><td align="center" style="padding:26px 36px 8px;">
          <a href="${args.linkVideo}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:16px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 34px;border-radius:999px;">${C.botao}</a>
        </td></tr>
        <tr><td style="padding:6px 36px 30px;text-align:center;color:rgba(42,21,24,0.45);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">${C.guarde}</td></tr>
      </table>
      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">${C.rodape}</p>
    </td></tr>
  </table>
</body></html>`;
}
