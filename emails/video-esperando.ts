// "SEU VÍDEO ESTÁ ESPERANDO AS FOTOS": o vídeo comprado junto com a música
// (order bump) e ainda não gerado, 24h depois da compra.
//
// Não é oferta, é entrega: ela JÁ PAGOU. Por isso sai pelo remetente
// transacional, e o botão leva direto pro bloco do vídeo no editor. Se ela
// não fizer nada, o `videoPendente` gera sozinho aos 3 dias, e o e-mail avisa
// isso, pra ninguém achar que perdeu o que comprou.

export function assuntoVideoEsperando(nome: string): string {
  return `O vídeo de ${nome} está esperando as fotos`;
}

export function textoVideoEsperando(args: { nome: string; link: string }): string {
  return (
    `O vídeo que você comprou junto com a música de ${args.nome} já está pago e reservado.\n\n` +
    `Ele é feito das fotos de vocês: suba as fotos na página do presente e toque em "Gerar meu vídeo".\n\n` +
    `${args.link}\n\n` +
    `Se você não mexer em nada, a gente gera sozinho em 2 dias com o que estiver na página.`
  );
}

export function emailVideoEsperando(args: { nome: string; titulo: string; link: string }): string {
  const { nome, titulo, link } = args;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${assuntoVideoEsperando(nome)}</title></head>
<body style="margin:0;padding:0;background-color:#f2e9dc;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2e9dc;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#faf5ee;border:1px solid rgba(42,21,24,0.14);border-radius:16px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#7d2b3a,#c9a227);"></td></tr>
        <tr><td style="padding:34px 34px 6px;text-align:center;">
          <div style="margin:0 auto 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#7d2b3a;text-align:center;">SERENATA</div>
          <h1 style="margin:0;color:#2a1518;font-size:25px;font-weight:normal;line-height:1.32;">O vídeo de ${nome} está esperando as fotos.</h1>
          <p style="margin:12px 0 0;color:rgba(42,21,24,0.6);font-size:15px;">“${titulo}”</p>
        </td></tr>
        <tr><td style="padding:22px 36px 4px;color:rgba(42,21,24,0.75);font-size:15px;line-height:1.7;">
          O vídeo que você comprou junto com a música já está pago e reservado. Ele é feito das fotos de vocês: suba as fotos na página do presente, dê o play pra conferir e toque em "Gerar meu vídeo".
        </td></tr>
        <tr><td align="center" style="padding:24px 36px 8px;">
          <a href="${link}" style="display:inline-block;background:#7d2b3a;color:#faf5ee;text-decoration:none;font-size:15px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;padding:16px 30px;border-radius:999px;">
            SUBIR AS FOTOS E GERAR
          </a>
        </td></tr>
        <tr><td style="padding:10px 36px 30px;text-align:center;color:rgba(42,21,24,0.5);font-size:13px;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
          Se você não mexer em nada, a gente gera sozinho em 2 dias com o que estiver na página. Você não perde o que comprou.
        </td></tr>
      </table>
      <p style="margin:18px 0 0;color:rgba(42,21,24,0.4);font-size:11px;font-family:Helvetica,Arial,sans-serif;">Serenata · uma música feita da história de quem você ama</p>
    </td></tr>
  </table>
</body></html>`;
}
